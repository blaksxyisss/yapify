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

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Message Character Counter</span>
            <span class="ym-setting-desc">Displays a subtle live character count below text chat inputs (warns when approaching limit).</span>
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

    container.querySelector('#yf-qol-char')?.addEventListener('change', async (e) => {
      await api.storage.set('charCounter', e.target.checked);
      if (!e.target.checked) {
        document.querySelectorAll('.yf-char-counter').forEach(el => el.remove());
      }
    });
  }
};
