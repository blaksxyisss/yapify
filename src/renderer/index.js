/**
 * Yapify Renderer Process Entry Point
 * Orchestrates storage, plugin manager, themes, and settings sidebar injection.
 */

import { logger } from './core/logger.js';
import { storage } from './core/storage.js';
import { themeManager } from './themes/theme-manager.js';
import { pluginManager } from './plugins/plugin-manager.js';
import { CustomAccentPlugin } from './plugins/custom-accent.js';
import { UITweaksPlugin } from './plugins/ui-tweaks.js';
import { QoLFeaturesPlugin } from './plugins/qol-features.js';
import { MessageLoggerPlugin } from './plugins/message-logger.js';
import { BetterTimestampsPlugin } from './plugins/better-timestamps.js';
import { QuickCSSPlugin } from './plugins/quick-css.js';
import { DoNotDisturbPlugin } from './plugins/do-not-disturb.js';
import { FontChangerPlugin } from './plugins/font-changer.js';
import { CopyRawPlugin } from './plugins/copy-raw.js';
import { TypingIndicatorPlugin } from './plugins/typing-indicator.js';
import { AutoScrollPlugin } from './plugins/autoscroll.js';
import { WindowModsPlugin } from './plugins/window-mods.js';
import { uiInjector } from './ui/injector.js';
import { events } from './core/event-bus.js';

async function bootstrap() {
  logger.info('================================================');
  logger.info('Yapify v1.0.0 initializing in Renderer Process');
  logger.info('================================================');

  try {
    // 1. Initialize persistent storage
    await storage.init();

    // 2. Initialize Theme Manager (applies globally)
    themeManager.init();

    // 3. Register Core Plugins
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

    // 4. Load external plugins from %APPDATA%/YapinMod/plugins
    if (window.yapinmodBridge?.invoke) {
      try {
        const externalList = await window.yapinmodBridge.invoke('yapinmod:list-plugins');
        if (Array.isArray(externalList)) {
          for (const item of externalList) {
            if (pluginManager.getPlugin(item.id)) continue;

            const res = await window.yapinmodBridge.invoke('yapinmod:load-plugin-code', item.id);
            if (res.success && res.code) {
              try {
                const moduleFunc = new Function('exports', 'require', 'module', res.code);
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
        logger.warn('Could not query external plugins directory: ' + err.message);
      }
    }

    // 5. Start all enabled plugins
    await pluginManager.initAll();

    // 6. Initialize UI injector (sidebar tabs + toast system)
    uiInjector.init();

    // 7. Expose developer object on window
    window.Yapify = {
      version: '1.0.0',
      plugins: pluginManager,
      themes: themeManager,
      storage,
      logger,
      events,
      openTab: (tab) => uiInjector.activateYapifyTab(tab),
    };

    // Keep legacy alias for backwards compat
    window.YapinMod = window.Yapify;

    events.emit('toast', 'Yapify loaded — open Settings to find Yapify tabs.', 'info');
    logger.info('Yapify renderer bootstrap completed successfully');
  } catch (err) {
    logger.error('Critical error in Yapify renderer bootstrap: ' + err.message, { stack: err.stack });
  }
}

// Start bootstrap when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
