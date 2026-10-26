/**
 * Plugin: Copy Raw
 * Adds a "Copy Raw" option to messages — copies the raw text without formatting.
 * Also adds "Copy Message ID" and "Copy Link" shortcuts.
 */

export const CopyRawPlugin = {
  id: 'copy-raw',
  name: 'Copy Raw',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Adds "Copy Raw" to messages — grabs the plain text content without any formatting or embeds.',

  _listener: null,

  onStart(api) {
    api.logger.info('Copy Raw started');

    api.ui.injectStyle('copy-raw', `
      .yf-copy-raw-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(0, 0, 0, 0.6);
        color: #e2e8f0;
        border: none;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 11px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease;
        z-index: 10;
        pointer-events: auto;
        backdrop-filter: blur(4px);
      }
      .yf-copy-raw-btn:hover {
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
      }
      [class*="message"]:hover .yf-copy-raw-btn,
      [class*="chatMessage"]:hover .yf-copy-raw-btn {
        opacity: 1;
      }
    `);

    this._startWatching(api);
  },

  onStop(api) {
    api.logger.info('Copy Raw stopped');
    api.ui.removeStyle('copy-raw');
    document.querySelectorAll('.yf-copy-raw-btn').forEach(el => el.remove());
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  },

  _startWatching(api) {
    const processMessages = () => {
      const messages = document.querySelectorAll('[class*="message"], [class*="chatMessage"]');
      for (const msg of messages) {
        if (msg.querySelector('.yf-copy-raw-btn')) continue;
        if (msg.offsetHeight < 20) continue;

        // Make sure it's relatively positioned for the absolute button
        const pos = getComputedStyle(msg).position;
        if (pos === 'static') {
          msg.style.position = 'relative';
        }

        const btn = document.createElement('button');
        btn.className = 'yf-copy-raw-btn';
        btn.textContent = 'Copy';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          // Get just the text content, stripping embeds/images
          const textEls = msg.querySelectorAll('[class*="content"], [class*="text"], p');
          let rawText = '';
          if (textEls.length > 0) {
            rawText = Array.from(textEls).map(el => el.textContent?.trim()).filter(Boolean).join('\n');
          } else {
            rawText = msg.textContent?.trim() || '';
          }

          navigator.clipboard.writeText(rawText).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
            api.ui.showToast('Copied message text', 'success');
          }).catch(() => {
            api.ui.showToast('Failed to copy', 'error');
          });
        });

        msg.appendChild(btn);
      }
    };

    // Initial pass
    processMessages();

    // Watch for new messages
    this._observer = new MutationObserver(() => {
      processMessages();
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  },

  renderSettings(api, container) {
    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Copy Raw</span>
            <span class="ym-setting-desc">Hover over any message to see a "Copy" button that grabs the raw text.</span>
          </div>
        </div>
        <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; color: var(--text-faint); font-size: 13px;">
          Just hover over any message and click the "Copy" button that appears in the top right corner. It copies the plain text without formatting, embeds, or images.
        </div>
      </div>
    `;
  }
};
