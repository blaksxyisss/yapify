/**
 * Yapify Settings Panel
 * Renders settings content inline in Yapin's main content area
 * when a Yapify sidebar tab is clicked.
 */

import { storage } from '../core/storage.js';
import { logger } from '../core/logger.js';
import { events } from '../core/event-bus.js';
import { pluginManager, PluginStatus } from '../plugins/plugin-manager.js';
import { themeManager } from '../themes/theme-manager.js';

class SettingsPanel {
  constructor() {
    this.activeTab = null;
    this.contentContainer = null;
    this.settingsNav = null;
    this.nativeListenersAttached = false;
  }

  init(settingsNav) {
    this.settingsNav = settingsNav;
    // Reset state so listeners get re-attached to the fresh DOM
    this.nativeListenersAttached = false;
    this.activeTab = null;
    logger.info('SettingsPanel initialized');
  }

  /**
   * Find the main content area and replace it with our Yapify panel content.
   */
  show(tabId, settingsNav) {
    this.activeTab = tabId;
    if (settingsNav) this.settingsNav = settingsNav;

    // Find the settings content area — the right side panel
    const contentArea = this.findContentArea();
    if (!contentArea) {
      logger.warn('Could not find settings content area');
      return;
    }

    // Create or reuse our container
    let panel = document.getElementById('yf-content-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'yf-content-panel';
      panel.className = 'yf-content-panel';
    }

    // Hide all native content children and show our panel
    for (const child of contentArea.children) {
      if (child.id !== 'yf-content-panel') {
        child.style.display = 'none';
        child.dataset.yfHidden = 'true';
      }
    }

    contentArea.dataset.yfPatched = 'true';

    // Render the active tab content
    panel.innerHTML = '';
    panel.appendChild(this.renderTab(tabId));

    if (!panel.parentElement) {
      contentArea.appendChild(panel);
    }

    // Listen for native tab clicks to restore original content
    this.watchForNativeTabClick(contentArea);
  }

  /**
   * Restore the original content when a native Yapin tab is clicked
   */
  watchForNativeTabClick(contentArea) {
    if (this.nativeListenersAttached) return;
    this.nativeListenersAttached = true;

    const nav = this.settingsNav;
    if (!nav) return;

    nav.querySelectorAll('a, button, [role="tab"]').forEach(item => {
      if (item.dataset?.yfTab !== undefined) return;
      if (item.id?.startsWith('yf-')) return;

      item.addEventListener('click', () => {
        // Deactivate our tabs
        document.querySelectorAll('.yf-settings-tab').forEach(t => t.classList.remove('active'));
        // Restore native content
        this.hide(contentArea);
        // Reset opacity on all native items
        nav.querySelectorAll('a, button, [role="tab"]').forEach(el => {
          if (!el.dataset?.yfTab && !el.id?.startsWith('yf-')) {
            el.style.opacity = '';
          }
        });
      });
    });
  }

  /**
   * Hide the Yapify panel and restore original content
   */
  hide(contentArea) {
    if (!contentArea) return;
    const panel = document.getElementById('yf-content-panel');
    if (panel) panel.remove();

    // Restore hidden native children
    for (const child of contentArea.children) {
      if (child.dataset?.yfHidden === 'true') {
        child.style.display = '';
        delete child.dataset.yfHidden;
      }
    }
    delete contentArea.dataset.yfPatched;
    this.activeTab = null;
  }

