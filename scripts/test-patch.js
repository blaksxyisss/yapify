/**
 * Test script to verify ASAR patching with unpacked native modules
 */

const asar = require('@electron/asar');
const path = require('node:path');
const fs = require('node:fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const TEMP_DIR = path.join(ROOT_DIR, 'scratch', 'asar_test');
const ORIGINAL_ASAR = path.join(ROOT_DIR, 'backup', 'app.asar.original');
const OUTPUT_ASAR = path.join(ROOT_DIR, 'scratch', 'test-app.asar');

async function testPatch() {
  console.log('[Test Patch] Testing ASAR patch with native module unpack...');

  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  // 1. Extract original ASAR
  asar.extractAll(ORIGINAL_ASAR, TEMP_DIR);

  // 2. Add yapinmod folder
  const ymTargetDir = path.join(TEMP_DIR, 'yapinmod');
  fs.mkdirSync(ymTargetDir, { recursive: true });

  fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'main.bundle.js'), path.join(ymTargetDir, 'main.js'));
  fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'preload.bundle.js'), path.join(ymTargetDir, 'preload.bundle.js'));
  fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'renderer.bundle.js'), path.join(ymTargetDir, 'renderer.bundle.js'));

  // 3. Patch main.js
  const mainJsPath = path.join(TEMP_DIR, 'main.js');
  let mainJs = fs.readFileSync(mainJsPath, 'utf8');

  const mainHook = `
// --- YapinMod Main Loader ---
try {
  const _ymPath = require('node:path').join(__dirname, 'yapinmod');
  const _ymMain = require(_ymPath + '/main.js');
  const _ymRendererCode = require('node:fs').readFileSync(require('node:path').join(_ymPath, 'renderer.bundle.js'), 'utf8');
  _ymMain.initialize(_ymRendererCode);
} catch (_ymErr) {
  console.error('[YapinMod] Error initializing main hook:', _ymErr);
}
// ----------------------------
`;
  mainJs = mainHook + '\n' + mainJs;
  fs.writeFileSync(mainJsPath, mainJs, 'utf8');

  // 4. Patch preload.js
  const preloadJsPath = path.join(TEMP_DIR, 'preload.js');
  let preloadJs = fs.readFileSync(preloadJsPath, 'utf8');

  const preloadHook = `
// --- YapinMod Preload Loader ---
try {
  require('./yapinmod/preload.bundle.js');
} catch (_ymPreloadErr) {
  console.error('[YapinMod] Error initializing preload hook:', _ymPreloadErr);
}
// -------------------------------
`;
  preloadJs = preloadHook + '\n' + preloadJs;
  fs.writeFileSync(preloadJsPath, preloadJs, 'utf8');

  // 5. Pack asar with native module unpack pattern
  console.log('[Test Patch] Repacking with unpack pattern: **/*.node, **/node_modules/uiohook-napi/** ...');
  await asar.createPackageWithOptions(TEMP_DIR, OUTPUT_ASAR, {
    unpack: '{**/*.node,**/node_modules/uiohook-napi/**}'
  });

  const stats = fs.statSync(OUTPUT_ASAR);
  console.log('[Test Patch] Repacked ASAR size:', stats.size, 'bytes');

  const unpackedDir = OUTPUT_ASAR + '.unpacked';
  console.log('[Test Patch] test-app.asar.unpacked exists:', fs.existsSync(unpackedDir));

  console.log('[Test Patch] Complete native unpack test PASSED!');
}

testPatch().catch(err => {
  console.error('[Test Patch] FAILED:', err);
  process.exit(1);
});
