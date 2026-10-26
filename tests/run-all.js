/**
 * Test Runner: Executes all unit and integration tests
 */

const { execSync } = require('node:child_process');
const path = require('node:path');

const TESTS = [
  'tests/plugin-system.test.js',
  'tests/theme.test.js',
  'tests/no-pings.test.js'
];

console.log('====================================================');
console.log('  YapinMod Automated Test Suite');
console.log('====================================================\n');

let failed = 0;

for (const testFile of TESTS) {
  try {
    console.log(`Running ${testFile}...`);
    execSync(`node ${testFile}`, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`[PASS] ${testFile}\n`);
  } catch (err) {
    console.error(`[FAIL] ${testFile}\n`);
    failed++;
  }
}

if (failed === 0) {
  console.log('====================================================');
  console.log('  ALL TESTS PASSED SUCCESSFULLY! (100% Green)');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error(`\n${failed} test suite(s) failed.`);
  process.exit(1);
}
