/**
 * Plugin: Do Not Disturb
 * Suppresses desktop notifications and optionally hides unread badges.
 */

export const DoNotDisturbPlugin = {
  id: 'do-not-disturb',
  name: 'Do Not Disturb',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Suppress desktop notifications and optionally hide unread badges. Great for focusing or streaming.',

  _originalNotification: null,
  _originalBadge: null,

  onStart(api) {
    api.logger.info('Do Not Disturb started');

    const suppressNotifs = api.storage.get('suppressNotifs', true);
    const hideBadges = api.storage.get('hideBadges', false);

    if (suppressNotifs) {
      this._suppressNotifications(api);
    }

    if (hideBadges) {
      this._hideBadges(api);
    }
  },

  onStop(api) {
    api.logger.info('Do Not Disturb stopped');
    // Restore original Notification
    if (this._originalNotification) {
      window.Notification = this._originalNotification;
      this._originalNotification = null;
    }
    if (this._originalBadge && window.yapperDesktop) {
      window.yapperDesktop.setBadge = this._originalBadge;
      this._originalBadge = null;
    }
    api.ui.removeStyle('dnd-badges');
  },

  _suppressNotifications(api) {
    // Override the Notification constructor to silently eat notifications
    this._originalNotification = window.Notification;
    const FakeNotification = function(title, options) {
      api.logger.debug(`DND: suppressed notification "${title}"`);
    };
    FakeNotification.permission = 'granted';
    FakeNotification.requestPermission = () => Promise.resolve('granted');
    window.Notification = FakeNotification;

    // Also suppress Yapper's native notification bridge
    if (window.yapperDesktop?.notify) {
      const origNotify = window.yapperDesktop.notify;
      window.yapperDesktop.notify = (n) => {
        api.logger.debug(`DND: suppressed yapper notify "${n?.title}"`);
      };
    }
  },

  _hideBadges(api) {
    // Suppress the badge count on taskbar
    if (window.yapperDesktop?.setBadge) {
      this._originalBadge = window.yapperDesktop.setBadge;
      window.yapperDesktop.setBadge = () => {};
    }

    // Hide unread count badges in the UI
    api.ui.injectStyle('dnd-badges', `
      [class*="badge"], [class*="unread-count"], [class*="mention-badge"],
      [class*="numberBadge"], [class*="count"] {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `);
  },

  renderSettings(api, container) {
    const suppressNotifs = api.storage.get('suppressNotifs', true);
    const hideBadges = api.storage.get('hideBadges', false);

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Suppress Notifications</span>
            <span class="ym-setting-desc">Block all desktop notifications from Yapin while DND is active.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-dnd-notifs" ${suppressNotifs ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Hide Unread Badges</span>
            <span class="ym-setting-desc">Hides all unread count badges and mention indicators in the sidebar.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-dnd-badges" ${hideBadges ? 'checked' : ''} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#yf-dnd-notifs')?.addEventListener('change', async (e) => {
      await api.storage.set('suppressNotifs', e.target.checked);
      api.ui.showToast(e.target.checked ? 'Notifications suppressed' : 'Notifications restored (restart needed)', 'info');
    });

    container.querySelector('#yf-dnd-badges')?.addEventListener('change', async (e) => {
      await api.storage.set('hideBadges', e.target.checked);
      if (e.target.checked) {
        this._hideBadges(api);
      } else {
        api.ui.removeStyle('dnd-badges');
      }
    });
  }
};