  /**
   * Find the main content area of the settings page.
   * Uses the settingsNav reference to find its content sibling.
   */
  findContentArea() {
    // If we have a direct reference to the nav, find the content sibling
    if (this.settingsNav) {
      const parent = this.settingsNav.parentElement;
      if (parent) {
        for (const sibling of parent.children) {
          if (sibling === this.settingsNav) continue;
          if (sibling.id === 'yf-content-panel') continue;
          // Skip tiny elements — we want the big content panel
          const rect = sibling.getBoundingClientRect();
          if (rect.width > 200 && rect.height > 200) {
            return sibling;
          }
        }
        // If nav's parent only has the nav, go one level up
        const grandparent = parent.parentElement;
        if (grandparent) {
          for (const uncle of grandparent.children) {
            if (uncle === parent) continue;
            if (uncle.id === 'yf-content-panel') continue;
            const rect = uncle.getBoundingClientRect();
            if (rect.width > 200 && rect.height > 200) {
              return uncle;
            }
          }
        }
      }
    }

    // Fallback: search for settings nav by text matching
    const settingsTabNames = [
      'my profile', 'my account', 'appearance', 'voice', 'audio',
      'keybinds', 'desktop', 'advanced', 'developer', 'subscription',
      'shards', 'yapin'
    ];

    const candidates = document.querySelectorAll(
      'nav, aside, [role="tablist"], [role="navigation"], [class*="sidebar"], [class*="nav"], [class*="settings"], [class*="menu"]'
    );

    for (const container of candidates) {
      const text = container.textContent?.toLowerCase() || '';
      const matchCount = settingsTabNames.filter(name => text.includes(name)).length;
      if (matchCount >= 3) {
        const rect = container.getBoundingClientRect();
        // Only consider narrow containers (actual sidebar, not whole page)
        if (rect.width > 300) continue;

        const parent = container.parentElement;
        if (parent) {
          for (const sibling of parent.children) {
            if (sibling !== container && sibling.id !== 'yf-content-panel') {
              const sRect = sibling.getBoundingClientRect();
              if (sRect.width > 200 && sRect.height > 200) {
                return sibling;
              }
            }
          }
          return parent;
        }
      }
    }

    return null;
  }

  /**
   * Render the content for a specific tab
   */
  renderTab(tabId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'yf-panel-wrapper';

    switch (tabId) {
      case 'plugins':
        wrapper.appendChild(this.renderPluginsTab());
        break;
      case 'themes':
        wrapper.appendChild(this.renderThemesTab());
        break;
      case 'settings':
        wrapper.appendChild(this.renderSettingsTab());
        break;
      case 'diagnostics':
        wrapper.appendChild(this.renderDiagnosticsTab());
        break;
      default:
        wrapper.textContent = 'Unknown tab';
    }

    return wrapper;
  }

  // ============================================================
  //  PLUGINS TAB
  // ============================================================
  renderPluginsTab() {
    const frag = document.createDocumentFragment();

    // Header
    const header = document.createElement('div');
    header.className = 'yf-section-header';
    header.innerHTML = `
      <div>
        <h2 class="yf-title">Plugins</h2>
        <p class="yf-subtitle">Turn plugins on or off. No restart needed.</p>
      </div>
      <button class="yf-btn secondary" id="yf-btn-refresh-plugins">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        Refresh
      </button>
    `;
    frag.appendChild(header);

    const listContainer = document.createElement('div');
    listContainer.id = 'yf-plugins-list';
    frag.appendChild(listContainer);

    this.populatePluginsList(listContainer);

    // Bind refresh
    setTimeout(() => {
      document.getElementById('yf-btn-refresh-plugins')?.addEventListener('click', () => {
        const container = document.getElementById('yf-plugins-list');
        if (container) this.populatePluginsList(container);
        events.emit('toast', 'Plugins list refreshed', 'info');
      });
    }, 0);

    return frag;
  }

