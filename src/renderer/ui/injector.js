/**
 * Yapify UI Injector
 * Injects Yapify tabs directly into Yapin's settings sidebar navigation.
 * No floating icons — everything lives inside the native settings page.
 */

import { CORE_STYLES } from './styles.js';
import { settingsPanel } from './settings-panel.js';
import { events } from '../core/event-bus.js';
import { logger } from '../core/logger.js';

class UIInjector {
  constructor() {
    this.toastContainer = null;
    this.injected = false;
    this.observer = null;
    this.sidebarCheckInterval = null;
  }

  init() {
    this.injectStyles();
    this.setupToastContainer();
    this.setupHotkeys();
    this.startSidebarWatcher();
    logger.info('UIInjector initialized — watching for settings sidebar');
  }

  injectStyles() {
    if (document.getElementById('yapify-core-styles')) return;
    const style = document.createElement('style');
    style.id = 'yapify-core-styles';
    style.textContent = CORE_STYLES;
    document.head.appendChild(style);
  }

  setupToastContainer() {
    if (document.getElementById('yf-toast-container')) {
      this.toastContainer = document.getElementById('yf-toast-container');
      return;
    }

    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'yf-toast-container';
    this.toastContainer.className = 'yf-toast-container';
    document.body.appendChild(this.toastContainer);

    events.on('toast', (msg, type = 'info') => this.showToast(msg, type));
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) this.setupToastContainer();

