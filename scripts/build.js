/**
 * Yapify Build Script
 * Uses esbuild to produce clean standalone bundles for main, preload, and renderer.
 */

const esbuild = require('esbuild');
const path = require('node:path');
const fs = require('node:fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function build() {
  console.log('[YapinMod Build] Starting build process...');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // 1. Bundle Renderer Process (IIFE for web execution)
  console.log('[YapinMod Build] Bundling Renderer process...');
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'src', 'renderer', 'index.js')],
    outfile: path.join(DIST_DIR, 'renderer.bundle.js'),
    bundle: true,
    format: 'iife',
    globalName: 'YapinModRenderer',
    platform: 'browser',
    target: ['chrome120'],
    minify: false, // keep readable for debugging
    sourcemap: false
  });
  console.log('[YapinMod Build] Successfully built dist/renderer.bundle.js');

  // 2. Bundle Preload Script (CommonJS for Electron preload)
  console.log('[YapinMod Build] Bundling Preload bridge...');
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, 'src', 'preload', 'index.js')],
    outfile: path.join(DIST_DIR, 'preload.bundle.js'),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    external: ['electron'],
    target: ['node20'],
    minify: false
  });
  console.log('[YapinMod Build] Successfully built dist/preload.bundle.js');

  // 3. Prepare Main Process bundle
  console.log('[YapinMod Build] Copying Main process hook...');
  const mainSource = fs.readFileSync(path.join(ROOT_DIR, 'src', 'main', 'index.js'), 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'main.bundle.js'), mainSource, 'utf8');
  console.log('[YapinMod Build] Successfully prepared dist/main.bundle.js');

  console.log('[YapinMod Build] All bundles built successfully in dist/ !');
}

build().catch(err => {
  console.error('[YapinMod Build] Build failed:', err);
  process.exit(1);
});
