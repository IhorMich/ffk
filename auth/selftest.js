#!/usr/bin/env node
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
['modes.js', 'lifecycle.js', 'engine.js'].forEach(f => require(path.join(root, 'auth', f)));
const A = global.MatchcardAuth;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}

const signedOut = A.buildSnapshot({});
assert(signedOut.mode === 'personal', 'default mode personal');
assert(!signedOut.signedIn, 'signed out');
assert(signedOut.showPersonalLogin, 'show login');

const both = A.buildSnapshot({
  personalEmail: 'a@b.c',
  personalUserId: 'u1',
  coachEmail: 'a@b.c',
  coachUserId: 'u2',
  isCoachPlan: true,
  isPro: true,
  isCoachSub: true
});
assert(both.mode === 'coach', 'coach mode');
assert(both.sameEmail, 'same email');
assert(both.canSignOut, 'can sign out');

const plan = A.planSignOut(both, {});
assert(plan.personal && plan.coach && plan.clearPro && plan.clearCoachPlan, 'full signout plan');

const personalOnly = A.planSignOut(
  A.buildSnapshot({ personalEmail: 'x@y.z', isPro: true }),
  {}
);
assert(personalOnly.personal && !personalOnly.coach && personalOnly.clearPro, 'personal-only plan');

// Lifecycle with fake adapters
let pro = true;
let coachPlan = true;
let personalOn = true;
let coachOn = true;
A.bind({
  getPersonalSession: async () => personalOn ? { user: { email: 'p@ffk.app', id: 'p1' } } : null,
  getCoachSession: () => coachOn ? { email: 'c@ffk.app', userId: 'c1' } : null,
  getIsCoachPlan: () => coachPlan,
  getIsPro: () => pro,
  getIsCoachSub: () => true,
  signOutPersonal: async () => { personalOn = false; },
  signOutCoach: async () => { coachOn = false; },
  clearPro: async () => { pro = false; },
  setCoachPlan: async (on) => { coachPlan = !!on; }
});

(async () => {
  const before = await A.snapshot();
  assert(before.personal && before.coach && before.mode === 'coach', 'bound snapshot');
  const out = await A.signOutAll();
  assert(out.ok, 'signOut ok');
  assert(!out.snapshot.personal && !out.snapshot.coach, 'cleared sessions');
  assert(!out.snapshot.isPro && !out.snapshot.isCoachPlan, 'cleared flags');

  personalOn = true;
  coachOn = true;
  pro = true;
  coachPlan = false;
  const mode = await A.setMode('coach');
  assert(mode.ok && mode.snapshot.mode === 'coach', 'setMode coach');
  // setMode must not destroy sessions
  assert(mode.snapshot.personal && mode.snapshot.coach, 'sessions kept');

  console.log('OK auth selftest');
})().catch(e => {
  console.error('FAIL', e);
  process.exit(1);
});