    const toast = document.createElement('div');
    toast.className = `yf-toast ${type}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  setupHotkeys() {
    // Alt+Y opens Yapify settings by navigating to settings and clicking our tab
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.activateYapifyTab('plugins');
      }
    });

    // Listen for IPC message from main process
    if (window.yapinmodBridge?.on) {
      window.yapinmodBridge.on('yapinmod:toggle-settings', () => {
        this.activateYapifyTab('plugins');
      });
    }
  }

  /**
   * Activate a specific Yapify tab in the settings sidebar.
   * If settings aren't open, tries to find/click the native settings button first.
   */
  activateYapifyTab(tabId = 'plugins') {
    const tab = document.getElementById(`yf-tab-${tabId}`);
    if (tab) {
      tab.click();
      return;
    }
    // If our tabs aren't injected yet, try triggering native settings first
    // Look for settings/gear button in Yapin's UI and click it
    this.tryOpenNativeSettings();
    // Retry after a brief delay for the settings page to render
    setTimeout(() => {
      const retryTab = document.getElementById(`yf-tab-${tabId}`);
      if (retryTab) retryTab.click();
    }, 500);
  }

  /**
   * Try to find and click Yapin's native settings button to open the settings page.
   */
  tryOpenNativeSettings() {
    // Common patterns for settings buttons in chat apps
    const selectors = [
      'button[aria-label*="etting"]',
      'button[aria-label*="Setting"]',
      'a[href*="setting"]',
      '[class*="settings"] button',
      '[class*="gear"]',
      '[class*="cog"]',
      'button[title*="etting"]',
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  /**
   * Continuously watch the DOM for Yapin's settings sidebar.
   * When found, inject the Yapify divider and tabs.
   * Uses MutationObserver + interval fallback for SPA navigation.
   */
  startSidebarWatcher() {
    this.tryInjectSidebar();

    // High frequency interval (every 250ms) to guarantee instant detection
    this.sidebarCheckInterval = setInterval(() => {
      this.tryInjectSidebar();
    }, 250);

    // MutationObserver for instant reactive injection when DOM changes
    this.observer = new MutationObserver(() => {
      this.tryInjectSidebar();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also trigger immediately on any user click (opening settings, closing, etc.)
    window.addEventListener('click', (e) => {
      const target = e.target;
      logger.info(`[Click] <${target?.tagName || 'el'} class="${target?.className || ''}"> text="${target?.textContent?.trim().slice(0, 25) || ''}"`);
      // Run multiple rapid checks to catch animation frames
      setTimeout(() => this.tryInjectSidebar(), 30);
      setTimeout(() => this.tryInjectSidebar(), 120);
      setTimeout(() => this.tryInjectSidebar(), 250);
      setTimeout(() => this.tryInjectSidebar(), 450);
    }, true);
  }

  logStatus(msg) {
    if (this._lastLoggedStatus !== msg) {
      this._lastLoggedStatus = msg;
      logger.info(`[Sidebar] ${msg}`);
    }
  }

  /**
   * Try to find the settings sidebar and inject Yapify tabs.
   * Only injects when the settings sidebar is ACTUALLY visible in the window viewport.
   * Re-injects reliably every time settings are opened, closed, and reopened.
   */
  tryInjectSidebar() {
    // 1. Look for all settings navigation bars
    const candidates = Array.from(document.querySelectorAll('.settings-nav, nav.settings-nav, .settings nav, .modal nav'));
    if (candidates.length === 0) {
      const stale = document.querySelectorAll('#yf-sidebar-divider, .yf-settings-tab');
      if (stale.length > 0) stale.forEach(el => el.remove());
      const stalePanel = document.getElementById('yf-content-panel');
      if (stalePanel) stalePanel.remove();
      this.logStatus('No settings nav candidates in DOM (Settings closed)');
      return;
    }

    // 2. Find the candidate that is currently ACTUALLY VISIBLE within the viewport
    let visibleNav = null;
    for (const nav of candidates) {
      if (!document.body.contains(nav)) continue;
      const rect = nav.getBoundingClientRect();
      const isVisibleOnScreen = (
        rect.width > 50 &&
        rect.height > 100 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
      );
      if (isVisibleOnScreen) {
        visibleNav = nav;
        break;
      }
    }

    // If settings are not currently open/visible on screen (e.g. translated offscreen or closed)
    if (!visibleNav) {
      const stale = document.querySelectorAll('#yf-sidebar-divider, .yf-settings-tab');
      if (stale.length > 0) {
        stale.forEach(el => el.remove());
        logger.info('Cleaned up stale Yapify sidebar elements while settings closed');
      }
      const stalePanel = document.getElementById('yf-content-panel');
      if (stalePanel) stalePanel.remove();
      this.logStatus(`Candidates in DOM (${candidates.length}) but none visible on screen`);
      return;
    }

    // 3. Locate the Yapin' Plus button or target item to insert after
    let insertAfterItem = visibleNav.querySelector('.plus-nav, button.plus-nav');
    if (!insertAfterItem) {
      const norm = (s) => (s || '').replace(/[\u2018\u2019\u201B\u02BC\u02BB`\u00B4']/g, "'").toLowerCase().trim();
      for (const btn of visibleNav.querySelectorAll('button, a, [role="tab"], div')) {
        const text = norm(btn.textContent);
        if (text.includes("yapin' plus") || text.includes('yapin plus') || text.includes('plus')) {
          insertAfterItem = btn;
          break;
        }
      }
    }

    // Fallback if plus button not found: insert after last button/tab item
    if (!insertAfterItem) {
      const allButtons = Array.from(visibleNav.querySelectorAll('button, a, [role="tab"]')).filter(b => !b.id?.startsWith('yf-'));
      if (allButtons.length > 0) {
        insertAfterItem = allButtons[allButtons.length - 1];
      } else if (visibleNav.children.length > 0) {
        insertAfterItem = visibleNav.children[visibleNav.children.length - 1];
      }
    }

    if (!insertAfterItem) {
      this.logStatus('Visible nav found, but target insertion item not found');
      return;
    }

    const existingDivider = visibleNav.querySelector('#yf-sidebar-divider');
    const existingTabs = visibleNav.querySelectorAll('.yf-settings-tab');
    const isDividerDirectlyAfter = existingDivider && insertAfterItem.nextSibling === existingDivider;

    if (existingDivider && existingTabs.length >= 4 && isDividerDirectlyAfter) {
      return; // Fully rendered, correctly placed, and visible!
    }

    // Clean up any stale or misplaced divider and tabs
    document.querySelectorAll('#yf-sidebar-divider, .yf-settings-tab').forEach(el => el.remove());

    const childrenList = Array.from(visibleNav.children).map(c => `${c.tagName}${c.id ? '#' + c.id : ''}${c.className ? '.' + c.className.split(' ').join('.') : ''}[${c.textContent?.trim().slice(0, 15)}]`).join(' -> ');
    logger.info(`Injecting Yapify tabs. Current children: ${childrenList}`);
    this.injectYapifyTabs(visibleNav, insertAfterItem);
    
    const afterChildren = Array.from(visibleNav.children).map(c => `${c.tagName}${c.id ? '#' + c.id : ''}${c.className ? '.' + c.className.split(' ').join('.') : ''}`).join(' -> ');
    logger.info(`After injection children: ${afterChildren}`);
  }

  /**
   * Inject the Yapify divider and tabs right after the target item.
   */
  injectYapifyTabs(settingsNav, insertAfterItem) {
    // Create divider
    const divider = document.createElement('div');
    divider.id = 'yf-sidebar-divider';
    divider.className = 'yf-sidebar-divider';
    divider.innerHTML = `
      <div class="yf-divider-line"></div>
      <span class="yf-divider-label">Yapify</span>
      <div class="yf-divider-line"></div>
    `;

    // Define our tabs with clean SVG paths (no invalid polyline formats)
    const tabs = [
      {
        id: 'plugins',
        label: 'Plugins',
        svg: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>'
      },
      {
        id: 'themes',
        label: 'Themes & Colors',
        svg: '<circle cx="12" cy="12" r="10"></circle><path d="M12 2a7 7 0 0 0 0 14h1a2 2 0 0 1 2 2 2 2 0 0 0 4 0 7 7 0 0 0-7-16z"></path>'
      },
      {
        id: 'settings',
        label: 'Settings',
        svg: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
      },
      {
        id: 'diagnostics',
        label: 'Diagnostics',
        svg: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>'
      }
    ];

    // Create tab buttons matching native settings nav items
    const tabElements = tabs.map(tab => {
      const btn = document.createElement('button');
      btn.id = `yf-tab-${tab.id}`;
      btn.className = 'yf-settings-tab';
      btn.setAttribute('data-yf-tab', tab.id);

      btn.innerHTML = `
        <svg class="yf-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${tab.svg}
        </svg>
        <span>${tab.label}</span>
      `;

      btn.addEventListener('click', () => {
        // Deactivate all native Yapin settings tabs
        settingsNav.querySelectorAll('a, button, [role="tab"]').forEach(item => {
          if (!item.dataset?.yfTab) {
            item.classList.remove('active', 'selected');
            item.removeAttribute('aria-selected');
            item.style.opacity = '0.7';
            item.style.background = '';
          }
        });

        // Activate our tab
        document.querySelectorAll('.yf-settings-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');

        // Show content inline on the right
        settingsPanel.show(tab.id, settingsNav);
      });

      return btn;
    });

    // Insert divider and tabs right after insertAfterItem
    const insertionParent = insertAfterItem.parentElement;
    const insertionRef = insertAfterItem.nextSibling;

    if (insertionParent) {
      insertionParent.insertBefore(divider, insertionRef);
      let lastInserted = divider;
      tabElements.forEach(tab => {
        insertionParent.insertBefore(tab, lastInserted.nextSibling);
        lastInserted = tab;
      });
    } else {
      settingsNav.appendChild(divider);
      tabElements.forEach(tab => settingsNav.appendChild(tab));
    }

    // Init the settings panel for inline content
    settingsPanel.init(settingsNav);

    logger.info('Yapify tabs injected into settings sidebar');
  }

  /**
   * Clean up observers and intervals
   */
  destroy() {
    if (this.sidebarCheckInterval) {
      clearInterval(this.sidebarCheckInterval);
      this.sidebarCheckInterval = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

export const uiInjector = new UIInjector();
