#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
['products.js', 'entitlements.js', 'model.js', 'engine.js'].forEach(f => require(path.join(root, 'account', f)));
require(path.join(root, 'auth', 'modes.js'));
require(path.join(root, 'auth', 'lifecycle.js'));
require(path.join(root, 'auth', 'engine.js'));

const Acc = global.MatchcardAccount;
const Auth = global.MatchcardAuth;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); process.exit(1); }
}

assert(Acc.LIMITS.FREE_MAX_PLAYERS === 1, 'free cap');
assert(Acc.LIMITS.PRO_MAX_PLAYERS === 32, 'pro cap');

const freeE = Acc.deriveEntitlements({ isPro: false });
assert(freeE.product === 'free' && freeE.maxPlayers === 1 && freeE.personalBackup, 'free entitlements');

const proE = Acc.deriveEntitlements({ isPro: true, isCoachSub: true });
assert(proE.product === 'pro' && proE.maxPlayers === 32 && proE.personalBackup && proE.coachSub, 'pro entitlements');
assert(Acc.canAddPlayer(freeE, 0) && !Acc.canAddPlayer(freeE, 1), 'free add gate');
assert(Acc.canAddPlayer(proE, 31) && !Acc.canAddPlayer(proE, 32), 'pro add gate');

const account = Acc.buildAccount({
  personal: { email: 'a@b.c', userId: 'u1' },
  coach: { email: 'a@b.c', userId: 'c1' },
  isPro: true,
  isCoachPlan: true,
  isCoachSub: true
});
assert(account.mode === 'coach', 'mode coach');
assert(account.product === 'pro', 'product');
assert(account.gates.canPersonalBackup && account.gates.canEnterCoach, 'gates');
assert(account.sameEmail && account.playerCap === 32, 'cap + same email');
assert(account.gates.canAddPlayer(1), 'gate fn');

const fromAuth = Acc.fromAuthSnapshot(Auth.buildSnapshot({
  personalEmail: 'x@y.z',
  personalUserId: 'p1',
  isPro: false,
  isCoachPlan: false,
  isCoachSub: false
}));
assert(fromAuth.product === 'free' && fromAuth.personal.email === 'x@y.z', 'from auth');

let pro = true;
Acc.bind({
  getIsPro: () => pro,
  getIsCoachPlan: () => false,
  getIsCoachSub: () => false,
  getPersonalSession: async () => ({ user: { email: 'live@ffk.app', id: 'L1' } }),
  getCoachSession: () => null
});
assert(Acc.isPro() && Acc.playerCap() === 32 && Acc.canSyncPersonal(), 'live pro');
pro = false;
assert(!Acc.isPro() && Acc.playerCap() === 1 && Acc.canSyncPersonal(), 'live free');

(async () => {
  const snap = await Acc.snapshot();
  assert(snap.personal && snap.personal.email === 'live@ffk.app', 'snapshot personal');
  assert(snap.product === 'free', 'snapshot product');
  console.log('OK account selftest');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
