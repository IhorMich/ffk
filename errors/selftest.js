#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
['codes.js', 'classify.js', 'report.js', 'engine.js'].forEach(f => require(path.join(root, 'errors', f)));
require(path.join(root, 'log', 'breadcrumb.js'));
require(path.join(root, 'log', 'engine.js'));
const E = global.MatchcardErrors;
const L = global.MatchcardLog;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
}

assert(E.classifyError('no_cloud').code === 'no_cloud', 'no_cloud');
assert(E.classifyError(new Error('Failed to fetch')).code === 'network', 'network');
assert(E.classifyError(new Error('Invalid login credentials')).code === 'auth', 'auth');
assert(E.classifyError('local_dirty_and_remote_present').code === 'conflict', 'conflict');

const scrubbed = E.scrub('mail me at kid@ffk.app please');
assert(!/@/.test(scrubbed) && scrubbed.includes('[email]'), 'scrub email');

let toasted = '';
global.showToast = (m) => { toasted = m; };
const reported = E.reportError(new Error('no_session'), { scope: 'sync', toast: 'Need login' });
assert(reported.code === 'no_session', 'report code');
assert(toasted === 'Need login', 'toast');

L.clear();
L.breadcrumb('sync.start', { pull: true });
L.error('sync.fail', { message: 'boom' });
const trail = L.getTrail();
assert(trail.length === 2 && trail[1].level === 'error', 'trail');

console.log('OK errors+log selftest');
