/**
 * YapinMod Uninstaller Script
 * Reverts app.asar back to its pristine original state and restores original checksums.
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const APPDATA = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Preferences') : path.join(process.env.HOME, '.config'));
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const YAPINMOD_DIR = path.join(APPDATA, 'YapinMod');

function getSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function findYapperPath() {
  const arg = process.argv.find(a => a.startsWith('--path='));
  if (arg) {
    const custom = arg.split('=')[1].replace(/^["']|["']$/g, '');
    if (fs.existsSync(custom)) return custom;
  }
  const defaultWin = path.join(LOCALAPPDATA, 'Programs', 'yapper-desktop');
  if (fs.existsSync(defaultWin)) return defaultWin;

  const pf = process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'yapper-desktop') : null;
  if (pf && fs.existsSync(pf)) return pf;

  return null;
}

function closeYapperProcess() {
  console.log('[YapinMod Uninstall] Closing running Yapper instances...');
  try {
    execSync('taskkill /F /IM Yapper.exe /T', { stdio: 'ignore' });
  } catch {
    // Process might not be running
  }
}

async function uninstall() {
  console.log('====================================================');
  console.log('  YapinMod - Uninstaller & Rollback Tool');
  console.log('====================================================\n');

  const yapperDir = findYapperPath();
  if (!yapperDir) {
    console.error('[Error] Could not locate Yapper directory.');
    process.exit(1);
  }

  const resourcesDir = path.join(yapperDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupAsarPath = path.join(resourcesDir, 'app.asar.original');
  const metaPath = path.join(resourcesDir, 'yapinmod-meta.json');

  if (!fs.existsSync(backupAsarPath)) {
    console.error('[Error] Original backup (app.asar.original) not found!');
    console.error('Cannot safely restore original without a verified backup.');
    process.exit(1);
  }

  closeYapperProcess();

  console.log(`[1/3] Restoring pristine app.asar from ${backupAsarPath}...`);
  fs.copyFileSync(backupAsarPath, asarPath);

  console.log('[2/3] Verifying checksum integrity...');
  const currentHash = getSha256(asarPath);
  console.log(`      Current SHA256: ${currentHash}`);

  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.originalHash && meta.originalHash === currentHash) {
        console.log('      Verified: Checksum matches pristine pre-mod hash perfectly!');
      }
      fs.rmSync(metaPath, { force: true });
    } catch {
      // Ignored
    }
  }

  // Check --purge flag
  if (process.argv.includes('--purge')) {
    console.log('[3/3] Purging user data directory (%APPDATA%/YapinMod)...');
    if (fs.existsSync(YAPINMOD_DIR)) {
      fs.rmSync(YAPINMOD_DIR, { recursive: true, force: true });
      console.log('      User data removed.');
    }
  } else {
    console.log('[3/3] Preserving user config & themes in %APPDATA%/YapinMod for future use.');
    console.log('      (Use --purge to completely remove settings if desired)');
  }

  console.log('\n====================================================');
  console.log('  UNINSTALL COMPLETE');
  console.log('  Yapin / Yapper has been completely restored to 100% vanilla.');
  console.log('====================================================\n');
}

uninstall().catch(err => {
  console.error('\n[Error] Uninstallation failed:', err);
  process.exit(1);
});
