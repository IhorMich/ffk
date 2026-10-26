'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const hooksDir = path.join(root, '.git', 'hooks');
if (!fs.existsSync(hooksDir)) process.exit(0);

const name = 'pre-push';
const dest = path.join(hooksDir, name);
fs.copyFileSync(path.join(__dirname, 'hooks', name), dest);
fs.chmodSync(dest, 0o755);
