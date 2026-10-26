/**
 * Yapify Installer Script
 * Detects Yapper installation, creates safe backups, builds latest bundles,
 * patches app.asar, and sets up user plugins/themes directories.
 */

const asar = require('@electron/asar');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const APPDATA = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Preferences') : path.join(process.env.HOME, '.config'));
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');

const YAPINMOD_DIR = path.join(APPDATA, 'YapinMod');
const PLUGINS_DIR = path.join(YAPINMOD_DIR, 'plugins');
const THEMES_DIR = path.join(YAPINMOD_DIR, 'themes');

function getSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function findYapperPath() {
  // 1. Check command line arg --path
  const arg = process.argv.find(a => a.startsWith('--path='));
  if (arg) {
    const custom = arg.split('=')[1].replace(/^["']|["']$/g, '');
    if (fs.existsSync(custom)) return custom;
  }

  // 2. Default Windows installation path
  const defaultWin = path.join(LOCALAPPDATA, 'Programs', 'yapper-desktop');
  if (fs.existsSync(defaultWin)) return defaultWin;

  // 3. Check Program Files
  const pf = process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'yapper-desktop') : null;
  if (pf && fs.existsSync(pf)) return pf;

  return null;
}

function isProcessRunning(processName) {
  try {
    const stdout = execSync(`tasklist /FI "IMAGENAME eq ${processName}.exe" /NH`, { encoding: 'utf8' });
    return stdout.toLowerCase().includes(processName.toLowerCase());
  } catch {
    return false;
  }
}

function closeYapperProcess() {
  console.log('[Yapify Install] Closing running Yapper instances...');
  try {
    execSync('taskkill /F /IM Yapper.exe /T', { stdio: 'ignore' });
    console.log('[Yapify Install] Yapper processes closed.');
  } catch {
    // Process may have already exited
  }
}

async function install() {
  console.log('====================================================');
  console.log('  Yapify - Vencord-Style Mod for Yapin.gg / Yapper');
  console.log('====================================================\n');

  // Step 1: Locate installation
  const yapperDir = findYapperPath();
  if (!yapperDir) {
    console.error('[Error] Could not automatically locate Yapper installation directory.');
    console.error('Please specify the path using: node installer/install.js --path="C:\\path\\to\\yapper-desktop"');
    process.exit(1);
  }

  const resourcesDir = path.join(yapperDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupAsarPath = path.join(resourcesDir, 'app.asar.original');

  if (!fs.existsSync(asarPath) && !fs.existsSync(backupAsarPath)) {
    console.error(`[Error] app.asar not found in ${resourcesDir}`);
    process.exit(1);
  }

  console.log(`[1/6] Found Yapper installation: ${yapperDir}`);

  // Step 2: Check running process
  if (isProcessRunning('Yapper')) {
    console.log('[Notice] Yapper is currently running.');
    const force = process.argv.includes('--force') || process.argv.includes('-y');
    if (force) {
      closeYapperProcess();
    } else {
      console.log('Closing Yapper to safely update files...');
      closeYapperProcess();
    }
  }

  // Step 3: Ensure pristine backup
  if (!fs.existsSync(backupAsarPath)) {
    console.log('[2/6] Creating initial backup of pristine app.asar...');
    fs.copyFileSync(asarPath, backupAsarPath);
    const hash = getSha256(backupAsarPath);
    console.log(`      Pristine backup created: ${backupAsarPath}`);
    console.log(`      SHA256 Hash: ${hash}`);

    // Store metadata
    const meta = {
      installedAt: new Date().toISOString(),
      originalHash: hash,
      modVersion: '1.0.0'
    };
    fs.writeFileSync(path.join(resourcesDir, 'yapinmod-meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  } else {
    console.log(`[2/6] Existing backup verified: ${backupAsarPath}`);
  }

  // Step 4: Build latest bundles
  console.log('[3/6] Building latest Yapify bundles...');
  execSync('node scripts/build.js', { cwd: ROOT_DIR, stdio: 'inherit' });

  // Step 5: Patch ASAR
  console.log('[4/6] Patching app.asar with Yapify loader...');
  const tempExtractDir = path.join(ROOT_DIR, '.tmp_patch_asar');
  if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    // ASAR expects [archive].unpacked right next to the archive file
    const origUnpacked = backupAsarPath + '.unpacked';
    const standardUnpacked = path.join(resourcesDir, 'app.asar.unpacked');
    let junctionCreated = false;

    if (fs.existsSync(standardUnpacked) && !fs.existsSync(origUnpacked)) {
      try {
        fs.symlinkSync(standardUnpacked, origUnpacked, 'junction');
        junctionCreated = true;
      } catch {
        // Fallback: copy if symlink fails
        execSync(`xcopy /E /I /Q /Y "${standardUnpacked}" "${origUnpacked}"`, { stdio: 'ignore' });
        junctionCreated = true;
      }
    }

    try {
      // Always extract from the pristine backup to ensure clean, non-accumulating patches
      asar.extractAll(backupAsarPath, tempExtractDir);
    } finally {
      if (junctionCreated && fs.existsSync(origUnpacked)) {
        try { fs.rmSync(origUnpacked, { recursive: true, force: true }); } catch {}
      }
    }

    // Create yapinmod subfolder inside asar
    const ymTargetDir = path.join(tempExtractDir, 'yapinmod');
    fs.mkdirSync(ymTargetDir, { recursive: true });

    fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'main.bundle.js'), path.join(ymTargetDir, 'main.js'));
    fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'preload.bundle.js'), path.join(ymTargetDir, 'preload.bundle.js'));
    fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'renderer.bundle.js'), path.join(ymTargetDir, 'renderer.bundle.js'));

    // Inject Main Loader Hook into main.js
    const mainJsPath = path.join(tempExtractDir, 'main.js');
    let mainJs = fs.readFileSync(mainJsPath, 'utf8');
    const mainHook = `
// --- Yapify Main Loader ---
try {
  const _ymPath = require('node:path').join(__dirname, 'yapinmod');
  const _ymMain = require(_ymPath + '/main.js');
  const _ymRendererCode = require('node:fs').readFileSync(require('node:path').join(_ymPath, 'renderer.bundle.js'), 'utf8');
  _ymMain.initialize(_ymRendererCode);
} catch (_ymErr) {
  console.error('[Yapify] Error initializing main hook:', _ymErr);
}
// ----------------------------
`;
    // Configure BrowserWindow to be frameless (eliminates native OS titlebar and native buttons)
    if (mainJs.includes('autoHideMenuBar: true,')) {
      mainJs = mainJs.replace(
        'autoHideMenuBar: true,',
        'autoHideMenuBar: true,\n    frame: false,'
      );
    }

    mainJs = mainHook + '\n' + mainJs;
    fs.writeFileSync(mainJsPath, mainJs, 'utf8');

    // Inject Preload Hook into preload.js (Inlined to satisfy Electron sandbox rules)
    const preloadJsPath = path.join(tempExtractDir, 'preload.js');
    let preloadJs = fs.readFileSync(preloadJsPath, 'utf8');
    const preloadBundleCode = fs.readFileSync(path.join(ROOT_DIR, 'dist', 'preload.bundle.js'), 'utf8');
    const preloadHook = `
// --- Yapify Preload Loader (Inlined) ---
try {
${preloadBundleCode}
} catch (_ymPreloadErr) {
  console.error('[Yapify] Error in preload hook:', _ymPreloadErr);
}
// ----------------------------------------
`;
    preloadJs = preloadHook + '\n' + preloadJs;
    fs.writeFileSync(preloadJsPath, preloadJs, 'utf8');

    // Repack patched ASAR
    const tempOutAsar = path.join(ROOT_DIR, '.tmp_app.asar');
    await asar.createPackageWithOptions(tempExtractDir, tempOutAsar, {
      unpack: '{**/*.node,**/node_modules/uiohook-napi/**}'
    });

    // Atomic replace
    fs.copyFileSync(tempOutAsar, asarPath);
    fs.rmSync(tempOutAsar, { force: true });
    console.log('      Successfully wrote patched app.asar');
  } finally {
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
  }

  // Step 6: Setup user configuration, example plugins, and themes
  console.log('[5/6] Setting up user directories in %APPDATA%/YapinMod...');
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  if (!fs.existsSync(THEMES_DIR)) fs.mkdirSync(THEMES_DIR, { recursive: true });

  // Copy themes
  const themesSrcDir = path.join(ROOT_DIR, 'themes');
  if (fs.existsSync(themesSrcDir)) {
    const themeFiles = fs.readdirSync(themesSrcDir);
    for (const tf of themeFiles) {
      if (tf.endsWith('.css')) {
        fs.copyFileSync(path.join(themesSrcDir, tf), path.join(THEMES_DIR, tf));
      }
    }
    console.log(`      Copied ${themeFiles.length} themes to ${THEMES_DIR}`);
  }

  // Copy example plugin
  const examplePluginSrc = path.join(ROOT_DIR, 'example-plugins', 'custom-timestamp');
  const examplePluginDest = path.join(PLUGINS_DIR, 'custom-timestamp');
  if (fs.existsSync(examplePluginSrc)) {
    if (!fs.existsSync(examplePluginDest)) fs.mkdirSync(examplePluginDest, { recursive: true });
    fs.copyFileSync(path.join(examplePluginSrc, 'manifest.json'), path.join(examplePluginDest, 'manifest.json'));
    fs.copyFileSync(path.join(examplePluginSrc, 'index.js'), path.join(examplePluginDest, 'index.js'));
    console.log(`      Installed community plugin: custom-timestamp`);
  }

  console.log('[6/6] Verifying patched archive integrity...');
  const patchedFiles = asar.listPackage(asarPath);
  const ok = patchedFiles.some(f => f.includes('yapinmod'));
  if (ok) {
    console.log('\n====================================================');
    console.log('  INSTALLATION SUCCESSFUL!');
    console.log('  Yapify has been cleanly installed.');
    console.log('  Launch Yapper and open Settings to see the Yapify tabs.');
    console.log('====================================================\n');
  } else {
    throw new Error('Integrity check failed: yapinmod files not found in patched archive.');
  }
}

install().catch(err => {
  console.error('\n[Error] Installation failed:', err);
  process.exit(1);
});
