#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
['schema.js', 'validate.js', 'migrate.js', 'engine.js'].forEach(f => require(path.join(root, 'data', f)));
const D = global.MatchcardData;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
}

const badRoster = D.validateRoster({ ids: ['a', 'a'], currentId: 'z' });
assert(!badRoster.ok, 'bad roster');
assert(badRoster.issues.some(i => i.code === 'roster_dup_id'), 'dup');
assert(badRoster.issues.some(i => i.code === 'roster_current_orphan'), 'orphan');

const fixed = D.repairRoster({ ids: ['a', 'a', 'b'], currentId: 'z' }, 32);
assert(fixed.roster.ids.join(',') === 'a,b', 'repair ids');
assert(fixed.roster.currentId === 'a', 'repair current');

const matches = D.repairMatchList([
  { id: 1, date: '2026-01-01' },
  { id: 1, date: '2026-01-02' },
  { id: 2, date: '2026-01-03' },
  null
]);
assert(matches.matches.length === 2 && matches.removed === 2, 'repair matches');

const mig = D.migrateBackupPayload([{ id: 9, date: '2026-01-01', opponent: 'X' }]);
assert(mig.ok && mig.payload.version === 4 && mig.payload.matches.length === 1, 'migrate array');

const v = D.validateBackupPayload(mig.payload);
assert(v.ok, 'validate migrated');

const empty = D.validateBackupPayload({});
assert(!empty.ok, 'empty backup');

console.log('OK data selftest');
