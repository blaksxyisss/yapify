/**
 * Plugin: Typing Indicator Tweaks
 * Control how typing indicators behave — hide them, make them minimal, etc.
 */

export const TypingIndicatorPlugin = {
  id: 'typing-indicator',
  name: 'Typing Indicator Tweaks',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Hide the typing indicator completely, or make it smaller and less distracting.',

  onStart(api) {
    api.logger.info('Typing Indicator Tweaks started');
    this._applyMode(api);
  },

  onStop(api) {
    api.logger.info('Typing Indicator Tweaks stopped');
    api.ui.removeStyle('typing-tweaks');
  },

  _applyMode(api) {
    const mode = api.storage.get('typingMode', 'minimal');

    let css = '';
    switch (mode) {
      case 'hidden':
        css = `
          [class*="typing"], [class*="typingIndicator"], [class*="typing-indicator"] {
            display: none !important;
          }
        `;
        break;
      case 'minimal':
        css = `
          [class*="typing"], [class*="typingIndicator"], [class*="typing-indicator"] {
            opacity: 0.5 !important;
            font-size: 11px !important;
            padding: 2px 8px !important;
          }
        `;
        break;
      case 'normal':
      default:
        css = '';
        break;
    }

    if (css) {
      api.ui.injectStyle('typing-tweaks', css);
    } else {
      api.ui.removeStyle('typing-tweaks');
    }
  },

  renderSettings(api, container) {
    const mode = api.storage.get('typingMode', 'minimal');

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Typing Indicator Mode</span>
            <span class="ym-setting-desc">Control how "X is typing..." appears in chat.</span>
          </div>
          <div class="ym-setting-control">
            <select id="yf-typing-mode" class="ym-select" style="background: rgba(255,255,255,0.08); color: var(--text); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px;">
              <option value="normal" ${mode === 'normal' ? 'selected' : ''}>Normal (default)</option>
              <option value="minimal" ${mode === 'minimal' ? 'selected' : ''}>Minimal (faded & small)</option>
              <option value="hidden" ${mode === 'hidden' ? 'selected' : ''}>Hidden (completely invisible)</option>
            </select>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#yf-typing-mode')?.addEventListener('change', async (e) => {
      await api.storage.set('typingMode', e.target.value);
      this._applyMode(api);
      api.ui.showToast(`Typing indicator: ${e.target.value}`, 'info');
    });
  }
};
