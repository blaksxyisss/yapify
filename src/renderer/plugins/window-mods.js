/**
 * Plugin: Window Mods
 * Adds customizable Window Modes (Borderless Windowed, Fullscreen, Windowed)
 * and authentic macOS-style traffic light window controls.
 * Traffic lights:
 *  - Red: Close window
 *  - Orange: Minimize window
 *  - Green: Fullscreen / Maximize
 */

import { storage } from '../core/storage.js';
import { createCustomDropdown } from '../ui/custom-dropdown.js';

export const WindowModsPlugin = {
  id: 'window-mods',
  name: 'Window Mods',
  version: '1.1.0',
  author: 'Yapify Team',
  description: 'Window modes (Borderless Windowed, Fullscreen, Windowed) and authentic Mac-style traffic light window controls (Close, Minimize, and Fullscreen).',

  _api: null,
  _keyListener: null,
  _checkInterval: null,
  _containerEl: null,

  onStart(api) {
    this._api = api;
    api.logger.info('Window Mods started');

    api.ui.injectStyle('window-mods-styles', `
      /* Drag bar for frameless window */
      .yf-window-drag-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 24px !important;
        -webkit-app-region: drag !important;
        z-index: 999980 !important;
        pointer-events: auto !important;
      }

      body.yf-borderless-windowed .yf-window-drag-bar,
      body.yf-fullscreen .yf-window-drag-bar {
        height: 8px !important;
      }

      /* Ensure buttons and controls are never blocked by dragging */
      button, input, textarea, a, select, [role="button"],
      .yf-mac-traffic-lights, .yf-mac-btn,
      .yf-custom-dropdown, .yf-dropdown-trigger, .yf-dropdown-menu,
      .yf-settings-modal, .yf-settings-overlay, .ym-settings-modal {
        -webkit-app-region: no-drag !important;
      }

      /* In borderless windowed mode, hide in-app top bars where the title/name is */
      body.yf-borderless-windowed .yf-app-top-bar,
      body.yf-borderless-windowed [class*="titlebar"],
      body.yf-borderless-windowed [class*="title-bar"],
      body.yf-borderless-windowed [class*="topbar"],
      body.yf-borderless-windowed [class*="top-bar"] {
        display: none !important;
      }

      .yf-mac-traffic-lights {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 6px 10px !important;
        background: rgba(18, 19, 23, 0.78) !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 20px !important;
        position: fixed !important;
        top: 10px !important;
        z-index: 999999 !important;
        user-select: none !important;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3) !important;
        transition: opacity 0.2s ease, transform 0.2s ease, left 0.15s ease, right 0.15s ease !important;
        -webkit-app-region: no-drag !important;
      }

      .yf-mac-traffic-lights.pos-left {
        left: 14px !important;
        right: auto !important;
      }

      .yf-mac-traffic-lights.pos-right {
        left: auto !important;
        right: 14px !important;
      }

      .yf-mac-traffic-lights:hover {
        background: rgba(24, 25, 30, 0.92) !important;
        border-color: rgba(255, 255, 255, 0.22) !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.65) !important;
      }

      .yf-mac-btn {
        width: 12.5px !important;
        height: 12.5px !important;
        border-radius: 50% !important;
        border: none !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        outline: none !important;
        position: relative !important;
        transition: transform 0.12s ease, filter 0.12s ease !important;
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 1px 2px rgba(0, 0, 0, 0.35) !important;
        flex-shrink: 0 !important;
        -webkit-app-region: no-drag !important;
      }

      .yf-mac-btn:hover {
        transform: scale(1.15) !important;
        filter: brightness(1.12) !important;
      }

      .yf-mac-btn:active {
        transform: scale(0.9) !important;
      }

      /* 1. Red: Close */
      .yf-mac-close {
        background: #ff5f56 !important;
        border: 1px solid #e0443e !important;
      }

      /* 2. Orange / Yellow: Minimize (3rd orange icon) */
      .yf-mac-min {
        background: #ffbd2e !important;
        border: 1px solid #dea123 !important;
      }

      /* 3. Green: Maximize / Fullscreen */
      .yf-mac-max {
        background: #27c93f !important;
        border: 1px solid #1aab29 !important;
      }

      /* Authentic Mac glyphs on hover */
      .yf-mac-glyph {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 8px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        color: rgba(0, 0, 0, 0.7) !important;
        opacity: 0 !important;
        transition: opacity 0.15s ease !important;
        pointer-events: none !important;
      }

      .yf-mac-traffic-lights:hover .yf-mac-glyph {
        opacity: 0.9 !important;
      }
    `);

    const wmSettings = storage.getPluginSettings('window-mods', {});
    const initialMode = wmSettings.windowMode || 'borderless_windowed';
    this._applyWindowModeClass(initialMode);
    this._ensureDragBar();
    this._setupMacButtons(api);
    this._setupHotkeys(api);
  },

  onStop(api) {
    api.logger.info('Window Mods stopped');
    api.ui.removeStyle('window-mods-styles');
    document.body.classList.remove('yf-borderless-windowed', 'yf-fullscreen', 'yf-windowed');
    const dragBar = document.getElementById('yf-drag-bar');
    if (dragBar) dragBar.remove();
    this._updateTopBarDetection(false);
    if (this._containerEl) {
      this._containerEl.remove();
      this._containerEl = null;
    }
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
    if (this._keyListener) {
      window.removeEventListener('keydown', this._keyListener);
      this._keyListener = null;
    }
  },

  _setupHotkeys(api) {
    this._keyListener = (e) => {
      // F11 toggles between fullscreen and windowed
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen(api);
      }
    };
    window.addEventListener('keydown', this._keyListener);
  },

  _ensureDragBar() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('yf-drag-bar')) {
      const bar = document.createElement('div');
      bar.id = 'yf-drag-bar';
      bar.className = 'yf-window-drag-bar';
      document.body?.prepend(bar);
    }
  },

  _applyWindowModeClass(mode) {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.remove('yf-borderless-windowed', 'yf-fullscreen', 'yf-windowed');
    if (mode === 'borderless_windowed') {
      document.body.classList.add('yf-borderless-windowed');
    } else if (mode === 'fullscreen') {
      document.body.classList.add('yf-fullscreen');
    } else {
      document.body.classList.add('yf-windowed');
    }
    this._updateTopBarDetection(mode === 'borderless_windowed');
  },

  _updateTopBarDetection(isBorderless) {
    if (typeof document === 'undefined') return;
    try {
      const elements = document.querySelectorAll('header, [class*="title"], [class*="header"], [class*="bar"], div');
      for (const el of elements) {
        if (el.closest?.('.yf-settings-modal') || el.closest?.('[role="dialog"]') || el.classList?.contains('yf-mac-traffic-lights')) continue;
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.top <= 6 && r.height >= 18 && r.height <= 50 && r.width >= (window.innerWidth || 1200) * 0.7) {
          if (el.textContent && (el.textContent.includes('Yapin') || el.querySelector('img, svg'))) {
            el.classList.add('yf-app-top-bar');
            if (isBorderless) {
              el.style.setProperty('display', 'none', 'important');
            } else {
              el.style.removeProperty('display');
            }
          }
        }
      }
    } catch (e) {}
  },

  async setWindowMode(mode) {
    this._applyWindowModeClass(mode);
    if (window.yapinmodBridge?.invoke) {
      try {
        await window.yapinmodBridge.invoke('yapinmod:set-window-mode', mode);
        await storage.setPluginSettings('window-mods', { windowMode: mode });
      } catch (err) {
        this._api?.logger.warn('Failed to set window mode: ' + err.message);
      }
    }
  },

  async toggleFullscreen(api) {
    if (window.yapinmodBridge?.invoke) {
      try {
        const res = await window.yapinmodBridge.invoke('yapinmod:window-action', 'toggle-fullscreen');
        const isFs = res?.isFullScreen;
        const nextMode = isFs ? 'fullscreen' : 'borderless_windowed';
        this._applyWindowModeClass(nextMode);
        await storage.setPluginSettings('window-mods', { windowMode: nextMode });
        api?.ui.showToast(`Fullscreen: ${isFs ? 'Enabled' : 'Disabled'}`, 'info');
      } catch (err) {
        api?.logger.warn('Failed to toggle fullscreen: ' + err.message);
      }
    }
  },

  _setupMacButtons(api) {
    const showMac = storage.getPluginSettings('window-mods', {}).macButtons !== false;
    if (!showMac) return;

    this._ensureMacButtonsInjected(api);

    // Watcher to keep buttons and top-bar state consistent across navigation
    this._checkInterval = setInterval(() => {
      this._ensureMacButtonsInjected(api);
      this._ensureDragBar();
      const currentMode = storage.getPluginSettings('window-mods', {}).windowMode || 'borderless_windowed';
      this._updateTopBarDetection(currentMode === 'borderless_windowed');
    }, 1000);
  },

  _ensureMacButtonsInjected(api) {
    const showMac = storage.getPluginSettings('window-mods', {}).macButtons !== false;
    if (!showMac) {
      if (this._containerEl) {
        this._containerEl.remove();
        this._containerEl = null;
      }
      return;
    }

    const pos = storage.getPluginSettings('window-mods', {}).macButtonsPosition || 'left';

    if (this._containerEl && document.body.contains(this._containerEl)) {
      this.setPosition(pos);
      return;
    }

    const container = document.createElement('div');
    container.className = `yf-mac-traffic-lights pos-${pos}`;
    container.setAttribute('aria-label', 'macOS Window Controls');

    // 1. Red: Close
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'yf-mac-btn yf-mac-close';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '<span class="yf-mac-glyph">✕</span>';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.yapinmodBridge?.invoke('yapinmod:window-action', 'close');
    });

    // 2. Orange: Minimize
    const minBtn = document.createElement('button');
    minBtn.type = 'button';
    minBtn.className = 'yf-mac-btn yf-mac-min';
    minBtn.title = 'Minimize';
    minBtn.innerHTML = '<span class="yf-mac-glyph">−</span>';
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.yapinmodBridge?.invoke('yapinmod:window-action', 'minimize');
    });

    // 3. Green: Maximize / Fullscreen
    const maxBtn = document.createElement('button');
    maxBtn.type = 'button';
    maxBtn.className = 'yf-mac-btn yf-mac-max';
    maxBtn.title = 'Fullscreen / Maximize';
    maxBtn.innerHTML = '<span class="yf-mac-glyph">⤢</span>';
    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.yapinmodBridge?.invoke('yapinmod:window-action', 'toggle-fullscreen');
    });

    container.appendChild(closeBtn);
    container.appendChild(minBtn);
    container.appendChild(maxBtn);

    document.body.appendChild(container);
    this._containerEl = container;
    this.setPosition(pos);
  },

  setPosition(pos) {
    if (!this._containerEl) return;
    if (pos === 'right') {
      this._containerEl.classList.remove('pos-left');
      this._containerEl.classList.add('pos-right');
      this._containerEl.style.setProperty('left', 'auto', 'important');
      this._containerEl.style.setProperty('right', '14px', 'important');
    } else {
      this._containerEl.classList.remove('pos-right');
      this._containerEl.classList.add('pos-left');
      this._containerEl.style.setProperty('left', '14px', 'important');
      this._containerEl.style.setProperty('right', 'auto', 'important');
    }
  },

  renderSettings(api, container) {
    const wmSettings = storage.getPluginSettings('window-mods', {});
    const showMac = wmSettings.macButtons !== false;
    const currentPos = wmSettings.macButtonsPosition || 'left';
    const currentMode = wmSettings.windowMode || 'windowed';

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Window Display Mode</span>
            <span class="ym-setting-desc">Select how Yapin' is displayed on your monitor.</span>
          </div>
          <div class="ym-setting-control" id="yf-wm-mode-dropdown-mount">
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Mac-Style Window Buttons</span>
            <span class="ym-setting-desc">Authentic macOS traffic lights: 🔴 Red (Close), 🟠 Orange (Minimize), and 🟢 Green (Fullscreen/Maximize).</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-wm-mac" ${showMac ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Buttons Position</span>
            <span class="ym-setting-desc">Choose whether the Mac traffic lights sit on the Top Left (macOS standard) or Top Right.</span>
          </div>
          <div class="ym-setting-control" id="yf-wm-pos-dropdown-mount">
          </div>
        </div>
      </div>
    `;

    // 1. Mount Custom Window Mode Dropdown
    const modeMount = container.querySelector('#yf-wm-mode-dropdown-mount');
    if (modeMount) {
      const modeDropdown = createCustomDropdown({
        options: [
          { value: 'borderless_windowed', label: 'Borderless Windowed' },
          { value: 'fullscreen', label: 'Fullscreen' },
          { value: 'windowed', label: 'Windowed' }
        ],
        value: currentMode,
        width: '210px',
        onChange: async (newMode) => {
          await this.setWindowMode(newMode);
        }
      });
      modeMount.appendChild(modeDropdown);
    }

    // 2. Mount Custom Position Dropdown
    const posMount = container.querySelector('#yf-wm-pos-dropdown-mount');
    if (posMount) {
      const posDropdown = createCustomDropdown({
        options: [
          { value: 'left', label: 'Top Left (macOS standard)' },
          { value: 'right', label: 'Top Right' }
        ],
        value: currentPos,
        width: '210px',
        onChange: async (newPos) => {
          await storage.setPluginSettings('window-mods', { macButtonsPosition: newPos });
          this.setPosition(newPos);
          // Notice: NO notification, as requested by user
        }
      });
      posMount.appendChild(posDropdown);
    }

    // 3. Mac Buttons Toggle - NO toast notification as requested
    container.querySelector('#yf-wm-mac')?.addEventListener('change', async (e) => {
      await storage.setPluginSettings('window-mods', { macButtons: e.target.checked });
      this._ensureMacButtonsInjected(api);
      // Notice: NO notification, as requested by user
    });
  }
};
