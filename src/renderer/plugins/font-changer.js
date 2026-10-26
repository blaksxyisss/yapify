/**
 * Plugin: Font Changer
 * Lets you override the client font with any Google Font or system font.
 */

export const FontChangerPlugin = {
  id: 'font-changer',
  name: 'Font Changer',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Swap the entire client font to any Google Font or local system font. Change the vibe instantly.',

  _linkEl: null,

  onStart(api) {
    api.logger.info('Font Changer started');
    const font = api.storage.get('fontFamily', '');
    const isGoogle = api.storage.get('isGoogleFont', true);
    if (font) {
      this._applyFont(api, font, isGoogle);
    }
  },

  onStop(api) {
    api.logger.info('Font Changer stopped');
    api.ui.removeStyle('font-override');
    if (this._linkEl) {
      this._linkEl.remove();
      this._linkEl = null;
    }
  },

  _applyFont(api, fontFamily, isGoogle) {
    // Load Google Font if needed
    if (isGoogle && fontFamily) {
      if (this._linkEl) this._linkEl.remove();
      this._linkEl = document.createElement('link');
      this._linkEl.rel = 'stylesheet';
      this._linkEl.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(this._linkEl);
    }

    if (fontFamily) {
      api.ui.injectStyle('font-override', `
        * {
          font-family: '${fontFamily}', system-ui, -apple-system, sans-serif !important;
        }
        code, pre, [class*="code"], [class*="mono"] {
          font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace !important;
        }
      `);
    } else {
      api.ui.removeStyle('font-override');
    }
  },

  renderSettings(api, container) {
    const font = api.storage.get('fontFamily', '');
    const isGoogle = api.storage.get('isGoogleFont', true);

    const popularFonts = [
      'Inter', 'Outfit', 'Poppins', 'Nunito', 'Lexend',
      'Plus Jakarta Sans', 'Space Grotesk', 'DM Sans',
      'Rubik', 'Manrope', 'Geist', 'Figtree'
    ];

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row" style="flex-direction: column; align-items: stretch;">
          <div class="ym-setting-info" style="margin-bottom: 10px;">
            <span class="ym-setting-title">Font Family</span>
            <span class="ym-setting-desc">Type any font name. Google Fonts are loaded automatically.</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="yf-font-input" class="ym-input" value="${font}" placeholder="e.g. Inter, Poppins, Outfit..." style="flex: 1;" />
            <button id="yf-font-apply" class="ym-btn secondary">Apply</button>
            <button id="yf-font-reset" class="ym-btn ghost">Reset</button>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Load from Google Fonts</span>
            <span class="ym-setting-desc">Uncheck if using a locally installed font instead.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-font-google" ${isGoogle ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div style="margin-top: 16px;">
          <span class="ym-setting-title" style="margin-bottom: 8px; display: block;">Quick Picks</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${popularFonts.map(f => `
              <button class="ym-btn ghost yf-font-pick ${font === f ? 'active' : ''}" data-font="${f}" style="font-size: 12px; padding: 5px 12px;">
                ${f}
              </button>
            `).join('')}
          </div>
        </div>

        ${font ? `
          <div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <span class="ym-setting-title" style="margin-bottom: 6px; display: block;">Preview</span>
            <p style="font-family: '${font}', sans-serif; font-size: 15px; color: var(--text); line-height: 1.5; margin: 0;">
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
        ` : ''}
      </div>
    `;

    const input = container.querySelector('#yf-font-input');

    const apply = async (fontName) => {
      const google = container.querySelector('#yf-font-google')?.checked ?? true;
      await api.storage.set('fontFamily', fontName);
      await api.storage.set('isGoogleFont', google);
      this._applyFont(api, fontName, google);
      api.ui.showToast(fontName ? `Font set to ${fontName}` : 'Font reset to default', 'success');
      this.renderSettings(api, container);
    };

    container.querySelector('#yf-font-apply')?.addEventListener('click', () => apply(input?.value?.trim() || ''));
    container.querySelector('#yf-font-reset')?.addEventListener('click', () => apply(''));

    container.querySelector('#yf-font-google')?.addEventListener('change', async (e) => {
      await api.storage.set('isGoogleFont', e.target.checked);
    });

    container.querySelectorAll('.yf-font-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.getAttribute('data-font');
        if (input) input.value = f;
        apply(f);
      });
    });
  }
};
