#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', '..');
// optional repair helpers
try { require(path.join(root, 'data', 'schema.js')); require(path.join(root, 'data', 'migrate.js')); require(path.join(root, 'data', 'validate.js')); require(path.join(root, 'data', 'engine.js')); } catch (e) {}
[
  'keys.js', 'kv.js', 'media.js', 'players.js', 'matches.js', 'settings.js', 'bundle.js', 'engine.js'
].forEach(f => require(path.join(root, 'repo', 'local', f)));

const R = global.MatchcardLocalRepo;
R.resetMemoryKv();
R.clearMediaCache();

function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
}

assert(R.setRoster({ currentId: 'p1', ids: ['p1', 'p1', 'p2'] }), 'set roster');
const roster = R.getRoster();
assert(roster.ids.join(',') === 'p1,p2', 'roster dedupe ' + roster.ids);
assert(roster.currentId === 'p1', 'current');

assert(R.setPlayer('p1', { id: 'p1', firstName: 'Ada', photo: 'data:image/png;base64,' + 'x'.repeat(80) }), 'set player');
const p = R.getPlayer('p1', { rawLs: true });
assert(p.firstName === 'Ada' && p.photo === '', 'photo stripped in LS');

assert(R.setMatches('p1', [
  { id: 1, date: '2026-01-01', opponent: 'A' },
  { id: 1, date: '2026-01-02', opponent: 'dup' },
  { id: 2, date: '2026-01-03', opponent: 'B' }
]), 'set matches');
const matches = R.getMatches('p1');
assert(matches.length === 2, 'match dedupe ' + matches.length);

R.setSettings({ isPro: true, lang: 'ru' });
assert(R.getSettings().isPro === true, 'settings');

const bundle = R.buildExportBundle({
  currentId: 'p1',
  player: { id: 'p1', firstName: 'Ada' },
  players: R.readAllPlayerSnapshots(),
  matches: matches,
  settings: R.getSettings()
});
assert(bundle.version === 4 && bundle.players.length >= 1, 'bundle');

R.deletePlayer('p2');
assert(!R.getPlayer('p2'), 'deleted');

console.log('OK local repo selftest');
