/**
 * Plugin A: Custom Accent Color
 * Provides real-time dynamic accent color customization.
 */

import { themeManager } from '../themes/theme-manager.js';

export const CustomAccentPlugin = {
  id: 'custom-accent',
  name: 'Custom Accent Colors',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Change the client accent color and active highlights in real-time with preset palettes or custom hex codes.',

  onStart(api) {
    api.logger.info('Custom Accent Plugin started');
    const color = api.storage.get('accentColor', null);
    if (color) {
      themeManager.setAccentColor(color, false);
    }
  },

  onStop(api) {
    api.logger.info('Custom Accent Plugin stopped; reverting to default accent');
    themeManager.setAccentColor(null, false);
  },

  renderSettings(api, container) {
    const PRESETS = [
      { name: 'Yapin Default', hex: '#ff6b4a' },
      { name: 'Discord Blurple', hex: '#5865f2' },
      { name: 'Neon Purple', hex: '#9d4edd' },
      { name: 'Cyberpunk Cyan', hex: '#00d2ff' },
      { name: 'Emerald Green', hex: '#10b981' },
      { name: 'Sunset Amber', hex: '#f59e0b' },
      { name: 'Crimson Rose', hex: '#f43f5e' },
      { name: 'Midnight Blue', hex: '#3b82f6' }
    ];

    const current = api.storage.get('accentColor', '#ff6b4a');

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <label class="ym-label">Choose an Accent Palette</label>
        <p class="ym-desc">Select a curated palette preset or enter your own custom hex color.</p>
        <div class="ym-swatch-grid" id="ym-accent-swatches">
          ${PRESETS.map(p => `
            <button class="ym-swatch-btn ${current === p.hex ? 'active' : ''}" data-hex="${p.hex}" title="${p.name}">
              <span class="ym-swatch-color" style="background-color: ${p.hex};"></span>
              <span class="ym-swatch-name">${p.name}</span>
            </button>
          `).join('')}
        </div>
        <div class="ym-field-row" style="margin-top: 14px;">
          <label class="ym-label" style="margin: 0; min-width: 110px;">Custom Hex:</label>
          <input type="text" id="ym-custom-hex-input" class="ym-input" value="${current}" placeholder="#ff6b4a" maxlength="7" style="width: 140px;" />
          <button id="ym-apply-hex-btn" class="ym-btn secondary">Apply</button>
          <button id="ym-reset-hex-btn" class="ym-btn ghost">Reset Default</button>
        </div>
      </div>
    `;

    // Swatch clicks
    container.querySelectorAll('.ym-swatch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hex = btn.getAttribute('data-hex');
        container.querySelectorAll('.ym-swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const input = container.querySelector('#ym-custom-hex-input');
        if (input) input.value = hex;

        await api.storage.set('accentColor', hex);
        await themeManager.setAccentColor(hex, true);
        api.ui.showToast(`Applied ${btn.getAttribute('title')} accent`, 'success');
      });
    });

    // Custom hex input
    const input = container.querySelector('#ym-custom-hex-input');
    const applyBtn = container.querySelector('#ym-apply-hex-btn');
    const resetBtn = container.querySelector('#ym-reset-hex-btn');

    if (applyBtn && input) {
      applyBtn.addEventListener('click', async () => {
        let hex = input.value.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
          await api.storage.set('accentColor', hex);
          await themeManager.setAccentColor(hex, true);
          api.ui.showToast(`Applied accent: ${hex}`, 'success');
        } else {
          api.ui.showToast('Invalid hex code format (e.g. #5865f2)', 'error');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        await api.storage.set('accentColor', '#ff6b4a');
        await themeManager.setAccentColor(null, true);
        if (input) input.value = '#ff6b4a';
        api.ui.showToast('Reset accent to default Yapin color', 'info');
      });
    }
  }
};
