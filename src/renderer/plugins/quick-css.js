/**
 * Plugin: Quick CSS
 * Live CSS editor — type custom CSS and see changes instantly.
 * Basically like Vencord's QuickCSS or BetterDiscord's Custom CSS.
 */

export const QuickCSSPlugin = {
  id: 'quick-css',
  name: 'Quick CSS',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Live CSS editor built right into settings. Write custom styles and see them applied instantly.',

  _styleEl: null,

  onStart(api) {
    api.logger.info('Quick CSS started');
    const css = api.storage.get('customCSS', '');
    if (css) {
      this._applyCSS(api, css);
    }
  },

  onStop(api) {
    api.logger.info('Quick CSS stopped');
    api.ui.removeStyle('quick-css');
  },

  _applyCSS(api, css) {
    api.ui.injectStyle('quick-css', css);
  },

  renderSettings(api, container) {
    const css = api.storage.get('customCSS', '');

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row" style="flex-direction: column; align-items: stretch;">
          <div class="ym-setting-info" style="margin-bottom: 10px;">
            <span class="ym-setting-title">Custom CSS Editor</span>
            <span class="ym-setting-desc">Write CSS below — it applies live as you type. Saved automatically.</span>
          </div>
          <textarea id="yf-css-editor" spellcheck="false" style="
            width: 100%;
            min-height: 250px;
            background: rgba(0, 0, 0, 0.35);
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.5;
            resize: vertical;
            tab-size: 2;
            outline: none;
            transition: border-color 0.2s;
          ">${this._escapeHtml(css)}</textarea>
          <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end;">
            <button id="yf-css-clear" class="ym-btn ghost">Clear</button>
            <button id="yf-css-apply" class="ym-btn secondary">Apply & Save</button>
          </div>
        </div>

        <div class="ym-setting-row" style="margin-top: 16px; flex-direction: column; align-items: stretch;">
          <span class="ym-setting-title" style="margin-bottom: 8px;">Snippets</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${this._getSnippets().map(s => `
              <button class="ym-btn ghost yf-snippet-btn" data-snippet="${this._escapeAttr(s.css)}" style="font-size: 12px; padding: 4px 10px;">
                ${s.name}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const editor = container.querySelector('#yf-css-editor');
    
    // Focus styling
    editor?.addEventListener('focus', () => {
      editor.style.borderColor = 'rgba(255, 255, 255, 0.25)';
    });
    editor?.addEventListener('blur', () => {
      editor.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });

    // Tab key support in textarea
    editor?.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
      }
    });

    // Apply button
    container.querySelector('#yf-css-apply')?.addEventListener('click', async () => {
      const val = editor?.value || '';
      await api.storage.set('customCSS', val);
      this._applyCSS(api, val);
      api.ui.showToast('Custom CSS saved and applied', 'success');
    });

    // Clear button
    container.querySelector('#yf-css-clear')?.addEventListener('click', async () => {
      if (editor) editor.value = '';
      await api.storage.set('customCSS', '');
      this._applyCSS(api, '');
      api.ui.showToast('Custom CSS cleared', 'info');
    });

    // Snippet buttons
    container.querySelectorAll('.yf-snippet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const snippet = btn.getAttribute('data-snippet');
        if (editor) {
          editor.value += (editor.value ? '\n\n' : '') + snippet;
          editor.scrollTop = editor.scrollHeight;
        }
      });
    });
  },

  _getSnippets() {
    return [
      { name: 'Hide Member List', css: '/* Hide member list sidebar */\n[class*="members"], [class*="member-list"] {\n  display: none !important;\n}' },
      { name: 'Bigger Chat Font', css: '/* Bigger chat text */\n[class*="message"] {\n  font-size: 16px !important;\n}' },
      { name: 'No Animations', css: '/* Kill all animations */\n* {\n  animation: none !important;\n  transition: none !important;\n}' },
      { name: 'Blur Background', css: '/* Frosted glass effect */\nbody {\n  backdrop-filter: blur(8px);\n}' },
      { name: 'Rounded Avatars', css: '/* Circle avatars */\nimg[class*="avatar"] {\n  border-radius: 50% !important;\n}' },
      { name: 'Compact Mode', css: '/* Reduce spacing in messages */\n[class*="message"] {\n  padding: 2px 16px !important;\n  margin: 0 !important;\n}' },
    ];
  },

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};
