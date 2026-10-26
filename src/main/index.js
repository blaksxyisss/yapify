/**
 * Yapify - Main Process Hook & Bridge
 * Handles IPC channels, configuration persistence, plugin/theme loading,
 * DevTools toggling, diagnostic logging, and renderer script injection.
 */

const { ipcMain, shell, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Determine YapinMod storage directory in %APPDATA%/YapinMod
const APPDATA_DIR = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Preferences') : path.join(process.env.HOME, '.config'));
const YAPINMOD_DIR = path.join(APPDATA_DIR, 'YapinMod');
const PLUGINS_DIR = path.join(YAPINMOD_DIR, 'plugins');
const THEMES_DIR = path.join(YAPINMOD_DIR, 'themes');
const CONFIG_PATH = path.join(YAPINMOD_DIR, 'config.json');
const LOG_PATH = path.join(YAPINMOD_DIR, 'yapinmod.log');

// Default YapinMod configuration
const DEFAULT_CONFIG = {
  version: '1.0.0',
  safeMode: false,
  debugLogging: true,
  devtoolsShortcut: true,
  accentColor: null, // Custom accent color override (e.g. '#5865f2')
  activeTheme: null, // Active CSS theme filename (or null for default)
  enabledPlugins: {
    'custom-accent': true,
    'ui-tweaks': true,
    'qol-features': true,
    'autoscroll': true,
    'window-mods': true,
    'no-pings': false
  },
  pluginSettings: {
    'ui-tweaks': {
      compactRail: false,
      smoothScroll: true,
      customRadius: 10,
      modernScrollbar: true
    },
    'qol-features': {
      charCounter: true,
      quickDevToolsButton: true,
      quickMuteBadge: true
    },
    'autoscroll': {
      autoScrollDefault: true
    },
    'window-mods': {
      borderlessFullscreen: false,
      macButtons: true,
      macButtonsPosition: 'left'
    },
    'no-pings': {
      active: true,
      muteSounds: true,
      suppressDesktopNotifs: true,
      hideBadges: true,
      suppressTaskbarBadge: true
    }
  }
};

let currentConfig = { ...DEFAULT_CONFIG };

/**
 * Diagnostic logger
 */
function log(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`;
  try {
    if (!fs.existsSync(YAPINMOD_DIR)) fs.mkdirSync(YAPINMOD_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, entry, 'utf8');
  } catch (err) {
    // fallback to console
  }
  if (currentConfig.debugLogging || level === 'error' || level === 'warn') {
    console.log(`[Yapify] [${level}] ${message}`, meta || '');
  }
}

/**
 * Initialize directories and load configuration
 */
function initStorage() {
  try {
    if (!fs.existsSync(YAPINMOD_DIR)) fs.mkdirSync(YAPINMOD_DIR, { recursive: true });
    if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    if (!fs.existsSync(THEMES_DIR)) fs.mkdirSync(THEMES_DIR, { recursive: true });

    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...data,
        enabledPlugins: { ...DEFAULT_CONFIG.enabledPlugins, ...(data.enabledPlugins || {}) },
        pluginSettings: { ...DEFAULT_CONFIG.pluginSettings, ...(data.pluginSettings || {}) }
      };
      log('info', 'Loaded existing configuration from disk');
    } else {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      log('info', 'Initialized default configuration file');
    }
  } catch (err) {
    log('error', 'Failed to initialize storage: ' + err.message);
  }
}

function saveConfig(patch) {
  try {
    currentConfig = { ...currentConfig, ...patch };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf8');
    log('info', 'Configuration saved to disk');
    return { success: true, config: currentConfig };
  } catch (err) {
    log('error', 'Failed to save configuration: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Read all available plugins from %APPDATA%/YapinMod/plugins
 * Each plugin can be:
 * 1. A directory containing `manifest.json` and `index.js`
 * 2. A single `.js` file with exported metadata
 */
function listPlugins() {
  const plugins = [];
  try {
    if (!fs.existsSync(PLUGINS_DIR)) return plugins;

    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(PLUGINS_DIR, entry.name);

      if (entry.isDirectory()) {
        const manifestPath = path.join(fullPath, 'manifest.json');
        const indexPath = path.join(fullPath, 'index.js');

        if (fs.existsSync(manifestPath) && fs.existsSync(indexPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (!manifest.id) manifest.id = entry.name;
            plugins.push({
              id: manifest.id,
              name: manifest.name || manifest.id,
              version: manifest.version || '1.0.0',
              description: manifest.description || '',
              author: manifest.author || 'Unknown',
              entryFile: indexPath,
              enabled: !!currentConfig.enabledPlugins[manifest.id],
              settings: currentConfig.pluginSettings[manifest.id] || {}
            });
          } catch (e) {
            log('warn', `Invalid manifest in plugin folder ${entry.name}: ${e.message}`);
          }
        }
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const id = path.basename(entry.name, '.js');
        plugins.push({
          id,
          name: id,
          version: '1.0.0',
          description: 'Single-file plugin',
          author: 'Unknown',
          entryFile: fullPath,
          enabled: !!currentConfig.enabledPlugins[id],
          settings: currentConfig.pluginSettings[id] || {}
        });
      }
    }
  } catch (err) {
    log('error', 'Failed to scan plugins: ' + err.message);
  }
  return plugins;
}

/**
 * Read all themes (.css files) in %APPDATA%/YapinMod/themes
 */
function listThemes() {
  const themes = [];
  try {
    if (!fs.existsSync(THEMES_DIR)) return themes;
    const files = fs.readdirSync(THEMES_DIR);
    for (const f of files) {
      if (f.endsWith('.css')) {
        const id = path.basename(f, '.css');
        themes.push({
          id,
          name: id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          filename: f,
          path: path.join(THEMES_DIR, f),
          active: currentConfig.activeTheme === f
        });
      }
    }
  } catch (err) {
    log('error', 'Failed to scan themes: ' + err.message);
  }
  return themes;
}

/**
 * Register all IPC handlers exposed to the renderer
 */
function registerIpcHandlers() {
  ipcMain.handle('yapinmod:get-config', () => currentConfig);

  ipcMain.handle('yapinmod:save-config', (_e, patch) => {
    return saveConfig(patch);
  });

  ipcMain.handle('yapinmod:list-plugins', () => listPlugins());

  ipcMain.handle('yapinmod:load-plugin-code', (_e, pluginId) => {
    try {
      const plugins = listPlugins();
      const p = plugins.find(x => x.id === pluginId);
      if (!p || !fs.existsSync(p.entryFile)) {
        return { success: false, error: 'Plugin entry file not found' };
      }
      const code = fs.readFileSync(p.entryFile, 'utf8');
      return { success: true, code, manifest: p };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('yapinmod:list-themes', () => listThemes());

  ipcMain.handle('yapinmod:get-theme-css', (_e, filename) => {
    try {
      if (!filename) return { success: true, css: '' };
      const safeFilename = path.basename(filename);
      const themePath = path.join(THEMES_DIR, safeFilename);
      if (fs.existsSync(themePath)) {
        return { success: true, css: fs.readFileSync(themePath, 'utf8') };
      }
      return { success: false, error: 'Theme file not found' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('yapinmod:open-folder', (_e, folderType) => {
    const target = folderType === 'themes' ? THEMES_DIR : folderType === 'plugins' ? PLUGINS_DIR : YAPINMOD_DIR;
    shell.openPath(target);
    return true;
  });

  ipcMain.handle('yapinmod:get-logs', () => {
    try {
      if (fs.existsSync(LOG_PATH)) {
        const text = fs.readFileSync(LOG_PATH, 'utf8');
        const lines = text.trim().split(/\r?\n/).slice(-200);
        return lines.join('\n');
      }
      return 'No logs recorded yet.';
    } catch (err) {
      return 'Failed to read logs: ' + err.message;
    }
  });

  ipcMain.handle('yapinmod:toggle-devtools', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) {
      win.webContents.toggleDevTools();
      return true;
    }
    return false;
  });

  ipcMain.handle('yapinmod:reload-renderer', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) {
      win.webContents.reload();
      return true;
    }
    return false;
  });

  ipcMain.handle('yapinmod:window-action', (e, action, value) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return { success: false, error: 'No window found' };

    switch (action) {
      case 'close':
        win.close();
        return { success: true };
      case 'minimize':
        win.minimize();
        return { success: true };
      case 'maximize':
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
        return { success: true, isMaximized: win.isMaximized() };
      case 'toggle-fullscreen':
        const nextFs = !win.isFullScreen();
        win.setFullScreen(nextFs);
        log('info', `Toggled borderless fullscreen: ${nextFs}`);
        return { success: true, isFullScreen: nextFs };
      case 'set-fullscreen':
        win.setFullScreen(!!value);
        log('info', `Set borderless fullscreen: ${!!value}`);
        return { success: true, isFullScreen: !!value };
      case 'is-fullscreen':
        return { success: true, isFullScreen: win.isFullScreen() };
      case 'is-maximized':
        return { success: true, isMaximized: win.isMaximized() };
      default:
        return { success: false, error: 'Unknown window action' };
    }
  });

  ipcMain.handle('yapinmod:set-window-mode', (e, mode) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return { success: false, error: 'No window found' };

    switch (mode) {
      case 'fullscreen':
        win.setFullScreen(true);
        log('info', 'Window mode set to Fullscreen');
        return { success: true, mode: 'fullscreen' };

      case 'borderless_windowed':
        if (win.isFullScreen()) {
          win.setFullScreen(false);
        }
        win.maximize();
        log('info', 'Window mode set to Borderless Windowed');
        return { success: true, mode: 'borderless_windowed' };

      case 'windowed':
      default:
        if (win.isFullScreen()) {
          win.setFullScreen(false);
        }
        if (win.isMaximized()) {
          win.unmaximize();
        }
        win.setSize(1200, 800);
        win.center();
        log('info', 'Window mode set to Windowed');
        return { success: true, mode: 'windowed' };
    }
  });

  ipcMain.handle('yapinmod:get-window-mode', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return { mode: 'windowed' };

    if (win.isFullScreen()) return { mode: 'fullscreen' };
    if (win.isMaximized()) return { mode: 'borderless_windowed' };
    return { mode: 'windowed' };
  });

  ipcMain.on('yapinmod:log', (_e, level, msg, meta) => {
    log(level || 'info', `[Renderer] ${msg}`, meta);
  });
}

/**
 * Hook into a BrowserWindow instance:
 * 1. Enables DevTools shortcuts (Ctrl+Shift+I / F12) and Reload (Ctrl+R / F5)
 * 2. Injects YapinMod renderer bundle and active theme CSS on DOM ready
 */
function hookWindow(win, rendererBundleCode) {
  if (!win || win.isDestroyed()) return;

  // Apply initial saved window mode (e.g. borderless_windowed maximizes frameless window)
  try {
    const wmSettings = currentConfig.pluginSettings?.['window-mods'] || {};
    const mode = wmSettings.windowMode || 'borderless_windowed';
    if (mode === 'borderless_windowed') {
      win.maximize();
      log('info', 'Applied initial window mode: borderless_windowed (maximized frameless)');
    } else if (mode === 'fullscreen') {
      win.setFullScreen(true);
      log('info', 'Applied initial window mode: fullscreen');
    }
  } catch (err) {
    log('warn', 'Failed to apply initial window mode: ' + err.message);
  }

  const wc = win.webContents;

  // Add developer keybindings to before-input-event
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;

    // F11 toggles borderless fullscreen
    if (input.key === 'F11') {
      e.preventDefault();
      const fs = !win.isFullScreen();
      win.setFullScreen(fs);
      log('info', `Borderless Fullscreen toggled via F11 shortcut: ${fs}`);
      return;
    }

    // F12 or Ctrl+Shift+I toggles DevTools
    if (input.key === 'F12' || ((input.control || input.meta) && input.shift && (input.key === 'I' || input.key === 'i'))) {
      e.preventDefault();
      wc.toggleDevTools();
      log('info', 'DevTools toggled via shortcut');
      return;
    }

    // Ctrl+R or F5 reloads window
    if (input.key === 'F5' || ((input.control || input.meta) && !input.shift && (input.key === 'R' || input.key === 'r'))) {
      e.preventDefault();
      wc.reload();
      log('info', 'Window reloaded via shortcut');
      return;
    }

    // Alt+Y toggles YapinMod settings
    if (input.alt && (input.key === 'y' || input.key === 'Y')) {
      e.preventDefault();
      wc.send('yapinmod:toggle-settings');
      return;
    }
  });

  // Inject bundle on DOM ready
  wc.on('dom-ready', async () => {
    try {
      const url = wc.getURL();
      // Only inject on Yapin / Yapper web application pages (not data: error screens)
      if (url.startsWith('data:') || !url.includes('yap')) return;

      log('info', `DOM ready on ${url}. Injecting Yapify renderer bundle...`);

      // 1. Inject active theme CSS if specified
      if (currentConfig.activeTheme) {
        const themePath = path.join(THEMES_DIR, path.basename(currentConfig.activeTheme));
        if (fs.existsSync(themePath)) {
          const css = fs.readFileSync(themePath, 'utf8');
          await wc.insertCSS(css);
          log('info', `Applied active theme: ${currentConfig.activeTheme}`);
        }
      }

      // 2. Inject renderer bundle code
      if (rendererBundleCode) {
        await wc.executeJavaScript(rendererBundleCode);
        log('info', 'Yapify renderer bundle executed successfully');
      }
    } catch (err) {
      log('error', `Failed to inject Yapify renderer: ${err.message}\n${err.stack}`);
    }
  });
}

/**
 * Main initialization entry point called when Electron boots
 */
function initialize(rendererBundleCode) {
  log('info', '================================================');
  log('info', `Yapify v${DEFAULT_CONFIG.version} initializing in Main Process`);
  log('info', `Process ID: ${process.pid}, Electron: ${process.versions.electron}, Node: ${process.versions.node}`);
  log('info', '================================================');

  initStorage();
  registerIpcHandlers();

  // Watch for any BrowserWindow created in the application
  const electron = require('electron');

  // Intercept BrowserWindow construction to ensure frameless window (removes native OS titlebar)
  try {
    const OrigBW = electron.BrowserWindow;
    if (OrigBW && !OrigBW.__yfPatched) {
      const PatchedBW = function(options) {
        const opts = Object.assign({}, options, {
          frame: false,
          autoHideMenuBar: true
        });
        return new OrigBW(opts);
      };
      PatchedBW.prototype = OrigBW.prototype;
      Object.assign(PatchedBW, OrigBW);
      PatchedBW.__yfPatched = true;
      electron.BrowserWindow = PatchedBW;
    }
  } catch (err) {
    log('warn', 'Failed to proxy BrowserWindow: ' + err.message);
  }

  electron.app.on('browser-window-created', (_e, win) => {
    log('info', 'BrowserWindow created, attaching Yapify window hooks');
    hookWindow(win, rendererBundleCode);
  });
}

module.exports = {
  initialize,
  hookWindow,
  log,
  currentConfig,
  listPlugins,
  listThemes,
  saveConfig,
  YAPINMOD_DIR,
  PLUGINS_DIR,
  THEMES_DIR,
  CONFIG_PATH,
  LOG_PATH
};
