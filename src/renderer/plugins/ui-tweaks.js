/**
 * Plugin B: UI Tweaks & Polish
 * Safe styling enhancements for spacing, border radii, scrollbars, and transitions.
 */

export const UITweaksPlugin = {
  id: 'ui-tweaks',
  name: 'UI Tweaks & Polish',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Customize UI corner rounding, compact server navigation rail, sleek scrollbars, and smooth scrolling animations.',

  onStart(api) {
    api.logger.info('UI Tweaks Plugin started');
    this.applyStyles(api);
  },

  onStop(api) {
    api.logger.info('UI Tweaks Plugin stopped; clearing injected styles');
    api.ui.removeStyle('main-tweaks');
  },

  applyStyles(api) {
    const compactRail = api.storage.get('compactRail', false);
    const radius = api.storage.get('customRadius', 10);
    const smoothScroll = api.storage.get('smoothScroll', true);
    const modernScrollbar = api.storage.get('modernScrollbar', true);

    let css = `
      :root {
        --radius: ${radius}px !important;
      }
    `;

    if (compactRail) {
      css += `
        /* Compact Server Rail */
        aside, [class*="rail"], [class*="servers"] {
          --rail-width: 54px !important;
          transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `;
    }

    if (smoothScroll) {
      css += `
        /* Smooth scrolling */
        html, body, main, [class*="chat"], [class*="messages"], [class*="scroll"] {
          scroll-behavior: smooth !important;
        }
      `;
    }

    if (modernScrollbar) {
      css += `
        /* Sleek Modern Scrollbars */
        ::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          transition: background 0.2s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `;
    }

    api.ui.injectStyle('main-tweaks', css);
  },

  renderSettings(api, container) {
    const compactRail = api.storage.get('compactRail', false);
    const radius = api.storage.get('customRadius', 10);
    const smoothScroll = api.storage.get('smoothScroll', true);
    const modernScrollbar = api.storage.get('modernScrollbar', true);

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Corner Rounding (Radius)</span>
            <span class="ym-setting-desc">Adjust the border radius across dialogs, buttons, cards and avatars.</span>
          </div>
          <div class="ym-setting-control" style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="ym-radius-slider" min="0" max="20" value="${radius}" class="ym-slider" />
            <span id="ym-radius-val" style="min-width: 38px; font-weight: bold; color: var(--text);">${radius}px</span>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Compact Server Rail</span>
            <span class="ym-setting-desc">Reduces padding and icon dimensions in the left navigation sidebar.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="ym-compact-rail" ${compactRail ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Smooth Scrolling</span>
            <span class="ym-setting-desc">Enables fluid momentum scrolling throughout chat history and channel lists.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="ym-smooth-scroll" ${smoothScroll ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Sleek Scrollbars</span>
            <span class="ym-setting-desc">Replaces wide browser scrollbars with subtle, semi-transparent bars.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="ym-modern-scrollbar" ${modernScrollbar ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const radiusSlider = container.querySelector('#ym-radius-slider');
    const radiusVal = container.querySelector('#ym-radius-val');
    radiusSlider?.addEventListener('input', async (e) => {
      const val = parseInt(e.target.value, 10);
      if (radiusVal) radiusVal.textContent = val + 'px';
      await api.storage.set('customRadius', val);
      this.applyStyles(api);
    });

    container.querySelector('#ym-compact-rail')?.addEventListener('change', async (e) => {
      await api.storage.set('compactRail', e.target.checked);
      this.applyStyles(api);
    });

    container.querySelector('#ym-smooth-scroll')?.addEventListener('change', async (e) => {
      await api.storage.set('smoothScroll', e.target.checked);
      this.applyStyles(api);
    });

    container.querySelector('#ym-modern-scrollbar')?.addEventListener('change', async (e) => {
      await api.storage.set('modernScrollbar', e.target.checked);
      this.applyStyles(api);
    });
  }
};
