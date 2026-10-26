/**
 * Plugin: Better Timestamps
 * Replaces relative timestamps with full date/time and adds "time ago" on hover.
 */

export const BetterTimestampsPlugin = {
  id: 'better-timestamps',
  name: 'Better Timestamps',
  version: '1.0.0',
  author: 'Yapify Team',
  description: 'Shows full dates on messages instead of "2 hours ago". Hover to see relative time.',

  _observer: null,
  _interval: null,

  onStart(api) {
    api.logger.info('Better Timestamps started');
    const format = api.storage.get('timeFormat', '12h');

    api.ui.injectStyle('timestamps', `
      .yf-timestamp {
        cursor: default;
        position: relative;
      }
      .yf-timestamp:hover::after {
        content: attr(data-relative);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 9999;
      }
    `);

    this._processExisting(api, format);
    this._startObserving(api, format);
  },

  onStop(api) {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    api.ui.removeStyle('timestamps');
    // Remove our modifications
    document.querySelectorAll('.yf-timestamp').forEach(el => {
      el.classList.remove('yf-timestamp');
      el.removeAttribute('data-relative');
      if (el.dataset.yfOriginal) {
        el.textContent = el.dataset.yfOriginal;
        delete el.dataset.yfOriginal;
      }
    });
  },

  _getTimeString(date, format) {
    const opts = {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: format === '12h'
    };
    const now = new Date();
    if (date.getFullYear() !== now.getFullYear()) {
      opts.year = 'numeric';
    }
    return date.toLocaleString(undefined, opts);
  },

  _getRelative(date) {
    const diff = Date.now() - date.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  },

  _processTimestamp(el, format) {
    if (el.dataset.yfProcessed) return;
    
    // Try to find a datetime attribute or parse the text
    const timeEl = el.closest('time') || el.querySelector('time');
    const datetime = timeEl?.getAttribute('datetime') || el.getAttribute('datetime');
    
    let date = null;
    if (datetime) {
      date = new Date(datetime);
    } else {
      // Try parsing text like "2 hours ago", "yesterday", etc
      const text = el.textContent?.trim().toLowerCase() || '';
      if (text.includes('ago') || text.includes('yesterday') || text.includes('today')) {
        // Keep original for these since we can't reliably parse them
        return;
      }
    }

    if (date && !isNaN(date.getTime())) {
      el.dataset.yfOriginal = el.textContent;
      el.textContent = this._getTimeString(date, format);
      el.dataset.yfRelative = this._getRelative(date);
      el.setAttribute('data-relative', this._getRelative(date));
      el.classList.add('yf-timestamp');
      el.dataset.yfProcessed = 'true';
    }
  },

  _processExisting(api, format) {
    document.querySelectorAll('time, [class*="timestamp"], [class*="time"]').forEach(el => {
      this._processTimestamp(el, format);
    });
  },

  _startObserving(api, format) {
    this._observer = new MutationObserver(() => {
      this._processExisting(api, format);
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  },

  renderSettings(api, container) {
    const format = api.storage.get('timeFormat', '12h');

    container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Time Format</span>
            <span class="ym-setting-desc">Choose between 12-hour (3:45 PM) or 24-hour (15:45) display.</span>
          </div>
          <div class="ym-setting-control">
            <select id="yf-time-format" class="ym-select" style="background: rgba(255,255,255,0.08); color: var(--text); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px;">
              <option value="12h" ${format === '12h' ? 'selected' : ''}>12-hour</option>
              <option value="24h" ${format === '24h' ? 'selected' : ''}>24-hour</option>
            </select>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#yf-time-format')?.addEventListener('change', async (e) => {
      await api.storage.set('timeFormat', e.target.value);
      api.ui.showToast(`Switched to ${e.target.value === '12h' ? '12-hour' : '24-hour'} format. Refresh to apply.`, 'info');
    });
  }
};
