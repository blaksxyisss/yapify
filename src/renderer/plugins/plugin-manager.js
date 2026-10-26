/**
 * Plugin Manager for YapinMod
 * Handles discovery, lifecycle hooks, runtime enable/disable,
 * error boundaries, and dependency validation.
 */

import { logger } from '../core/logger.js';
import { storage } from '../core/storage.js';
import { events } from '../core/event-bus.js';

export const PluginStatus = {
  INACTIVE: 'INACTIVE',
  STARTING: 'STARTING',
  ACTIVE: 'ACTIVE',
  STOPPING: 'STOPPING',
  ERROR: 'ERROR'
};

class PluginManager {
  constructor() {
    this.plugins = new Map(); // id -> { manifest, instance, status, error, cleanupFns }
  }

  /**
   * Register a plugin with metadata and lifecycle hooks
   */
  register(definition) {
    if (!definition || typeof definition !== 'object') {
      logger.error('Attempted to register invalid plugin definition');
      return false;
    }

    const { id, name, version, author, description, dependencies } = definition;

    if (!id || typeof id !== 'string') {
      logger.error('Plugin registration rejected: missing or invalid "id"');
      return false;
    }

    // Duplicate detection
    if (this.plugins.has(id)) {
      logger.warn(`Plugin with ID "${id}" is already registered. Skipping duplicate.`);
      return false;
    }

    const manifest = {
      id,
      name: name || id,
      version: version || '1.0.0',
      author: author || 'Unknown',
      description: description || '',
      dependencies: Array.isArray(dependencies) ? dependencies : []
    };

    this.plugins.set(id, {
      manifest,
      instance: definition,
      status: PluginStatus.INACTIVE,
      error: null,
      cleanupFns: []
    });

    logger.info(`Registered plugin: ${manifest.name} (v${manifest.version}) by ${manifest.author}`);
    return true;
  }

  /**
   * Create an isolated API context for a specific plugin
   */
  createPluginApi(pluginEntry) {
    const { id } = pluginEntry.manifest;
    const cleanupFns = pluginEntry.cleanupFns;

    return {
      id,
      manifest: { ...pluginEntry.manifest },
      logger: {
        info: (msg, meta) => logger.info(`[Plugin:${id}] ${msg}`, meta),
        warn: (msg, meta) => logger.warn(`[Plugin:${id}] ${msg}`, meta),
        error: (msg, meta) => logger.error(`[Plugin:${id}] ${msg}`, meta),
        debug: (msg, meta) => logger.debug(`[Plugin:${id}] ${msg}`, meta)
      },
      storage: {
        get: (key, def) => {
          const settings = storage.getPluginSettings(id, {});
          return settings[key] !== undefined ? settings[key] : def;
        },
        set: async (key, val) => {
          await storage.setPluginSettings(id, { [key]: val });
        },
        getAll: () => storage.getPluginSettings(id, {})
      },
      ui: {
        injectStyle: (styleId, css) => {
          const fullId = `yapinmod-plugin-${id}-${styleId}`;
          let el = document.getElementById(fullId);
          if (!el) {
            el = document.createElement('style');
            el.id = fullId;
            document.head.appendChild(el);
            cleanupFns.push(() => {
              const node = document.getElementById(fullId);
              if (node) node.remove();
            });
          }
          el.textContent = css;
          return el;
        },
        removeStyle: (styleId) => {
          const fullId = `yapinmod-plugin-${id}-${styleId}`;
          const el = document.getElementById(fullId);
          if (el) el.remove();
        },
        showToast: (msg, type = 'info') => {
          events.emit('toast', msg, type);
        }
      },
      events: {
        on: (event, handler) => {
          const unsub = events.on(event, handler);
          cleanupFns.push(unsub);
          return unsub;
        },
        emit: (event, ...args) => events.emit(event, ...args)
      }
    };
  }

