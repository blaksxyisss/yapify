/**
 * Test Suite: Plugin System & Error Isolation
 */

const assert = require('node:assert');

// Mock browser / DOM environment for testing
global.window = {
  yapinmodBridge: {
    invoke: async () => ({}),
    send: () => {},
    on: () => () => {}
  }
};
global.document = {
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  getElementById: () => null,
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
  addEventListener: () => {}
};

async function run() {
  console.log('[Test: PluginSystem] Running plugin system tests...');

  // Import modules
  const { pluginManager, PluginStatus } = await import('../src/renderer/plugins/plugin-manager.js');

  // Test 1: Register valid plugin
  const validPlugin = {
    id: 'test-plugin-1',
    name: 'Test Plugin 1',
    version: '1.2.0',
    author: 'Test Author',
    description: 'Unit testing plugin',
    onStart() {},
    onStop() {}
  };
  const regOk = pluginManager.register(validPlugin);
  assert.strictEqual(regOk, true, 'Valid plugin should register successfully');

  // Test 2: Reject duplicate registration
  const dupOk = pluginManager.register(validPlugin);
  assert.strictEqual(dupOk, false, 'Duplicate plugin registration must be rejected');

  // Test 3: Reject missing ID
  const invalidPlugin = { name: 'No ID' };
  const invalidOk = pluginManager.register(invalidPlugin);
  assert.strictEqual(invalidOk, false, 'Plugin without ID must be rejected');

  // Test 4: Error Isolation (Broken Plugin must NOT crash host)
  let brokenCleanedUp = false;
  const brokenPlugin = {
    id: 'broken-plugin',
    name: 'Broken Plugin',
    version: '1.0.0',
    onStart(api) {
      api.ui.injectStyle('temp', 'body{}');
      throw new Error('Simulated runtime crash in plugin onStart!');
    }
  };
  pluginManager.register(brokenPlugin);
  const startRes = await pluginManager.startPlugin('broken-plugin');
  assert.strictEqual(startRes, false, 'Broken plugin start should return false');
  
  const brokenEntry = pluginManager.getPlugin('broken-plugin');
  assert.strictEqual(brokenEntry.status, PluginStatus.ERROR, 'Broken plugin status should be ERROR');
  assert.ok(brokenEntry.error.includes('Simulated runtime crash'), 'Error message should be captured');

  // Test 5: Dependency handling
  const dependentPlugin = {
    id: 'dependent-plugin',
    name: 'Dependent Plugin',
    dependencies: ['non-existent-plugin'],
    onStart() {}
  };
  pluginManager.register(dependentPlugin);
  const depStartRes = await pluginManager.startPlugin('dependent-plugin');
  assert.strictEqual(depStartRes, false, 'Plugin with missing dependencies must fail cleanly');
  assert.strictEqual(pluginManager.getPlugin('dependent-plugin').status, PluginStatus.ERROR);

  // Test 6: AutoScroll plugin registration & API contract
  const { AutoScrollPlugin } = await import('../src/renderer/plugins/autoscroll.js');
  assert.strictEqual(AutoScrollPlugin.id, 'autoscroll', 'AutoScroll plugin should have correct ID');
  assert.strictEqual(typeof AutoScrollPlugin.onStart, 'function', 'AutoScroll plugin should have onStart');
  assert.strictEqual(typeof AutoScrollPlugin.onStop, 'function', 'AutoScroll plugin should have onStop');
  assert.strictEqual(typeof AutoScrollPlugin.renderSettings, 'function', 'AutoScroll plugin should have renderSettings');
  const asRegOk = pluginManager.register(AutoScrollPlugin);
  assert.strictEqual(asRegOk, true, 'AutoScrollPlugin should register in pluginManager');

  // Test 7: WindowMods plugin registration & API contract
  const { WindowModsPlugin } = await import('../src/renderer/plugins/window-mods.js');
  assert.strictEqual(WindowModsPlugin.id, 'window-mods', 'WindowMods plugin should have correct ID');
  assert.strictEqual(typeof WindowModsPlugin.onStart, 'function', 'WindowMods plugin should have onStart');
  assert.strictEqual(typeof WindowModsPlugin.onStop, 'function', 'WindowMods plugin should have onStop');
  assert.strictEqual(typeof WindowModsPlugin.renderSettings, 'function', 'WindowMods plugin should have renderSettings');
  const wmRegOk = pluginManager.register(WindowModsPlugin);
  assert.strictEqual(wmRegOk, true, 'WindowModsPlugin should register in pluginManager');

  console.log('[Test: PluginSystem] All 7 plugin system tests PASSED!');
}

run().catch(err => {
  console.error('[Test: PluginSystem] FAILED:', err);
  process.exit(1);
});
