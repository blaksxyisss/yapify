var YapinModRenderer = (() => {
  // src/renderer/core/logger.js
  var Logger = class {
    constructor() {
      this.logs = [];
      this.maxLogs = 300;
    }
    log(level, message, meta = null) {
      const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      const entry = { timestamp, level, message, meta };
      this.logs.push(entry);
      if (this.logs.length > this.maxLogs) this.logs.shift();
      const prefix = `%c[Yapify]%c [${level.toUpperCase()}]`;
      const style1 = "color: #ff6b4a; font-weight: bold;";
      const style2 = level === "error" ? "color: #f2555a; font-weight: bold;" : level === "warn" ? "color: #f5b544; font-weight: bold;" : "color: #9c9daa;";
      if (level === "error") {
        console.error(prefix, style1, style2, message, meta || "");
      } else if (level === "warn") {
        console.warn(prefix, style1, style2, message, meta || "");
      } else {
        console.log(prefix, style1, style2, message, meta || "");
      }
      if (window.yapinmodBridge?.send) {
        window.yapinmodBridge.send("yapinmod:log", level, message, meta);
      }
    }
    info(msg, meta) {
      this.log("info", msg, meta);
    }
    warn(msg, meta) {
      this.log("warn", msg, meta);
    }
    error(msg, meta) {
      this.log("error", msg, meta);
    }
    debug(msg, meta) {
      this.log("debug", msg, meta);
    }
    getRecentLogs() {
      return [...this.logs];
    }
    clear() {
      this.logs = [];
    }
  };
  var logger = new Logger();

  // src/renderer/core/event-bus.js
  var EventBus = class {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
    }
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, /* @__PURE__ */ new Set());
      }
      this.listeners.get(event).add(callback);
      return () => this.off(event, callback);
    }
    off(event, callback) {
      const list = this.listeners.get(event);
      if (list) {
        list.delete(callback);
        if (list.size === 0) this.listeners.delete(event);
      }
    }
    emit(event, ...args) {
      const list = this.listeners.get(event);
      if (list) {
        for (const cb of list) {
          try {
            cb(...args);
          } catch (err) {
            console.error(`[YapinMod] Error in event listener for '${event}':`, err);
          }
        }
      }
    }
  };
  var events = new EventBus();

  // src/renderer/core/storage.js
  var Storage = class {
    constructor() {
      this.config = {
        version: "1.0.0",
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
          const loaded = await window.yapinmodBridge.invoke("yapinmod:get-config");
          if (loaded && typeof loaded === "object") {
            this.config = { ...this.config, ...loaded };
          }
        }
        this.initialized = true;
        logger.info("Storage initialized with persistent settings");
      } catch (err) {
        logger.error("Failed to load settings from main process: " + err.message);
      }
    }
    get(key, defaultValue = null) {
      return this.config[key] !== void 0 ? this.config[key] : defaultValue;
    }
    async set(key, value) {
      this.config[key] = value;
      await this.persist();
      events.emit("config:change", key, value);
    }
    async setPluginEnabled(pluginId, enabled) {
      this.config.enabledPlugins = this.config.enabledPlugins || {};
      this.config.enabledPlugins[pluginId] = !!enabled;
      await this.persist();
      events.emit("plugin:toggle", pluginId, enabled);
    }
    isPluginEnabled(pluginId, defaultValue = false) {
      if (!this.config.enabledPlugins) return defaultValue;
      return this.config.enabledPlugins[pluginId] !== void 0 ? !!this.config.enabledPlugins[pluginId] : defaultValue;
    }
    getPluginSettings(pluginId, defaults = {}) {
      this.config.pluginSettings = this.config.pluginSettings || {};
      return { ...defaults, ...this.config.pluginSettings[pluginId] || {} };
    }
    async setPluginSettings(pluginId, settings) {
      this.config.pluginSettings = this.config.pluginSettings || {};
      this.config.pluginSettings[pluginId] = { ...this.config.pluginSettings[pluginId] || {}, ...settings };
      await this.persist();
      events.emit("plugin:settings:change", pluginId, this.config.pluginSettings[pluginId]);
    }
    async persist() {
      try {
        if (window.yapinmodBridge?.invoke) {
          await window.yapinmodBridge.invoke("yapinmod:save-config", this.config);
        }
      } catch (err) {
        logger.error("Failed to persist settings: " + err.message);
      }
    }
    async resetToDefaults() {
      this.config = {
        version: "1.0.0",
        safeMode: false,
        debugLogging: true,
        devtoolsShortcut: true,
        accentColor: null,
        activeTheme: null,
        enabledPlugins: {
          "custom-accent": true,
          "ui-tweaks": true,
          "qol-features": true,
          "autoscroll": true,
          "no-pings": false
        },
        pluginSettings: {
          "ui-tweaks": {
            compactRail: false,
            smoothScroll: true,
            customRadius: 10,
            modernScrollbar: true
          },
          "qol-features": {
            charCounter: true,
            quickDevToolsButton: true,
            quickMuteBadge: true
          },
          "autoscroll": {
            autoScrollDefault: true
          },
          "no-pings": {
            active: true,
            muteSounds: true,
            suppressDesktopNotifs: true,
            hideBadges: true,
            suppressTaskbarBadge: true
          }
        }
      };
      await this.persist();
      events.emit("config:reset");
      logger.info("Reset all settings to defaults");
    }
  };
  var storage = new Storage();

  // src/renderer/themes/theme-manager.js
  var ThemeManager = class {
    constructor() {
      this.themeStyleEl = null;
      this.accentStyleEl = null;
      this.currentThemeCSS = "";
    }
    init() {
      if (!document.getElementById("yapify-theme-style")) {
        this.themeStyleEl = document.createElement("style");
        this.themeStyleEl.id = "yapify-theme-style";
        document.head.appendChild(this.themeStyleEl);
      } else {
        this.themeStyleEl = document.getElementById("yapify-theme-style");
      }
      if (!document.getElementById("yapify-accent-style")) {
        this.accentStyleEl = document.createElement("style");
        this.accentStyleEl.id = "yapify-accent-style";
        document.head.appendChild(this.accentStyleEl);
      } else {
        this.accentStyleEl = document.getElementById("yapify-accent-style");
      }
      const accent = storage.get("accentColor");
      if (accent) {
        this.setAccentColor(accent, false);
      }
      const activeTheme = storage.get("activeTheme");
      if (activeTheme) {
        this.applyTheme(activeTheme, false);
      }
      this.watchForNavigation();
      logger.info("ThemeManager initialized \u2014 themes apply globally");
    }
    /**
     * Watch for SPA navigation and re-inject theme styles if they get removed.
     * This ensures themes work everywhere, not just on one page.
     */
    watchForNavigation() {
      setInterval(() => {
        if (!document.getElementById("yapify-theme-style") && this.currentThemeCSS) {
          this.themeStyleEl = document.createElement("style");
          this.themeStyleEl.id = "yapify-theme-style";
          this.themeStyleEl.textContent = this.currentThemeCSS;
          document.head.appendChild(this.themeStyleEl);
          logger.info("Re-injected theme after navigation");
        }
        if (!document.getElementById("yapify-accent-style") && this.accentStyleEl?.textContent) {
          const css = this.accentStyleEl.textContent;
          this.accentStyleEl = document.createElement("style");
          this.accentStyleEl.id = "yapify-accent-style";
          this.accentStyleEl.textContent = css;
          document.head.appendChild(this.accentStyleEl);
        }
      }, 1e3);
      const headObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const removed of mutation.removedNodes) {
            if (removed.id === "yapify-theme-style" && this.currentThemeCSS) {
              this.themeStyleEl = document.createElement("style");
              this.themeStyleEl.id = "yapify-theme-style";
              this.themeStyleEl.textContent = this.currentThemeCSS;
              document.head.appendChild(this.themeStyleEl);
            }
            if (removed.id === "yapify-accent-style") {
              const accent = storage.get("accentColor");
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
      const num = parseInt(hex.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 255) + amt;
      const B = (num & 255) + amt;
      return "#" + (16777216 + (R < 255 ? R < 1 ? 0 : R : 255) * 65536 + (G < 255 ? G < 1 ? 0 : G : 255) * 256 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    /**
     * Helper to convert hex color to rgba
     */
    hexToRgba(hex, alpha) {
      const cleanHex = hex.replace("#", "");
      const bigint = parseInt(cleanHex, 16);
      const r = bigint >> 16 & 255;
      const g = bigint >> 8 & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    async setAccentColor(hexColor, persist = true) {
      if (!hexColor) {
        if (this.accentStyleEl) this.accentStyleEl.textContent = "";
        if (persist) await storage.set("accentColor", null);
        logger.info("Reset accent color to Yapin default");
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
          await storage.set("accentColor", hexColor);
        }
        logger.info(`Applied accent color: ${hexColor}`);
      } catch (err) {
        logger.error("Failed to set accent color: " + err.message);
      }
    }
    async applyTheme(filename, persist = true) {
      if (!filename) {
        this.currentThemeCSS = "";
        if (this.themeStyleEl) this.themeStyleEl.textContent = "";
        if (persist) await storage.set("activeTheme", null);
        logger.info("Cleared active theme");
        return;
      }
      try {
        if (window.yapinmodBridge?.invoke) {
          const res = await window.yapinmodBridge.invoke("yapinmod:get-theme-css", filename);
          if (res.success && res.css) {
            this.currentThemeCSS = res.css;
            if (this.themeStyleEl) {
              this.themeStyleEl.textContent = res.css;
            }
            if (persist) {
              await storage.set("activeTheme", filename);
            }
            logger.info(`Applied custom theme globally: ${filename}`);
          } else {
            logger.warn(`Failed to load theme CSS for ${filename}: ${res.error || "Empty CSS"}`);
          }
        }
      } catch (err) {
        logger.error(`Error applying theme ${filename}: ${err.message}`);
      }
    }
    async getThemes() {
      try {
        if (window.yapinmodBridge?.invoke) {
          return await window.yapinmodBridge.invoke("yapinmod:list-themes");
        }
      } catch (err) {
        logger.error("Failed to list themes: " + err.message);
      }
      return [];
    }
  };
  var themeManager = new ThemeManager();

  // src/renderer/plugins/plugin-manager.js
  var PluginStatus = {
    INACTIVE: "INACTIVE",
    STARTING: "STARTING",
    ACTIVE: "ACTIVE",
    STOPPING: "STOPPING",
    ERROR: "ERROR"
  };
  var PluginManager = class {
    constructor() {
      this.plugins = /* @__PURE__ */ new Map();
    }
    /**
     * Register a plugin with metadata and lifecycle hooks
     */
    register(definition) {
      if (!definition || typeof definition !== "object") {
        logger.error("Attempted to register invalid plugin definition");
        return false;
      }
      const { id, name, version, author, description, dependencies } = definition;
      if (!id || typeof id !== "string") {
        logger.error('Plugin registration rejected: missing or invalid "id"');
        return false;
      }
      if (this.plugins.has(id)) {
        logger.warn(`Plugin with ID "${id}" is already registered. Skipping duplicate.`);
        return false;
      }
      const manifest = {
        id,
        name: name || id,
        version: version || "1.0.0",
        author: author || "Unknown",
        description: description || "",
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
            return settings[key] !== void 0 ? settings[key] : def;
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
              el = document.createElement("style");
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
          showToast: (msg, type = "info") => {
            events.emit("toast", msg, type);
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
        if (typeof entry.instance.onLoad === "function") {
          await entry.instance.onLoad(api);
        }
        if (typeof entry.instance.onStart === "function") {
          await entry.instance.onStart(api);
        }
        entry.status = PluginStatus.ACTIVE;
        logger.info(`Successfully started plugin: ${entry.manifest.name}`);
        events.emit("plugin:started", id);
        return true;
      } catch (err) {
        entry.status = PluginStatus.ERROR;
        entry.error = err.message || String(err);
        logger.error(`Error starting plugin "${id}": ${err.message}`, { stack: err.stack });
        events.emit("toast", `Plugin error in "${entry.manifest.name}": ${err.message}`, "error");
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
        if (typeof entry.instance.onStop === "function") {
          await entry.instance.onStop(api);
        }
      } catch (err) {
        logger.error(`Error in onStop for plugin "${id}": ${err.message}`, { stack: err.stack });
      } finally {
        this.executeCleanup(entry);
        entry.status = PluginStatus.INACTIVE;
        logger.info(`Stopped plugin: ${entry.manifest.name}`);
        events.emit("plugin:stopped", id);
      }
    }
    executeCleanup(entry) {
      if (entry.cleanupFns && entry.cleanupFns.length > 0) {
        for (const fn of entry.cleanupFns) {
          try {
            if (typeof fn === "function") fn();
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
      if (storage.get("safeMode", false)) {
        logger.warn("Safe Mode is ENABLED. All plugins are paused.");
        events.emit("toast", "YapinMod Safe Mode is active: all plugins paused", "warning");
        return;
      }
      for (const [id, entry] of this.plugins.entries()) {
        const isCoreDefault = ["custom-accent", "ui-tweaks", "qol-features", "autoscroll", "window-mods"].includes(id);
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
      return Array.from(this.plugins.values()).map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        author: p.manifest.author,
        description: p.manifest.description,
        status: p.status,
        error: p.error,
        enabled: storage.isPluginEnabled(p.manifest.id, ["custom-accent", "ui-tweaks", "qol-features", "autoscroll", "window-mods"].includes(p.manifest.id)),
        hasSettings: typeof p.instance.renderSettings === "function"
      }));
    }
  };
  var pluginManager = new PluginManager();

  // src/renderer/plugins/custom-accent.js
  var CustomAccentPlugin = {
    id: "custom-accent",
    name: "Custom Accent Colors",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Change the client accent color and active highlights in real-time with preset palettes or custom hex codes.",
    onStart(api) {
      api.logger.info("Custom Accent Plugin started");
      const color = api.storage.get("accentColor", null);
      if (color) {
        themeManager.setAccentColor(color, false);
      }
    },
    onStop(api) {
      api.logger.info("Custom Accent Plugin stopped; reverting to default accent");
      themeManager.setAccentColor(null, false);
    },
    renderSettings(api, container) {
      const PRESETS = [
        { name: "Yapin Default", hex: "#ff6b4a" },
        { name: "Discord Blurple", hex: "#5865f2" },
        { name: "Neon Purple", hex: "#9d4edd" },
        { name: "Cyberpunk Cyan", hex: "#00d2ff" },
        { name: "Emerald Green", hex: "#10b981" },
        { name: "Sunset Amber", hex: "#f59e0b" },
        { name: "Crimson Rose", hex: "#f43f5e" },
        { name: "Midnight Blue", hex: "#3b82f6" }
      ];
      const current = api.storage.get("accentColor", "#ff6b4a");
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <label class="ym-label">Choose an Accent Palette</label>
        <p class="ym-desc">Select a curated palette preset or enter your own custom hex color.</p>
        <div class="ym-swatch-grid" id="ym-accent-swatches">
          ${PRESETS.map((p) => `
            <button class="ym-swatch-btn ${current === p.hex ? "active" : ""}" data-hex="${p.hex}" title="${p.name}">
              <span class="ym-swatch-color" style="background-color: ${p.hex};"></span>
              <span class="ym-swatch-name">${p.name}</span>
            </button>
          `).join("")}
        </div>
        <div class="ym-field-row" style="margin-top: 14px;">
          <label class="ym-label" style="margin: 0; min-width: 110px;">Custom Hex:</label>
          <input type="text" id="ym-custom-hex-input" class="ym-input" value="${current}" placeholder="#ff6b4a" maxlength="7" style="width: 140px;" />
          <button id="ym-apply-hex-btn" class="ym-btn secondary">Apply</button>
          <button id="ym-reset-hex-btn" class="ym-btn ghost">Reset Default</button>
        </div>
      </div>
    `;
      container.querySelectorAll(".ym-swatch-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const hex = btn.getAttribute("data-hex");
          container.querySelectorAll(".ym-swatch-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const input2 = container.querySelector("#ym-custom-hex-input");
          if (input2) input2.value = hex;
          await api.storage.set("accentColor", hex);
          await themeManager.setAccentColor(hex, true);
          api.ui.showToast(`Applied ${btn.getAttribute("title")} accent`, "success");
        });
      });
      const input = container.querySelector("#ym-custom-hex-input");
      const applyBtn = container.querySelector("#ym-apply-hex-btn");
      const resetBtn = container.querySelector("#ym-reset-hex-btn");
      if (applyBtn && input) {
        applyBtn.addEventListener("click", async () => {
          let hex = input.value.trim();
          if (!hex.startsWith("#")) hex = "#" + hex;
          if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
            await api.storage.set("accentColor", hex);
            await themeManager.setAccentColor(hex, true);
            api.ui.showToast(`Applied accent: ${hex}`, "success");
          } else {
            api.ui.showToast("Invalid hex code format (e.g. #5865f2)", "error");
          }
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
          await api.storage.set("accentColor", "#ff6b4a");
          await themeManager.setAccentColor(null, true);
          if (input) input.value = "#ff6b4a";
          api.ui.showToast("Reset accent to default Yapin color", "info");
        });
      }
    }
  };

  // src/renderer/plugins/ui-tweaks.js
  var UITweaksPlugin = {
    id: "ui-tweaks",
    name: "UI Tweaks & Polish",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Customize UI corner rounding, compact server navigation rail, sleek scrollbars, and smooth scrolling animations.",
    onStart(api) {
      api.logger.info("UI Tweaks Plugin started");
      this.applyStyles(api);
    },
    onStop(api) {
      api.logger.info("UI Tweaks Plugin stopped; clearing injected styles");
      api.ui.removeStyle("main-tweaks");
    },
    applyStyles(api) {
      const compactRail = api.storage.get("compactRail", false);
      const radius = api.storage.get("customRadius", 10);
      const smoothScroll = api.storage.get("smoothScroll", true);
      const modernScrollbar = api.storage.get("modernScrollbar", true);
      let css = `
      :root {
        --radius: ${radius}px !important;
      }
    `;
      if (compactRail) {
        css += `
        /* Compact Server Rail */
        aside, [class*="rail"], [class*="servers"] {
          --rail-width: 54px !important;
          transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `;
      }
      if (smoothScroll) {
        css += `
        /* Smooth scrolling */
        html, body, main, [class*="chat"], [class*="messages"], [class*="scroll"] {
          scroll-behavior: smooth !important;
        }
      `;
      }
      if (modernScrollbar) {
        css += `
        /* Sleek Modern Scrollbars */
        ::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          transition: background 0.2s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `;
      }
      api.ui.injectStyle("main-tweaks", css);
    },
    renderSettings(api, container) {
      const compactRail = api.storage.get("compactRail", false);
      const radius = api.storage.get("customRadius", 10);
      const smoothScroll = api.storage.get("smoothScroll", true);
      const modernScrollbar = api.storage.get("modernScrollbar", true);
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Corner Rounding (Radius)</span>
            <span class="ym-setting-desc">Adjust the border radius across dialogs, buttons, cards and avatars.</span>
          </div>
          <div class="ym-setting-control" style="display: flex; align-items: center; gap: 10px;">
            <input type="range" id="ym-radius-slider" min="0" max="20" value="${radius}" class="ym-slider" />
            <span id="ym-radius-val" style="min-width: 38px; font-weight: bold; color: var(--text);">${radius}px</span>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Compact Server Rail</span>
            <span class="ym-setting-desc">Reduces padding and icon dimensions in the left navigation sidebar.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="ym-compact-rail" ${compactRail ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Smooth Scrolling</span>
            <span class="ym-setting-desc">Enables fluid momentum scrolling throughout chat history and channel lists.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="ym-smooth-scroll" ${smoothScroll ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Sleek Scrollbars</span>
            <span class="ym-setting-desc">Replaces wide browser scrollbars with subtle, semi-transparent bars.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="ym-modern-scrollbar" ${modernScrollbar ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
      const radiusSlider = container.querySelector("#ym-radius-slider");
      const radiusVal = container.querySelector("#ym-radius-val");
      radiusSlider?.addEventListener("input", async (e) => {
        const val = parseInt(e.target.value, 10);
        if (radiusVal) radiusVal.textContent = val + "px";
        await api.storage.set("customRadius", val);
        this.applyStyles(api);
      });
      container.querySelector("#ym-compact-rail")?.addEventListener("change", async (e) => {
        await api.storage.set("compactRail", e.target.checked);
        this.applyStyles(api);
      });
      container.querySelector("#ym-smooth-scroll")?.addEventListener("change", async (e) => {
        await api.storage.set("smoothScroll", e.target.checked);
        this.applyStyles(api);
      });
      container.querySelector("#ym-modern-scrollbar")?.addEventListener("change", async (e) => {
        await api.storage.set("modernScrollbar", e.target.checked);
        this.applyStyles(api);
      });
    }
  };

  // src/renderer/ui/custom-dropdown.js
  function createCustomDropdown({
    options = [],
    value = "",
    onChange = () => {
    },
    placeholder = "Select option...",
    width = "210px"
  }) {
    let currentValue = value;
    const wrapper = document.createElement("div");
    wrapper.className = "yf-custom-dropdown";
    wrapper.style.width = width;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "yf-dropdown-trigger";
    const labelSpan = document.createElement("span");
    labelSpan.className = "yf-dropdown-label";
    const arrowIcon = document.createElement("div");
    arrowIcon.className = "yf-dropdown-arrow";
    arrowIcon.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowIcon);
    wrapper.appendChild(trigger);
    const menu = document.createElement("div");
    menu.className = "yf-dropdown-menu";
    wrapper.appendChild(menu);
    function updateTriggerLabel() {
      const selected = options.find((o) => o.value === currentValue);
      labelSpan.textContent = selected ? selected.label : placeholder;
    }
    function renderItems() {
      menu.innerHTML = "";
      for (const opt of options) {
        const item = document.createElement("div");
        item.className = "yf-dropdown-item" + (opt.value === currentValue ? " is-selected" : "");
        item.setAttribute("data-value", opt.value);
        const text = document.createElement("span");
        text.className = "yf-dropdown-item-text";
        text.textContent = opt.label;
        item.appendChild(text);
        const checkSvg = document.createElement("div");
        checkSvg.className = "yf-dropdown-check";
        checkSvg.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
        item.appendChild(checkSvg);
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          currentValue = opt.value;
          updateTriggerLabel();
          renderItems();
          closeMenu();
          onChange(currentValue);
        });
        menu.appendChild(item);
      }
    }
    function openMenu() {
      document.querySelectorAll(".yf-custom-dropdown.is-open").forEach((el) => {
        if (el !== wrapper) {
          el.classList.remove("is-open");
          el.querySelector(".yf-dropdown-menu")?.classList.remove("is-open");
        }
      });
      wrapper.classList.add("is-open");
      menu.classList.add("is-open");
    }
    function closeMenu() {
      wrapper.classList.remove("is-open");
      menu.classList.remove("is-open");
    }
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (menu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });
    const onDocClick = (e) => {
      if (!wrapper.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener("click", onDocClick);
    const onKeyDown = (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        closeMenu();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    updateTriggerLabel();
    renderItems();
    wrapper.setValue = (newVal) => {
      currentValue = newVal;
      updateTriggerLabel();
      renderItems();
    };
    wrapper.getValue = () => currentValue;
    wrapper.destroy = () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      wrapper.remove();
    };
    return wrapper;
  }

  // src/renderer/plugins/qol-features.js
  var QoLFeaturesPlugin = {
    id: "qol-features",
    name: "Quality of Life Features",
    version: "1.2.0",
    author: "Yapify Team",
    description: "Productivity suite: message character counter, auto-scroll chat controls, window modes, and Mac-style window controls.",
    onStart(api) {
      api.logger.info("QoL Features Plugin started");
      const charCounter = api.storage.get("charCounter", true);
      if (charCounter) this.setupCharCounter(api);
    },
    onStop(api) {
      api.logger.info("QoL Features Plugin stopped; cleaning up observers and elements");
      document.querySelectorAll(".yf-char-counter").forEach((el) => el.remove());
    },
    setupCharCounter(api) {
      const updateCounter = (inputEl) => {
        if (!inputEl) return;
        const count = (inputEl.value || inputEl.textContent || "").length;
        let counter = inputEl.parentElement?.querySelector(".yf-char-counter");
        if (!counter) {
          counter = document.createElement("div");
          counter.className = "yf-char-counter";
          counter.style.cssText = `
          font-size: 11px;
          color: var(--text-faint, #9294a1);
          text-align: right;
          padding: 2px 6px;
          margin-top: 2px;
          user-select: none;
          pointer-events: none;
        `;
          inputEl.parentElement?.appendChild(counter);
        }
        counter.textContent = `${count} chars`;
        if (count > 1800) {
          counter.style.color = "var(--danger, #f2555a)";
        } else {
          counter.style.color = "var(--text-faint, #9294a1)";
        }
      };
      const onInput = (e) => {
        const target = e.target;
        if (target && (target.tagName === "TEXTAREA" || target.getAttribute("contenteditable") === "true" || target.classList.contains("input"))) {
          updateCounter(target);
        }
      };
      document.addEventListener("input", onInput, true);
      api.events.on("plugin:cleanup", () => document.removeEventListener("input", onInput, true));
    },
    renderSettings(api, container) {
      const charCounter = api.storage.get("charCounter", true);
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Message Character Counter</span>
            <span class="ym-setting-desc">Displays a subtle live character count below text chat inputs (warns when approaching limit).</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-qol-char" ${charCounter ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
      container.querySelector("#yf-qol-char")?.addEventListener("change", async (e) => {
        await api.storage.set("charCounter", e.target.checked);
        if (!e.target.checked) {
          document.querySelectorAll(".yf-char-counter").forEach((el) => el.remove());
        }
      });
    }
  };

  // src/renderer/plugins/message-logger.js
  var MessageLoggerPlugin = {
    id: "message-logger",
    name: "Message Logger",
    version: "1.1.0",
    author: "Yapify Team",
    description: "Deleted messages stay visible in red. Right-click a red message to dismiss it.",
    _observer: null,
    onStart(api) {
      api.logger.info("Message Logger started");
      api.ui.injectStyle("msg-logger", `
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
      api.logger.info("Message Logger stopped");
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      api.ui.removeStyle("msg-logger");
      document.querySelectorAll(".yf-deleted-msg").forEach((el) => {
        el.classList.remove("yf-deleted-msg");
      });
      document.querySelectorAll(".yf-dismiss-menu").forEach((el) => el.remove());
    },
    _startObserving(api) {
      document.addEventListener("click", () => {
        document.querySelectorAll(".yf-dismiss-menu").forEach((el) => el.remove());
      });
      this._observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.removedNodes.length > 3) continue;
          const target = mutation.target;
          if (!target || target === document.body || target.id === "__next") continue;
          for (const removed of mutation.removedNodes) {
            if (removed.nodeType !== Node.ELEMENT_NODE) continue;
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
      const tag = el.tagName?.toLowerCase();
      if (tag === "body" || tag === "main" || tag === "section" || tag === "nav" || tag === "header") return false;
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("messages") || cls.includes("chat-shell") || cls.includes("chat-wrap") || cls.includes("chat-row") || cls.includes("server") || cls.includes("channel") || cls.includes("sidebar")) {
        return false;
      }
      if (el.querySelector?.("textarea, input, .chat-head, .channel-header, .member-list, .messages, .messages-inner, .chat-start, .chat-shell")) {
        return false;
      }
      if (el.querySelectorAll?.('.msg, [class*="message"]').length > 1) {
        return false;
      }
      const isMsgRow = el.classList.contains("msg") || el.classList.contains("message") && !el.classList.contains("messages");
      if (!isMsgRow) return false;
      return !!el.querySelector?.('.msg-text, .msg-body, [class*="text"]');
    },
    _preserveMessage(api, removedEl, parent, refSibling) {
      if (removedEl.classList?.contains("yf-deleted-msg")) return;
      const text = removedEl.textContent?.trim() || "";
      if (text.length < 1) return;
      if (!parent || !document.body.contains(parent)) return;
      removedEl.classList.add("yf-deleted-msg");
      removedEl.style.display = "";
      removedEl.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showDismissMenu(api, e, removedEl);
      };
      try {
        if (refSibling && parent.contains(refSibling)) {
          parent.insertBefore(removedEl, refSibling);
        } else {
          parent.appendChild(removedEl);
        }
        api.logger.info(`Preserved deleted message: "${text.slice(0, 30)}..."`);
      } catch (err) {
        api.logger.debug("Could not re-insert deleted message: " + err.message);
      }
    },
    _showDismissMenu(api, event, msgEl) {
      document.querySelectorAll(".yf-dismiss-menu").forEach((el) => el.remove());
      const menu = document.createElement("div");
      menu.className = "yf-dismiss-menu";
      menu.style.left = event.clientX + "px";
      menu.style.top = event.clientY + "px";
      const dismissBtn = document.createElement("button");
      dismissBtn.textContent = "Dismiss deleted message";
      dismissBtn.className = "yf-dismiss-danger";
      dismissBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        msgEl.remove();
        menu.remove();
      });
      const dismissAllBtn = document.createElement("button");
      dismissAllBtn.textContent = "Dismiss all deleted";
      dismissAllBtn.className = "yf-dismiss-danger";
      dismissAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".yf-deleted-msg").forEach((el) => el.remove());
        menu.remove();
        api.ui.showToast("Cleared all deleted messages", "info");
      });
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy deleted text";
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = msgEl.textContent?.replace("deleted", "").trim() || "";
        navigator.clipboard.writeText(text).then(() => {
          api.ui.showToast("Copied deleted message", "success");
        });
        menu.remove();
      });
      menu.appendChild(copyBtn);
      menu.appendChild(dismissBtn);
      menu.appendChild(dismissAllBtn);
      document.body.appendChild(menu);
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = window.innerWidth - rect.width - 8 + "px";
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = window.innerHeight - rect.height - 8 + "px";
      }
      const onKey = (e) => {
        if (e.key === "Escape") {
          menu.remove();
          document.removeEventListener("keydown", onKey);
        }
      };
      document.addEventListener("keydown", onKey);
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
          \u2022 When someone deletes a message, it stays but turns red<br/>
          \u2022 Right-click any red message to dismiss it or copy the text<br/>
          \u2022 "Dismiss all deleted" clears every red message at once
        </div>
      </div>
    `;
    }
  };

  // src/renderer/plugins/better-timestamps.js
  var BetterTimestampsPlugin = {
    id: "better-timestamps",
    name: "Better Timestamps",
    version: "1.0.0",
    author: "Yapify Team",
    description: 'Shows full dates on messages instead of "2 hours ago". Hover to see relative time.',
    _observer: null,
    _interval: null,
    onStart(api) {
      api.logger.info("Better Timestamps started");
      const format = api.storage.get("timeFormat", "12h");
      api.ui.injectStyle("timestamps", `
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
      api.ui.removeStyle("timestamps");
      document.querySelectorAll(".yf-timestamp").forEach((el) => {
        el.classList.remove("yf-timestamp");
        el.removeAttribute("data-relative");
        if (el.dataset.yfOriginal) {
          el.textContent = el.dataset.yfOriginal;
          delete el.dataset.yfOriginal;
        }
      });
    },
    _getTimeString(date, format) {
      const opts = {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: format === "12h"
      };
      const now = /* @__PURE__ */ new Date();
      if (date.getFullYear() !== now.getFullYear()) {
        opts.year = "numeric";
      }
      return date.toLocaleString(void 0, opts);
    },
    _getRelative(date) {
      const diff = Date.now() - date.getTime();
      const secs = Math.floor(diff / 1e3);
      if (secs < 60) return "just now";
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
      const timeEl = el.closest("time") || el.querySelector("time");
      const datetime = timeEl?.getAttribute("datetime") || el.getAttribute("datetime");
      let date = null;
      if (datetime) {
        date = new Date(datetime);
      } else {
        const text = el.textContent?.trim().toLowerCase() || "";
        if (text.includes("ago") || text.includes("yesterday") || text.includes("today")) {
          return;
        }
      }
      if (date && !isNaN(date.getTime())) {
        el.dataset.yfOriginal = el.textContent;
        el.textContent = this._getTimeString(date, format);
        el.dataset.yfRelative = this._getRelative(date);
        el.setAttribute("data-relative", this._getRelative(date));
        el.classList.add("yf-timestamp");
        el.dataset.yfProcessed = "true";
      }
    },
    _processExisting(api, format) {
      document.querySelectorAll('time, [class*="timestamp"], [class*="time"]').forEach((el) => {
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
      const format = api.storage.get("timeFormat", "12h");
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Time Format</span>
            <span class="ym-setting-desc">Choose between 12-hour (3:45 PM) or 24-hour (15:45) display.</span>
          </div>
          <div class="ym-setting-control">
            <select id="yf-time-format" class="ym-select" style="background: rgba(255,255,255,0.08); color: var(--text); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px;">
              <option value="12h" ${format === "12h" ? "selected" : ""}>12-hour</option>
              <option value="24h" ${format === "24h" ? "selected" : ""}>24-hour</option>
            </select>
          </div>
        </div>
      </div>
    `;
      container.querySelector("#yf-time-format")?.addEventListener("change", async (e) => {
        await api.storage.set("timeFormat", e.target.value);
        api.ui.showToast(`Switched to ${e.target.value === "12h" ? "12-hour" : "24-hour"} format. Refresh to apply.`, "info");
      });
    }
  };

  // src/renderer/plugins/quick-css.js
  var QuickCSSPlugin = {
    id: "quick-css",
    name: "Quick CSS",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Live CSS editor built right into settings. Write custom styles and see them applied instantly.",
    _styleEl: null,
    onStart(api) {
      api.logger.info("Quick CSS started");
      const css = api.storage.get("customCSS", "");
      if (css) {
        this._applyCSS(api, css);
      }
    },
    onStop(api) {
      api.logger.info("Quick CSS stopped");
      api.ui.removeStyle("quick-css");
    },
    _applyCSS(api, css) {
      api.ui.injectStyle("quick-css", css);
    },
    renderSettings(api, container) {
      const css = api.storage.get("customCSS", "");
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row" style="flex-direction: column; align-items: stretch;">
          <div class="ym-setting-info" style="margin-bottom: 10px;">
            <span class="ym-setting-title">Custom CSS Editor</span>
            <span class="ym-setting-desc">Write CSS below \u2014 it applies live as you type. Saved automatically.</span>
          </div>
          <textarea id="yf-css-editor" spellcheck="false" style="
            width: 100%;
            min-height: 250px;
            background: rgba(0, 0, 0, 0.35);
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.5;
            resize: vertical;
            tab-size: 2;
            outline: none;
            transition: border-color 0.2s;
          ">${this._escapeHtml(css)}</textarea>
          <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end;">
            <button id="yf-css-clear" class="ym-btn ghost">Clear</button>
            <button id="yf-css-apply" class="ym-btn secondary">Apply & Save</button>
          </div>
        </div>

        <div class="ym-setting-row" style="margin-top: 16px; flex-direction: column; align-items: stretch;">
          <span class="ym-setting-title" style="margin-bottom: 8px;">Snippets</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${this._getSnippets().map((s) => `
              <button class="ym-btn ghost yf-snippet-btn" data-snippet="${this._escapeAttr(s.css)}" style="font-size: 12px; padding: 4px 10px;">
                ${s.name}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
      const editor = container.querySelector("#yf-css-editor");
      editor?.addEventListener("focus", () => {
        editor.style.borderColor = "rgba(255, 255, 255, 0.25)";
      });
      editor?.addEventListener("blur", () => {
        editor.style.borderColor = "rgba(255, 255, 255, 0.1)";
      });
      editor?.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
        }
      });
      container.querySelector("#yf-css-apply")?.addEventListener("click", async () => {
        const val = editor?.value || "";
        await api.storage.set("customCSS", val);
        this._applyCSS(api, val);
        api.ui.showToast("Custom CSS saved and applied", "success");
      });
      container.querySelector("#yf-css-clear")?.addEventListener("click", async () => {
        if (editor) editor.value = "";
        await api.storage.set("customCSS", "");
        this._applyCSS(api, "");
        api.ui.showToast("Custom CSS cleared", "info");
      });
      container.querySelectorAll(".yf-snippet-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const snippet = btn.getAttribute("data-snippet");
          if (editor) {
            editor.value += (editor.value ? "\n\n" : "") + snippet;
            editor.scrollTop = editor.scrollHeight;
          }
        });
      });
    },
    _getSnippets() {
      return [
        { name: "Hide Member List", css: '/* Hide member list sidebar */\n[class*="members"], [class*="member-list"] {\n  display: none !important;\n}' },
        { name: "Bigger Chat Font", css: '/* Bigger chat text */\n[class*="message"] {\n  font-size: 16px !important;\n}' },
        { name: "No Animations", css: "/* Kill all animations */\n* {\n  animation: none !important;\n  transition: none !important;\n}" },
        { name: "Blur Background", css: "/* Frosted glass effect */\nbody {\n  backdrop-filter: blur(8px);\n}" },
        { name: "Rounded Avatars", css: '/* Circle avatars */\nimg[class*="avatar"] {\n  border-radius: 50% !important;\n}' },
        { name: "Compact Mode", css: '/* Reduce spacing in messages */\n[class*="message"] {\n  padding: 2px 16px !important;\n  margin: 0 !important;\n}' }
      ];
    },
    _escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    _escapeAttr(str) {
      return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  };

  // src/renderer/plugins/do-not-disturb.js
  var DoNotDisturbPlugin = {
    id: "do-not-disturb",
    name: "Do Not Disturb",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Suppress desktop notifications and optionally hide unread badges. Great for focusing or streaming.",
    _originalNotification: null,
    _originalBadge: null,
    onStart(api) {
      api.logger.info("Do Not Disturb started");
      const suppressNotifs = api.storage.get("suppressNotifs", true);
      const hideBadges = api.storage.get("hideBadges", false);
      if (suppressNotifs) {
        this._suppressNotifications(api);
      }
      if (hideBadges) {
        this._hideBadges(api);
      }
    },
    onStop(api) {
      api.logger.info("Do Not Disturb stopped");
      if (this._originalNotification) {
        window.Notification = this._originalNotification;
        this._originalNotification = null;
      }
      if (this._originalBadge && window.yapperDesktop) {
        window.yapperDesktop.setBadge = this._originalBadge;
        this._originalBadge = null;
      }
      api.ui.removeStyle("dnd-badges");
    },
    _suppressNotifications(api) {
      this._originalNotification = window.Notification;
      const FakeNotification = function(title, options) {
        api.logger.debug(`DND: suppressed notification "${title}"`);
      };
      FakeNotification.permission = "granted";
      FakeNotification.requestPermission = () => Promise.resolve("granted");
      window.Notification = FakeNotification;
      if (window.yapperDesktop?.notify) {
        const origNotify = window.yapperDesktop.notify;
        window.yapperDesktop.notify = (n) => {
          api.logger.debug(`DND: suppressed yapper notify "${n?.title}"`);
        };
      }
    },
    _hideBadges(api) {
      if (window.yapperDesktop?.setBadge) {
        this._originalBadge = window.yapperDesktop.setBadge;
        window.yapperDesktop.setBadge = () => {
        };
      }
      api.ui.injectStyle("dnd-badges", `
      [class*="badge"], [class*="unread-count"], [class*="mention-badge"],
      [class*="numberBadge"], [class*="count"] {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `);
    },
    renderSettings(api, container) {
      const suppressNotifs = api.storage.get("suppressNotifs", true);
      const hideBadges = api.storage.get("hideBadges", false);
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Suppress Notifications</span>
            <span class="ym-setting-desc">Block all desktop notifications from Yapin while DND is active.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-dnd-notifs" ${suppressNotifs ? "checked" : ""} />
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
              <input type="checkbox" id="yf-dnd-badges" ${hideBadges ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
      container.querySelector("#yf-dnd-notifs")?.addEventListener("change", async (e) => {
        await api.storage.set("suppressNotifs", e.target.checked);
        api.ui.showToast(e.target.checked ? "Notifications suppressed" : "Notifications restored (restart needed)", "info");
      });
      container.querySelector("#yf-dnd-badges")?.addEventListener("change", async (e) => {
        await api.storage.set("hideBadges", e.target.checked);
        if (e.target.checked) {
          this._hideBadges(api);
        } else {
          api.ui.removeStyle("dnd-badges");
        }
      });
    }
  };

  // src/renderer/plugins/font-changer.js
  var FontChangerPlugin = {
    id: "font-changer",
    name: "Font Changer",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Swap the entire client font to any Google Font or local system font. Change the vibe instantly.",
    _linkEl: null,
    onStart(api) {
      api.logger.info("Font Changer started");
      const font = api.storage.get("fontFamily", "");
      const isGoogle = api.storage.get("isGoogleFont", true);
      if (font) {
        this._applyFont(api, font, isGoogle);
      }
    },
    onStop(api) {
      api.logger.info("Font Changer stopped");
      api.ui.removeStyle("font-override");
      if (this._linkEl) {
        this._linkEl.remove();
        this._linkEl = null;
      }
    },
    _applyFont(api, fontFamily, isGoogle) {
      if (isGoogle && fontFamily) {
        if (this._linkEl) this._linkEl.remove();
        this._linkEl = document.createElement("link");
        this._linkEl.rel = "stylesheet";
        this._linkEl.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(this._linkEl);
      }
      if (fontFamily) {
        api.ui.injectStyle("font-override", `
        * {
          font-family: '${fontFamily}', system-ui, -apple-system, sans-serif !important;
        }
        code, pre, [class*="code"], [class*="mono"] {
          font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace !important;
        }
      `);
      } else {
        api.ui.removeStyle("font-override");
      }
    },
    renderSettings(api, container) {
      const font = api.storage.get("fontFamily", "");
      const isGoogle = api.storage.get("isGoogleFont", true);
      const popularFonts = [
        "Inter",
        "Outfit",
        "Poppins",
        "Nunito",
        "Lexend",
        "Plus Jakarta Sans",
        "Space Grotesk",
        "DM Sans",
        "Rubik",
        "Manrope",
        "Geist",
        "Figtree"
      ];
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row" style="flex-direction: column; align-items: stretch;">
          <div class="ym-setting-info" style="margin-bottom: 10px;">
            <span class="ym-setting-title">Font Family</span>
            <span class="ym-setting-desc">Type any font name. Google Fonts are loaded automatically.</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="yf-font-input" class="ym-input" value="${font}" placeholder="e.g. Inter, Poppins, Outfit..." style="flex: 1;" />
            <button id="yf-font-apply" class="ym-btn secondary">Apply</button>
            <button id="yf-font-reset" class="ym-btn ghost">Reset</button>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Load from Google Fonts</span>
            <span class="ym-setting-desc">Uncheck if using a locally installed font instead.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-font-google" ${isGoogle ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div style="margin-top: 16px;">
          <span class="ym-setting-title" style="margin-bottom: 8px; display: block;">Quick Picks</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${popularFonts.map((f) => `
              <button class="ym-btn ghost yf-font-pick ${font === f ? "active" : ""}" data-font="${f}" style="font-size: 12px; padding: 5px 12px;">
                ${f}
              </button>
            `).join("")}
          </div>
        </div>

        ${font ? `
          <div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <span class="ym-setting-title" style="margin-bottom: 6px; display: block;">Preview</span>
            <p style="font-family: '${font}', sans-serif; font-size: 15px; color: var(--text); line-height: 1.5; margin: 0;">
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
        ` : ""}
      </div>
    `;
      const input = container.querySelector("#yf-font-input");
      const apply = async (fontName) => {
        const google = container.querySelector("#yf-font-google")?.checked ?? true;
        await api.storage.set("fontFamily", fontName);
        await api.storage.set("isGoogleFont", google);
        this._applyFont(api, fontName, google);
        api.ui.showToast(fontName ? `Font set to ${fontName}` : "Font reset to default", "success");
        this.renderSettings(api, container);
      };
      container.querySelector("#yf-font-apply")?.addEventListener("click", () => apply(input?.value?.trim() || ""));
      container.querySelector("#yf-font-reset")?.addEventListener("click", () => apply(""));
      container.querySelector("#yf-font-google")?.addEventListener("change", async (e) => {
        await api.storage.set("isGoogleFont", e.target.checked);
      });
      container.querySelectorAll(".yf-font-pick").forEach((btn) => {
        btn.addEventListener("click", () => {
          const f = btn.getAttribute("data-font");
          if (input) input.value = f;
          apply(f);
        });
      });
    }
  };

  // src/renderer/plugins/copy-raw.js
  var CopyRawPlugin = {
    id: "copy-raw",
    name: "Copy Raw",
    version: "1.0.0",
    author: "Yapify Team",
    description: 'Adds "Copy Raw" to messages \u2014 grabs the plain text content without any formatting or embeds.',
    _listener: null,
    onStart(api) {
      api.logger.info("Copy Raw started");
      api.ui.injectStyle("copy-raw", `
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
      api.logger.info("Copy Raw stopped");
      api.ui.removeStyle("copy-raw");
      document.querySelectorAll(".yf-copy-raw-btn").forEach((el) => el.remove());
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    },
    _startWatching(api) {
      const processMessages = () => {
        const messages = document.querySelectorAll('[class*="message"], [class*="chatMessage"]');
        for (const msg of messages) {
          if (msg.querySelector(".yf-copy-raw-btn")) continue;
          if (msg.offsetHeight < 20) continue;
          const pos = getComputedStyle(msg).position;
          if (pos === "static") {
            msg.style.position = "relative";
          }
          const btn = document.createElement("button");
          btn.className = "yf-copy-raw-btn";
          btn.textContent = "Copy";
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const textEls = msg.querySelectorAll('[class*="content"], [class*="text"], p');
            let rawText = "";
            if (textEls.length > 0) {
              rawText = Array.from(textEls).map((el) => el.textContent?.trim()).filter(Boolean).join("\n");
            } else {
              rawText = msg.textContent?.trim() || "";
            }
            navigator.clipboard.writeText(rawText).then(() => {
              btn.textContent = "Copied!";
              setTimeout(() => {
                btn.textContent = "Copy";
              }, 1500);
              api.ui.showToast("Copied message text", "success");
            }).catch(() => {
              api.ui.showToast("Failed to copy", "error");
            });
          });
          msg.appendChild(btn);
        }
      };
      processMessages();
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

  // src/renderer/plugins/typing-indicator.js
  var TypingIndicatorPlugin = {
    id: "typing-indicator",
    name: "Typing Indicator Tweaks",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Hide the typing indicator completely, or make it smaller and less distracting.",
    onStart(api) {
      api.logger.info("Typing Indicator Tweaks started");
      this._applyMode(api);
    },
    onStop(api) {
      api.logger.info("Typing Indicator Tweaks stopped");
      api.ui.removeStyle("typing-tweaks");
    },
    _applyMode(api) {
      const mode = api.storage.get("typingMode", "minimal");
      let css = "";
      switch (mode) {
        case "hidden":
          css = `
          [class*="typing"], [class*="typingIndicator"], [class*="typing-indicator"] {
            display: none !important;
          }
        `;
          break;
        case "minimal":
          css = `
          [class*="typing"], [class*="typingIndicator"], [class*="typing-indicator"] {
            opacity: 0.5 !important;
            font-size: 11px !important;
            padding: 2px 8px !important;
          }
        `;
          break;
        case "normal":
        default:
          css = "";
          break;
      }
      if (css) {
        api.ui.injectStyle("typing-tweaks", css);
      } else {
        api.ui.removeStyle("typing-tweaks");
      }
    },
    renderSettings(api, container) {
      const mode = api.storage.get("typingMode", "minimal");
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Typing Indicator Mode</span>
            <span class="ym-setting-desc">Control how "X is typing..." appears in chat.</span>
          </div>
          <div class="ym-setting-control">
            <select id="yf-typing-mode" class="ym-select" style="background: rgba(255,255,255,0.08); color: var(--text); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px;">
              <option value="normal" ${mode === "normal" ? "selected" : ""}>Normal (default)</option>
              <option value="minimal" ${mode === "minimal" ? "selected" : ""}>Minimal (faded & small)</option>
              <option value="hidden" ${mode === "hidden" ? "selected" : ""}>Hidden (completely invisible)</option>
            </select>
          </div>
        </div>
      </div>
    `;
      container.querySelector("#yf-typing-mode")?.addEventListener("change", async (e) => {
        await api.storage.set("typingMode", e.target.value);
        this._applyMode(api);
        api.ui.showToast(`Typing indicator: ${e.target.value}`, "info");
      });
    }
  };

  // src/renderer/plugins/autoscroll.js
  var AutoScrollPlugin = {
    id: "autoscroll",
    name: "Auto Scroll",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Automatically scrolls chat to the bottom. Features a toggle button next to the GIF icon that crosses out in red when paused or scrolled up.",
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
      this._isActive = api.storage.get("autoScrollDefault", true);
      api.logger.info("Auto Scroll plugin started");
      api.ui.injectStyle("autoscroll-styles", `
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
      this._startWatcher();
    },
    onStop(api) {
      api.logger.info("Auto Scroll plugin stopped");
      this._stopWatcher();
      api.ui.removeStyle("autoscroll-styles");
      document.querySelectorAll(".yf-autoscroll-btn").forEach((btn) => btn.remove());
    },
    _startWatcher() {
      this._attachScrollListeners();
      this._ensureButtonInjected();
      this._checkInterval = setInterval(() => {
        this._ensureButtonInjected();
        this._attachScrollListeners();
      }, 600);
      this._domObserver = new MutationObserver((mutations) => {
        let hasNewNodes = false;
        let hasChatChange = false;
        for (const m of mutations) {
          if (m.addedNodes.length > 0) {
            hasNewNodes = true;
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const cls = typeof node.className === "string" ? node.className : "";
                if (cls.includes("msg") || cls.includes("chat") || node.querySelector?.('.msg, [class*="message"]')) {
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
      const candidates = [
        document.querySelector(".messages-inner"),
        document.querySelector(".messages"),
        document.querySelector(".chat .messages"),
        document.querySelector('[class*="messages-inner"]'),
        document.querySelector('[class*="messages"]'),
        document.querySelector(".chat")
      ];
      for (const el of candidates) {
        if (el && this._isScrollable(el)) return el;
      }
      const anyMsg = document.querySelector('.msg, [class*="msg"], [class*="message"]');
      if (anyMsg) {
        let parent = anyMsg.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
          if (this._isScrollable(parent)) return parent;
          parent = parent.parentElement;
        }
      }
      const chat = document.querySelector('.chat, [class*="chat"]');
      if (chat) {
        const all = chat.querySelectorAll("*");
        for (const el of all) {
          if (this._isScrollable(el)) return el;
        }
      }
      return document.querySelector(".messages-inner") || document.querySelector(".messages") || document.querySelector(".chat");
    },
    _isScrollable(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
      return canScroll && el.scrollHeight > el.clientHeight;
    },
    _attachScrollListeners() {
      const container = this._getScrollContainer();
      if (!container || container === this._scrollContainer) return;
      this._detachScrollListeners();
      this._scrollContainer = container;
      this._scrollListener = () => {
        if (this._isProgrammaticScroll || !this._scrollContainer) return;
        const { scrollTop, scrollHeight, clientHeight } = this._scrollContainer;
        const distFromBottom = scrollHeight - clientHeight - scrollTop;
        if (distFromBottom > 50) {
          if (this._isActive) {
            this._isActive = false;
            this._updateButtonUI();
            this._api?.logger.debug("Manual scroll up detected; Auto-scroll paused (crossed out)");
          }
        } else if (distFromBottom <= 20) {
          if (!this._isActive) {
            this._isActive = true;
            this._updateButtonUI();
            this._api?.logger.debug("Scrolled back to bottom; Auto-scroll resumed (uncrossed)");
          }
        }
      };
      this._wheelListener = (e) => {
        if (e.deltaY < 0 && this._isActive) {
          this._isActive = false;
          this._updateButtonUI();
          this._api?.logger.debug("Wheel up detected; Auto-scroll paused (crossed out)");
        }
      };
      container.addEventListener("scroll", this._scrollListener, { passive: true });
      container.addEventListener("wheel", this._wheelListener, { passive: true });
    },
    _detachScrollListeners() {
      if (this._scrollContainer) {
        if (this._scrollListener) {
          this._scrollContainer.removeEventListener("scroll", this._scrollListener);
          this._scrollListener = null;
        }
        if (this._wheelListener) {
          this._scrollContainer.removeEventListener("wheel", this._wheelListener);
          this._wheelListener = null;
        }
        this._scrollContainer = null;
      }
    },
    _findGifButton() {
      const composer = document.querySelector('.composer, [class*="composer"], .chat-box, .chat-input, .chat');
      const scope = composer || document;
      const buttons = scope.querySelectorAll('button, [role="button"], [class*="btn"], [class*="action"]');
      for (const btn of buttons) {
        if (btn.classList.contains("yf-autoscroll-btn")) continue;
        const text = btn.textContent?.trim().toUpperCase();
        if (text === "GIF") return btn;
      }
      const attrBtn = scope.querySelector(
        'button[aria-label*="gif" i], button[title*="gif" i], button[data-tooltip*="gif" i], [class*="gif" i] button, button[class*="gif" i]'
      );
      if (attrBtn && !attrBtn.classList.contains("yf-autoscroll-btn")) {
        return attrBtn.closest("button") || attrBtn;
      }
      for (const el of scope.querySelectorAll("span, div, b, strong, p")) {
        if (el.children.length === 0 && el.textContent?.trim().toUpperCase() === "GIF") {
          const parentBtn = el.closest('button, [role="button"], [class*="btn"]');
          if (parentBtn && !parentBtn.classList.contains("yf-autoscroll-btn")) return parentBtn;
          return el;
        }
      }
      return null;
    },
    _findActionInsertionPoint() {
      const gifBtn = this._findGifButton();
      if (gifBtn && gifBtn.parentElement) {
        return { container: gifBtn.parentElement, refEl: gifBtn.nextSibling };
      }
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
      const existing = document.querySelector(".yf-autoscroll-btn");
      if (existing && document.body.contains(existing)) {
        this._updateButtonUI(existing);
        return;
      }
      const target = this._findActionInsertionPoint();
      if (!target || !target.container) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yf-autoscroll-btn " + (this._isActive ? "is-active" : "is-disabled");
      btn.setAttribute("aria-label", this._isActive ? "Auto-scroll is ON" : "Auto-scroll is OFF");
      btn.innerHTML = `
      <svg class="yf-autoscroll-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Downward arrow into bottom tray -->
        <path class="yf-as-arrow" d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14" />
        <!-- Red diagonal cross-out line -->
        <line class="yf-as-cross" x1="4" y1="4" x2="20" y2="20" />
      </svg>
    `;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._isActive = !this._isActive;
        this._updateButtonUI(btn);
        if (this._isActive) {
          this._scrollToBottom(true);
          this._api?.ui.showToast("Auto-scroll enabled", "info");
        } else {
          this._api?.ui.showToast("Auto-scroll paused (crossed out)", "info");
        }
      });
      this._updateButtonUI(btn);
      try {
        if (target.refEl) {
          target.container.insertBefore(btn, target.refEl);
        } else {
          target.container.appendChild(btn);
        }
        this._api?.logger.info("Injected Auto Scroll button next to GIF icon");
      } catch (err) {
        this._api?.logger.warn("Failed to insert autoscroll button: " + err.message);
      }
    },
    _updateButtonUI(btn = null) {
      const el = btn || document.querySelector(".yf-autoscroll-btn");
      if (!el) return;
      if (this._isActive) {
        el.classList.add("is-active");
        el.classList.remove("is-disabled");
        el.title = "Auto-scroll: ON (Click to pause)";
        el.setAttribute("aria-label", "Auto-scroll is ON");
      } else {
        el.classList.remove("is-active");
        el.classList.add("is-disabled");
        el.title = "Auto-scroll: PAUSED / OFF (Click or scroll to bottom to enable)";
        el.setAttribute("aria-label", "Auto-scroll is OFF (Crossed out)");
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
          container.scrollTo({ top: targetTop, behavior: "smooth" });
        } else {
          container.scrollTop = targetTop;
        }
        const newBelow = document.querySelector(".new-below");
        if (newBelow && newBelow.offsetParent !== null) {
          newBelow.click();
        }
      } catch (e) {
      } finally {
        setTimeout(() => {
          this._isProgrammaticScroll = false;
        }, 150);
      }
    },
    renderSettings(api, container) {
      const autoScrollDefault = api.storage.get("autoScrollDefault", true);
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Auto Scroll by Default</span>
            <span class="ym-setting-desc">Automatically keep chat scrolled to the newest messages upon opening or switching channels.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-as-default" ${autoScrollDefault ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px; margin-top: 14px;">
          <div class="ym-setting-info">
            <span class="ym-setting-title">How it works</span>
            <span class="ym-setting-desc" style="line-height: 1.5; color: var(--text-muted, #9294a1);">
              \u2022 A toggle button is placed directly <b>next to the GIF icon</b> in the chat input bar.<br/>
              \u2022 When active, new messages keep the chat automatically scrolled to the bottom.<br/>
              \u2022 When you <b>scroll up manually</b>, the icon <b>crosses itself out in red</b> and pauses auto-scrolling.<br/>
              \u2022 When you <b>scroll back down to the bottom</b> or click the button, it uncrosses and resumes auto-scrolling.
            </span>
          </div>
        </div>
      </div>
    `;
      container.querySelector("#yf-as-default")?.addEventListener("change", async (e) => {
        await api.storage.set("autoScrollDefault", e.target.checked);
        this._isActive = e.target.checked;
        this._updateButtonUI();
        api.ui.showToast(`Auto Scroll default: ${e.target.checked ? "Enabled" : "Disabled"}`, "info");
      });
    }
  };

  // src/renderer/plugins/window-mods.js
  var WindowModsPlugin = {
    id: "window-mods",
    name: "Window Mods",
    version: "1.1.0",
    author: "Yapify Team",
    description: "Window modes (Borderless Windowed, Fullscreen, Windowed) and authentic Mac-style traffic light window controls (Close, Minimize, and Fullscreen).",
    _api: null,
    _keyListener: null,
    _checkInterval: null,
    _containerEl: null,
    onStart(api) {
      this._api = api;
      api.logger.info("Window Mods started");
      api.ui.injectStyle("window-mods-styles", `
      /* Drag bar for frameless window */
      .yf-window-drag-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 24px !important;
        -webkit-app-region: drag !important;
        z-index: 999980 !important;
        pointer-events: auto !important;
      }

      body.yf-borderless-windowed .yf-window-drag-bar,
      body.yf-fullscreen .yf-window-drag-bar {
        height: 8px !important;
      }

      /* Ensure buttons and controls are never blocked by dragging */
      button, input, textarea, a, select, [role="button"],
      .yf-mac-traffic-lights, .yf-mac-btn,
      .yf-custom-dropdown, .yf-dropdown-trigger, .yf-dropdown-menu,
      .yf-settings-modal, .yf-settings-overlay, .ym-settings-modal {
        -webkit-app-region: no-drag !important;
      }

      /* In borderless windowed mode, hide in-app top bars where the title/name is */
      body.yf-borderless-windowed .yf-app-top-bar,
      body.yf-borderless-windowed [class*="titlebar"],
      body.yf-borderless-windowed [class*="title-bar"],
      body.yf-borderless-windowed [class*="topbar"],
      body.yf-borderless-windowed [class*="top-bar"] {
        display: none !important;
      }

      .yf-mac-traffic-lights {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 6px 10px !important;
        background: rgba(18, 19, 23, 0.78) !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 20px !important;
        position: fixed !important;
        top: 10px !important;
        z-index: 999999 !important;
        user-select: none !important;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3) !important;
        transition: opacity 0.2s ease, transform 0.2s ease, left 0.15s ease, right 0.15s ease !important;
        -webkit-app-region: no-drag !important;
      }

      .yf-mac-traffic-lights.pos-left {
        left: 14px !important;
        right: auto !important;
      }

      .yf-mac-traffic-lights.pos-right {
        left: auto !important;
        right: 14px !important;
      }

      .yf-mac-traffic-lights:hover {
        background: rgba(24, 25, 30, 0.92) !important;
        border-color: rgba(255, 255, 255, 0.22) !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.65) !important;
      }

      .yf-mac-btn {
        width: 12.5px !important;
        height: 12.5px !important;
        border-radius: 50% !important;
        border: none !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        outline: none !important;
        position: relative !important;
        transition: transform 0.12s ease, filter 0.12s ease !important;
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 1px 2px rgba(0, 0, 0, 0.35) !important;
        flex-shrink: 0 !important;
        -webkit-app-region: no-drag !important;
      }

      .yf-mac-btn:hover {
        transform: scale(1.15) !important;
        filter: brightness(1.12) !important;
      }

      .yf-mac-btn:active {
        transform: scale(0.9) !important;
      }

      /* 1. Red: Close */
      .yf-mac-close {
        background: #ff5f56 !important;
        border: 1px solid #e0443e !important;
      }

      /* 2. Orange / Yellow: Minimize (3rd orange icon) */
      .yf-mac-min {
        background: #ffbd2e !important;
        border: 1px solid #dea123 !important;
      }

      /* 3. Green: Maximize / Fullscreen */
      .yf-mac-max {
        background: #27c93f !important;
        border: 1px solid #1aab29 !important;
      }

      /* Authentic Mac glyphs on hover */
      .yf-mac-glyph {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 8px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        color: rgba(0, 0, 0, 0.7) !important;
        opacity: 0 !important;
        transition: opacity 0.15s ease !important;
        pointer-events: none !important;
      }

      .yf-mac-traffic-lights:hover .yf-mac-glyph {
        opacity: 0.9 !important;
      }
    `);
      const wmSettings = storage.getPluginSettings("window-mods", {});
      const initialMode = wmSettings.windowMode || "borderless_windowed";
      this._applyWindowModeClass(initialMode);
      this._ensureDragBar();
      this._setupMacButtons(api);
      this._setupHotkeys(api);
    },
    onStop(api) {
      api.logger.info("Window Mods stopped");
      api.ui.removeStyle("window-mods-styles");
      document.body.classList.remove("yf-borderless-windowed", "yf-fullscreen", "yf-windowed");
      const dragBar = document.getElementById("yf-drag-bar");
      if (dragBar) dragBar.remove();
      this._updateTopBarDetection(false);
      if (this._containerEl) {
        this._containerEl.remove();
        this._containerEl = null;
      }
      if (this._checkInterval) {
        clearInterval(this._checkInterval);
        this._checkInterval = null;
      }
      if (this._keyListener) {
        window.removeEventListener("keydown", this._keyListener);
        this._keyListener = null;
      }
    },
    _setupHotkeys(api) {
      this._keyListener = (e) => {
        if (e.key === "F11") {
          e.preventDefault();
          this.toggleFullscreen(api);
        }
      };
      window.addEventListener("keydown", this._keyListener);
    },
    _ensureDragBar() {
      if (typeof document === "undefined") return;
      if (!document.getElementById("yf-drag-bar")) {
        const bar = document.createElement("div");
        bar.id = "yf-drag-bar";
        bar.className = "yf-window-drag-bar";
        document.body?.prepend(bar);
      }
    },
    _applyWindowModeClass(mode) {
      if (typeof document === "undefined" || !document.body) return;
      document.body.classList.remove("yf-borderless-windowed", "yf-fullscreen", "yf-windowed");
      if (mode === "borderless_windowed") {
        document.body.classList.add("yf-borderless-windowed");
      } else if (mode === "fullscreen") {
        document.body.classList.add("yf-fullscreen");
      } else {
        document.body.classList.add("yf-windowed");
      }
      this._updateTopBarDetection(mode === "borderless_windowed");
    },
    _updateTopBarDetection(isBorderless) {
      if (typeof document === "undefined") return;
      try {
        const elements = document.querySelectorAll('header, [class*="title"], [class*="header"], [class*="bar"], div');
        for (const el of elements) {
          if (el.closest?.(".yf-settings-modal") || el.closest?.('[role="dialog"]') || el.classList?.contains("yf-mac-traffic-lights")) continue;
          const r = el.getBoundingClientRect();
          if (r.top >= 0 && r.top <= 6 && r.height >= 18 && r.height <= 50 && r.width >= (window.innerWidth || 1200) * 0.7) {
            if (el.textContent && (el.textContent.includes("Yapin") || el.querySelector("img, svg"))) {
              el.classList.add("yf-app-top-bar");
              if (isBorderless) {
                el.style.setProperty("display", "none", "important");
              } else {
                el.style.removeProperty("display");
              }
            }
          }
        }
      } catch (e) {
      }
    },
    async setWindowMode(mode) {
      this._applyWindowModeClass(mode);
      if (window.yapinmodBridge?.invoke) {
        try {
          await window.yapinmodBridge.invoke("yapinmod:set-window-mode", mode);
          await storage.setPluginSettings("window-mods", { windowMode: mode });
        } catch (err) {
          this._api?.logger.warn("Failed to set window mode: " + err.message);
        }
      }
    },
    async toggleFullscreen(api) {
      if (window.yapinmodBridge?.invoke) {
        try {
          const res = await window.yapinmodBridge.invoke("yapinmod:window-action", "toggle-fullscreen");
          const isFs = res?.isFullScreen;
          const nextMode = isFs ? "fullscreen" : "borderless_windowed";
          this._applyWindowModeClass(nextMode);
          await storage.setPluginSettings("window-mods", { windowMode: nextMode });
          api?.ui.showToast(`Fullscreen: ${isFs ? "Enabled" : "Disabled"}`, "info");
        } catch (err) {
          api?.logger.warn("Failed to toggle fullscreen: " + err.message);
        }
      }
    },
    _setupMacButtons(api) {
      const showMac = storage.getPluginSettings("window-mods", {}).macButtons !== false;
      if (!showMac) return;
      this._ensureMacButtonsInjected(api);
      this._checkInterval = setInterval(() => {
        this._ensureMacButtonsInjected(api);
        this._ensureDragBar();
        const currentMode = storage.getPluginSettings("window-mods", {}).windowMode || "borderless_windowed";
        this._updateTopBarDetection(currentMode === "borderless_windowed");
      }, 1e3);
    },
    _ensureMacButtonsInjected(api) {
      const showMac = storage.getPluginSettings("window-mods", {}).macButtons !== false;
      if (!showMac) {
        if (this._containerEl) {
          this._containerEl.remove();
          this._containerEl = null;
        }
        return;
      }
      const pos = storage.getPluginSettings("window-mods", {}).macButtonsPosition || "left";
      if (this._containerEl && document.body.contains(this._containerEl)) {
        this.setPosition(pos);
        return;
      }
      const container = document.createElement("div");
      container.className = `yf-mac-traffic-lights pos-${pos}`;
      container.setAttribute("aria-label", "macOS Window Controls");
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "yf-mac-btn yf-mac-close";
      closeBtn.title = "Close";
      closeBtn.innerHTML = '<span class="yf-mac-glyph">\u2715</span>';
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.yapinmodBridge?.invoke("yapinmod:window-action", "close");
      });
      const minBtn = document.createElement("button");
      minBtn.type = "button";
      minBtn.className = "yf-mac-btn yf-mac-min";
      minBtn.title = "Minimize";
      minBtn.innerHTML = '<span class="yf-mac-glyph">\u2212</span>';
      minBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.yapinmodBridge?.invoke("yapinmod:window-action", "minimize");
      });
      const maxBtn = document.createElement("button");
      maxBtn.type = "button";
      maxBtn.className = "yf-mac-btn yf-mac-max";
      maxBtn.title = "Fullscreen / Maximize";
      maxBtn.innerHTML = '<span class="yf-mac-glyph">\u2922</span>';
      maxBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.yapinmodBridge?.invoke("yapinmod:window-action", "toggle-fullscreen");
      });
      container.appendChild(closeBtn);
      container.appendChild(minBtn);
      container.appendChild(maxBtn);
      document.body.appendChild(container);
      this._containerEl = container;
      this.setPosition(pos);
    },
    setPosition(pos) {
      if (!this._containerEl) return;
      if (pos === "right") {
        this._containerEl.classList.remove("pos-left");
        this._containerEl.classList.add("pos-right");
        this._containerEl.style.setProperty("left", "auto", "important");
        this._containerEl.style.setProperty("right", "14px", "important");
      } else {
        this._containerEl.classList.remove("pos-right");
        this._containerEl.classList.add("pos-left");
        this._containerEl.style.setProperty("left", "14px", "important");
        this._containerEl.style.setProperty("right", "auto", "important");
      }
    },
    renderSettings(api, container) {
      const wmSettings = storage.getPluginSettings("window-mods", {});
      const showMac = wmSettings.macButtons !== false;
      const currentPos = wmSettings.macButtonsPosition || "left";
      const currentMode = wmSettings.windowMode || "windowed";
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Window Display Mode</span>
            <span class="ym-setting-desc">Select how Yapin' is displayed on your monitor.</span>
          </div>
          <div class="ym-setting-control" id="yf-wm-mode-dropdown-mount">
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Mac-Style Window Buttons</span>
            <span class="ym-setting-desc">Authentic macOS traffic lights: \u{1F534} Red (Close), \u{1F7E0} Orange (Minimize), and \u{1F7E2} Green (Fullscreen/Maximize).</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-wm-mac" ${showMac ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Buttons Position</span>
            <span class="ym-setting-desc">Choose whether the Mac traffic lights sit on the Top Left (macOS standard) or Top Right.</span>
          </div>
          <div class="ym-setting-control" id="yf-wm-pos-dropdown-mount">
          </div>
        </div>
      </div>
    `;
      const modeMount = container.querySelector("#yf-wm-mode-dropdown-mount");
      if (modeMount) {
        const modeDropdown = createCustomDropdown({
          options: [
            { value: "borderless_windowed", label: "Borderless Windowed" },
            { value: "fullscreen", label: "Fullscreen" },
            { value: "windowed", label: "Windowed" }
          ],
          value: currentMode,
          width: "210px",
          onChange: async (newMode) => {
            await this.setWindowMode(newMode);
          }
        });
        modeMount.appendChild(modeDropdown);
      }
      const posMount = container.querySelector("#yf-wm-pos-dropdown-mount");
      if (posMount) {
        const posDropdown = createCustomDropdown({
          options: [
            { value: "left", label: "Top Left (macOS standard)" },
            { value: "right", label: "Top Right" }
          ],
          value: currentPos,
          width: "210px",
          onChange: async (newPos) => {
            await storage.setPluginSettings("window-mods", { macButtonsPosition: newPos });
            this.setPosition(newPos);
          }
        });
        posMount.appendChild(posDropdown);
      }
      container.querySelector("#yf-wm-mac")?.addEventListener("change", async (e) => {
        await storage.setPluginSettings("window-mods", { macButtons: e.target.checked });
        this._ensureMacButtonsInjected(api);
      });
    }
  };

  // src/renderer/plugins/no-pings.js
  var NoPingsPlugin = {
    id: "no-pings",
    name: "No Pings",
    version: "1.0.0",
    author: "Yapify Team",
    description: "Adds a toggle under the DMs button to silence all pings, notification sounds, desktop alerts, and unread badges.",
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
      this._isActive = api.storage.get("active", true);
      api.logger.info(`No Pings plugin started (initial active state: ${this._isActive})`);
      this._injectStyles(api);
      this._hookTitle();
      if (this._isActive) {
        this._applySuppression();
      }
      this._startWatcher();
    },
    onStop(api) {
      api.logger.info("No Pings plugin stopped; cleaning up elements and restoring notifications");
      this._stopWatcher();
      const toggleWrap = document.getElementById("yf-no-pings-wrap");
      if (toggleWrap) toggleWrap.remove();
      this._removeSuppression();
      this._restoreTitle();
      this._unhookTitle();
      api.ui.removeStyle("toggle-styles");
      api.ui.removeStyle("suppression-styles");
      this._api = null;
    },
    _injectStyles(api) {
      api.ui.injectStyle("toggle-styles", `
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
          return el.closest(".rail-wrap") || el;
        }
      }
      const firstWrap = rail.querySelector(".rail-wrap:not(.yf-no-pings-wrap)");
      if (firstWrap) return firstWrap;
      const firstBtn = rail.querySelector("button.rail-item, a.rail-item");
      if (firstBtn && !firstBtn.classList.contains("yf-no-pings-btn")) {
        return firstBtn.closest(".rail-wrap") || firstBtn;
      }
      const firstChild = rail.firstElementChild;
      if (firstChild && firstChild.id !== "yf-no-pings-wrap") return firstChild;
      return null;
    },
    /**
     * Ensure the No Pings toggle is injected right under the DMS button.
     * Rock-solid: never removes or loops if already present in the DOM.
     */
    _ensureToggleInjected() {
      if (!this._api) return;
      const existing = document.getElementById("yf-no-pings-wrap");
      if (existing && document.contains(existing)) {
        this._updateVisualState();
        return;
      }
      const rail = document.querySelector('nav.rail, aside.rail, nav[class*="rail"], aside[class*="rail"], .rail');
      if (!rail) return;
      const dmsItem = this._findDmsItem(rail);
      if (!dmsItem) return;
      const toggleWrap = this._createToggleElement();
      dmsItem.insertAdjacentElement("afterend", toggleWrap);
      this._updateVisualState();
    },
    /**
     * Create the toggle DOM element.
     */
    _createToggleElement() {
      const wrap = document.createElement("div");
      wrap.id = "yf-no-pings-wrap";
      wrap.className = `rail-wrap yf-no-pings-wrap ${this._isActive ? "is-active" : ""}`;
      wrap.setAttribute("data-yf-plugin", "no-pings");
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
          <span class="yf-np-tooltip-badge ${this._isActive ? "yf-np-badge-on" : "yf-np-badge-off"}">${this._isActive ? "ON" : "OFF"}</span>
        </div>
        <div class="yf-np-tooltip-desc">${this._isActive ? "All pings & sounds silenced" : "Click to silence all pings"}</div>
      </div>
    `;
      const btn = wrap.querySelector("#yf-no-pings-btn");
      btn?.addEventListener("click", (e) => {
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
      const wrap = document.getElementById("yf-no-pings-wrap");
      if (!wrap) return;
      const shouldHaveActive = !!this._isActive;
      if (wrap.classList.contains("is-active") !== shouldHaveActive) {
        if (shouldHaveActive) {
          wrap.classList.add("is-active");
        } else {
          wrap.classList.remove("is-active");
        }
      }
      const btn = wrap.querySelector("#yf-no-pings-btn");
      if (btn && btn.getAttribute("aria-checked") !== String(shouldHaveActive)) {
        btn.setAttribute("aria-checked", String(shouldHaveActive));
      }
      const badge = wrap.querySelector(".yf-np-tooltip-badge");
      if (badge) {
        const targetClass = `yf-np-tooltip-badge ${shouldHaveActive ? "yf-np-badge-on" : "yf-np-badge-off"}`;
        if (badge.className !== targetClass) badge.className = targetClass;
        const targetText = shouldHaveActive ? "ON" : "OFF";
        if (badge.textContent !== targetText) badge.textContent = targetText;
      }
      const desc = wrap.querySelector(".yf-np-tooltip-desc");
      if (desc) {
        const targetDesc = shouldHaveActive ? "All pings & sounds silenced" : "Click to silence all pings";
        if (desc.textContent !== targetDesc) desc.textContent = targetDesc;
      }
    },
    /**
     * Toggle between active (No Pings ON) and inactive (No Pings OFF).
     */
    async toggleActive() {
      this._isActive = !this._isActive;
      if (this._api?.storage) {
        await this._api.storage.set("active", this._isActive);
      }
      this._updateVisualState();
      if (this._isActive) {
        this._applySuppression();
      } else {
        this._removeSuppression();
        this._restoreTitle();
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
      try {
        const proto = Document.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "title") || typeof HTMLDocument !== "undefined" && Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "title") || Object.getOwnPropertyDescriptor(document, "title");
        if (desc && desc.set && desc.get) {
          this._origTitleGet = desc.get;
          this._origTitleSet = desc.set;
          const self = this;
          Object.defineProperty(document, "title", {
            configurable: true,
            enumerable: true,
            get() {
              return self._origTitleGet.call(this);
            },
            set(val) {
              self._rawTitle = val;
              if (typeof val === "string") {
                const match = val.match(/^\((\d+)\+?\)/);
                if (match && match[1]) {
                  self._lastBadgeCount = parseInt(match[1], 10);
                }
              }
              if (self._isActive && typeof val === "string") {
                const cleaned = val.replace(/^\(\d+\+?\)\s*/, "");
                return self._origTitleSet.call(this, cleaned);
              }
              return self._origTitleSet.call(this, val);
            }
          });
          this._titleHooked = true;
        }
      } catch (err) {
      }
      try {
        const targetNode = document.querySelector("head") || document.documentElement || document;
        if (targetNode && !this._titleObserver) {
          this._titleObserver = new MutationObserver(() => {
            if (!this._isActive || this._isSettingTitle) return;
            const titleEl = document.querySelector("title");
            const current = titleEl?.textContent || document.title || "";
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
      } catch (err) {
      }
      if (this._isActive) {
        this._sanitizeCurrentTitle();
      }
    },
    /**
     * Strip leading (1) count from current window title if active.
     */
    _sanitizeCurrentTitle() {
      const suppressTitle = this._api ? this._api.storage.get("suppressTitleCount", true) : true;
      if (!suppressTitle) return;
      try {
        const current = document.title || document.querySelector("title")?.textContent || "";
        if (/^\(\d+\+?\)\s*/.test(current)) {
          this._rawTitle = current;
          const match = current.match(/^\((\d+)\+?\)/);
          if (match && match[1]) {
            this._lastBadgeCount = parseInt(match[1], 10);
          }
          const cleaned = current.replace(/^\(\d+\+?\)\s*/, "");
          this._isSettingTitle = true;
          if (this._origTitleSet) {
            this._origTitleSet.call(document, cleaned);
          } else {
            document.title = cleaned;
          }
          const titleEl = document.querySelector("title");
          if (titleEl) {
            titleEl.textContent = cleaned;
          }
          this._isSettingTitle = false;
        }
      } catch (err) {
      }
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
            const current = (targetTitle || document.title || document.querySelector("title")?.textContent || "Yapin'").replace(/^\(\d+\+?\)\s*/, "");
            targetTitle = `(${this._lastBadgeCount}) ${current}`;
          }
        }
        if (targetTitle) {
          if (this._origTitleSet) {
            this._origTitleSet.call(document, targetTitle);
          } else {
            document.title = targetTitle;
          }
          const titleEl = document.querySelector("title");
          if (titleEl) {
            titleEl.textContent = targetTitle;
          }
        }
        this._isSettingTitle = false;
      } catch (err) {
      }
    },
    /**
     * Unhook document.title descriptor.
     */
    _unhookTitle() {
      if (!this._titleHooked) return;
      try {
        if (this._origTitleSet && this._origTitleGet) {
          Object.defineProperty(document, "title", {
            configurable: true,
            enumerable: true,
            get: this._origTitleGet,
            set: this._origTitleSet
          });
        }
      } catch (err) {
      }
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
      const muteSounds = this._api.storage.get("muteSounds", true);
      const suppressDesktopNotifs = this._api.storage.get("suppressDesktopNotifs", true);
      const hideBadges = this._api.storage.get("hideBadges", true);
      const suppressTaskbarBadge = this._api.storage.get("suppressTaskbarBadge", true);
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
        } catch (err) {
        }
      }
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
          FakeNotification.permission = "granted";
          FakeNotification.requestPermission = () => Promise.resolve("granted");
          window.Notification = FakeNotification;
        } catch (err) {
        }
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
        } catch (err) {
        }
      }
      if (suppressTaskbarBadge && !this._originalBadge) {
        try {
          if (window.yapperDesktop?.setBadge) {
            this._originalBadge = window.yapperDesktop.setBadge;
            const self = this;
            window.yapperDesktop.setBadge = (count) => {
              if (typeof count === "number") {
                self._lastBadgeCount = count;
              }
              if (self._isActive) {
                self._api?.logger?.debug("No Pings: suppressed taskbar badge count");
                self._originalBadge(0);
                return;
              }
              self._originalBadge(count);
            };
            window.yapperDesktop.setBadge(0);
          }
        } catch (err) {
        }
      }
      if (hideBadges) {
        this._api.ui.injectStyle("suppression-styles", `
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
        document.body.classList.add("yf-no-pings-active");
      }
      this._sanitizeCurrentTitle();
    },
    /**
     * Remove ping suppression and restore native behaviors.
     */
    _removeSuppression() {
      document.body.classList.remove("yf-no-pings-active");
      if (this._api?.ui) {
        this._api.ui.removeStyle("suppression-styles");
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
        if (typeof this._lastBadgeCount === "number" && this._lastBadgeCount > 0) {
          try {
            this._originalBadge(this._lastBadgeCount);
          } catch (err) {
          }
        }
        this._originalBadge = null;
      }
      this._restoreTitle();
    },
    /**
     * Render custom settings in the Plugins page (Settings -> Plugins).
     */
    renderSettings(api, container) {
      const muteSounds = api.storage.get("muteSounds", true);
      const suppressDesktopNotifs = api.storage.get("suppressDesktopNotifs", true);
      const hideBadges = api.storage.get("hideBadges", true);
      const suppressTaskbarBadge = api.storage.get("suppressTaskbarBadge", true);
      container.innerHTML = `
      <div class="ym-plugin-settings-block">
        <!-- Status Banner -->
        <div id="yf-np-status-banner" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: ${this._isActive ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.04)"}; border: 1px solid ${this._isActive ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.08)"}; border-radius: 8px; margin-bottom: 14px;">
          <div>
            <div id="yf-np-status-text" style="font-weight: 600; font-size: 13px; color: ${this._isActive ? "#ef4444" : "var(--text, #ffffff)"};">
              Toggle Under DMs Button: <b>${this._isActive ? "ACTIVE (Pings Muted)" : "INACTIVE (Pings Normal)"}</b>
            </div>
            <div style="font-size: 11px; color: var(--text-muted, #949ba4); margin-top: 2px;">
              Located directly under the Direct Messages bear icon in the left server rail.
            </div>
          </div>
          <button class="yf-btn secondary" id="yf-np-quick-toggle" style="font-size: 11px; padding: 5px 12px; border-radius: 6px;">
            ${this._isActive ? "Turn Off" : "Turn On"}
          </button>
        </div>

        <div class="ym-setting-row">
          <div class="ym-setting-info">
            <span class="ym-setting-title">Mute Ping Sounds</span>
            <span class="ym-setting-desc">Silences all notification sounds and audio alerts while No Pings is active.</span>
          </div>
          <div class="ym-setting-control">
            <label class="ym-switch">
              <input type="checkbox" id="yf-np-mute-sounds" ${muteSounds ? "checked" : ""} />
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
              <input type="checkbox" id="yf-np-suppress-notifs" ${suppressDesktopNotifs ? "checked" : ""} />
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
              <input type="checkbox" id="yf-np-hide-badges" ${hideBadges ? "checked" : ""} />
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
              <input type="checkbox" id="yf-np-suppress-taskbar" ${suppressTaskbarBadge ? "checked" : ""} />
              <span class="ym-switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
      const quickToggleBtn = container.querySelector("#yf-np-quick-toggle");
      quickToggleBtn?.addEventListener("click", async () => {
        await this.toggleActive();
        const statusText = container.querySelector("#yf-np-status-text");
        const banner = container.querySelector("#yf-np-status-banner");
        if (statusText) {
          statusText.innerHTML = `Toggle Under DMs Button: <b>${this._isActive ? "ACTIVE (Pings Muted)" : "INACTIVE (Pings Normal)"}</b>`;
          statusText.style.color = this._isActive ? "#ef4444" : "var(--text, #ffffff)";
        }
        if (banner) {
          banner.style.background = this._isActive ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.04)";
          banner.style.borderColor = this._isActive ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.08)";
        }
        quickToggleBtn.textContent = this._isActive ? "Turn Off" : "Turn On";
      });
      container.querySelector("#yf-np-mute-sounds")?.addEventListener("change", async (e) => {
        await api.storage.set("muteSounds", e.target.checked);
        if (this._isActive) this._applySuppression();
      });
      container.querySelector("#yf-np-suppress-notifs")?.addEventListener("change", async (e) => {
        await api.storage.set("suppressDesktopNotifs", e.target.checked);
        if (this._isActive) this._applySuppression();
      });
      container.querySelector("#yf-np-hide-badges")?.addEventListener("change", async (e) => {
        await api.storage.set("hideBadges", e.target.checked);
        if (this._isActive) {
          if (e.target.checked) {
            this._applySuppression();
          } else {
            document.body.classList.remove("yf-no-pings-active");
            api.ui.removeStyle("suppression-styles");
          }
        }
      });
      container.querySelector("#yf-np-suppress-taskbar")?.addEventListener("change", async (e) => {
        await api.storage.set("suppressTaskbarBadge", e.target.checked);
        if (this._isActive) this._applySuppression();
      });
    }
  };

  // src/renderer/ui/styles.js
  var CORE_STYLES = `
/* ============================================================
   SIDEBAR INJECTION \u2014 Divider & Tab Buttons
   ============================================================ */

.settings-nav {
  scrollbar-width: thin !important;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent !important;
}

.settings-nav::-webkit-scrollbar {
  display: block !important;
  width: 5px !important;
}

.settings-nav::-webkit-scrollbar-track {
  background: transparent !important;
}

.settings-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25) !important;
  border-radius: 4px !important;
}

.yf-sidebar-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 4px;
  margin-top: 2px;
  user-select: none;
}

.yf-divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--border, rgba(255, 255, 255, 0.15)),
    transparent
  );
}

.yf-divider-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--accent, #ff6b4a);
  white-space: nowrap;
  text-shadow: 0 0 12px var(--accent-soft, rgba(255, 107, 74, 0.3));
}

.yf-settings-tab {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 10px;
  margin: 1px 0;
  border: none;
  border-radius: var(--radius, 6px);
  background: transparent;
  color: var(--text-muted, #9c9daa);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.yf-settings-tab::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  border-radius: 0 3px 3px 0;
  background: var(--accent, #ff6b4a);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.yf-settings-tab:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
}

.yf-settings-tab.active {
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  color: var(--text, #ececf1);
  font-weight: 600;
}

.yf-settings-tab.active::before {
  transform: translateY(-50%) scaleY(1);
}

.yf-tab-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.yf-settings-tab:hover .yf-tab-icon,
.yf-settings-tab.active .yf-tab-icon {
  opacity: 1;
}

/* ============================================================
   CONTENT PANEL \u2014 Inline Settings Area
   ============================================================ */

.yf-content-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  animation: yfFadeIn 0.2s ease;
}

.yf-panel-wrapper {
  padding: 32px 40px;
  max-width: 740px;
}

@keyframes yfFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================================
   TYPOGRAPHY
   ============================================================ */

.yf-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text, #ececf1);
  margin: 0 0 4px 0;
  letter-spacing: -0.2px;
}

.yf-subtitle {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.yf-section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

/* ============================================================
   CARDS
   ============================================================ */

.yf-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 10px);
  padding: 20px 24px;
  margin-bottom: 18px;
  transition: border-color 0.15s ease;
}

.yf-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.yf-card-danger {
  border-color: rgba(242, 85, 90, 0.2);
}

.yf-card-danger:hover {
  border-color: rgba(242, 85, 90, 0.35);
}

.yf-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  margin: 0 0 6px 0;
}

.yf-card-title.danger {
  color: var(--danger, #f2555a);
}

.yf-card-desc {
  font-size: 12.5px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* ============================================================
   SETTING ROWS
   ============================================================ */

.yf-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.yf-setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.yf-setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 75%;
}

.yf-setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text, #ececf1);
}

.yf-setting-hint {
  font-size: 12px;
  color: var(--text-muted, #9c9daa);
  line-height: 1.4;
}

/* ============================================================
   FORM CONTROLS
   ============================================================ */

/* Toggle Switch */
.yf-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.yf-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.yf-switch-track {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-active, #383944);
  transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 24px;
}

.yf-switch-track::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.yf-switch input:checked + .yf-switch-track {
  background-color: var(--accent, #ff6b4a);
}

.yf-switch input:checked + .yf-switch-track::before {
  transform: translateX(20px);
}

/* Buttons */
.yf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius, 6px);
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
  background: var(--accent, #ff6b4a);
  color: white;
  white-space: nowrap;
}

.yf-btn:hover {
  filter: brightness(1.12);
  transform: translateY(-1px);
}

.yf-btn:active {
  transform: translateY(0);
}

.yf-btn.secondary {
  background: var(--bg-elev, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}

.yf-btn.secondary:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.1));
  border-color: rgba(255, 255, 255, 0.18);
}

.yf-btn.ghost {
  background: transparent;
  color: var(--text-muted, #9c9daa);
}

.yf-btn.ghost:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
}

.yf-btn.danger {
  background: var(--danger, #f2555a);
  color: white;
}

.yf-btn.active {
  background: var(--accent, #ff6b4a);
  color: white;
  pointer-events: none;
  opacity: 0.9;
}

.yf-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Input */
.yf-input {
  background: var(--bg-input, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  color: var(--text, #ececf1);
  padding: 7px 12px;
  border-radius: var(--radius, 6px);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.yf-input:focus {
  border-color: var(--accent, #ff6b4a);
}

/* Slider */
.yf-slider {
  -webkit-appearance: none;
  height: 6px;
  background: var(--bg-active, #383944);
  border-radius: 3px;
  outline: none;
}

.yf-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent, #ff6b4a);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* ============================================================
   PLUGIN CARDS
   ============================================================ */

.yf-plugin-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 10px);
  padding: 16px 20px;
  margin-bottom: 12px;
  transition: all 0.15s ease;
}

.yf-plugin-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.yf-plugin-card.enabled {
  border-color: var(--accent-soft, rgba(255, 107, 74, 0.25));
}

.yf-plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.yf-plugin-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.yf-plugin-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
}

.yf-chip {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: var(--text-muted, #9c9daa);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.yf-chip.status-active {
  background: rgba(63, 207, 130, 0.12);
  color: #3fcf82;
}

.yf-chip.status-error {
  background: rgba(242, 85, 90, 0.12);
  color: #f2555a;
}

.yf-plugin-desc {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 8px 0;
  line-height: 1.45;
}

.yf-plugin-author {
  font-size: 11.5px;
  color: var(--text-faint, rgba(255, 255, 255, 0.35));
}

.yf-plugin-error {
  color: var(--danger, #f2555a);
  font-size: 12px;
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(242, 85, 90, 0.08);
  border-radius: 4px;
}

.yf-plugin-settings {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* ============================================================
   SWATCH GRID (Accent Color Picker)
   ============================================================ */

.yf-swatch-grid, .ym-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.yf-swatch-btn, .ym-swatch-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-elev, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text, #ececf1);
}

.yf-swatch-btn:hover, .ym-swatch-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  border-color: rgba(255, 255, 255, 0.15);
}

.yf-swatch-btn.active, .ym-swatch-btn.active {
  border-color: var(--accent, #ff6b4a);
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  box-shadow: 0 0 0 1px var(--accent, #ff6b4a);
}

.yf-swatch-color, .ym-swatch-color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.yf-swatch-name, .ym-swatch-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text, #ececf1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Backwards compat for plugin renderSettings using ym- classes */
.ym-setting-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.ym-setting-row:last-child { border-bottom: none; padding-bottom: 0; }
.ym-setting-info { display: flex; flex-direction: column; gap: 2px; max-width: 75%; }
.ym-setting-title { font-size: 14px; font-weight: 500; color: var(--text, #ececf1); }
.ym-setting-desc { font-size: 12px; color: var(--text-muted, #9c9daa); line-height: 1.4; }
.ym-setting-control { flex-shrink: 0; }
.ym-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.ym-switch input { opacity: 0; width: 0; height: 0; }
.ym-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bg-active, #383944); transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 24px; }
.ym-switch-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.ym-switch input:checked + .ym-switch-slider { background-color: var(--accent, #ff6b4a); }
.ym-switch input:checked + .ym-switch-slider:before { transform: translateX(20px); }
.ym-input { background: var(--bg-input, rgba(255,255,255,0.06)); border: 1px solid var(--border, rgba(255,255,255,0.1)); color: var(--text, #ececf1); padding: 7px 12px; border-radius: var(--radius, 6px); font-size: 13px; outline: none; transition: border-color 0.15s ease; }
.ym-input:focus { border-color: var(--accent, #ff6b4a); }
.ym-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; border-radius: var(--radius, 6px); cursor: pointer; border: none; transition: all 0.15s ease; background: var(--accent, #ff6b4a); color: white; white-space: nowrap; }
.ym-btn:hover { filter: brightness(1.12); }
.ym-btn.secondary { background: var(--bg-elev, rgba(255,255,255,0.06)); color: var(--text, #ececf1); border: 1px solid var(--border, rgba(255,255,255,0.1)); }
.ym-btn.secondary:hover { background: var(--bg-hover, rgba(255,255,255,0.1)); }
.ym-btn.ghost { background: transparent; color: var(--text-muted, #9c9daa); }
.ym-btn.ghost:hover { background: var(--bg-hover, rgba(255,255,255,0.06)); color: var(--text, #ececf1); }
.ym-btn.danger { background: var(--danger, #f2555a); color: white; }
.ym-label { font-size: 13px; font-weight: 600; color: var(--text, #ececf1); margin-bottom: 6px; display: block; }
.ym-desc { font-size: 12px; color: var(--text-muted, #9c9daa); margin: 0 0 10px 0; line-height: 1.4; }
.ym-slider { -webkit-appearance: none; height: 6px; background: var(--bg-active, #383944); border-radius: 3px; outline: none; }
.ym-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent, #ff6b4a); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
.ym-field-row { display: flex; align-items: center; gap: 10px; }
.ym-plugin-settings-block { padding: 4px 0; }

/* ============================================================
   LOG TERMINAL
   ============================================================ */

.yf-log-terminal {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 8px);
  padding: 16px;
  font-family: 'Consolas', 'SF Mono', 'Courier New', monospace;
  font-size: 12px;
  height: 420px;
  overflow-y: auto;
  color: var(--text-muted, #c9cdd4);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

/* ============================================================
   EMPTY STATES
   ============================================================ */

.yf-empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted, #9c9daa);
}

.yf-empty-state p {
  margin: 12px 0 18px;
  font-size: 14px;
}

.yf-empty-hint {
  padding: 16px 0;
  color: var(--text-muted, #9c9daa);
  font-size: 13px;
  line-height: 1.5;
}

.yf-empty-hint code {
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: 'Consolas', 'SF Mono', monospace;
}

/* ============================================================
   VERSION FOOTER
   ============================================================ */

.yf-version-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: var(--text-faint, rgba(255, 255, 255, 0.25));
  text-align: center;
}

/* ============================================================
   TOAST SYSTEM
   ============================================================ */

.yf-toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.yf-toast {
  padding: 10px 18px;
  background: var(--bg-rail, rgba(20, 21, 25, 0.95));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  color: var(--text, #ececf1);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  animation: yfToastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  pointer-events: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.yf-toast.success {
  border-left: 3px solid #3fcf82;
}

.yf-toast.error {
  border-left: 3px solid #f2555a;
}

.yf-toast.warning {
  border-left: 3px solid #f5b544;
}

@keyframes yfToastIn {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ============================================================
   SETTINGS MODAL \u2014 Standalone Overlay Window
   ============================================================ */

.ym-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.ym-modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.ym-modal-container {
  width: min(90vw, 900px);
  height: min(85vh, 640px);
  background: var(--bg-base, #1a1b1f);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
  transform: scale(0.96) translateY(8px);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.ym-modal-overlay.open .ym-modal-container {
  transform: scale(1) translateY(0);
}

/* Header */
.ym-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  background: var(--bg-elev, rgba(255, 255, 255, 0.02));
  flex-shrink: 0;
}

.ym-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ym-logo-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #fff;
  background: linear-gradient(135deg, var(--accent, #ff6b4a), #c850c0);
  padding: 4px 10px;
  border-radius: 6px;
}

.ym-header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  margin: 0;
}

.ym-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #9c9daa);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ym-close-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text, #ececf1);
}

/* Body \u2014 sidebar + content */
.ym-modal-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar Nav */
.ym-modal-nav {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 2px;
  border-right: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  background: var(--bg-elev, rgba(255, 255, 255, 0.015));
  overflow-y: auto;
}

.ym-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #9c9daa);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ym-nav-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.ym-nav-item:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
}

.ym-nav-item:hover svg {
  opacity: 0.9;
}

.ym-nav-item.active {
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  color: var(--text, #ececf1);
  font-weight: 600;
}

.ym-nav-item.active svg {
  opacity: 1;
}

.ym-nav-footer {
  margin-top: auto;
  padding: 12px;
  font-size: 10px;
  color: var(--text-faint, rgba(255, 255, 255, 0.2));
  line-height: 1.5;
}

/* Content area */
.ym-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

/* Tab Panes */
.ym-tab-pane {
  display: none;
}

.ym-tab-pane.active {
  display: block;
  animation: yfFadeIn 0.2s ease;
}

/* Typography */
.ym-pane-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text, #ececf1);
  margin: 0 0 4px 0;
  letter-spacing: -0.2px;
}

.ym-pane-subtitle {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

/* Cards */
.ym-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 18px;
  transition: border-color 0.15s ease;
}

.ym-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.ym-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  margin: 0 0 6px 0;
}

.ym-card-desc {
  font-size: 12.5px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* Plugin Cards */
.ym-plugin-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 12px;
  transition: all 0.15s ease;
}

.ym-plugin-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.ym-plugin-card.active {
  border-color: var(--accent-soft, rgba(255, 107, 74, 0.25));
}

.ym-plugin-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ym-plugin-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ym-plugin-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
}

.ym-plugin-chip {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: var(--text-muted, #9c9daa);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.ym-plugin-chip.status-active {
  background: rgba(63, 207, 130, 0.12);
  color: #3fcf82;
}

.ym-plugin-chip.status-error {
  background: rgba(242, 85, 90, 0.12);
  color: #f2555a;
}

.ym-plugin-desc {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 8px 0;
  line-height: 1.45;
}

.ym-plugin-author {
  font-size: 11.5px;
  color: var(--text-faint, rgba(255, 255, 255, 0.35));
}

.ym-plugin-settings-toggle {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Log terminal */
.ym-log-terminal {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px;
  font-family: 'Consolas', 'SF Mono', 'Courier New', monospace;
  font-size: 12px;
  height: 380px;
  overflow-y: auto;
  color: var(--text-muted, #c9cdd4);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

/* ============================================================
   CUSTOM DROPDOWN COMPONENT
   ============================================================ */

.yf-custom-dropdown {
  position: relative;
  display: inline-block;
  user-select: none;
  font-family: inherit;
}

.yf-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #f4f4f7);
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.yf-dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(255, 255, 255, 0.22);
}

.yf-custom-dropdown.is-open .yf-dropdown-trigger {
  border-color: var(--accent, #5865f2);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.25);
}

.yf-dropdown-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.yf-dropdown-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #9294a1);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.yf-custom-dropdown.is-open .yf-dropdown-arrow {
  transform: rotate(180deg);
  color: var(--accent, #5865f2);
}

.yf-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #18191e;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 5px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 999999;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px) scale(0.98);
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.15s;
  box-sizing: border-box;
}

.yf-dropdown-menu.is-open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}

.yf-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-muted, #b5b7c2);
  cursor: pointer;
  transition: all 0.12s ease;
}

.yf-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text, #ffffff);
}

.yf-dropdown-item.is-selected {
  background: rgba(88, 101, 242, 0.16);
  color: var(--accent, #7289da);
  font-weight: 600;
}

.yf-dropdown-check {
  display: none;
  color: var(--accent, #5865f2);
  flex-shrink: 0;
}

.yf-dropdown-item.is-selected .yf-dropdown-check {
  display: flex;
}
`;

  // src/renderer/ui/settings-panel.js
  var SettingsPanel = class {
    constructor() {
      this.activeTab = null;
      this.contentContainer = null;
      this.settingsNav = null;
      this.nativeListenersAttached = false;
    }
    init(settingsNav) {
      this.settingsNav = settingsNav;
      this.nativeListenersAttached = false;
      this.activeTab = null;
      logger.info("SettingsPanel initialized");
    }
    /**
     * Find the main content area and replace it with our Yapify panel content.
     */
    show(tabId, settingsNav) {
      this.activeTab = tabId;
      if (settingsNav) this.settingsNav = settingsNav;
      const contentArea = this.findContentArea();
      if (!contentArea) {
        logger.warn("Could not find settings content area");
        return;
      }
      let panel = document.getElementById("yf-content-panel");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "yf-content-panel";
        panel.className = "yf-content-panel";
      }
      for (const child of contentArea.children) {
        if (child.id !== "yf-content-panel") {
          child.style.display = "none";
          child.dataset.yfHidden = "true";
        }
      }
      contentArea.dataset.yfPatched = "true";
      panel.innerHTML = "";
      panel.appendChild(this.renderTab(tabId));
      if (!panel.parentElement) {
        contentArea.appendChild(panel);
      }
      this.watchForNativeTabClick(contentArea);
    }
    /**
     * Restore the original content when a native Yapin tab is clicked
     */
    watchForNativeTabClick(contentArea) {
      if (this.nativeListenersAttached) return;
      this.nativeListenersAttached = true;
      const nav = this.settingsNav;
      if (!nav) return;
      nav.querySelectorAll('a, button, [role="tab"]').forEach((item) => {
        if (item.dataset?.yfTab !== void 0) return;
        if (item.id?.startsWith("yf-")) return;
        item.addEventListener("click", () => {
          document.querySelectorAll(".yf-settings-tab").forEach((t) => t.classList.remove("active"));
          this.hide(contentArea);
          nav.querySelectorAll('a, button, [role="tab"]').forEach((el) => {
            if (!el.dataset?.yfTab && !el.id?.startsWith("yf-")) {
              el.style.opacity = "";
            }
          });
        });
      });
    }
    /**
     * Hide the Yapify panel and restore original content
     */
    hide(contentArea) {
      if (!contentArea) return;
      const panel = document.getElementById("yf-content-panel");
      if (panel) panel.remove();
      for (const child of contentArea.children) {
        if (child.dataset?.yfHidden === "true") {
          child.style.display = "";
          delete child.dataset.yfHidden;
        }
      }
      delete contentArea.dataset.yfPatched;
      this.activeTab = null;
    }
    /**
     * Find the main content area of the settings page.
     * Uses the settingsNav reference to find its content sibling.
     */
    findContentArea() {
      if (this.settingsNav) {
        const parent = this.settingsNav.parentElement;
        if (parent) {
          for (const sibling of parent.children) {
            if (sibling === this.settingsNav) continue;
            if (sibling.id === "yf-content-panel") continue;
            const rect = sibling.getBoundingClientRect();
            if (rect.width > 200 && rect.height > 200) {
              return sibling;
            }
          }
          const grandparent = parent.parentElement;
          if (grandparent) {
            for (const uncle of grandparent.children) {
              if (uncle === parent) continue;
              if (uncle.id === "yf-content-panel") continue;
              const rect = uncle.getBoundingClientRect();
              if (rect.width > 200 && rect.height > 200) {
                return uncle;
              }
            }
          }
        }
      }
      const settingsTabNames = [
        "my profile",
        "my account",
        "appearance",
        "voice",
        "audio",
        "keybinds",
        "desktop",
        "advanced",
        "developer",
        "subscription",
        "shards",
        "yapin"
      ];
      const candidates = document.querySelectorAll(
        'nav, aside, [role="tablist"], [role="navigation"], [class*="sidebar"], [class*="nav"], [class*="settings"], [class*="menu"]'
      );
      for (const container of candidates) {
        const text = container.textContent?.toLowerCase() || "";
        const matchCount = settingsTabNames.filter((name) => text.includes(name)).length;
        if (matchCount >= 3) {
          const rect = container.getBoundingClientRect();
          if (rect.width > 300) continue;
          const parent = container.parentElement;
          if (parent) {
            for (const sibling of parent.children) {
              if (sibling !== container && sibling.id !== "yf-content-panel") {
                const sRect = sibling.getBoundingClientRect();
                if (sRect.width > 200 && sRect.height > 200) {
                  return sibling;
                }
              }
            }
            return parent;
          }
        }
      }
      return null;
    }
    /**
     * Render the content for a specific tab
     */
    renderTab(tabId) {
      const wrapper = document.createElement("div");
      wrapper.className = "yf-panel-wrapper";
      switch (tabId) {
        case "plugins":
          wrapper.appendChild(this.renderPluginsTab());
          break;
        case "themes":
          wrapper.appendChild(this.renderThemesTab());
          break;
        case "settings":
          wrapper.appendChild(this.renderSettingsTab());
          break;
        case "diagnostics":
          wrapper.appendChild(this.renderDiagnosticsTab());
          break;
        default:
          wrapper.textContent = "Unknown tab";
      }
      return wrapper;
    }
    // ============================================================
    //  PLUGINS TAB
    // ============================================================
    renderPluginsTab() {
      const frag = document.createDocumentFragment();
      const header = document.createElement("div");
      header.className = "yf-section-header";
      header.innerHTML = `
      <div>
        <h2 class="yf-title">Plugins</h2>
        <p class="yf-subtitle">Turn plugins on or off. No restart needed.</p>
      </div>
      <button class="yf-btn secondary" id="yf-btn-refresh-plugins">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        Refresh
      </button>
    `;
      frag.appendChild(header);
      const listContainer = document.createElement("div");
      listContainer.id = "yf-plugins-list";
      frag.appendChild(listContainer);
      this.populatePluginsList(listContainer);
      setTimeout(() => {
        document.getElementById("yf-btn-refresh-plugins")?.addEventListener("click", () => {
          const container = document.getElementById("yf-plugins-list");
          if (container) this.populatePluginsList(container);
          events.emit("toast", "Plugins list refreshed", "info");
        });
      }, 0);
      return frag;
    }
    populatePluginsList(container) {
      const plugins = pluginManager.getAllPlugins();
      if (plugins.length === 0) {
        container.innerHTML = `
        <div class="yf-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <p>No plugins installed yet.</p>
          <button class="yf-btn secondary" id="yf-btn-open-plugins-folder">Open Plugins Folder</button>
        </div>
      `;
        container.querySelector("#yf-btn-open-plugins-folder")?.addEventListener("click", () => {
          window.yapinmodBridge?.invoke?.("yapinmod:open-folder", "plugins");
        });
        return;
      }
      container.innerHTML = plugins.map((p) => {
        const statusClass = p.status === PluginStatus.ACTIVE ? "status-active" : p.status === PluginStatus.ERROR ? "status-error" : "";
        return `
        <div class="yf-plugin-card ${p.enabled ? "enabled" : ""}" id="yf-pcard-${p.id}">
          <div class="yf-plugin-header">
            <div class="yf-plugin-info">
              <span class="yf-plugin-name">${p.name}</span>
            </div>
            <label class="yf-switch">
              <input type="checkbox" class="yf-plugin-toggle" data-id="${p.id}" ${p.enabled ? "checked" : ""} />
              <span class="yf-switch-track"></span>
            </label>
          </div>
          <p class="yf-plugin-desc">${p.description}</p>
          <div class="yf-plugin-author">by ${p.author}</div>
          ${p.error ? `<div class="yf-plugin-error">\u26A0 ${p.error}</div>` : ""}
          ${p.hasSettings ? `<div class="yf-plugin-settings" id="yf-psettings-${p.id}"></div>` : ""}
        </div>
      `;
      }).join("");
      plugins.forEach((p) => {
        const toggle = container.querySelector(`.yf-plugin-toggle[data-id="${p.id}"]`);
        toggle?.addEventListener("change", async (e) => {
          await pluginManager.togglePlugin(p.id, e.target.checked);
          this.populatePluginsList(container);
        });
        if (p.hasSettings) {
          const settingsContainer = container.querySelector(`#yf-psettings-${p.id}`);
          const pluginEntry = pluginManager.getPlugin(p.id);
          if (settingsContainer && pluginEntry?.instance?.renderSettings) {
            const api = pluginManager.createPluginApi(pluginEntry);
            pluginEntry.instance.renderSettings(api, settingsContainer);
          }
        }
      });
    }
    // ============================================================
    //  THEMES TAB
    // ============================================================
    renderThemesTab() {
      const frag = document.createDocumentFragment();
      const header = document.createElement("div");
      header.className = "yf-section-header";
      header.innerHTML = `
      <div>
        <h2 class="yf-title">Themes & Colors</h2>
        <p class="yf-subtitle">Change accent colors and load CSS themes.</p>
      </div>
    `;
      frag.appendChild(header);
      const accentCard = document.createElement("div");
      accentCard.className = "yf-card";
      accentCard.innerHTML = `<h3 class="yf-card-title">Accent Color</h3>`;
      const accentContent = document.createElement("div");
      accentContent.id = "yf-accent-content";
      accentCard.appendChild(accentContent);
      frag.appendChild(accentCard);
      const accentPlugin = pluginManager.getPlugin("custom-accent");
      if (accentPlugin?.instance?.renderSettings) {
        const api = pluginManager.createPluginApi(accentPlugin);
        accentPlugin.instance.renderSettings(api, accentContent);
      }
      const themesCard = document.createElement("div");
      themesCard.className = "yf-card";
      themesCard.innerHTML = `
      <div class="yf-section-header" style="margin-bottom: 12px;">
        <h3 class="yf-card-title" style="margin: 0;">CSS Themes</h3>
        <button class="yf-btn secondary" id="yf-btn-refresh-themes">Refresh</button>
      </div>
    `;
      const themesContent = document.createElement("div");
      themesContent.id = "yf-themes-list";
      themesCard.appendChild(themesContent);
      frag.appendChild(themesCard);
      this.populateThemesList(themesContent);
      setTimeout(() => {
        document.getElementById("yf-btn-refresh-themes")?.addEventListener("click", () => {
          const container = document.getElementById("yf-themes-list");
          if (container) this.populateThemesList(container);
          events.emit("toast", "Themes list refreshed", "info");
        });
      }, 0);
      return frag;
    }
    async populateThemesList(container) {
      const themes = await themeManager.getThemes();
      const activeTheme = storage.get("activeTheme", null);
      let html = `
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Yapin Default Theme</span>
          <span class="yf-setting-hint">The stock yapin look.</span>
        </div>
        <button class="yf-btn ${!activeTheme ? "active" : "secondary"}" id="yf-theme-default-btn">
          ${!activeTheme ? "Applied" : "Apply"}
        </button>
      </div>
    `;
      if (themes.length === 0) {
        html += `
        <div class="yf-empty-hint">
          No custom themes found. Drop <code>.css</code> files in <code>%APPDATA%/YapinMod/themes</code> and they'll show up here.
        </div>
      `;
      } else {
        themes.forEach((t) => {
          const isActive = activeTheme === t.filename;
          html += `
          <div class="yf-setting-row">
            <div class="yf-setting-info">
              <span class="yf-setting-label">${t.name}</span>
              <span class="yf-setting-hint">${t.filename}</span>
            </div>
            <button class="yf-btn ${isActive ? "active" : "secondary"} yf-theme-apply" data-file="${t.filename}">
              ${isActive ? "Applied" : "Apply"}
            </button>
          </div>
        `;
        });
      }
      container.innerHTML = html;
      container.querySelector("#yf-theme-default-btn")?.addEventListener("click", async () => {
        await themeManager.applyTheme(null, true);
        this.populateThemesList(container);
        events.emit("toast", "Reverted to default Yapin theme", "info");
      });
      container.querySelectorAll(".yf-theme-apply").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const filename = btn.getAttribute("data-file");
          await themeManager.applyTheme(filename, true);
          this.populateThemesList(container);
          events.emit("toast", `Applied theme: ${filename}`, "success");
        });
      });
    }
    // ============================================================
    //  SETTINGS TAB (System Settings)
    // ============================================================
    renderSettingsTab() {
      const frag = document.createDocumentFragment();
      const header = document.createElement("div");
      header.innerHTML = `
      <h2 class="yf-title">Settings</h2>
      <p class="yf-subtitle">General mod settings and tools.</p>
    `;
      frag.appendChild(header);
      const actionsCard = document.createElement("div");
      actionsCard.className = "yf-card";
      actionsCard.innerHTML = `
      <h3 class="yf-card-title">Quick Actions</h3>
      <p class="yf-card-desc">Shortcuts for common stuff.</p>
      <div class="yf-actions-row">
        <button class="yf-btn secondary" id="yf-btn-devtools">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          DevTools
        </button>
        <button class="yf-btn secondary" id="yf-btn-reload">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          Reload Client
        </button>
        <button class="yf-btn secondary" id="yf-btn-plugins-folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Plugins Folder
        </button>
        <button class="yf-btn secondary" id="yf-btn-themes-folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Themes Folder
        </button>
      </div>
    `;
      frag.appendChild(actionsCard);
      const systemCard = document.createElement("div");
      systemCard.className = "yf-card";
      systemCard.innerHTML = `
      <h3 class="yf-card-title">System</h3>
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Safe Mode</span>
          <span class="yf-setting-hint">Skip all plugins on startup. Use this if something broke.</span>
        </div>
        <label class="yf-switch">
          <input type="checkbox" id="yf-toggle-safemode" ${storage.get("safeMode", false) ? "checked" : ""} />
          <span class="yf-switch-track"></span>
        </label>
      </div>
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Developer Hotkeys</span>
          <span class="yf-setting-hint">Enables Ctrl+Shift+I and F12 to open DevTools.</span>
        </div>
        <label class="yf-switch">
          <input type="checkbox" id="yf-toggle-devtools-hotkey" ${storage.get("devtoolsShortcut", true) ? "checked" : ""} />
          <span class="yf-switch-track"></span>
        </label>
      </div>
      <div class="yf-setting-row">
        <div class="yf-setting-info">
          <span class="yf-setting-label">Debug Logging</span>
          <span class="yf-setting-hint">Extra logging for troubleshooting.</span>
        </div>
        <label class="yf-switch">
          <input type="checkbox" id="yf-toggle-logging" ${storage.get("debugLogging", true) ? "checked" : ""} />
          <span class="yf-switch-track"></span>
        </label>
      </div>
    `;
      frag.appendChild(systemCard);
      const dangerCard = document.createElement("div");
      dangerCard.className = "yf-card yf-card-danger";
      dangerCard.innerHTML = `
      <h3 class="yf-card-title danger">Reset Everything</h3>
      <p class="yf-card-desc">Wipes all settings back to defaults. Can't undo this.</p>
      <button class="yf-btn danger" id="yf-btn-reset">Reset All Settings</button>
    `;
      frag.appendChild(dangerCard);
      const footer = document.createElement("div");
      footer.className = "yf-version-footer";
      footer.textContent = "Yapify v1.0.0";
      frag.appendChild(footer);
      setTimeout(() => {
        document.getElementById("yf-btn-devtools")?.addEventListener("click", () => {
          window.yapinmodBridge?.invoke?.("yapinmod:toggle-devtools");
        });
        document.getElementById("yf-btn-reload")?.addEventListener("click", () => {
          window.yapinmodBridge?.invoke?.("yapinmod:reload-renderer");
        });
        document.getElementById("yf-btn-plugins-folder")?.addEventListener("click", () => {
          window.yapinmodBridge?.invoke?.("yapinmod:open-folder", "plugins");
        });
        document.getElementById("yf-btn-themes-folder")?.addEventListener("click", () => {
          window.yapinmodBridge?.invoke?.("yapinmod:open-folder", "themes");
        });
        document.getElementById("yf-toggle-safemode")?.addEventListener("change", async (e) => {
          await storage.set("safeMode", e.target.checked);
          events.emit("toast", `Safe Mode ${e.target.checked ? "enabled" : "disabled"}`, "info");
        });
        document.getElementById("yf-toggle-devtools-hotkey")?.addEventListener("change", async (e) => {
          await storage.set("devtoolsShortcut", e.target.checked);
        });
        document.getElementById("yf-toggle-logging")?.addEventListener("change", async (e) => {
          await storage.set("debugLogging", e.target.checked);
        });
        document.getElementById("yf-btn-reset")?.addEventListener("click", async () => {
          if (confirm("Reset all settings to defaults? Can't undo this.")) {
            await storage.resetToDefaults();
            events.emit("toast", "Settings reset", "success");
          }
        });
      }, 0);
      return frag;
    }
    // ============================================================
    //  DIAGNOSTICS TAB
    // ============================================================
    renderDiagnosticsTab() {
      const frag = document.createDocumentFragment();
      const header = document.createElement("div");
      header.className = "yf-section-header";
      header.innerHTML = `
      <div>
        <h2 class="yf-title">Diagnostics</h2>
        <p class="yf-subtitle">Live client logs and plugin runtime status.</p>
      </div>
      <div class="yf-actions-row">
        <button class="yf-btn secondary" id="yf-btn-copy-logs">Copy Logs</button>
        <button class="yf-btn secondary" id="yf-btn-clear-logs">Clear</button>
      </div>
    `;
      frag.appendChild(header);
      const terminal = document.createElement("div");
      terminal.className = "yf-log-terminal";
      terminal.id = "yf-log-terminal";
      terminal.textContent = "Loading logs...";
      frag.appendChild(terminal);
      setTimeout(async () => {
        const term = document.getElementById("yf-log-terminal");
        if (!term) return;
        if (window.yapinmodBridge?.invoke) {
          const logs = await window.yapinmodBridge.invoke("yapinmod:get-logs");
          term.textContent = logs || "No logs recorded yet.";
          term.scrollTop = term.scrollHeight;
        } else {
          const logs = logger.getRecentLogs().map(
            (l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`
          ).join("\n");
          term.textContent = logs || "No logs recorded yet.";
          term.scrollTop = term.scrollHeight;
        }
        document.getElementById("yf-btn-copy-logs")?.addEventListener("click", () => {
          navigator.clipboard.writeText(term.textContent);
          events.emit("toast", "Logs copied to clipboard", "success");
        });
        document.getElementById("yf-btn-clear-logs")?.addEventListener("click", () => {
          logger.clear();
          term.textContent = "Logs cleared.";
        });
      }, 0);
      return frag;
    }
  };
  var settingsPanel = new SettingsPanel();

  // src/renderer/ui/injector.js
  var UIInjector = class {
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
      logger.info("UIInjector initialized \u2014 watching for settings sidebar");
    }
    injectStyles() {
      if (document.getElementById("yapify-core-styles")) return;
      const style = document.createElement("style");
      style.id = "yapify-core-styles";
      style.textContent = CORE_STYLES;
      document.head.appendChild(style);
    }
    setupToastContainer() {
      if (document.getElementById("yf-toast-container")) {
        this.toastContainer = document.getElementById("yf-toast-container");
        return;
      }
      this.toastContainer = document.createElement("div");
      this.toastContainer.id = "yf-toast-container";
      this.toastContainer.className = "yf-toast-container";
      document.body.appendChild(this.toastContainer);
      events.on("toast", (msg, type = "info") => this.showToast(msg, type));
    }
    showToast(message, type = "info") {
      if (!this.toastContainer) this.setupToastContainer();
      const toast = document.createElement("div");
      toast.className = `yf-toast ${type}`;
      toast.textContent = message;
      this.toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px) scale(0.95)";
        toast.style.transition = "all 0.2s ease";
        setTimeout(() => toast.remove(), 250);
      }, 3500);
    }
    setupHotkeys() {
      window.addEventListener("keydown", (e) => {
        if (e.altKey && (e.key === "y" || e.key === "Y")) {
          e.preventDefault();
          this.activateYapifyTab("plugins");
        }
      });
      if (window.yapinmodBridge?.on) {
        window.yapinmodBridge.on("yapinmod:toggle-settings", () => {
          this.activateYapifyTab("plugins");
        });
      }
    }
    /**
     * Activate a specific Yapify tab in the settings sidebar.
     * If settings aren't open, tries to find/click the native settings button first.
     */
    activateYapifyTab(tabId = "plugins") {
      const tab = document.getElementById(`yf-tab-${tabId}`);
      if (tab) {
        tab.click();
        return;
      }
      this.tryOpenNativeSettings();
      setTimeout(() => {
        const retryTab = document.getElementById(`yf-tab-${tabId}`);
        if (retryTab) retryTab.click();
      }, 500);
    }
    /**
     * Try to find and click Yapin's native settings button to open the settings page.
     */
    tryOpenNativeSettings() {
      const selectors = [
        'button[aria-label*="etting"]',
        'button[aria-label*="Setting"]',
        'a[href*="setting"]',
        '[class*="settings"] button',
        '[class*="gear"]',
        '[class*="cog"]',
        'button[title*="etting"]'
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
      this.sidebarCheckInterval = setInterval(() => {
        this.tryInjectSidebar();
      }, 250);
      this.observer = new MutationObserver(() => {
        this.tryInjectSidebar();
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      window.addEventListener("click", (e) => {
        const target = e.target;
        logger.info(`[Click] <${target?.tagName || "el"} class="${target?.className || ""}"> text="${target?.textContent?.trim().slice(0, 25) || ""}"`);
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
      const candidates = Array.from(document.querySelectorAll(".settings-nav, nav.settings-nav, .settings nav, .modal nav"));
      if (candidates.length === 0) {
        const stale = document.querySelectorAll("#yf-sidebar-divider, .yf-settings-tab");
        if (stale.length > 0) stale.forEach((el) => el.remove());
        const stalePanel = document.getElementById("yf-content-panel");
        if (stalePanel) stalePanel.remove();
        this.logStatus("No settings nav candidates in DOM (Settings closed)");
        return;
      }
      let visibleNav = null;
      for (const nav of candidates) {
        if (!document.body.contains(nav)) continue;
        const rect = nav.getBoundingClientRect();
        const isVisibleOnScreen = rect.width > 50 && rect.height > 100 && rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
        if (isVisibleOnScreen) {
          visibleNav = nav;
          break;
        }
      }
      if (!visibleNav) {
        const stale = document.querySelectorAll("#yf-sidebar-divider, .yf-settings-tab");
        if (stale.length > 0) {
          stale.forEach((el) => el.remove());
          logger.info("Cleaned up stale Yapify sidebar elements while settings closed");
        }
        const stalePanel = document.getElementById("yf-content-panel");
        if (stalePanel) stalePanel.remove();
        this.logStatus(`Candidates in DOM (${candidates.length}) but none visible on screen`);
        return;
      }
      let insertAfterItem = visibleNav.querySelector(".plus-nav, button.plus-nav");
      if (!insertAfterItem) {
        const norm = (s) => (s || "").replace(/[\u2018\u2019\u201B\u02BC\u02BB`\u00B4']/g, "'").toLowerCase().trim();
        for (const btn of visibleNav.querySelectorAll('button, a, [role="tab"], div')) {
          const text = norm(btn.textContent);
          if (text.includes("yapin' plus") || text.includes("yapin plus") || text.includes("plus")) {
            insertAfterItem = btn;
            break;
          }
        }
      }
      if (!insertAfterItem) {
        const allButtons = Array.from(visibleNav.querySelectorAll('button, a, [role="tab"]')).filter((b) => !b.id?.startsWith("yf-"));
        if (allButtons.length > 0) {
          insertAfterItem = allButtons[allButtons.length - 1];
        } else if (visibleNav.children.length > 0) {
          insertAfterItem = visibleNav.children[visibleNav.children.length - 1];
        }
      }
      if (!insertAfterItem) {
        this.logStatus("Visible nav found, but target insertion item not found");
        return;
      }
      const existingDivider = visibleNav.querySelector("#yf-sidebar-divider");
      const existingTabs = visibleNav.querySelectorAll(".yf-settings-tab");
      const isDividerDirectlyAfter = existingDivider && insertAfterItem.nextSibling === existingDivider;
      if (existingDivider && existingTabs.length >= 4 && isDividerDirectlyAfter) {
        return;
      }
      document.querySelectorAll("#yf-sidebar-divider, .yf-settings-tab").forEach((el) => el.remove());
      const childrenList = Array.from(visibleNav.children).map((c) => `${c.tagName}${c.id ? "#" + c.id : ""}${c.className ? "." + c.className.split(" ").join(".") : ""}[${c.textContent?.trim().slice(0, 15)}]`).join(" -> ");
      logger.info(`Injecting Yapify tabs. Current children: ${childrenList}`);
      this.injectYapifyTabs(visibleNav, insertAfterItem);
      const afterChildren = Array.from(visibleNav.children).map((c) => `${c.tagName}${c.id ? "#" + c.id : ""}${c.className ? "." + c.className.split(" ").join(".") : ""}`).join(" -> ");
      logger.info(`After injection children: ${afterChildren}`);
    }
    /**
     * Inject the Yapify divider and tabs right after the target item.
     */
    injectYapifyTabs(settingsNav, insertAfterItem) {
      const divider = document.createElement("div");
      divider.id = "yf-sidebar-divider";
      divider.className = "yf-sidebar-divider";
      divider.innerHTML = `
      <div class="yf-divider-line"></div>
      <span class="yf-divider-label">Yapify</span>
      <div class="yf-divider-line"></div>
    `;
      const tabs = [
        {
          id: "plugins",
          label: "Plugins",
          svg: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>'
        },
        {
          id: "themes",
          label: "Themes & Colors",
          svg: '<circle cx="12" cy="12" r="10"></circle><path d="M12 2a7 7 0 0 0 0 14h1a2 2 0 0 1 2 2 2 2 0 0 0 4 0 7 7 0 0 0-7-16z"></path>'
        },
        {
          id: "settings",
          label: "Settings",
          svg: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
        },
        {
          id: "diagnostics",
          label: "Diagnostics",
          svg: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>'
        }
      ];
      const tabElements = tabs.map((tab) => {
        const btn = document.createElement("button");
        btn.id = `yf-tab-${tab.id}`;
        btn.className = "yf-settings-tab";
        btn.setAttribute("data-yf-tab", tab.id);
        btn.innerHTML = `
        <svg class="yf-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${tab.svg}
        </svg>
        <span>${tab.label}</span>
      `;
        btn.addEventListener("click", () => {
          settingsNav.querySelectorAll('a, button, [role="tab"]').forEach((item) => {
            if (!item.dataset?.yfTab) {
              item.classList.remove("active", "selected");
              item.removeAttribute("aria-selected");
              item.style.opacity = "0.7";
              item.style.background = "";
            }
          });
          document.querySelectorAll(".yf-settings-tab").forEach((t) => t.classList.remove("active"));
          btn.classList.add("active");
          settingsPanel.show(tab.id, settingsNav);
        });
        return btn;
      });
      const insertionParent = insertAfterItem.parentElement;
      const insertionRef = insertAfterItem.nextSibling;
      if (insertionParent) {
        insertionParent.insertBefore(divider, insertionRef);
        let lastInserted = divider;
        tabElements.forEach((tab) => {
          insertionParent.insertBefore(tab, lastInserted.nextSibling);
          lastInserted = tab;
        });
      } else {
        settingsNav.appendChild(divider);
        tabElements.forEach((tab) => settingsNav.appendChild(tab));
      }
      settingsPanel.init(settingsNav);
      logger.info("Yapify tabs injected into settings sidebar");
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
  };
  var uiInjector = new UIInjector();

  // src/renderer/index.js
  async function bootstrap() {
    logger.info("================================================");
    logger.info("Yapify v1.0.0 initializing in Renderer Process");
    logger.info("================================================");
    try {
      await storage.init();
      themeManager.init();
      pluginManager.register(CustomAccentPlugin);
      pluginManager.register(UITweaksPlugin);
      pluginManager.register(QoLFeaturesPlugin);
      pluginManager.register(MessageLoggerPlugin);
      pluginManager.register(BetterTimestampsPlugin);
      pluginManager.register(QuickCSSPlugin);
      pluginManager.register(DoNotDisturbPlugin);
      pluginManager.register(FontChangerPlugin);
      pluginManager.register(CopyRawPlugin);
      pluginManager.register(TypingIndicatorPlugin);
      pluginManager.register(AutoScrollPlugin);
      pluginManager.register(WindowModsPlugin);
      pluginManager.register(NoPingsPlugin);
      if (window.yapinmodBridge?.invoke) {
        try {
          const externalList = await window.yapinmodBridge.invoke("yapinmod:list-plugins");
          if (Array.isArray(externalList)) {
            for (const item of externalList) {
              if (pluginManager.getPlugin(item.id)) continue;
              const res = await window.yapinmodBridge.invoke("yapinmod:load-plugin-code", item.id);
              if (res.success && res.code) {
                try {
                  const moduleFunc = new Function("exports", "require", "module", res.code);
                  const pluginModule = { exports: {} };
                  moduleFunc(pluginModule.exports, () => ({}), pluginModule);
                  const pluginDef = pluginModule.exports.default || pluginModule.exports;
                  if (pluginDef && pluginDef.id) {
                    pluginManager.register(pluginDef);
                  }
                } catch (e) {
                  logger.error(`Failed to load external plugin "${item.id}": ${e.message}`);
                }
              }
            }
          }
        } catch (err) {
          logger.warn("Could not query external plugins directory: " + err.message);
        }
      }
      await pluginManager.initAll();
      uiInjector.init();
      window.Yapify = {
        version: "1.0.0",
        plugins: pluginManager,
        themes: themeManager,
        storage,
        logger,
        events,
        openTab: (tab) => uiInjector.activateYapifyTab(tab)
      };
      window.YapinMod = window.Yapify;
      events.emit("toast", "Yapify loaded \u2014 open Settings to find Yapify tabs.", "info");
      logger.info("Yapify renderer bootstrap completed successfully");
    } catch (err) {
      logger.error("Critical error in Yapify renderer bootstrap: " + err.message, { stack: err.stack });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