  /**
   * Start an individual plugin inside an error boundary
   */
  async startPlugin(id) {
    const entry = this.plugins.get(id);
    if (!entry) {
      logger.warn(`Cannot start unknown plugin: ${id}`);
      return false;
    }

    if (entry.status === PluginStatus.ACTIVE) return true;

    // Check dependencies
    if (entry.manifest.dependencies && entry.manifest.dependencies.length > 0) {
      for (const depId of entry.manifest.dependencies) {
        const dep = this.plugins.get(depId);
        if (!dep || dep.status !== PluginStatus.ACTIVE) {
          entry.status = PluginStatus.ERROR;
          entry.error = `Missing active dependency: ${depId}`;
          logger.error(`Failed to start ${id}: ${entry.error}`);
          return false;
        }
      }
    }

    entry.status = PluginStatus.STARTING;
    entry.error = null;
    entry.cleanupFns = [];

    const api = this.createPluginApi(entry);

    try {
      // Call onLoad if provided
      if (typeof entry.instance.onLoad === 'function') {
        await entry.instance.onLoad(api);
      }

      // Call onStart if provided
      if (typeof entry.instance.onStart === 'function') {
        await entry.instance.onStart(api);
      }

      entry.status = PluginStatus.ACTIVE;
      logger.info(`Successfully started plugin: ${entry.manifest.name}`);
      events.emit('plugin:started', id);
      return true;
    } catch (err) {
      // Error boundary: isolate error so Yapin client does not crash
      entry.status = PluginStatus.ERROR;
      entry.error = err.message || String(err);
      logger.error(`Error starting plugin "${id}": ${err.message}`, { stack: err.stack });
      events.emit('toast', `Plugin error in "${entry.manifest.name}": ${err.message}`, 'error');
      // Execute any cleanup created before error
      this.executeCleanup(entry);
      return false;
    }
  }

  /**
   * Stop an individual plugin safely
   */
  async stopPlugin(id) {
    const entry = this.plugins.get(id);
    if (!entry) return;

    if (entry.status === PluginStatus.INACTIVE) return;

    entry.status = PluginStatus.STOPPING;
    const api = this.createPluginApi(entry);

    try {
      if (typeof entry.instance.onStop === 'function') {
        await entry.instance.onStop(api);
      }
    } catch (err) {
      logger.error(`Error in onStop for plugin "${id}": ${err.message}`, { stack: err.stack });
    } finally {
      this.executeCleanup(entry);
      entry.status = PluginStatus.INACTIVE;
      logger.info(`Stopped plugin: ${entry.manifest.name}`);
      events.emit('plugin:stopped', id);
    }
  }

  executeCleanup(entry) {
    if (entry.cleanupFns && entry.cleanupFns.length > 0) {
      for (const fn of entry.cleanupFns) {
        try {
          if (typeof fn === 'function') fn();
        } catch (e) {
          logger.warn(`Cleanup error in plugin ${entry.manifest.id}: ${e.message}`);
        }
      }
      entry.cleanupFns = [];
    }
  }

  /**
   * Toggle a plugin enabled state and persist to settings
   */
  async togglePlugin(id, enable) {
    await storage.setPluginEnabled(id, enable);
    if (enable) {
      await this.startPlugin(id);
    } else {
      await this.stopPlugin(id);
    }
  }

  /**
   * Initialize all registered plugins based on stored configuration
   */
  async initAll() {
    logger.info(`Initializing ${this.plugins.size} registered plugins...`);

    // If safe mode is on, don't auto-start plugins
    if (storage.get('safeMode', false)) {
      logger.warn('Safe Mode is ENABLED. All plugins are paused.');
      events.emit('toast', 'YapinMod Safe Mode is active: all plugins paused', 'warning');
      return;
    }

    for (const [id, entry] of this.plugins.entries()) {
      const isCoreDefault = ['custom-accent', 'ui-tweaks', 'qol-features', 'autoscroll', 'window-mods'].includes(id);
      const shouldEnable = storage.isPluginEnabled(id, isCoreDefault);
      if (shouldEnable) {
        await this.startPlugin(id);
      }
    }
  }

  getPlugin(id) {
    return this.plugins.get(id);
  }

  getAllPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      author: p.manifest.author,
      description: p.manifest.description,
      status: p.status,
      error: p.error,
      enabled: storage.isPluginEnabled(p.manifest.id, ['custom-accent', 'ui-tweaks', 'qol-features', 'autoscroll', 'window-mods'].includes(p.manifest.id)),
      hasSettings: typeof p.instance.renderSettings === 'function'
    }));
  }
}

export const pluginManager = new PluginManager();
