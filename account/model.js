/* Matchcard Account — unified Free/Pro/Coach account model */
(function (root) {
  'use strict';
  var A = root.MatchcardAccount = root.MatchcardAccount || {};

  /**
   * Build Account JSON from identity + plan flags.
   * Does not touch DOM/storage.
   *
   * @param {object} input
   * @param {object|null} [input.personal] {email, userId}
   * @param {object|null} [input.coach] {email, userId}
   * @param {boolean} [input.isPro]
   * @param {boolean} [input.isCoachPlan]
   * @param {boolean} [input.isCoachSub]
   * @param {'personal'|'coach'} [input.mode]
   */
  A.buildAccount = function (input) {
    var i = input || {};
    var isPro = !!i.isPro;
    var isCoachPlan = !!i.isCoachPlan;
    var isCoachSub = !!i.isCoachSub;
    var personal = i.personal && typeof i.personal === 'object' ? i.personal : null;
    var coach = i.coach && typeof i.coach === 'object' ? i.coach : null;
    if (personal && !personal.email) personal = null;
    if (coach && !coach.email) coach = null;

    var mode = i.mode || (isCoachPlan ? 'coach' : 'personal');
    if (mode !== 'coach') mode = 'personal';

    var entitlements = A.deriveEntitlements({
      isPro: isPro,
      isCoachSub: isCoachSub,
      isCoachPlan: isCoachPlan
    });

    var gates = {
      canPersonalBackup: A.canPersonalBackup(entitlements),
      canUnlimitedSeasons: !!entitlements.unlimitedSeasons,
      canCharts: !!entitlements.charts,
      canEnterCoach: !!(coach || isCoachSub),
      canEnterPersonal: true,
      canSignOut: !!(personal || coach),
      canAddPlayer: function (count) {
        return A.canAddPlayer(entitlements, count);
      }
    };

    return {
      mode: mode,
      product: entitlements.product,
      personal: personal,
      coach: coach,
      entitlements: entitlements,
      gates: gates,
      isPro: isPro,
      isCoachPlan: isCoachPlan,
      isCoachSub: isCoachSub,
      playerCap: entitlements.maxPlayers,
      signedIn: !!(personal || coach),
      showPersonalLogin: !personal,
      sameEmail: !!(personal && coach && String(personal.email).toLowerCase() === String(coach.email).toLowerCase())
    };
  };

  /** Merge Auth snapshot (+ optional extra flags) into Account. */
  A.fromAuthSnapshot = function (authSnap, extra) {
    var s = authSnap || {};
    var x = extra || {};
    return A.buildAccount({
      mode: s.mode,
      personal: s.personal || null,
      coach: s.coach || null,
      isPro: x.isPro != null ? !!x.isPro : !!s.isPro,
      isCoachPlan: x.isCoachPlan != null ? !!x.isCoachPlan : !!s.isCoachPlan,
      isCoachSub: x.isCoachSub != null ? !!x.isCoachSub : !!s.isCoachSub
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
