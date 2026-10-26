/**
 * Persistent Configuration Storage
 * Reads from and writes to YapinMod's config.json via IPC.
 */

import { logger } from './logger.js';
import { events } from './event-bus.js';

class Storage {
  constructor() {
    this.config = {
      version: '1.0.0',
      safeMode: false,
      debugLogging: true,
      devtoolsShortcut: true,
      accentColor: null,
      activeTheme: null,
      enabledPlugins: {},
      pluginSettings: {}
    };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      if (window.yapinmodBridge?.invoke) {
        const loaded = await window.yapinmodBridge.invoke('yapinmod:get-config');
        if (loaded && typeof loaded === 'object') {
          this.config = { ...this.config, ...loaded };
        }
      }
      this.initialized = true;
      logger.info('Storage initialized with persistent settings');
    } catch (err) {
      logger.error('Failed to load settings from main process: ' + err.message);
    }
  }

  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  async set(key, value) {
    this.config[key] = value;
    await this.persist();
    events.emit('config:change', key, value);
  }

  async setPluginEnabled(pluginId, enabled) {
    this.config.enabledPlugins = this.config.enabledPlugins || {};
    this.config.enabledPlugins[pluginId] = !!enabled;
    await this.persist();
    events.emit('plugin:toggle', pluginId, enabled);
  }

  isPluginEnabled(pluginId, defaultValue = false) {
    if (!this.config.enabledPlugins) return defaultValue;
    return this.config.enabledPlugins[pluginId] !== undefined ? !!this.config.enabledPlugins[pluginId] : defaultValue;
  }

  getPluginSettings(pluginId, defaults = {}) {
    this.config.pluginSettings = this.config.pluginSettings || {};
    return { ...defaults, ...(this.config.pluginSettings[pluginId] || {}) };
  }

  async setPluginSettings(pluginId, settings) {
    this.config.pluginSettings = this.config.pluginSettings || {};
    this.config.pluginSettings[pluginId] = { ...(this.config.pluginSettings[pluginId] || {}), ...settings };
    await this.persist();
    events.emit('plugin:settings:change', pluginId, this.config.pluginSettings[pluginId]);
  }

  async persist() {
    try {
      if (window.yapinmodBridge?.invoke) {
        await window.yapinmodBridge.invoke('yapinmod:save-config', this.config);
      }
    } catch (err) {
      logger.error('Failed to persist settings: ' + err.message);
    }
  }

  async resetToDefaults() {
    this.config = {
      version: '1.0.0',
      safeMode: false,
      debugLogging: true,
      devtoolsShortcut: true,
      accentColor: null,
      activeTheme: null,
      enabledPlugins: {
        'custom-accent': true,
        'ui-tweaks': true,
        'qol-features': true,
        'autoscroll': true
      },
      pluginSettings: {
        'ui-tweaks': {
          compactRail: false,
          smoothScroll: true,
          customRadius: 10,
          modernScrollbar: true
        },
        'qol-features': {
          charCounter: true,
          quickDevToolsButton: true,
          quickMuteBadge: true
        },
        'autoscroll': {
          autoScrollDefault: true
        }
      }
    };
    await this.persist();
    events.emit('config:reset');
    logger.info('Reset all settings to defaults');
  }
}

export const storage = new Storage();
