#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
['plan.js', 'merge.js', 'lifecycle.js', 'engine.js'].forEach(f => require(path.join(root, 'sync', f)));
const S = global.MatchcardSync;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
}

const free = S.planPersonalSync({ isPro: false, ready: true, hasSession: true });
assert(free.reason === 'not_pro' && free.status === 'free', 'not_pro');

const need = S.planPersonalSync({ isPro: true, ready: true, hasSession: false });
assert(need.reason === 'no_session', 'no_session');

const seed = S.planPersonalSync({
  isPro: true, ready: true, hasSession: true,
  hasRemote: false, localAt: '', localDirty: true, pull: true, push: true
});
assert(seed.relation === 'remote_empty', 'remote_empty');
assert(seed.steps.some(s => s.action === 'push'), 'seed push');

const remoteNewer = S.planPersonalSync({
  isPro: true, ready: true, hasSession: true,
  hasRemote: true, remoteAt: '2026-01-02T00:00:00.000Z', localAt: '2026-01-01T00:00:00.000Z',
  localDirty: false, pull: true, push: true
});
assert(remoteNewer.relation === 'remote_newer', 'remote_newer');
assert(remoteNewer.steps[0].action === 'pull_merge', 'pull first');
assert(remoteNewer.steps.some(s => s.action === 'push'), 'then push');

const dirtyConflict = S.planPersonalSync({
  isPro: true, ready: true, hasSession: true,
  hasRemote: true, remoteAt: '2026-01-03T00:00:00.000Z', localAt: '2026-01-01T00:00:00.000Z',
  localDirty: true, pull: true, push: true
});
assert(dirtyConflict.conflict === 'local_dirty_and_remote_present', 'conflict flagged');

const equalSkip = S.planPersonalSync({
  isPro: true, ready: true, hasSession: true,
  hasRemote: true, remoteAt: '2026-01-01T00:00:00.000Z', localAt: '2026-01-01T00:00:00.000Z',
  localDirty: false, pull: true, push: false
});
assert(equalSkip.steps[0].action === 'skip_pull', 'skip equal');

const merged = S.mergeMatchLists(
  [{ id: 1, date: '2026-01-01', opponent: 'A', score: '1-0', minutes: 60, position: 'fwd' }],
  [
    { id: 1, date: '2026-01-01', opponent: 'A', score: '1-0', minutes: 60, position: 'fwd' },
    { id: 2, date: '2026-01-02', opponent: 'B', score: '2-0', minutes: 60, position: 'fwd' }
  ]
);
assert(merged.added === 1 && merged.skipped === 1 && merged.matches.length === 2, 'merge matches');

const bad = S.validateBackupPayload({});
assert(!bad.ok && bad.reason === 'no_data', 'validate empty');
const okBundle = S.validateBackupPayload({ version: 4, matches: [{ id: 1 }], player: { firstName: 'X' } });
assert(okBundle.ok, 'validate bundle');

// Lifecycle with memory adapters
let localAt = '';
let dirty = true;
let store = { version: 4, matches: [{ id: 10, date: '2026-01-01', opponent: 'L', score: '1-0', minutes: 60, position: 'fwd' }], player: { firstName: 'Kid' } };
let remote = { payload: { version: 4, matches: [{ id: 11, date: '2026-01-02', opponent: 'R', score: '0-0', minutes: 60, position: 'fwd' }], player: { firstName: 'Kid' } }, updatedAt: '2026-02-01T00:00:00.000Z' };

S.bind({
  ready: () => true,
  isPro: () => true,
  getSession: async () => ({ user: { id: 'u1' } }),
  readLocalAt: async () => localAt,
  writeLocalAt: async (iso) => { localAt = iso; },
  isDirty: async () => dirty,
  setDirty: async (v) => { dirty = !!v; },
  fetchRemote: async () => remote,
  applyRemote: async (payload) => {
    const m = S.mergeMatchLists(store.matches, payload.matches);
    store = Object.assign({}, store, { matches: m.matches });
  },
  exportLocal: async () => store,
  pushRemote: async (_session, payload, at) => { remote = { payload, updatedAt: at }; },
  nowIso: () => '2026-02-02T00:00:00.000Z',
  onState: () => {}
});

(async () => {
  const out = await S.runPersonalSync({ pull: true, push: true });
  assert(out.ok, 'run ok ' + JSON.stringify(out));
  assert(store.matches.length === 2, 'merged both matches');
  assert(!dirty, 'dirty cleared after push');
  assert(localAt === '2026-02-02T00:00:00.000Z', 'localAt updated');
  console.log('OK sync selftest');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
