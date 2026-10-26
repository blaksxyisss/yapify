/**
 * Plugin: Message Logger
 * When someone deletes a message, it stays in chat but turns red.
 * Right-click on a deleted message to dismiss it.
 */

export const MessageLoggerPlugin = {
  id: 'message-logger',
  name: 'Message Logger',
  version: '1.1.0',
  author: 'Yapify Team',
  description: 'Deleted messages stay visible in red. Right-click a red message to dismiss it.',

  _observer: null,

  onStart(api) {
    api.logger.info('Message Logger started');

    api.ui.injectStyle('msg-logger', `
      .yf-deleted-msg {
        background: rgba(239, 68, 68, 0.12) !important;
        border-left: 3px solid #ef4444 !important;
        opacity: 0.9 !important;
        position: relative !important;
        transition: background 0.2s ease;
      }
      .yf-deleted-msg:hover {
        background: rgba(239, 68, 68, 0.18) !important;
      }
      .yf-deleted-msg::after {
        content: 'deleted';
        position: absolute;
        top: 6px;
        right: 14px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #ef4444;
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(239, 68, 68, 0.3);
        padding: 1px 6px;
        border-radius: 4px;
        pointer-events: none;
      }
      .yf-deleted-msg .msg-text,
      .yf-deleted-msg [class*="text"] {
        color: #fca5a5 !important;
        text-decoration: line-through;
        text-decoration-color: rgba(239, 68, 68, 0.6);
      }
      .yf-deleted-msg .msg-author,
      .yf-deleted-msg [class*="author"] {
        color: #f87171 !important;
      }
      .yf-deleted-msg img, .yf-deleted-msg video {
        filter: grayscale(0.8) opacity(0.5);
      }
      .yf-dismiss-menu {
        position: fixed;
        background: #1e1e2e;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        padding: 4px;
        z-index: 99999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        min-width: 160px;
      }
      .yf-dismiss-menu button {
        display: block;
        width: 100%;
        background: none;
        border: none;
        color: #e2e8f0;
        padding: 8px 12px;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
      }
      .yf-dismiss-menu button:hover {
        background: rgba(255,255,255,0.08);
      }
      .yf-dismiss-menu .yf-dismiss-danger {
        color: #f87171;
      }
      .yf-dismiss-menu .yf-dismiss-danger:hover {
        background: rgba(248, 113, 113, 0.15);
      }
    `);

    this._startObserving(api);
  },

  onStop(api) {
    api.logger.info('Message Logger stopped');
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    api.ui.removeStyle('msg-logger');
    // Remove all deleted message markers
    document.querySelectorAll('.yf-deleted-msg').forEach(el => {
      el.classList.remove('yf-deleted-msg');
    });
    // Remove any open context menus
    document.querySelectorAll('.yf-dismiss-menu').forEach(el => el.remove());
  },

  _startObserving(api) {
    // Close any open dismiss menu on click elsewhere
    document.addEventListener('click', () => {
      document.querySelectorAll('.yf-dismiss-menu').forEach(el => el.remove());
    });

    this._observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Skip bulk unmounts (e.g. channel or server switches remove many nodes)
        if (mutation.removedNodes.length > 3) continue;

        const target = mutation.target;
        if (!target || target === document.body || target.id === '__next') continue;

        for (const removed of mutation.removedNodes) {
          if (removed.nodeType !== Node.ELEMENT_NODE) continue;

          // ONLY preserve if the removed element ITSELF is a single message row
          if (this._isMessageElement(removed)) {
            this._preserveMessage(api, removed, mutation.target, mutation.nextSibling);
          }
        }
      }
    });

    this._observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  _isMessageElement(el) {
    if (!el || !el.classList) return false;

    // Never match layout or top-level containers
    const tag = el.tagName?.toLowerCase();
    if (tag === 'body' || tag === 'main' || tag === 'section' || tag === 'nav' || tag === 'header') return false;

    const cls = typeof el.className === 'string' ? el.className : '';
    // Must NOT be a container holding channels, members, headers, or multiple messages
    if (
      cls.includes('messages') ||
      cls.includes('chat-shell') ||
      cls.includes('chat-wrap') ||
      cls.includes('chat-row') ||
      cls.includes('server') ||
      cls.includes('channel') ||
      cls.includes('sidebar')
    ) {
      return false;
    }

    // Must NOT contain page-level components (inputs, channel headers, member lists, search bars)
    if (el.querySelector?.('textarea, input, .chat-head, .channel-header, .member-list, .messages, .messages-inner, .chat-start, .chat-shell')) {
      return false;
    }

    // Must NOT contain multiple messages (a message row only contains itself)
    if (el.querySelectorAll?.('.msg, [class*="message"]').length > 1) {
      return false;
    }

    // Must be a message row: strictly has .msg class (or .message)
    const isMsgRow = el.classList.contains('msg') || (el.classList.contains('message') && !el.classList.contains('messages'));
    if (!isMsgRow) return false;

    // Must contain actual message text or body
    return !!el.querySelector?.('.msg-text, .msg-body, [class*="text"]');
  },

  _preserveMessage(api, removedEl, parent, refSibling) {
    // Don't preserve if it's our own deleted marker being dismissed
    if (removedEl.classList?.contains('yf-deleted-msg')) return;
    
    // Don't preserve empty elements
    const text = removedEl.textContent?.trim() || '';
    if (text.length < 1) return;
    
    // Don't preserve if parent is gone (page navigation)
    if (!parent || !document.body.contains(parent)) return;

    // Mark it as deleted and put it back
    removedEl.classList.add('yf-deleted-msg');
    removedEl.style.display = '';

    // Add right-click handler to dismiss
    removedEl.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showDismissMenu(api, e, removedEl);
    };

    // Re-insert into the parent at its original location
    try {
      if (refSibling && parent.contains(refSibling)) {
        parent.insertBefore(removedEl, refSibling);
      } else {
        parent.appendChild(removedEl);
      }
      api.logger.info(`Preserved deleted message: "${text.slice(0, 30)}..."`);
    } catch (err) {
      api.logger.debug('Could not re-insert deleted message: ' + err.message);
    }
  },

  _showDismissMenu(api, event, msgEl) {
    // Remove any existing menus
    document.querySelectorAll('.yf-dismiss-menu').forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'yf-dismiss-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';

    // Dismiss this message
    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Dismiss deleted message';
    dismissBtn.className = 'yf-dismiss-danger';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      msgEl.remove();
      menu.remove();
    });

    // Dismiss all deleted messages
    const dismissAllBtn = document.createElement('button');
    dismissAllBtn.textContent = 'Dismiss all deleted';
    dismissAllBtn.className = 'yf-dismiss-danger';
    dismissAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.yf-deleted-msg').forEach(el => el.remove());
      menu.remove();
      api.ui.showToast('Cleared all deleted messages', 'info');
    });

    // Copy text
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy deleted text';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = msgEl.textContent?.replace('deleted', '').trim() || '';
      navigator.clipboard.writeText(text).then(() => {
        api.ui.showToast('Copied deleted message', 'success');
      });
      menu.remove();
    });

    menu.appendChild(copyBtn);
    menu.appendChild(dismissBtn);
    menu.appendChild(dismissAllBtn);

    document.body.appendChild(menu);

    // Keep menu in viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }

    // Close on escape
    const onKey = (e) => {
      if (e.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  },

  renderSettings(api, container) {
    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Message Logger</span>
            <span class="ym-setting-desc">Deleted messages stay in chat highlighted in red.</span>
          </div>
        </div>
        <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; color: var(--text-faint); font-size: 13px; line-height: 1.6;">
          <div style="border-left: 3px solid #f87171; padding-left: 10px; margin-bottom: 8px; color: #f87171;">
            This is what a deleted message looks like
          </div>
          <strong style="color: var(--text);">How it works:</strong><br/>
          • When someone deletes a message, it stays but turns red<br/>
          • Right-click any red message to dismiss it or copy the text<br/>
          • "Dismiss all deleted" clears every red message at once
        </div>
      </div>
    `;
  }
};
