/**
 * Theme & Accent Color Manager for Yapify
 * Applies custom CSS styles and CSS variable overrides to the DOM.
 * Themes are injected globally — they apply everywhere, not just settings.
 */

import { logger } from '../core/logger.js';
import { storage } from '../core/storage.js';
import { events } from '../core/event-bus.js';

class ThemeManager {
  constructor() {
    this.themeStyleEl = null;
    this.accentStyleEl = null;
    this.currentThemeCSS = '';
  }

  init() {
    // Create dedicated style elements in head for global application
    if (!document.getElementById('yapify-theme-style')) {
      this.themeStyleEl = document.createElement('style');
      this.themeStyleEl.id = 'yapify-theme-style';
      document.head.appendChild(this.themeStyleEl);
    } else {
      this.themeStyleEl = document.getElementById('yapify-theme-style');
    }

    if (!document.getElementById('yapify-accent-style')) {
      this.accentStyleEl = document.createElement('style');
      this.accentStyleEl.id = 'yapify-accent-style';
      document.head.appendChild(this.accentStyleEl);
    } else {
      this.accentStyleEl = document.getElementById('yapify-accent-style');
    }

    // Apply saved accent color
    const accent = storage.get('accentColor');
    if (accent) {
      this.setAccentColor(accent, false);
    }

    // Apply saved theme
    const activeTheme = storage.get('activeTheme');
    if (activeTheme) {
      this.applyTheme(activeTheme, false);
    }

    // Re-apply theme on SPA navigation (content changes but page doesn't reload)
    this.watchForNavigation();

    logger.info('ThemeManager initialized — themes apply globally');
  }

  /**
   * Watch for SPA navigation and re-inject theme styles if they get removed.
   * This ensures themes work everywhere, not just on one page.
   */
  watchForNavigation() {
    // Periodic check to ensure our style elements are still in the DOM
    setInterval(() => {
      // Re-inject theme style if it was removed
      if (!document.getElementById('yapify-theme-style') && this.currentThemeCSS) {
        this.themeStyleEl = document.createElement('style');
        this.themeStyleEl.id = 'yapify-theme-style';
        this.themeStyleEl.textContent = this.currentThemeCSS;
        document.head.appendChild(this.themeStyleEl);
        logger.info('Re-injected theme after navigation');
      }

      // Re-inject accent style if removed
      if (!document.getElementById('yapify-accent-style') && this.accentStyleEl?.textContent) {
        const css = this.accentStyleEl.textContent;
        this.accentStyleEl = document.createElement('style');
        this.accentStyleEl.id = 'yapify-accent-style';
        this.accentStyleEl.textContent = css;
        document.head.appendChild(this.accentStyleEl);
      }
    }, 1000);

    // Also use MutationObserver on <head> to detect style removal
    const headObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const removed of mutation.removedNodes) {
          if (removed.id === 'yapify-theme-style' && this.currentThemeCSS) {
            this.themeStyleEl = document.createElement('style');
            this.themeStyleEl.id = 'yapify-theme-style';
            this.themeStyleEl.textContent = this.currentThemeCSS;
            document.head.appendChild(this.themeStyleEl);
          }
          if (removed.id === 'yapify-accent-style') {
            const accent = storage.get('accentColor');
            if (accent) this.setAccentColor(accent, false);
          }
        }
      }
    });

    headObserver.observe(document.head, { childList: true });
  }

  /**
   * Helper to darken/lighten a hex color
   */
  adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  /**
   * Helper to convert hex color to rgba
   */
  hexToRgba(hex, alpha) {
    const cleanHex = hex.replace('#', '');
    const bigint = parseInt(cleanHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  async setAccentColor(hexColor, persist = true) {
    if (!hexColor) {
      if (this.accentStyleEl) this.accentStyleEl.textContent = '';
      if (persist) await storage.set('accentColor', null);
      logger.info('Reset accent color to Yapin default');
      return;
    }

    try {
      const hover = this.adjustBrightness(hexColor, -10);
      const soft = this.hexToRgba(hexColor, 0.2);

      const css = `
        :root {
          --accent: ${hexColor} !important;
          --accent-hover: ${hover} !important;
          --accent-soft: ${soft} !important;
        }
        /* Override accent on buttons, badges, and active UI items */
        .btn:not(.secondary):not(.danger):not(.ghost),
        .on,
        [data-accent="true"] {
          --accent-override: ${hexColor};
        }
      `;

      if (this.accentStyleEl) {
        this.accentStyleEl.textContent = css;
      }

      if (persist) {
        await storage.set('accentColor', hexColor);
      }
      logger.info(`Applied accent color: ${hexColor}`);
    } catch (err) {
      logger.error('Failed to set accent color: ' + err.message);
    }
  }

  async applyTheme(filename, persist = true) {
    if (!filename) {
      this.currentThemeCSS = '';
      if (this.themeStyleEl) this.themeStyleEl.textContent = '';
      if (persist) await storage.set('activeTheme', null);
      logger.info('Cleared active theme');
      return;
    }

    try {
      if (window.yapinmodBridge?.invoke) {
        const res = await window.yapinmodBridge.invoke('yapinmod:get-theme-css', filename);
        if (res.success && res.css) {
          this.currentThemeCSS = res.css;
          if (this.themeStyleEl) {
            this.themeStyleEl.textContent = res.css;
          }
          if (persist) {
            await storage.set('activeTheme', filename);
          }
          logger.info(`Applied custom theme globally: ${filename}`);
        } else {
          logger.warn(`Failed to load theme CSS for ${filename}: ${res.error || 'Empty CSS'}`);
        }
      }
    } catch (err) {
      logger.error(`Error applying theme ${filename}: ${err.message}`);
    }
  }

  async getThemes() {
    try {
      if (window.yapinmodBridge?.invoke) {
        return await window.yapinmodBridge.invoke('yapinmod:list-themes');
      }
    } catch (err) {
      logger.error('Failed to list themes: ' + err.message);
    }
    return [];
  }
}

export const themeManager = new ThemeManager();
