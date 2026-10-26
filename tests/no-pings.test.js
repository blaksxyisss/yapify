/**
 * Test Suite: No Pings Plugin
 * Verifies plugin registration, rail toggle creation, ping suppression, and settings lifecycle.
 */

const assert = require('node:assert');

// Mock browser / DOM environment
global.window = {
  yapinmodBridge: {
    invoke: async () => ({}),
    send: () => {},
    on: () => () => {}
  },
  HTMLMediaElement: {
    prototype: {
      play: function() { return Promise.resolve('original_play'); }
    }
  },
  Notification: function(title, options) {
    this.title = title;
    this.options = options;
  },
  yapperDesktop: {
    setBadge: (count) => {},
    notify: (n) => {}
  }
};

const elements = new Map();

let _currentDocTitle = 'Yapin\'';
function MockDocument() {}
MockDocument.prototype = {};
Object.defineProperty(MockDocument.prototype, 'title', {
  configurable: true,
  enumerable: true,
  get() { return _currentDocTitle; },
  set(val) { _currentDocTitle = val; }
});
global.Document = MockDocument;

global.document = Object.create(MockDocument.prototype, {
  head: { value: { appendChild: (el) => { elements.set(el.id, el); } } },
  body: {
    value: {
      classList: {
        _classes: new Set(),
        add: function(c) { this._classes.add(c); },
        remove: function(c) { this._classes.delete(c); },
        contains: function(c) { return this._classes.has(c); }
      },
      appendChild: () => {}
    }
  },
  getElementById: { value: (id) => elements.get(id) || null },
  createElement: {
    value: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        style: {},
        children: [],
        dataset: {},
        innerHTML: '',
        textContent: '',
        attributes: {},
        setAttribute: function(k, v) { this.attributes[k] = v; },
        getAttribute: function(k) { return this.attributes[k]; },
        appendChild: function(c) { this.children.push(c); },
        querySelector: function(sel) {
          if (sel === '#yf-no-pings-btn') return { addEventListener: () => {}, setAttribute: () => {} };
          if (sel === '.yf-np-tooltip-badge') return { className: '', textContent: '' };
          if (sel === '.yf-np-tooltip-desc') return { textContent: '' };
          return null;
        },
        querySelectorAll: () => [],
        classList: {
          _classes: new Set(),
          add: function(c) { this._classes.add(c); },
          remove: function(c) { this._classes.delete(c); },
          contains: function(c) { return this._classes.has(c); }
        },
        remove: function() {
          if (this.id) elements.delete(this.id);
        }
      };
      return el;
    }
  },
  querySelector: { value: (sel) => null },
  querySelectorAll: { value: () => [] },
  addEventListener: { value: () => {} }
});

global.Node = { ELEMENT_NODE: 1 };

global.MutationObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
};

