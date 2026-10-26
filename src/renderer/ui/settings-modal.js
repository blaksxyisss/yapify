/**
 * YapinMod Settings Modal Component
 * Renders the integrated desktop settings interface.
 */

import { storage } from '../core/storage.js';
import { logger } from '../core/logger.js';
import { events } from '../core/event-bus.js';
import { pluginManager, PluginStatus } from '../plugins/plugin-manager.js';
import { themeManager } from '../themes/theme-manager.js';

class SettingsModal {
  constructor() {
    this.overlay = null;
    this.activeTab = 'overview';
    this.isOpen = false;
  }

  init() {
    this.buildModal();
    this.bindEvents();
    logger.info('SettingsModal initialized');
  }

  buildModal() {
    if (document.getElementById('ym-settings-overlay')) {
      this.overlay = document.getElementById('ym-settings-overlay');
      return;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'ym-settings-overlay';
    this.overlay.className = 'ym-modal-overlay';

    this.overlay.innerHTML = `
      <div class="ym-modal-container">
        <!-- Header -->
        <div class="ym-modal-header">
          <div class="ym-header-left">
            <span class="ym-logo-badge">Yapify</span>
            <h2 class="ym-header-title">Mod Settings</h2>
          </div>
          <button class="ym-close-btn" id="ym-modal-close" title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="ym-modal-body">
          <!-- Sidebar Navigation -->
          <nav class="ym-modal-nav">
            <button class="ym-nav-item active" data-tab="overview">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Overview</span>
            </button>

            <button class="ym-nav-item" data-tab="plugins">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>Plugins</span>
            </button>

            <button class="ym-nav-item" data-tab="themes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a7 7 0 0 0 0 14h1a2 2 0 0 1 2 2 2 2 0 0 0 4 0 7 7 0 0 0-7-16z"></path>
              </svg>
              <span>Themes & Colors</span>
            </button>

            <button class="ym-nav-item" data-tab="diagnostics">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              <span>Diagnostics</span>
            </button>

            <div class="ym-nav-footer">
              Yapify v1.0.0<br/>client mod for yapin
            </div>
          </nav>

          <!-- Content Panels -->
          <div class="ym-modal-content">
            <!-- 1. Overview Tab -->
            <div class="ym-tab-pane active" id="ym-pane-overview">
              <h3 class="ym-pane-title">Settings</h3>
              <p class="ym-pane-subtitle">General mod settings, shortcuts, and tools.</p>

              <div class="ym-card">
                <h4 class="ym-card-title">Quick Actions</h4>
                <p class="ym-card-desc">Handy shortcuts for common stuff.</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                  <button class="ym-btn secondary" id="ym-btn-devtools">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    Toggle DevTools
                  </button>
                  <button class="ym-btn secondary" id="ym-btn-reload">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    Reload Client
                  </button>
                  <button class="ym-btn secondary" id="ym-btn-open-plugins">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    Plugins Folder
                  </button>
                  <button class="ym-btn secondary" id="ym-btn-open-themes">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    Themes Folder
                  </button>
                </div>
              </div>

              <div class="ym-card">
                <h4 class="ym-card-title">System Settings</h4>
                <div class="ym-setting-row">
                  <div class="ym-setting-info">
                    <span class="ym-setting-title">Safe Mode</span>
                    <span class="ym-setting-desc">Skip loading all plugins on startup. Turn this on if something broke.</span>
                  </div>
                  <div class="ym-setting-control">
                    <label class="ym-switch">
                      <input type="checkbox" id="ym-toggle-safemode" ${storage.get('safeMode', false) ? 'checked' : ''} />
                      <span class="ym-switch-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="ym-setting-row">
                  <div class="ym-setting-info">
                    <span class="ym-setting-title">DevTools Hotkeys</span>
                    <span class="ym-setting-desc">Ctrl+Shift+I and F12 to open devtools.</span>
                  </div>
                  <div class="ym-setting-control">
                    <label class="ym-switch">
                      <input type="checkbox" id="ym-toggle-devtools-hotkey" ${storage.get('devtoolsShortcut', true) ? 'checked' : ''} />
                      <span class="ym-switch-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="ym-setting-row">
                  <div class="ym-setting-info">
                    <span class="ym-setting-title">Debug Logging</span>
                    <span class="ym-setting-desc">Log extra details to %APPDATA%/YapinMod/yapinmod.log for debugging.</span>
                  </div>
                  <div class="ym-setting-control">
                    <label class="ym-switch">
                      <input type="checkbox" id="ym-toggle-logging" ${storage.get('debugLogging', true) ? 'checked' : ''} />
                      <span class="ym-switch-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="ym-card" style="border-color: rgba(242, 85, 90, 0.2);">
                <h4 class="ym-card-title" style="color: var(--danger, #f2555a);">Reset Everything</h4>
                <p class="ym-card-desc">Wipes all Yapify settings back to defaults. Can't undo this.</p>
                <button class="ym-btn danger" id="ym-btn-reset">Reset All Settings</button>
              </div>
            </div>

            <!-- 2. Plugins Tab -->
            <div class="ym-tab-pane" id="ym-pane-plugins">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                  <h3 class="ym-pane-title" style="margin: 0;">Plugins</h3>
                  <p class="ym-pane-subtitle" style="margin: 0;">Turn plugins on or off. No restart needed.</p>
                </div>
                <button class="ym-btn secondary" id="ym-btn-refresh-plugins">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                  Refresh
                </button>
              </div>
              <div id="ym-plugins-list-container">
                <!-- Dynamically populated -->
              </div>
            </div>

            <!-- 3. Themes Tab -->
            <div class="ym-tab-pane" id="ym-pane-themes">
              <h3 class="ym-pane-title">Themes & Colors</h3>
              <p class="ym-pane-subtitle">Change accent colors and load CSS themes.</p>

              <div class="ym-card">
                <h4 class="ym-card-title">Live Accent Color</h4>
                <div id="ym-themes-accent-container">
                  <!-- Plugin A settings rendered here or default controls -->
                </div>
              </div>

              <div class="ym-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <h4 class="ym-card-title" style="margin: 0;">Installed CSS Themes</h4>
                  <button class="ym-btn secondary" id="ym-btn-refresh-themes">Refresh Themes</button>
                </div>
                <div id="ym-themes-list-container">
                  <!-- Dynamically populated -->
                </div>
              </div>
            </div>

            <!-- 4. Diagnostics Tab -->
            <div class="ym-tab-pane" id="ym-pane-diagnostics">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div>
                  <h3 class="ym-pane-title" style="margin: 0;">Logs</h3>
                  <p class="ym-pane-subtitle" style="margin: 0;">See what's happening under the hood.</p>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="ym-btn secondary" id="ym-btn-copy-logs">Copy Logs</button>
                  <button class="ym-btn secondary" id="ym-btn-clear-logs">Clear</button>
                </div>
              </div>
              <div class="ym-log-terminal" id="ym-log-terminal">
                Loading logs...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
  }

  bindEvents() {
    // Close button
    this.overlay.querySelector('#ym-modal-close')?.addEventListener('click', () => this.close());

    // Click outside modal
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Tab navigation
    const navItems = this.overlay.querySelectorAll('.ym-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Quick Actions
    this.overlay.querySelector('#ym-btn-devtools')?.addEventListener('click', () => {
      window.yapinmodBridge?.invoke?.('yapinmod:toggle-devtools');
    });

    this.overlay.querySelector('#ym-btn-reload')?.addEventListener('click', () => {
      window.yapinmodBridge?.invoke?.('yapinmod:reload-renderer');
    });

    this.overlay.querySelector('#ym-btn-open-plugins')?.addEventListener('click', () => {
      window.yapinmodBridge?.invoke?.('yapinmod:open-folder', 'plugins');
    });

    this.overlay.querySelector('#ym-btn-open-themes')?.addEventListener('click', () => {
      window.yapinmodBridge?.invoke?.('yapinmod:open-folder', 'themes');
    });

    // System Settings toggles
    this.overlay.querySelector('#ym-toggle-safemode')?.addEventListener('change', async (e) => {
      await storage.set('safeMode', e.target.checked);
      events.emit('toast', `Safe Mode ${e.target.checked ? 'ENABLED' : 'DISABLED'}`, 'info');
    });

    this.overlay.querySelector('#ym-toggle-devtools-hotkey')?.addEventListener('change', async (e) => {
      await storage.set('devtoolsShortcut', e.target.checked);
    });

    this.overlay.querySelector('#ym-toggle-logging')?.addEventListener('change', async (e) => {
      await storage.set('debugLogging', e.target.checked);
    });

    this.overlay.querySelector('#ym-btn-reset')?.addEventListener('click', async () => {
      if (confirm('Reset all Yapify settings to defaults? This can\'t be undone.')) {
        await storage.resetToDefaults();
        events.emit('toast', 'Settings reset', 'success');
        this.renderPluginsList();
        this.renderThemesList();
      }
    });

    // Refresh buttons
    this.overlay.querySelector('#ym-btn-refresh-plugins')?.addEventListener('click', () => {
      this.renderPluginsList();
      events.emit('toast', 'Plugins list refreshed', 'info');
    });

    this.overlay.querySelector('#ym-btn-refresh-themes')?.addEventListener('click', () => {
      this.renderThemesList();
      events.emit('toast', 'Themes list refreshed', 'info');
    });

    // Logs buttons
    this.overlay.querySelector('#ym-btn-copy-logs')?.addEventListener('click', () => {
      const terminal = this.overlay.querySelector('#ym-log-terminal');
      if (terminal) {
        navigator.clipboard.writeText(terminal.textContent);
        events.emit('toast', 'Diagnostic logs copied to clipboard', 'success');
      }
    });

    this.overlay.querySelector('#ym-btn-clear-logs')?.addEventListener('click', () => {
      logger.clear();
      const terminal = this.overlay.querySelector('#ym-log-terminal');
      if (terminal) terminal.textContent = 'Logs cleared.';
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    this.overlay.querySelectorAll('.ym-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    this.overlay.querySelectorAll('.ym-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `ym-pane-${tabId}`);
    });

    if (tabId === 'plugins') this.renderPluginsList();
    if (tabId === 'themes') this.renderThemesList();
    if (tabId === 'diagnostics') this.renderLogs();
  }

  renderPluginsList() {
    const container = this.overlay.querySelector('#ym-plugins-list-container');
    if (!container) return;

    const plugins = pluginManager.getAllPlugins();
    if (plugins.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          No plugins found. Click "Plugins Folder" to add custom plugins.
        </div>
      `;
      return;
    }

    container.innerHTML = plugins.map(p => {
      const statusClass = p.status === PluginStatus.ACTIVE ? 'status-active' : p.status === PluginStatus.ERROR ? 'status-error' : '';
      return `
        <div class="ym-plugin-card ${p.enabled ? 'active' : ''}" id="ym-pcard-${p.id}">
          <div class="ym-plugin-card-header">
            <div class="ym-plugin-title-wrap">
              <span class="ym-plugin-title">${p.name}</span>
              <span class="ym-plugin-chip">v${p.version}</span>
              <span class="ym-plugin-chip ${statusClass}">${p.status}</span>
            </div>
            <label class="ym-switch">
              <input type="checkbox" class="ym-plugin-toggle" data-id="${p.id}" ${p.enabled ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
          <p class="ym-plugin-desc">${p.description}</p>
          <div class="ym-plugin-author">By ${p.author}</div>
          ${p.error ? `<div style="color: var(--danger, #f2555a); font-size: 12px; margin-top: 8px;">Error: ${p.error}</div>` : ''}
          ${p.hasSettings ? `<div class="ym-plugin-settings-toggle" id="ym-psettings-${p.id}"></div>` : ''}
        </div>
      `;
    }).join('');

    // Attach toggle switches and settings panels
    plugins.forEach(p => {
      const toggle = container.querySelector(`.ym-plugin-toggle[data-id="${p.id}"]`);
      toggle?.addEventListener('change', async (e) => {
        await pluginManager.togglePlugin(p.id, e.target.checked);
        this.renderPluginsList();
      });

      if (p.hasSettings) {
        const settingsContainer = container.querySelector(`#ym-psettings-${p.id}`);
        const pluginInstance = pluginManager.getPlugin(p.id)?.instance;
        if (settingsContainer && pluginInstance?.renderSettings) {
          const api = pluginManager.createPluginApi(pluginManager.getPlugin(p.id));
          pluginInstance.renderSettings(api, settingsContainer);
        }
      }
    });
  }