  populatePluginsList(container) {
    const plugins = pluginManager.getAllPlugins();
    if (plugins.length === 0) {
      container.innerHTML = `
        <div class="yf-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <p>No plugins installed yet.</p>
          <button class="yf-btn secondary" id="yf-btn-open-plugins-folder">Open Plugins Folder</button>
        </div>
      `;
      container.querySelector('#yf-btn-open-plugins-folder')?.addEventListener('click', () => {
        window.yapinmodBridge?.invoke?.('yapinmod:open-folder', 'plugins');
      });
      return;
    }

    container.innerHTML = plugins.map(p => {
      const statusClass = p.status === PluginStatus.ACTIVE ? 'status-active' : p.status === PluginStatus.ERROR ? 'status-error' : '';
      return `
        <div class="yf-plugin-card ${p.enabled ? 'enabled' : ''}" id="yf-pcard-${p.id}">
          <div class="yf-plugin-header">
            <div class="yf-plugin-info">
              <span class="yf-plugin-name">${p.name}</span>
            </div>
            <label class="yf-switch">
              <input type="checkbox" class="yf-plugin-toggle" data-id="${p.id}" ${p.enabled ? 'checked' : ''} />
              <span class="yf-switch-track"></span>
            </label>
          </div>
          <p class="yf-plugin-desc">${p.description}</p>
          <div class="yf-plugin-author">by ${p.author}</div>
          ${p.error ? `<div class="yf-plugin-error">⚠ ${p.error}</div>` : ''}
          ${p.hasSettings ? `<div class="yf-plugin-settings" id="yf-psettings-${p.id}"></div>` : ''}
        </div>
      `;
    }).join('');

    // Bind toggles and settings
    plugins.forEach(p => {
      const toggle = container.querySelector(`.yf-plugin-toggle[data-id="${p.id}"]`);
      toggle?.addEventListener('change', async (e) => {
        await pluginManager.togglePlugin(p.id, e.target.checked);
        this.populatePluginsList(container);
      });

      if (p.hasSettings) {
        const settingsContainer = container.querySelector(`#yf-psettings-${p.id}`);
        const pluginEntry = pluginManager.getPlugin(p.id);
        if (settingsContainer && pluginEntry?.instance?.renderSettings) {
          const api = pluginManager.createPluginApi(pluginEntry);
          pluginEntry.instance.renderSettings(api, settingsContainer);
        }
      }
    });
  }

  // ============================================================
  //  THEMES TAB
  // ============================================================
  renderThemesTab() {
    const frag = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'yf-section-header';
    header.innerHTML = `
      <div>
        <h2 class="yf-title">Themes & Colors</h2>
        <p class="yf-subtitle">Change accent colors and load CSS themes.</p>
      </div>
    `;
    frag.appendChild(header);

    // Accent color section
    const accentCard = document.createElement('div');
    accentCard.className = 'yf-card';
    accentCard.innerHTML = `<h3 class="yf-card-title">Accent Color</h3>`;
    const accentContent = document.createElement('div');
    accentContent.id = 'yf-accent-content';
    accentCard.appendChild(accentContent);
    frag.appendChild(accentCard);

    // Render accent plugin settings
    const accentPlugin = pluginManager.getPlugin('custom-accent');
    if (accentPlugin?.instance?.renderSettings) {
      const api = pluginManager.createPluginApi(accentPlugin);
      accentPlugin.instance.renderSettings(api, accentContent);
    }

    // Themes list section
    const themesCard = document.createElement('div');
    themesCard.className = 'yf-card';
    themesCard.innerHTML = `
      <div class="yf-section-header" style="margin-bottom: 12px;">
        <h3 class="yf-card-title" style="margin: 0;">CSS Themes</h3>
        <button class="yf-btn secondary" id="yf-btn-refresh-themes">Refresh</button>
      </div>
    `;
    const themesContent = document.createElement('div');
    themesContent.id = 'yf-themes-list';
    themesCard.appendChild(themesContent);
    frag.appendChild(themesCard);

    this.populateThemesList(themesContent);

    setTimeout(() => {
      document.getElementById('yf-btn-refresh-themes')?.addEventListener('click', () => {
        const container = document.getElementById('yf-themes-list');
        if (container) this.populateThemesList(container);
        events.emit('toast', 'Themes list refreshed', 'info');
      });
    }, 0);

    return frag;
  }

