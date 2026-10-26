/**
 * Plugin: No Pings
 * Adds a quick toggle under the Direct Messages (DMs) button in the server rail
 * to silence all pings, audio notification sounds, desktop alerts, and mention badges.
 * Must first be toggled in the Plugins settings page before the toggle appears on the main page.
 */

export const NoPingsPlugin = {
  id: 'no-pings',
  name: 'No Pings',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Adds a toggle under the DMs button to silence all pings, notification sounds, desktop alerts, and unread badges.',

  _api: null,
  _isActive: false,
  _checkInterval: null,
  _originalAudioPlay: null,
  _originalNotification: null,
  _originalYapperNotify: null,
  _originalBadge: null,
  _lastBadgeCount: 0,
  _titleHooked: false,
  _origTitleGet: null,
  _origTitleSet: null,
  _titleObserver: null,
  _rawTitle: null,
  _isSettingTitle: false,

  onStart(api) {
    this._api = api;
    this._isActive = api.storage.get('active', true);
    api.logger.info(`No Pings plugin started (initial active state: ${this._isActive})`);

    // 1. Inject styles for the rail toggle and tooltip
    this._injectStyles(api);

    // 2. Hook document title to intercept unread count like (1) Yapin'
    this._hookTitle();

    // 3. If active, apply suppression hooks
    if (this._isActive) {
      this._applySuppression();
    }

    // 4. Start DOM watcher to safely inject toggle under the DMS button
    this._startWatcher();
  },

  onStop(api) {
    api.logger.info('No Pings plugin stopped; cleaning up elements and restoring notifications');

    // 1. Stop DOM watcher
    this._stopWatcher();

    // 2. Remove injected toggle button from rail
    const toggleWrap = document.getElementById('yf-no-pings-wrap');
    if (toggleWrap) toggleWrap.remove();

    // 3. Restore title and remove ping suppression
    this._removeSuppression();
    this._restoreTitle();
    this._unhookTitle();

    // 4. Clean up injected styles
    api.ui.removeStyle('toggle-styles');
    api.ui.removeStyle('suppression-styles');

    this._api = null;
  },

  _injectStyles(api) {
    api.ui.injectStyle('toggle-styles', `
      /* No Pings Rail Wrapper */
      .yf-no-pings-wrap {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin: 4px 0 6px 0;
        z-index: 20;
      }

      /* Native Discord/Yapin Left Indicator Pill */
      .yf-no-pings-pill {
        position: absolute;
        left: 0;
        width: 4px;
        height: 0;
        border-radius: 0 4px 4px 0;
        background: #ffffff;
        transition: height 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, box-shadow 0.2s ease;
        pointer-events: none;
      }

      .yf-no-pings-wrap:hover .yf-no-pings-pill {
        height: 14px;
      }

      .yf-no-pings-wrap.is-active .yf-no-pings-pill {
        height: 26px;
        background: #ef4444;
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.65);
      }

      /* Rail Toggle Button */
      .yf-no-pings-btn {
        position: relative;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 0;
        cursor: pointer;
        outline: none;
        user-select: none;
        transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }

      .yf-no-pings-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        transform: scale(1.04);
      }

      .yf-no-pings-btn:active {
        transform: scale(0.94);
      }

      /* Active State (No Pings ON - Red Mute Glow) */
      .yf-no-pings-wrap.is-active .yf-no-pings-btn {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(185, 28, 28, 0.14) 100%);
        border-color: rgba(239, 68, 68, 0.55);
        box-shadow: 0 0 16px rgba(239, 68, 68, 0.35), inset 0 0 10px rgba(239, 68, 68, 0.2);
      }

      .yf-no-pings-wrap.is-active .yf-no-pings-btn:hover {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.35) 0%, rgba(185, 28, 28, 0.22) 100%);
        border-color: rgba(239, 68, 68, 0.7);
        box-shadow: 0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 12px rgba(239, 68, 68, 0.25);
      }

      /* Icon & Slash Animation */
      .yf-no-pings-icon-container {
        position: relative;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .yf-no-pings-svg {
        width: 19px;
        height: 19px;
        overflow: visible;
        color: var(--text-muted, #949ba4);
        transition: color 0.2s ease, transform 0.2s ease;
      }

      .yf-no-pings-btn:hover .yf-no-pings-svg {
        color: var(--text, #ffffff);
      }

      .yf-no-pings-wrap.is-active .yf-no-pings-svg {
        color: #ef4444;
      }

      .yf-bell-slash {
        transition: stroke-dashoffset 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
        stroke: #ef4444;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-dasharray: 30;
        stroke-dashoffset: 30;
        opacity: 0;
      }

      .yf-no-pings-wrap.is-active .yf-bell-slash {
        stroke-dashoffset: 0;
        opacity: 1;
      }

      /* Micro Toggle Switch inside the Button */
      .yf-no-pings-switch {
        width: 22px;
        height: 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.16);
        position: relative;
        transition: background 0.25s ease;
        box-sizing: border-box;
      }

      .yf-no-pings-knob {
        position: absolute;
        top: 1.5px;
        left: 2px;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #ffffff;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }

      .yf-no-pings-wrap.is-active .yf-no-pings-switch {
        background: #ef4444;
      }

      .yf-no-pings-wrap.is-active .yf-no-pings-knob {
        transform: translateX(11px);
        background: #ffffff;
      }

      /* Glassmorphic Side Tooltip */
      .yf-no-pings-tooltip {
        position: absolute;
        left: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%) translateX(-6px);
        background: rgba(18, 19, 25, 0.96);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65);
        border-radius: 8px;
        padding: 8px 12px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
        z-index: 10000;
        font-family: inherit;
      }

      .yf-no-pings-tooltip::before {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 5px solid transparent;
        border-right-color: rgba(18, 19, 25, 0.96);
      }

      .yf-no-pings-wrap:hover .yf-no-pings-tooltip {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
      }

      .yf-np-tooltip-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
      }

      .yf-np-tooltip-title {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
      }

      .yf-np-tooltip-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .yf-np-badge-off {
        background: rgba(255, 255, 255, 0.12);
        color: #a1a1aa;
      }

      .yf-np-badge-on {
        background: rgba(239, 68, 68, 0.25);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }

      .yf-np-tooltip-desc {
        font-size: 11px;
        color: var(--text-muted, #949ba4);
      }
    `);
  },

  _startWatcher() {
    this._ensureToggleInjected();

    // Safe, non-blocking interval check
    this._checkInterval = setInterval(() => {
      this._ensureToggleInjected();
      if (this._isActive) {
        this._sanitizeCurrentTitle();
      }
    }, 600);
  },

  _stopWatcher() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  },

  /**
   * Locate the Direct Messages (DMs) button in the server rail.
   */
  _findDmsItem(rail) {
    if (!rail) return null;

    // Look for DMs button / link by common patterns
    const dmsSelectors = [
      '[data-testid="dms-button"]',
      'a[href*="/@me"]',
      'a[href*="channels/@me"]',
      'a[href="/dms"]',
      'button[aria-label*="Direct Messages" i]',
      'a[aria-label*="Direct Messages" i]',
      'button[aria-label*="Direct messages" i]',
      'button[title*="Direct Messages" i]',
      'a[title*="Direct Messages" i]',
      'button[title*="Direct messages" i]',
      'button[aria-label*="DMs" i]',
      'button[title*="DMs" i]',
      '.rail-item[href*="@me"]'
    ];

    for (const sel of dmsSelectors) {
      const el = rail.querySelector(sel);
      if (el) {
        return el.closest('.rail-wrap') || el;
      }
    }

    // In Yapin/Discord, the DMS button is the first .rail-wrap or .rail-item in the rail
    const firstWrap = rail.querySelector('.rail-wrap:not(.yf-no-pings-wrap)');
    if (firstWrap) return firstWrap;

    const firstBtn = rail.querySelector('button.rail-item, a.rail-item');
    if (firstBtn && !firstBtn.classList.contains('yf-no-pings-btn')) {
      return firstBtn.closest('.rail-wrap') || firstBtn;
    }

    // Fallback: rail's first child
    const firstChild = rail.firstElementChild;
    if (firstChild && firstChild.id !== 'yf-no-pings-wrap') return firstChild;

    return null;
  },

  /**
   * Ensure the No Pings toggle is injected right under the DMS button.
   * Rock-solid: never removes or loops if already present in the DOM.
   */
  _ensureToggleInjected() {
    if (!this._api) return;

    // 1. If the toggle already exists in document, do not re-insert or touch DOM structure
    const existing = document.getElementById('yf-no-pings-wrap');
    if (existing && document.contains(existing)) {
      this._updateVisualState();
      return;
    }

    // 2. Locate the rail
    const rail = document.querySelector('nav.rail, aside.rail, nav[class*="rail"], aside[class*="rail"], .rail');
    if (!rail) return;

    // 3. Locate the DMS button
    const dmsItem = this._findDmsItem(rail);
    if (!dmsItem) return;

    // 4. Create and insert toggle directly after DMS button
    const toggleWrap = this._createToggleElement();
    dmsItem.insertAdjacentElement('afterend', toggleWrap);
    this._updateVisualState();
  },

  /**
   * Create the toggle DOM element.
   */
  _createToggleElement() {
    const wrap = document.createElement('div');
    wrap.id = 'yf-no-pings-wrap';
    wrap.className = `rail-wrap yf-no-pings-wrap ${this._isActive ? 'is-active' : ''}`;
    wrap.setAttribute('data-yf-plugin', 'no-pings');

    wrap.innerHTML = `
      <div class="yf-no-pings-pill"></div>
      <button class="rail-item yf-no-pings-btn" id="yf-no-pings-btn" type="button" aria-label="Toggle No Pings" role="switch" aria-checked="${this._isActive}">
        <div class="yf-no-pings-icon-container">
          <svg class="yf-no-pings-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            <line class="yf-bell-slash" x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        </div>
        <div class="yf-no-pings-switch">
          <div class="yf-no-pings-knob"></div>
        </div>
      </button>

      <div class="yf-no-pings-tooltip" role="tooltip">
        <div class="yf-np-tooltip-header">
          <span class="yf-np-tooltip-title">No Pings</span>
          <span class="yf-np-tooltip-badge ${this._isActive ? 'yf-np-badge-on' : 'yf-np-badge-off'}">${this._isActive ? 'ON' : 'OFF'}</span>
        </div>
        <div class="yf-np-tooltip-desc">${this._isActive ? 'All pings & sounds silenced' : 'Click to silence all pings'}</div>
      </div>
    `;

    const btn = wrap.querySelector('#yf-no-pings-btn');
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleActive();
    });

    return wrap;
  },

  /**
   * Update visual state (classes, attributes, tooltip) across the toggle button.
   */
  _updateVisualState() {
    const wrap = document.getElementById('yf-no-pings-wrap');
    if (!wrap) return;

    const shouldHaveActive = !!this._isActive;
    if (wrap.classList.contains('is-active') !== shouldHaveActive) {
      if (shouldHaveActive) {
        wrap.classList.add('is-active');
      } else {
        wrap.classList.remove('is-active');
      }
    }

    const btn = wrap.querySelector('#yf-no-pings-btn');
    if (btn && btn.getAttribute('aria-checked') !== String(shouldHaveActive)) {
      btn.setAttribute('aria-checked', String(shouldHaveActive));
    }

    const badge = wrap.querySelector('.yf-np-tooltip-badge');
    if (badge) {
      const targetClass = `yf-np-tooltip-badge ${shouldHaveActive ? 'yf-np-badge-on' : 'yf-np-badge-off'}`;
      if (badge.className !== targetClass) badge.className = targetClass;
      const targetText = shouldHaveActive ? 'ON' : 'OFF';
      if (badge.textContent !== targetText) badge.textContent = targetText;
    }

    const desc = wrap.querySelector('.yf-np-tooltip-desc');
    if (desc) {
      const targetDesc = shouldHaveActive ? 'All pings & sounds silenced' : 'Click to silence all pings';
      if (desc.textContent !== targetDesc) desc.textContent = targetDesc;
    }
  },

  /**
   * Toggle between active (No Pings ON) and inactive (No Pings OFF).
   */
  async toggleActive() {
    this._isActive = !this._isActive;

    if (this._api?.storage) {
      await this._api.storage.set('active', this._isActive);
    }

    this._updateVisualState();

    if (this._isActive) {
      this._applySuppression();
      // Notice: No popup toast, as requested by user
    } else {
      this._removeSuppression();
      this._restoreTitle();
      // Notice: No popup toast, as requested by user
    }
  },

  /**
   * Hook document.title and <title> tag to prevent (1) unread count on taskbar while active.
   */
  _hookTitle() {
    if (this._titleHooked) {
      if (this._isActive) this._sanitizeCurrentTitle();
      return;
    }

    // 1. Hook Document.prototype.title
    try {
      const proto = Document.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'title')
        || (typeof HTMLDocument !== 'undefined' && Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'title'))
        || Object.getOwnPropertyDescriptor(document, 'title');

      if (desc && desc.set && desc.get) {
        this._origTitleGet = desc.get;
        this._origTitleSet = desc.set;
        const self = this;

        Object.defineProperty(document, 'title', {
          configurable: true,
          enumerable: true,
          get() {
            return self._origTitleGet.call(this);
          },
          set(val) {
            self._rawTitle = val;
            if (typeof val === 'string') {
              const match = val.match(/^\((\d+)\+?\)/);
              if (match && match[1]) {
                self._lastBadgeCount = parseInt(match[1], 10);
              }
            }
            if (self._isActive && typeof val === 'string') {
              const cleaned = val.replace(/^\(\d+\+?\)\s*/, '');
              return self._origTitleSet.call(this, cleaned);
            }
            return self._origTitleSet.call(this, val);
          }
        });
        this._titleHooked = true;
      }
    } catch (err) {}

    // 2. Also observe the DOM for direct <title> tag text changes
    try {
      const targetNode = document.querySelector('head') || document.documentElement || document;
      if (targetNode && !this._titleObserver) {
        this._titleObserver = new MutationObserver(() => {
          if (!this._isActive || this._isSettingTitle) return;
          const titleEl = document.querySelector('title');
          const current = titleEl?.textContent || document.title || '';
          if (/^\(\d+\+?\)\s*/.test(current)) {
            this._rawTitle = current;
            const match = current.match(/^\((\d+)\+?\)/);
            if (match && match[1]) {
              this._lastBadgeCount = parseInt(match[1], 10);
            }
            this._sanitizeCurrentTitle();
          }
        });
        this._titleObserver.observe(targetNode, { childList: true, characterData: true, subtree: true });
      }
    } catch (err) {}

    if (this._isActive) {
      this._sanitizeCurrentTitle();
    }
  },

  /**
   * Strip leading (1) count from current window title if active.
   */
  _sanitizeCurrentTitle() {
    const suppressTitle = this._api ? this._api.storage.get('suppressTitleCount', true) : true;
    if (!suppressTitle) return;

    try {
      const current = document.title || document.querySelector('title')?.textContent || '';
      if (/^\(\d+\+?\)\s*/.test(current)) {
        this._rawTitle = current;
        const match = current.match(/^\((\d+)\+?\)/);
        if (match && match[1]) {
          this._lastBadgeCount = parseInt(match[1], 10);
        }
        const cleaned = current.replace(/^\(\d+\+?\)\s*/, '');
        this._isSettingTitle = true;
        if (this._origTitleSet) {
          this._origTitleSet.call(document, cleaned);
        } else {
          document.title = cleaned;
        }
        const titleEl = document.querySelector('title');
        if (titleEl) {
          titleEl.textContent = cleaned;
        }
        this._isSettingTitle = false;
      }
    } catch (err) {}
  },

  /**
   * Restore the raw title (e.g. (1) Yapin') when No Pings is deactivated.
   */
  _restoreTitle() {
    try {
      this._isSettingTitle = true;
      let targetTitle = this._rawTitle;
      if (!targetTitle || !/^\(\d+\+?\)\s*/.test(targetTitle)) {
        if (this._lastBadgeCount > 0) {
          const current = (targetTitle || document.title || document.querySelector('title')?.textContent || 'Yapin\'').replace(/^\(\d+\+?\)\s*/, '');
          targetTitle = `(${this._lastBadgeCount}) ${current}`;
        }
      }

      if (targetTitle) {
        if (this._origTitleSet) {
          this._origTitleSet.call(document, targetTitle);
        } else {
          document.title = targetTitle;
        }
        const titleEl = document.querySelector('title');
        if (titleEl) {
          titleEl.textContent = targetTitle;
        }
      }
      this._isSettingTitle = false;
    } catch (err) {}
  },

  /**
   * Unhook document.title descriptor.
   */
  _unhookTitle() {
    if (!this._titleHooked) return;
    try {
      if (this._origTitleSet && this._origTitleGet) {
        Object.defineProperty(document, 'title', {
          configurable: true,
          enumerable: true,
          get: this._origTitleGet,
          set: this._origTitleSet
        });
      }
    } catch (err) {}

    if (this._titleObserver) {
      this._titleObserver.disconnect();
      this._titleObserver = null;
    }
    this._titleHooked = false;
  },

  /**
   * Apply ping suppression (audio, desktop alerts, badge counts, title count, and in-app mention pills).
   */
  _applySuppression() {
    if (!this._api) return;

    const muteSounds = this._api.storage.get('muteSounds', true);
    const suppressDesktopNotifs = this._api.storage.get('suppressDesktopNotifs', true);
    const hideBadges = this._api.storage.get('hideBadges', true);
    const suppressTaskbarBadge = this._api.storage.get('suppressTaskbarBadge', true);

    // 1. Audio suppression: safely mute Audio instances
    if (muteSounds && !this._originalAudioPlay) {
      try {
        if (window.Audio?.prototype?.play) {
          this._originalAudioPlay = window.Audio.prototype.play;
          const self = this;
          window.Audio.prototype.play = function() {
            if (self._isActive) {
              this.muted = true;
              this.volume = 0;
            }
            return self._originalAudioPlay.apply(this, arguments);
          };
        }
      } catch (err) {}
    }

    // 2. Desktop notification suppression: override Notification constructor and Yapper native notify
    if (suppressDesktopNotifs && !this._originalNotification) {
      try {
        this._originalNotification = window.Notification;
        const self = this;
        const FakeNotification = function(title, options) {
          if (self._isActive) {
            self._api?.logger?.debug(`No Pings: blocked desktop notification "${title}"`);
            return;
          }
          return new self._originalNotification(title, options);
        };
        FakeNotification.permission = 'granted';
        FakeNotification.requestPermission = () => Promise.resolve('granted');
        window.Notification = FakeNotification;
      } catch (err) {}

      try {
        if (window.yapperDesktop?.notify) {
          this._originalYapperNotify = window.yapperDesktop.notify;
          const self = this;
          window.yapperDesktop.notify = (n) => {
            if (self._isActive) {
              self._api?.logger?.debug(`No Pings: blocked native Yapper notify "${n?.title}"`);
              return;
            }
            self._originalYapperNotify(n);
          };
        }
      } catch (err) {}
    }

    // 3. Taskbar badge count suppression
    if (suppressTaskbarBadge && !this._originalBadge) {
      try {
        if (window.yapperDesktop?.setBadge) {
          this._originalBadge = window.yapperDesktop.setBadge;
          const self = this;
          window.yapperDesktop.setBadge = (count) => {
            if (typeof count === 'number') {
              self._lastBadgeCount = count;
            }
            if (self._isActive) {
              self._api?.logger?.debug('No Pings: suppressed taskbar badge count');
              self._originalBadge(0);
              return;
            }
            self._originalBadge(count);
          };
          window.yapperDesktop.setBadge(0);
        }
      } catch (err) {}
    }

    // 4. In-App mention badges suppression
    if (hideBadges) {
      this._api.ui.injectStyle('suppression-styles', `
        body.yf-no-pings-active .at-btn,
        body.yf-no-pings-active [class*="at-btn"],
        body.yf-no-pings-active [class*="at-count"],
        body.yf-no-pings-active .rail-wrap.unread::before,
        body.yf-no-pings-active .rail-wrap.unread::after,
        body.yf-no-pings-active [class*="unread-count"],
        body.yf-no-pings-active [class*="mention-badge"],
        body.yf-no-pings-active [class*="numberBadge"],
        body.yf-no-pings-active aside .badge,
        body.yf-no-pings-active nav .badge {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `);
      document.body.classList.add('yf-no-pings-active');
    }

    // 5. Sanitize window title count
    this._sanitizeCurrentTitle();
  },

  /**
   * Remove ping suppression and restore native behaviors.
   */
  _removeSuppression() {
    document.body.classList.remove('yf-no-pings-active');
    if (this._api?.ui) {
      this._api.ui.removeStyle('suppression-styles');
    }

    if (this._originalAudioPlay) {
      window.Audio.prototype.play = this._originalAudioPlay;
      this._originalAudioPlay = null;
    }
    if (this._originalNotification) {
      window.Notification = this._originalNotification;
      this._originalNotification = null;
    }
    if (this._originalYapperNotify && window.yapperDesktop) {
      window.yapperDesktop.notify = this._originalYapperNotify;
      this._originalYapperNotify = null;
    }
    if (this._originalBadge && window.yapperDesktop) {
      window.yapperDesktop.setBadge = this._originalBadge;
      if (typeof this._lastBadgeCount === 'number' && this._lastBadgeCount > 0) {
        try {
          this._originalBadge(this._lastBadgeCount);
        } catch (err) {}
      }
      this._originalBadge = null;
    }

    this._restoreTitle();
  },

  /**
   * Render custom settings in the Plugins page (Settings -> Plugins).
   */
  renderSettings(api, container) {
    const muteSounds = api.storage.get('muteSounds', true);
    const suppressDesktopNotifs = api.storage.get('suppressDesktopNotifs', true);
    const hideBadges = api.storage.get('hideBadges', true);
    const suppressTaskbarBadge = api.storage.get('suppressTaskbarBadge', true);

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <!-- Status Banner -->
        <div id="yf-np-status-banner" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: ${this._isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${this._isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; margin-bottom: 14px;">
          <div>
            <div id="yf-np-status-text" style="font-weight: 600; font-size: 13px; color: ${this._isActive ? '#ef4444' : 'var(--text, #ffffff)'};">
              Toggle Under DMs Button: <b>${this._isActive ? 'ACTIVE (Pings Muted)' : 'INACTIVE (Pings Normal)'}</b>
            </div>
            <div style="font-size: 11px; color: var(--text-muted, #949ba4); margin-top: 2px;">
              Located directly under the Direct Messages bear icon in the left server rail.
            </div>
          </div>
          <button class="yf-btn secondary" id="yf-np-quick-toggle" style="font-size: 11px; padding: 5px 12px; border-radius: 6px;">
            ${this._isActive ? 'Turn Off' : 'Turn On'}
          </button>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Mute Ping Sounds</span>
            <span class="ym-setting-desc">Silences all notification sounds and audio alerts while No Pings is active.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-np-mute-sounds" ${muteSounds ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Block Desktop Notifications</span>
            <span class="ym-setting-desc">Blocks OS notification popup banners from appearing while No Pings is active.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-np-suppress-notifs" ${suppressDesktopNotifs ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Hide In-App Mention Badges</span>
            <span class="ym-setting-desc">Hides the @1 ping button, server unread dots, and channel mention count badges.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-np-hide-badges" ${hideBadges ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Suppress Taskbar Badge</span>
            <span class="ym-setting-desc">Prevents the red unread count badge on the Windows taskbar icon.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-np-suppress-taskbar" ${suppressTaskbarBadge ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    // Bind setting controls cleanly with in-place DOM updates
    const quickToggleBtn = container.querySelector('#yf-np-quick-toggle');
    quickToggleBtn?.addEventListener('click', async () => {
      await this.toggleActive();
      const statusText = container.querySelector('#yf-np-status-text');
      const banner = container.querySelector('#yf-np-status-banner');
      if (statusText) {
        statusText.innerHTML = `Toggle Under DMs Button: <b>${this._isActive ? 'ACTIVE (Pings Muted)' : 'INACTIVE (Pings Normal)'}</b>`;
        statusText.style.color = this._isActive ? '#ef4444' : 'var(--text, #ffffff)';
      }
      if (banner) {
        banner.style.background = this._isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.04)';
        banner.style.borderColor = this._isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.08)';
      }
      quickToggleBtn.textContent = this._isActive ? 'Turn Off' : 'Turn On';
    });

    container.querySelector('#yf-np-mute-sounds')?.addEventListener('change', async (e) => {
      await api.storage.set('muteSounds', e.target.checked);
      if (this._isActive) this._applySuppression();
    });

    container.querySelector('#yf-np-suppress-notifs')?.addEventListener('change', async (e) => {
      await api.storage.set('suppressDesktopNotifs', e.target.checked);
      if (this._isActive) this._applySuppression();
    });

    container.querySelector('#yf-np-hide-badges')?.addEventListener('change', async (e) => {
      await api.storage.set('hideBadges', e.target.checked);
      if (this._isActive) {
        if (e.target.checked) {
          this._applySuppression();
        } else {
          document.body.classList.remove('yf-no-pings-active');
          api.ui.removeStyle('suppression-styles');
        }
      }
    });

    container.querySelector('#yf-np-suppress-taskbar')?.addEventListener('change', async (e) => {
      await api.storage.set('suppressTaskbarBadge', e.target.checked);
      if (this._isActive) this._applySuppression();
    });
  }
};