async function run() {
  console.log('[Test: NoPings] Running No Pings plugin tests...');

  const { pluginManager } = await import('../src/renderer/plugins/plugin-manager.js');
  const { NoPingsPlugin } = await import('../src/renderer/plugins/no-pings.js');

  // Test 1: Plugin metadata and registration
  assert.strictEqual(NoPingsPlugin.id, 'no-pings');
  assert.strictEqual(typeof NoPingsPlugin.onStart, 'function');
  assert.strictEqual(typeof NoPingsPlugin.onStop, 'function');
  assert.strictEqual(typeof NoPingsPlugin.renderSettings, 'function');

  const regOk = pluginManager.register(NoPingsPlugin);
  assert.strictEqual(regOk, true, 'NoPingsPlugin should register successfully in pluginManager');

  // Test 2: Mock API context
  const storageMap = new Map();
  const injectedStyles = new Map();
  let toastCalls = 0;

  const mockApi = {
    id: 'no-pings',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    },
    storage: {
      get: (k, def) => storageMap.has(k) ? storageMap.get(k) : def,
      set: async (k, v) => storageMap.set(k, v),
      getAll: () => Object.fromEntries(storageMap.entries())
    },
    ui: {
      injectStyle: (id, css) => {
        injectedStyles.set(id, css);
        elements.set(`yapinmod-plugin-no-pings-${id}`, { id, remove: () => injectedStyles.delete(id) });
      },
      removeStyle: (id) => injectedStyles.delete(id),
      showToast: () => { toastCalls++; }
    }
  };

    // Test 3: Start plugin (when enabled in plugins page)
    NoPingsPlugin.onStart(mockApi);
    assert.strictEqual(NoPingsPlugin._isActive, true, 'Should be active by default when started');
    assert.ok(injectedStyles.has('toggle-styles'), 'Rail toggle styles should be injected');
    assert.ok(injectedStyles.has('suppression-styles'), 'Suppression styles should be injected when active');
    assert.ok(document.body.classList.contains('yf-no-pings-active'), 'body should have yf-no-pings-active class');

    // Test 4: Verify Title Suppression while Active (e.g. (1) Yapin' -> Yapin')
    document.title = '(1) Yapin\'';
    assert.strictEqual(document.title, 'Yapin\'', 'document.title should have (1) prefix stripped when active');
    assert.strictEqual(NoPingsPlugin._lastBadgeCount, 1, 'Should record last badge count of 1');

    // Test 5: Toggle Active state (clicking toggle button on main page to DISABLE)
    await NoPingsPlugin.toggleActive();
    assert.strictEqual(NoPingsPlugin._isActive, false, 'Toggle should deactivate No Pings');
    assert.strictEqual(storageMap.get('active'), false, 'Inactive state should be persisted to storage');
    assert.ok(!document.body.classList.contains('yf-no-pings-active'), 'body should no longer have yf-no-pings-active class');
    assert.strictEqual(toastCalls, 0, 'No popup toast should be shown when disabling toggle');

    // Test 6: Verify Title Restoration when Disabled (restores (1) Yapin')
    assert.strictEqual(document.title, '(1) Yapin\'', 'document.title should restore (1) prefix when disabled');

    // Test 7: Toggle back ON
    await NoPingsPlugin.toggleActive();
    assert.strictEqual(NoPingsPlugin._isActive, true, 'Toggle should reactivate No Pings');
    assert.strictEqual(storageMap.get('active'), true, 'Active state should be persisted to storage');
    assert.ok(document.body.classList.contains('yf-no-pings-active'), 'body should have yf-no-pings-active class again');
    assert.strictEqual(document.title, 'Yapin\'', 'document.title should have (1) prefix removed again when re-enabled');
    assert.strictEqual(toastCalls, 0, 'No popup toast should be shown when enabling toggle');

    // Test 8: Verify element creation
    const toggleEl = NoPingsPlugin._createToggleElement();
    assert.ok(toggleEl, 'Toggle element should be created');
    assert.strictEqual(toggleEl.id, 'yf-no-pings-wrap');
    assert.ok(toggleEl.className.includes('yf-no-pings-wrap'));
    assert.ok(toggleEl.innerHTML.includes('yf-no-pings-btn'));
    assert.ok(toggleEl.innerHTML.includes('yf-no-pings-svg'));
    assert.ok(toggleEl.innerHTML.includes('yf-no-pings-switch'));
    assert.ok(toggleEl.innerHTML.includes('yf-no-pings-tooltip'));

    // Test 9: Verify Settings rendering
    const settingsContainer = document.createElement('div');
    NoPingsPlugin.renderSettings(mockApi, settingsContainer);
    assert.ok(settingsContainer.innerHTML.includes('Mute Ping Sounds'));
    assert.ok(settingsContainer.innerHTML.includes('Block Desktop Notifications'));
    assert.ok(settingsContainer.innerHTML.includes('Hide In-App Mention Badges'));
    assert.ok(settingsContainer.innerHTML.includes('Suppress Taskbar Badge'));

    // Test 10: Stop plugin (when disabled in plugins page)
    NoPingsPlugin.onStop(mockApi);
    assert.strictEqual(NoPingsPlugin._checkInterval, null, 'Watcher interval should be cleared');
    assert.ok(!document.body.classList.contains('yf-no-pings-active'), 'body class should be removed on stop');
    assert.strictEqual(injectedStyles.size, 0, 'All styles should be removed on stop');

    console.log('[Test: NoPings] All 10 No Pings plugin tests PASSED successfully!');
  }

  run().catch(err => {
    console.error('[Test: NoPings] FAILED:', err);
    process.exit(1);
  });