  async populateThemesList(container) {
    const themes = await themeManager.getThemes();
    const activeTheme = storage.get('activeTheme', null);

    let html = `
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Yapin Default Theme</span>
          <span class="yf-setting-hint">The stock yapin look.</span>
        </div>
        <button class="yf-btn ${!activeTheme ? 'active' : 'secondary'}" id="yf-theme-default-btn">
          ${!activeTheme ? 'Applied' : 'Apply'}
        </button>
      </div>
    `;

    if (themes.length === 0) {
      html += `
        <div class="yf-empty-hint">
          No custom themes found. Drop <code>.css</code> files in <code>%APPDATA%/YapinMod/themes</code> and they'll show up here.
        </div>
      `;
    } else {
      themes.forEach(t => {
        const isActive = activeTheme === t.filename;
        html += `
          <div class="yf-setting-row">
            <div class="yf-setting-info">
              <span class="yf-setting-label">${t.name}</span>
              <span class="yf-setting-hint">${t.filename}</span>
            </div>
            <button class="yf-btn ${isActive ? 'active' : 'secondary'} yf-theme-apply" data-file="${t.filename}">
              ${isActive ? 'Applied' : 'Apply'}
            </button>
          </div>
        `;
      });
    }

    container.innerHTML = html;

    container.querySelector('#yf-theme-default-btn')?.addEventListener('click', async () => {
      await themeManager.applyTheme(null, true);
      this.populateThemesList(container);
      events.emit('toast', 'Reverted to default Yapin theme', 'info');
    });

    container.querySelectorAll('.yf-theme-apply').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.getAttribute('data-file');
        await themeManager.applyTheme(filename, true);
        this.populateThemesList(container);
        events.emit('toast', `Applied theme: ${filename}`, 'success');
      });
    });
  }

  // ============================================================
  //  SETTINGS TAB (System Settings)
  // ============================================================
  renderSettingsTab() {
    const frag = document.createDocumentFragment();

    const header = document.createElement('div');
    header.innerHTML = `
      <h2 class="yf-title">Settings</h2>
      <p class="yf-subtitle">General mod settings and tools.</p>
    `;
    frag.appendChild(header);

    // Quick Actions
    const actionsCard = document.createElement('div');
    actionsCard.className = 'yf-card';
    actionsCard.innerHTML = `
      <h3 class="yf-card-title">Quick Actions</h3>
      <p class="yf-card-desc">Shortcuts for common stuff.</p>
      <div class="yf-actions-row">
        <button class="yf-btn secondary" id="yf-btn-devtools">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          DevTools
        </button>
        <button class="yf-btn secondary" id="yf-btn-reload">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          Reload Client
        </button>
        <button class="yf-btn secondary" id="yf-btn-plugins-folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Plugins Folder
        </button>
        <button class="yf-btn secondary" id="yf-btn-themes-folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Themes Folder
        </button>
      </div>
    `;
    frag.appendChild(actionsCard);

    // System toggles
    const systemCard = document.createElement('div');
    systemCard.className = 'yf-card';
    systemCard.innerHTML = `
      <h3 class="yf-card-title">System</h3>
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Safe Mode</span>
          <span class="yf-setting-hint">Skip all plugins on startup. Use this if something broke.</span>
        </div>
        <label class="yf-switch">
          <input type="checkbox" id="yf-toggle-safemode" ${storage.get('safeMode', false) ? 'checked' : ''} />
          <span class="yf-switch-track"></span>
        </label>
      </div>
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Developer Hotkeys</span>
          <span class="yf-setting-hint">Enables Ctrl+Shift+I and F12 to open DevTools.</span>
        </div>
        <label class="yf-switch">
          <input type="checkbox" id="yf-toggle-devtools-hotkey" ${storage.get('devtoolsShortcut', true) ? 'checked' : ''} />
          <span class="yf-switch-track"></span>
        </label>
      </div>
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Debug Logging</span>
          <span class="yf-setting-hint">Extra logging for troubleshooting.</span>
        </div>
        <label class="yf-switch">
          <input type="checkbox" id="yf-toggle-logging" ${storage.get('debugLogging', true) ? 'checked' : ''} />
          <span class="yf-switch-track"></span>
        </label>
      </div>
    `;
    frag.appendChild(systemCard);

    // Danger zone
    const dangerCard = document.createElement('div');
    dangerCard.className = 'yf-card yf-card-danger';
    dangerCard.innerHTML = `
      <h3 class="yf-card-title danger">Reset Everything</h3>
      <p class="yf-card-desc">Wipes all settings back to defaults. Can't undo this.</p>
      <button class="yf-btn danger" id="yf-btn-reset">Reset All Settings</button>
    `;
    frag.appendChild(dangerCard);

    // Version footer
    const footer = document.createElement('div');
    footer.className = 'yf-version-footer';
    footer.textContent = 'Yapify v1.0.0';
    frag.appendChild(footer);

    // Bind events after DOM insertion
    setTimeout(() => {
      document.getElementById('yf-btn-devtools')?.addEventListener('click', () => {
        window.yapinmodBridge?.invoke?.('yapinmod:toggle-devtools');
      });
      document.getElementById('yf-btn-reload')?.addEventListener('click', () => {
        window.yapinmodBridge?.invoke?.('yapinmod:reload-renderer');
      });
      document.getElementById('yf-btn-plugins-folder')?.addEventListener('click', () => {
        window.yapinmodBridge?.invoke?.('yapinmod:open-folder', 'plugins');
      });
      document.getElementById('yf-btn-themes-folder')?.addEventListener('click', () => {
        window.yapinmodBridge?.invoke?.('yapinmod:open-folder', 'themes');
      });
      document.getElementById('yf-toggle-safemode')?.addEventListener('change', async (e) => {
        await storage.set('safeMode', e.target.checked);
        events.emit('toast', `Safe Mode ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
      });
      document.getElementById('yf-toggle-devtools-hotkey')?.addEventListener('change', async (e) => {
        await storage.set('devtoolsShortcut', e.target.checked);
      });
      document.getElementById('yf-toggle-logging')?.addEventListener('change', async (e) => {
        await storage.set('debugLogging', e.target.checked);
      });
      document.getElementById('yf-btn-reset')?.addEventListener('click', async () => {
        if (confirm('Reset all settings to defaults? Can\'t undo this.')) {
          await storage.resetToDefaults();
          events.emit('toast', 'Settings reset', 'success');
        }
      });
    }, 0);

    return frag;
  }

  // ============================================================
  //  DIAGNOSTICS TAB
  // ============================================================
  renderDiagnosticsTab() {
    const frag = document.createDocumentFragment();

    const header = document.createElement('div');
    header.className = 'yf-section-header';
    header.innerHTML = `
      <div>
        <h2 class="yf-title">Diagnostics</h2>
        <p class="yf-subtitle">Live client logs and plugin runtime status.</p>
      </div>
      <div class="yf-actions-row">
        <button class="yf-btn secondary" id="yf-btn-copy-logs">Copy Logs</button>
        <button class="yf-btn secondary" id="yf-btn-clear-logs">Clear</button>
      </div>
    `;
    frag.appendChild(header);

    const terminal = document.createElement('div');
    terminal.className = 'yf-log-terminal';
    terminal.id = 'yf-log-terminal';
    terminal.textContent = 'Loading logs...';
    frag.appendChild(terminal);

    // Load logs after insertion
    setTimeout(async () => {
      const term = document.getElementById('yf-log-terminal');
      if (!term) return;

      if (window.yapinmodBridge?.invoke) {
        const logs = await window.yapinmodBridge.invoke('yapinmod:get-logs');
        term.textContent = logs || 'No logs recorded yet.';
        term.scrollTop = term.scrollHeight;
      } else {
        const logs = logger.getRecentLogs().map(l =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`
        ).join('\n');
        term.textContent = logs || 'No logs recorded yet.';
        term.scrollTop = term.scrollHeight;
      }

      document.getElementById('yf-btn-copy-logs')?.addEventListener('click', () => {
        navigator.clipboard.writeText(term.textContent);
        events.emit('toast', 'Logs copied to clipboard', 'success');
      });
      document.getElementById('yf-btn-clear-logs')?.addEventListener('click', () => {
        logger.clear();
        term.textContent = 'Logs cleared.';
      });
    }, 0);

    return frag;
  }
}

export const settingsPanel = new SettingsPanel();
