#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  'account/selftest.js',
  'auth/selftest.js',
  'rating/selftest.js',
  'sync/selftest.js',
  'repo/local/selftest.js',
  'repo/cloud/selftest.js',
  'data/selftest.js',
  'errors/selftest.js'
];

const root = path.join(__dirname, '..');
for (const file of tests) {
  const result = spawnSync(process.execPath, [path.join(root, file)], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.stderr.write('\nFAIL ' + file + '\n');
    process.exit(result.status || 1);
  }
}
process.stdout.write('\nAll 8 selftests passed.\n');
