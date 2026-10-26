/**
 * Test Suite: Theme & Accent Color Utilities
 */

const assert = require('node:assert');

global.window = {
  yapinmodBridge: {
    invoke: async () => ({ success: true, css: '/* test */' }),
    send: () => {},
    on: () => () => {}
  }
};
global.document = {
  head: { appendChild: () => {} },
  getElementById: () => null,
  createElement: () => ({ textContent: '' })
};

async function run() {
  console.log('[Test: ThemeManager] Running theme manager tests...');

  const { themeManager } = await import('../src/renderer/themes/theme-manager.js');

  // Test 1: Hex to RGBA conversion
  const rgba = themeManager.hexToRgba('#ff6b4a', 0.2);
  assert.strictEqual(rgba, 'rgba(255, 107, 74, 0.2)', 'hexToRgba should calculate exact RGB with alpha');

  // Test 2: Brightness adjustment
  const dark = themeManager.adjustBrightness('#5865f2', -10);
  assert.ok(dark.startsWith('#'), 'Adjusted brightness should be a valid hex');
  assert.notStrictEqual(dark, '#5865f2', 'Adjusted brightness should differ from original');

  console.log('[Test: ThemeManager] All theme tests PASSED!');
}

run().catch(err => {
  console.error('[Test: ThemeManager] FAILED:', err);
  process.exit(1);
});
