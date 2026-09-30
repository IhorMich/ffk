/* Matchcard Auth — pure mode / snapshot helpers (no DOM / storage) */
(function (root) {
  'use strict';
  var A = root.MatchcardAuth = root.MatchcardAuth || {};

  /** @returns {'coach'|'personal'} */
  A.deriveMode = function (input) {
    var i = input || {};
    return i.isCoachPlan ? 'coach' : 'personal';
  };

  A.normalizeEmail = function (email) {
    return String(email || '').trim().toLowerCase();
  };

  /**
   * Build a JSON auth snapshot from already-resolved session facts.
   * @param {object} facts
   */
  A.buildSnapshot = function (facts) {
    var f = facts || {};
    var personalEmail = A.normalizeEmail(f.personalEmail);
    var coachEmail = A.normalizeEmail(f.coachEmail);
    var personalUserId = String(f.personalUserId || '').trim();
    var coachUserId = String(f.coachUserId || '').trim();
    var isCoachPlan = !!f.isCoachPlan;
    var isPro = !!f.isPro;
    var isCoachSub = !!f.isCoachSub;
    var mode = A.deriveMode({ isCoachPlan: isCoachPlan });

    var personal = personalEmail
      ? { email: personalEmail, userId: personalUserId || null }
      : null;
    var coach = coachEmail
      ? { email: coachEmail, userId: coachUserId || null }
      : null;

    return {
      mode: mode,
      personal: personal,
      coach: coach,
      isPro: isPro,
      isCoachPlan: isCoachPlan,
      isCoachSub: isCoachSub,
      signedIn: !!(personal || coach),
      showPersonalLogin: !personal,
      canSignOut: !!(personal || coach),
      canEnterCoach: !!(coach || isCoachSub),
      canEnterPersonal: true,
      sameEmail: !!(personal && coach && personal.email === coach.email)
    };
  };

  /**
   * Decide what signOutAll should clear.
   * Default: clear every present session (+ related plan flags).
   */
  A.planSignOut = function (snapshot, options) {
    var snap = snapshot || {};
    var opts = options || {};
    var personal = opts.personal;
    var coach = opts.coach;
    if (personal == null) personal = !!(snap.personal);
    if (coach == null) coach = !!(snap.coach);
    return {
      personal: !!personal,
      coach: !!coach,
      clearPro: !!personal && (opts.clearPro !== false),
      clearCoachPlan: !!coach && (opts.clearCoachPlan !== false)
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