  async renderThemesList() {
    const listContainer = this.overlay.querySelector('#ym-themes-list-container');
    const accentContainer = this.overlay.querySelector('#ym-themes-accent-container');

    // Render Accent plugin inside Themes tab
    const accentPlugin = pluginManager.getPlugin('custom-accent');
    if (accentPlugin?.instance?.renderSettings && accentContainer) {
      const api = pluginManager.createPluginApi(accentPlugin);
      accentPlugin.instance.renderSettings(api, accentContainer);
    }

    if (!listContainer) return;

    const themes = await themeManager.getThemes();
    const activeTheme = storage.get('activeTheme', null);

    let html = `
      <div class="ym-setting-row" style="padding-top: 0;">
        <div class="ym-setting-info">
          <span class="ym-setting-title">Yapin Default Theme</span>
          <span class="ym-setting-desc">Original clean dark theme styling.</span>
        </div>
        <button class="ym-btn ${!activeTheme ? 'active' : 'secondary'}" id="ym-theme-default-btn">
          ${!activeTheme ? 'Active' : 'Apply'}
        </button>
      </div>
    `;

    if (themes.length === 0) {
      html += `
        <div style="padding: 16px 0; color: var(--text-muted); font-size: 13px;">
          No external .css themes found in %APPDATA%/YapinMod/themes. Place any CSS file there to apply it!
        </div>
      `;
    } else {
      themes.forEach(t => {
        const isActive = activeTheme === t.filename;
        html += `
          <div class="ym-setting-row">
            <div class="ym-setting-info">
              <span class="ym-setting-title">${t.name}</span>
              <span class="ym-setting-desc">File: ${t.filename}</span>
            </div>
            <button class="ym-btn ${isActive ? 'active' : 'secondary'} ym-theme-apply-btn" data-file="${t.filename}">
              ${isActive ? 'Active' : 'Apply'}
            </button>
          </div>
        `;
      });
    }

    listContainer.innerHTML = html;

    listContainer.querySelector('#ym-theme-default-btn')?.addEventListener('click', async () => {
      await themeManager.applyTheme(null, true);
      this.renderThemesList();
      events.emit('toast', 'Reverted to default Yapin theme', 'info');
    });

    listContainer.querySelectorAll('.ym-theme-apply-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.getAttribute('data-file');
        await themeManager.applyTheme(filename, true);
        this.renderThemesList();
        events.emit('toast', `Applied theme: ${filename}`, 'success');
      });
    });
  }

  async renderLogs() {
    const terminal = this.overlay.querySelector('#ym-log-terminal');
    if (!terminal) return;

    if (window.yapinmodBridge?.invoke) {
      const logs = await window.yapinmodBridge.invoke('yapinmod:get-logs');
      terminal.textContent = logs || 'No logs recorded yet.';
      terminal.scrollTop = terminal.scrollHeight;
    } else {
      const logs = logger.getRecentLogs().map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
      terminal.textContent = logs || 'No logs recorded yet.';
      terminal.scrollTop = terminal.scrollHeight;
    }
  }

  open(tab = 'overview') {
    if (!this.overlay) this.buildModal();
    this.switchTab(tab);
    this.overlay.classList.add('open');
    this.isOpen = true;
  }

  close() {
    if (!this.overlay) return;
    this.overlay.classList.remove('open');
    this.isOpen = false;
  }

  toggle(tab = 'overview') {
    if (this.isOpen) this.close();
    else this.open(tab);
  }
}

export const settingsModal = new SettingsModal();
