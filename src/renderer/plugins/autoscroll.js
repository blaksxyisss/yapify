/**
 * Plugin: Auto Scroll
 * Automatically scrolls chat to the bottom as new messages arrive.
 * Adds a toggle button next to the GIF icon in the chat input bar.
 * When disabled or when the user scrolls up manually, the button crosses itself out in red.
 * Scrolling back to the bottom or clicking the button re-activates auto-scroll.
 */

export const AutoScrollPlugin = {
  id: 'autoscroll',
  name: 'Auto Scroll',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Automatically scrolls chat to the bottom. Features a toggle button next to the GIF icon that crosses out in red when paused or scrolled up.',

  _api: null,
  _isActive: true,
  _isProgrammaticScroll: false,
  _domObserver: null,
  _scrollContainer: null,
  _scrollListener: null,
  _wheelListener: null,
  _checkInterval: null,

  onStart(api) {
    this._api = api;
    this._isActive = api.storage.get('autoScrollDefault', true);
    api.logger.info('Auto Scroll plugin started');

    // 1. Inject styles for the action button and its crossed-out state
    api.ui.injectStyle('autoscroll-styles', `
      .yf-autoscroll-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        min-width: 28px;
        min-height: 28px;
        padding: 4px;
        margin: 0 2px;
        cursor: pointer;
        color: var(--text-muted, #9294a1);
        transition: color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
        position: relative;
        outline: none;
        user-select: none;
        flex-shrink: 0;
        vertical-align: middle;
      }

      .yf-autoscroll-btn:hover {
        color: var(--text, #ffffff);
        background: rgba(255, 255, 255, 0.08);
      }

      .yf-autoscroll-btn:active {
        transform: scale(0.92);
      }

      .yf-autoscroll-btn.is-active {
        color: var(--accent, #5865f2);
      }

      .yf-autoscroll-btn.is-active:hover {
        color: var(--text, #ffffff);
      }

      .yf-autoscroll-btn.is-disabled {
        color: var(--text-faint, #6e707b);
      }

      .yf-autoscroll-icon {
        width: 18px;
        height: 18px;
        display: block;
        overflow: visible;
        pointer-events: none;
      }

      .yf-autoscroll-icon .yf-as-arrow {
        transition: opacity 0.15s ease, stroke 0.15s ease;
      }

      .yf-autoscroll-btn.is-disabled .yf-as-arrow {
        opacity: 0.38;
      }

      .yf-autoscroll-btn.is-active .yf-as-arrow {
        opacity: 1;
      }

      .yf-autoscroll-icon .yf-as-cross {
        display: none;
        stroke: #ef4444;
        stroke-width: 2.4;
        stroke-linecap: round;
        filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.7));
      }

      .yf-autoscroll-btn.is-disabled .yf-as-cross {
        display: inline;
      }
    `);

    // 2. Start monitoring DOM for chat container and GIF button
    this._startWatcher();
  },

  onStop(api) {
    api.logger.info('Auto Scroll plugin stopped');
    this._stopWatcher();
    api.ui.removeStyle('autoscroll-styles');
    document.querySelectorAll('.yf-autoscroll-btn').forEach(btn => btn.remove());
  },

  _startWatcher() {
    this._attachScrollListeners();
    this._ensureButtonInjected();

    // Check periodically for SPA navigation / chat channel re-renders
    this._checkInterval = setInterval(() => {
      this._ensureButtonInjected();
      this._attachScrollListeners();
    }, 600);

    // MutationObserver to react immediately to new messages and DOM changes
    this._domObserver = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      let hasChatChange = false;

      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          hasNewNodes = true;
          // Check if newly added nodes are inside messages container
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const cls = typeof node.className === 'string' ? node.className : '';
              if (cls.includes('msg') || cls.includes('chat') || node.querySelector?.('.msg, [class*="message"]')) {
                hasChatChange = true;
                break;
              }
            }
          }
        }
      }

      if (hasNewNodes) {
        this._ensureButtonInjected();
      }

      // If active and new messages arrived, scroll to bottom
      if (this._isActive && (hasChatChange || hasNewNodes)) {
        this._onNewMessage();
      }
    });

    this._domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  _stopWatcher() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
    if (this._domObserver) {
      this._domObserver.disconnect();
      this._domObserver = null;
    }
    this._detachScrollListeners();
  },

  _getScrollContainer() {
    // 1. Direct candidates in order of priority
    const candidates = [
      document.querySelector('.messages-inner'),
      document.querySelector('.messages'),
      document.querySelector('.chat .messages'),
      document.querySelector('[class*="messages-inner"]'),
      document.querySelector('[class*="messages"]'),
      document.querySelector('.chat')
    ];

    for (const el of candidates) {
      if (el && this._isScrollable(el)) return el;
    }

    // 2. Look for any scrollable ancestor above a message row
    const anyMsg = document.querySelector('.msg, [class*="msg"], [class*="message"]');
    if (anyMsg) {
      let parent = anyMsg.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        if (this._isScrollable(parent)) return parent;
        parent = parent.parentElement;
      }
    }

    // 3. Fallback: find any element inside .chat with overflow
    const chat = document.querySelector('.chat, [class*="chat"]');
    if (chat) {
      const all = chat.querySelectorAll('*');
      for (const el of all) {
        if (this._isScrollable(el)) return el;
      }
    }

    return document.querySelector('.messages-inner') || document.querySelector('.messages') || document.querySelector('.chat');
  },

  _isScrollable(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    return canScroll && el.scrollHeight > el.clientHeight;
  },

  _attachScrollListeners() {
    const container = this._getScrollContainer();
    if (!container || container === this._scrollContainer) return;

    this._detachScrollListeners();
    this._scrollContainer = container;

    // Detect manual scrolling up and down
    this._scrollListener = () => {
      if (this._isProgrammaticScroll || !this._scrollContainer) return;

      const { scrollTop, scrollHeight, clientHeight } = this._scrollContainer;
      const distFromBottom = scrollHeight - clientHeight - scrollTop;

      // Scrolled up manually (more than 50px from the bottom) -> cross itself out!
      if (distFromBottom > 50) {
        if (this._isActive) {
          this._isActive = false;
          this._updateButtonUI();
          this._api?.logger.debug('Manual scroll up detected; Auto-scroll paused (crossed out)');
        }
      }
      // Scrolled down manually back to the bottom -> uncross and re-activate!
      else if (distFromBottom <= 20) {
        if (!this._isActive) {
          this._isActive = true;
          this._updateButtonUI();
          this._api?.logger.debug('Scrolled back to bottom; Auto-scroll resumed (uncrossed)');
        }
      }
    };

    // Also catch wheel up events directly for immediate response
    this._wheelListener = (e) => {
      if (e.deltaY < 0 && this._isActive) {
        // User rolling wheel up
        this._isActive = false;
        this._updateButtonUI();
        this._api?.logger.debug('Wheel up detected; Auto-scroll paused (crossed out)');
      }
    };

    container.addEventListener('scroll', this._scrollListener, { passive: true });
    container.addEventListener('wheel', this._wheelListener, { passive: true });
  },

  _detachScrollListeners() {
    if (this._scrollContainer) {
      if (this._scrollListener) {
        this._scrollContainer.removeEventListener('scroll', this._scrollListener);
        this._scrollListener = null;
      }
      if (this._wheelListener) {
        this._scrollContainer.removeEventListener('wheel', this._wheelListener);
        this._wheelListener = null;
      }
      this._scrollContainer = null;
    }
  },

  _findGifButton() {
    const composer = document.querySelector('.composer, [class*="composer"], .chat-box, .chat-input, .chat');
    const scope = composer || document;

    // 1. Buttons containing exact text "GIF"
    const buttons = scope.querySelectorAll('button, [role="button"], [class*="btn"], [class*="action"]');
    for (const btn of buttons) {
      if (btn.classList.contains('yf-autoscroll-btn')) continue;
      const text = btn.textContent?.trim().toUpperCase();
      if (text === 'GIF') return btn;
    }

    // 2. Attributes matching "gif"
    const attrBtn = scope.querySelector(
      'button[aria-label*="gif" i], button[title*="gif" i], button[data-tooltip*="gif" i], [class*="gif" i] button, button[class*="gif" i]'
    );
    if (attrBtn && !attrBtn.classList.contains('yf-autoscroll-btn')) {
      return attrBtn.closest('button') || attrBtn;
    }

    // 3. Any element inside composer whose direct text is "GIF"
    for (const el of scope.querySelectorAll('span, div, b, strong, p')) {
      if (el.children.length === 0 && el.textContent?.trim().toUpperCase() === 'GIF') {
        const parentBtn = el.closest('button, [role="button"], [class*="btn"]');
        if (parentBtn && !parentBtn.classList.contains('yf-autoscroll-btn')) return parentBtn;
        return el;
      }
    }

    return null;
  },

  _findActionInsertionPoint() {
    // 1. Try finding the GIF button first
    const gifBtn = this._findGifButton();
    if (gifBtn && gifBtn.parentElement) {
      return { container: gifBtn.parentElement, refEl: gifBtn.nextSibling };
    }

    // 2. Fallback: look for other action buttons in composer (emoji, poll, or send button)
    const composer = document.querySelector('.composer, [class*="composer"]');
    if (composer) {
      const emojiBtn = composer.querySelector('button[aria-label*="emoji" i], [class*="emoji"]');
      if (emojiBtn && emojiBtn.parentElement) {
        return { container: emojiBtn.parentElement, refEl: emojiBtn };
      }

      const anyBtn = composer.querySelector('button[type="submit"], [class*="send"], button:last-of-type');
      if (anyBtn && anyBtn.parentElement) {
        return { container: anyBtn.parentElement, refEl: anyBtn };
      }

      return { container: composer, refEl: null };
    }

    return null;
  },

  _ensureButtonInjected() {
    const existing = document.querySelector('.yf-autoscroll-btn');
    if (existing && document.body.contains(existing)) {
      this._updateButtonUI(existing);
      return;
    }

    const target = this._findActionInsertionPoint();
    if (!target || !target.container) return;

    // Create the autoscroll button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'yf-autoscroll-btn ' + (this._isActive ? 'is-active' : 'is-disabled');
    btn.setAttribute('aria-label', this._isActive ? 'Auto-scroll is ON' : 'Auto-scroll is OFF');

    // SVG icon with arrow down + diagonal cross line
    btn.innerHTML = `
      <svg class="yf-autoscroll-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Downward arrow into bottom tray -->
        <path class="yf-as-arrow" d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" />
        <!-- Red diagonal cross-out line -->
        <line class="yf-as-cross" x1="4" y1="4" x2="20" y2="20" />
      </svg>
    `;

    // Click handler to toggle autoscroll
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      this._isActive = !this._isActive;
      this._updateButtonUI(btn);

      if (this._isActive) {
        this._scrollToBottom(true);
        this._api?.ui.showToast('Auto-scroll enabled', 'info');
      } else {
        this._api?.ui.showToast('Auto-scroll paused (crossed out)', 'info');
      }
    });

    this._updateButtonUI(btn);

    // Insert next to the GIF button or ref element
    try {
      if (target.refEl) {
        target.container.insertBefore(btn, target.refEl);
      } else {
        target.container.appendChild(btn);
      }
      this._api?.logger.info('Injected Auto Scroll button next to GIF icon');
    } catch (err) {
      this._api?.logger.warn('Failed to insert autoscroll button: ' + err.message);
    }
  },

  _updateButtonUI(btn = null) {
    const el = btn || document.querySelector('.yf-autoscroll-btn');
    if (!el) return;

    if (this._isActive) {
      el.classList.add('is-active');
      el.classList.remove('is-disabled');
      el.title = 'Auto-scroll: ON (Click to pause)';
      el.setAttribute('aria-label', 'Auto-scroll is ON');
    } else {
      el.classList.remove('is-active');
      el.classList.add('is-disabled');
      el.title = 'Auto-scroll: PAUSED / OFF (Click or scroll to bottom to enable)';
      el.setAttribute('aria-label', 'Auto-scroll is OFF (Crossed out)');
    }
  },

  _onNewMessage() {
    if (!this._isActive) return;
    this._scrollToBottom(false);
  },

  _scrollToBottom(smooth = false) {
    const container = this._getScrollContainer();
    if (!container) return;

    this._isProgrammaticScroll = true;

    try {
      const targetTop = container.scrollHeight;
      if (smooth) {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTop = targetTop;
      }

      // If Yapin displayed the native "new messages" button, click it to sync client state
      const newBelow = document.querySelector('.new-below');
      if (newBelow && newBelow.offsetParent !== null) {
        newBelow.click();
      }
    } catch (e) {
      // Ignore
    } finally {
      setTimeout(() => {
        this._isProgrammaticScroll = false;
      }, 150);
    }
  },

  renderSettings(api, container) {
    const autoScrollDefault = api.storage.get('autoScrollDefault', true);

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Auto Scroll by Default</span>
            <span class="ym-setting-desc">Automatically keep chat scrolled to the newest messages upon opening or switching channels.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-as-default" ${autoScrollDefault ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px; margin-top: 14px;">
          <div class="ym-setting-info">
            <span class="ym-setting-title">How it works</span>
            <span class="ym-setting-desc" style="line-height: 1.5; color: var(--text-muted, #9294a1);">
              • A toggle button is placed directly <b>next to the GIF icon</b> in the chat input bar.<br/>
              • When active, new messages keep the chat automatically scrolled to the bottom.<br/>
              • When you <b>scroll up manually</b>, the icon <b>crosses itself out in red</b> and pauses auto-scrolling.<br/>
              • When you <b>scroll back down to the bottom</b> or click the button, it uncrosses and resumes auto-scrolling.
            </span>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#yf-as-default')?.addEventListener('change', async (e) => {
      await api.storage.set('autoScrollDefault', e.target.checked);
      this._isActive = e.target.checked;
      this._updateButtonUI();
      api.ui.showToast(`Auto Scroll default: ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'info');
    });
  }
};
