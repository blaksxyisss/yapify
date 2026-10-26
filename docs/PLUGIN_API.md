# YapinMod Plugin Development Guide

This guide describes how to build, test, and distribute custom plugins for YapinMod.

---

## 1. Quick Start

Create a folder inside `%APPDATA%\YapinMod\plugins\` (e.g. `my-awesome-plugin`).

Inside your folder, create:
1. `manifest.json` — metadata about your plugin.
2. `index.js` — plugin code with lifecycle hooks.

---

## 2. Plugin Manifest (`manifest.json`)

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "author": "YourName",
  "description": "Short description of what your plugin does.",
  "dependencies": []
}
```

### Fields
- `id` *(string, required)*: Unique slug identifying the plugin (kebab-case).
- `name` *(string, required)*: Human-readable display name.
- `version` *(string, required)*: Semver version string.
- `author` *(string)*: Author name or handle.
- `description` *(string)*: 1-2 sentence description shown in the settings card.
- `dependencies` *(array of strings)*: IDs of other plugins that must be active for this plugin to start.

---

## 3. Plugin Implementation (`index.js`)

Plugins export an object containing lifecycle methods:

```javascript
module.exports = {
  id: 'my-awesome-plugin',
  name: 'My Awesome Plugin',

  /**
   * Called when the plugin is first loaded into memory.
   * Optional async initialization.
   */
  async onLoad(api) {
    api.logger.info('Plugin loaded into memory');
  },

  /**
   * Called when the plugin is activated by the user or on app startup.
   */
  onStart(api) {
    api.logger.info('Plugin started');

    // Inject CSS that automatically unloads when the plugin stops:
    api.ui.injectStyle('my-style', `
      .my-custom-badge {
        color: var(--accent);
        font-weight: bold;
      }
    `);

    // Show a non-intrusive notification:
    api.ui.showToast('My Awesome Plugin is active!', 'success');
  },

  /**
   * Called when the plugin is turned off.
   * Clean up custom DOM elements, intervals, or observers here.
   */
  onStop(api) {
    api.logger.info('Plugin stopped');
    // Note: styles injected via api.ui.injectStyle are cleaned up automatically!
  },

  /**
   * Render custom configuration options inside the YapinMod Settings Modal.
   */
  renderSettings(api, container) {
    const isEnabled = api.storage.get('someFeature', true);

    container.innerHTML = `
      <div class="ym-setting-row">
        <div class="ym-setting-info">
          <span class="ym-setting-title">Enable Feature X</span>
          <span class="ym-setting-desc">Toggles feature X behavior.</span>
        </div>
        <div class="ym-setting-control">
          <label class="ym-switch">
            <input type="checkbox" id="my-feature-toggle" ${isEnabled ? 'checked' : ''} />
            <span class="ym-switch-slider"></span>
          </label>
        </div>
      </div>
    `;

    container.querySelector('#my-feature-toggle')?.addEventListener('change', async (e) => {
      await api.storage.set('someFeature', e.target.checked);
      api.ui.showToast(`Feature ${e.target.checked ? 'enabled' : 'disabled'}`);
    });
  }
};
```

---

## 4. The `api` Context Object

Each plugin receives a scoped `api` object:

### `api.logger`
- `api.logger.info(message, meta)`
- `api.logger.warn(message, meta)`
- `api.logger.error(message, meta)`
- `api.logger.debug(message, meta)`
Logs are tagged with your plugin ID and routed to both console and `%APPDATA%/YapinMod/yapinmod.log`.

### `api.storage`
- `api.storage.get(key, defaultValue)`: Get a persistent setting value.
- `api.storage.set(key, value)`: Save a persistent setting value (survives app restarts).
- `api.storage.getAll()`: Get all settings for this plugin.

### `api.ui`
- `api.ui.injectStyle(styleId, css)`: Inject scoped CSS. Automatically removed when plugin stops.
- `api.ui.removeStyle(styleId)`: Remove previously injected CSS.
- `api.ui.showToast(message, type)`: Display toast notification (`'info'`, `'success'`, `'warning'`, `'error'`).

### `api.events`
- `api.events.on(eventName, handler)`: Subscribe to YapinMod event bus.
- `api.events.emit(eventName, ...args)`: Publish an event.

---

## 5. Error Boundaries

YapinMod wraps all plugin methods in an error boundary. If your plugin throws an exception during `onStart` or runtime execution:
1. The exception stack trace is logged to the diagnostic terminal.
2. The plugin status is marked as `ERROR`.
3. Only your plugin is paused — the Yapin client and all other plugins continue running uninterrupted.
