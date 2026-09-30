#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', '..');
[
  path.join(root, 'repo', 'local', 'keys.js'),
  path.join(root, 'repo', 'local', 'kv.js'),
  path.join(root, 'repo', 'local', 'engine.js'),
  path.join(root, 'sync', 'plan.js'),
  path.join(root, 'sync', 'merge.js'),
  path.join(root, 'sync', 'lifecycle.js'),
  path.join(root, 'sync', 'engine.js'),
  path.join(root, 'repo', 'cloud', 'keys.js'),
  path.join(root, 'repo', 'cloud', 'meta.js'),
  path.join(root, 'repo', 'cloud', 'client.js'),
  path.join(root, 'repo', 'cloud', 'personal.js'),
  path.join(root, 'repo', 'cloud', 'adapters.js'),
  path.join(root, 'repo', 'cloud', 'engine.js')
].forEach(f => require(f));

const C = global.MatchcardCloudRepo;
const S = global.MatchcardSync;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
}

(async () => {
  C.resetMemoryMeta();
  C.resetConfig();

  const remoteStore = Object.create(null);
  C.configure({
    ready: () => true,
    isPro: () => true,
    getSession: async () => ({ user: { id: 'u-cloud' } }),
    getClient: () => null
  });
  C.useTransport({
    fetchPersonal: async (uid) => remoteStore[uid] || null,
    pushPersonal: async (uid, payload, at) => {
      remoteStore[uid] = { payload, updatedAt: at };
    }
  });

  assert(!C.isDirty(), 'clean start');
  C.markPersonalDirty();
  assert(C.isDirty(), 'dirty set');

  const session = { user: { id: 'u-cloud' } };
  const empty = await C.fetchPersonalBackup(session);
  assert(empty === null, 'empty remote');

  const pushed = await C.pushPersonalBackup(session, {
    version: 4,
    matches: [{ id: 1, date: '2026-01-01', opponent: 'A', minutes: 60, position: 'fwd' }],
    player: { firstName: 'Ada' }
  }, '2026-03-01T00:00:00.000Z');
  assert(pushed.ok && pushed.at === '2026-03-01T00:00:00.000Z', 'push ok');
  assert(!C.isDirty(), 'dirty cleared on push');
  assert(C.readLocalSyncAt() === '2026-03-01T00:00:00.000Z', 'sync at');

  const fetched = await C.fetchPersonalBackup(session);
  assert(fetched && fetched.payload.player.firstName === 'Ada', 'fetch payload');

  let local = {
    version: 4,
    matches: [{ id: 2, date: '2026-01-02', opponent: 'B', minutes: 60, position: 'fwd' }],
    player: { firstName: 'Ada' }
  };
  C.writeLocalSyncAt('2026-02-01T00:00:00.000Z');
  C.setDirty(false);

  S.bind(C.buildSyncAdapters({
    exportLocal: () => local,
    applyRemote: (payload) => {
      const m = S.mergeMatchLists(local.matches, payload.matches || []);
      local = Object.assign({}, local, { matches: m.matches });
    },
    nowIso: () => '2026-03-02T00:00:00.000Z',
    onState: () => {}
  }));

  const out = await S.runPersonalSync({ pull: true, push: true });
  assert(out.ok, 'sync run ' + JSON.stringify(out && out.reason));
  assert(local.matches.length === 2, 'merged matches ' + local.matches.length);
  assert(C.readLocalSyncAt() === '2026-03-02T00:00:00.000Z', 'sync at after engine');
  assert(!C.isDirty(), 'clean after sync');

  console.log('OK cloud repo selftest');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
