/**
 * Plugin C: Quality of Life (QoL) Features
 * Client-side productivity conveniences using existing DOM and Electron APIs.
 * Includes character counter, autoscroll controls, and window mods (borderless windowed, fullscreen, windowed, and Mac controls).
 */

import { storage } from '../core/storage.js';
import { pluginManager } from './plugin-manager.js';
import { createCustomDropdown } from '../ui/custom-dropdown.js';

export const QoLFeaturesPlugin = {
  id: 'qol-features',
  name: 'Quality of Life Features',
  version: '1.2.0',
  author: 'Yapify Team',
  description: 'Productivity suite: message character counter, auto-scroll chat controls, window modes, and Mac-style window controls.',

  onStart(api) {
    api.logger.info('QoL Features Plugin started');
    const charCounter = api.storage.get('charCounter', true);

    if (charCounter) this.setupCharCounter(api);
  },

  onStop(api) {
    api.logger.info('QoL Features Plugin stopped; cleaning up observers and elements');
    document.querySelectorAll('.yf-char-counter').forEach(el => el.remove());
  },

  setupCharCounter(api) {
    const updateCounter = (inputEl) => {
      if (!inputEl) return;
      const count = (inputEl.value || inputEl.textContent || '').length;
      let counter = inputEl.parentElement?.querySelector('.yf-char-counter');

      if (!counter) {
        counter = document.createElement('div');
        counter.className = 'yf-char-counter';
        counter.style.cssText = `
          font-size: 11px;
          color: var(--text-faint, #9294a1);
          text-align: right;
          padding: 2px 6px;
          margin-top: 2px;
          user-select: none;
          pointer-events: none;
        `;
        inputEl.parentElement?.appendChild(counter);
      }

      counter.textContent = `${count} chars`;
      if (count > 1800) {
        counter.style.color = 'var(--danger, #f2555a)';
      } else {
        counter.style.color = 'var(--text-faint, #9294a1)';
      }
    };

    const onInput = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true' || target.classList.contains('input'))) {
        updateCounter(target);
      }
    };

    document.addEventListener('input', onInput, true);
    api.events.on('plugin:cleanup', () => document.removeEventListener('input', onInput, true));
  },

  renderSettings(api, container) {
    const charCounter = api.storage.get('charCounter', true);

    // Auto-scroll settings
    const autoScrollEnabled = storage.isPluginEnabled('autoscroll', true);
    const asSettings = storage.getPluginSettings('autoscroll', { autoScrollDefault: true });
    const autoScrollDefault = asSettings.autoScrollDefault !== false;

    // Window mods settings
    const wmEnabled = storage.isPluginEnabled('window-mods', true);
    const wmSettings = storage.getPluginSettings('window-mods', { macButtons: true, macButtonsPosition: 'left', windowMode: 'windowed' });
    const macButtons = wmSettings.macButtons !== false;
    const macPosition = wmSettings.macButtonsPosition || 'left';
    const currentMode = wmSettings.windowMode || 'windowed';

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <!-- 1. Auto-Scroll Section -->
        <div style="font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent, #5865f2); margin-bottom: 10px;">
          Auto-Scroll Controls
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Auto-Scroll Plugin</span>
            <span class="ym-setting-desc">Enables the Auto-Scroll system with button next to the GIF icon and red cross-out indicator.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-qol-as-toggle" ${autoScrollEnabled ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Auto-Scroll by Default</span>
            <span class="ym-setting-desc">Keep chat pinned to the newest messages automatically unless scrolled up.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-qol-as-default" ${autoScrollDefault ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div style="font-size: 12px; color: var(--text-muted, #9294a1); padding: 6px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; margin: 8px 0 16px;">
          💡 <b>How it works:</b> Click the button next to the <b>GIF icon</b> to toggle. If you <b>scroll up manually</b>, it automatically pauses and <b>crosses itself out in red</b>. Scrolling back down to the bottom uncrosses it.
        </div>

        <!-- 2. Window Mods Section -->
        <div style="font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent, #5865f2); margin: 18px 0 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
          Window Mods & Display
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Window Display Mode</span>
            <span class="ym-setting-desc">Custom dropdown to switch between Borderless Windowed, Fullscreen, and Windowed.</span>
          </div>
          <div class="ym-setting-control" id="yf-qol-mode-dropdown-mount">
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Mac-Style Window Buttons</span>
            <span class="ym-setting-desc">Authentic macOS traffic lights: 🔴 Red (Close), 🟠 Orange (Minimize), and 🟢 Green (Fullscreen/Maximize).</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-qol-mac-btn" ${macButtons && wmEnabled ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Traffic Lights Position</span>
            <span class="ym-setting-desc">Position Mac traffic lights at the Top Left (macOS standard) or Top Right.</span>
          </div>
          <div class="ym-setting-control" id="yf-qol-pos-dropdown-mount">
          </div>
        </div>

        <!-- 3. General QoL Section -->
        <div style="font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent, #5865f2); margin: 18px 0 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
          Chat Productivity
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Message Character Counter</span>
            <span class="ym-setting-desc">Displays a subtle live character count below text chat inputs.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-qol-char" ${charCounter ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    // 1. Mount Custom Window Mode Dropdown
    const modeMount = container.querySelector('#yf-qol-mode-dropdown-mount');
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
          const wmPlugin = pluginManager.getPlugin('window-mods')?.instance;
          if (wmPlugin) {
            await wmPlugin.setWindowMode(newMode);
          } else if (window.yapinmodBridge?.invoke) {
            await window.yapinmodBridge.invoke('yapinmod:set-window-mode', newMode);
            await storage.setPluginSettings('window-mods', { windowMode: newMode });
          }
        }
      });
      modeMount.appendChild(modeDropdown);
    }

    // 2. Mount Custom Position Dropdown
    const posMount = container.querySelector('#yf-qol-pos-dropdown-mount');
    if (posMount) {
      const posDropdown = createCustomDropdown({
        options: [
          { value: 'left', label: 'Top Left (macOS standard)' },
          { value: 'right', label: 'Top Right' }
        ],
        value: macPosition,
        width: '210px',
        onChange: async (newPos) => {
          await storage.setPluginSettings('window-mods', { macButtonsPosition: newPos });
          const wmPlugin = pluginManager.getPlugin('window-mods')?.instance;
          if (wmPlugin) {
            wmPlugin.setPosition(newPos);
          }
          // Notice: NO notification, as requested by user
        }
      });
      posMount.appendChild(posDropdown);
    }

    // Auto-Scroll toggles
    container.querySelector('#yf-qol-as-toggle')?.addEventListener('change', async (e) => {
      await pluginManager.togglePlugin('autoscroll', e.target.checked);
      api.ui.showToast(`Auto-Scroll: ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'info');
    });

    container.querySelector('#yf-qol-as-default')?.addEventListener('change', async (e) => {
      await storage.setPluginSettings('autoscroll', { autoScrollDefault: e.target.checked });
      const asPlugin = pluginManager.getPlugin('autoscroll')?.instance;
      if (asPlugin) {
        asPlugin._isActive = e.target.checked;
        asPlugin._updateButtonUI?.();
      }
      api.ui.showToast(`Auto-Scroll Default: ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'info');
    });

    // Mac Buttons Toggle - NO toast notification as requested
    container.querySelector('#yf-qol-mac-btn')?.addEventListener('change', async (e) => {
      await storage.setPluginSettings('window-mods', { macButtons: e.target.checked });
      if (!storage.isPluginEnabled('window-mods', false) && e.target.checked) {
        await pluginManager.togglePlugin('window-mods', true);
      }
      const wmPlugin = pluginManager.getPlugin('window-mods')?.instance;
      if (wmPlugin) {
        wmPlugin._ensureMacButtonsInjected?.(api);
      }
      // Notice: NO notification, as requested by user
    });

    container.querySelector('#yf-qol-char')?.addEventListener('change', async (e) => {
      await api.storage.set('charCounter', e.target.checked);
      if (!e.target.checked) {
        document.querySelectorAll('.yf-char-counter').forEach(el => el.remove());
      }
    });
  }
};
