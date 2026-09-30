/* Matchcard Account — live adapters + snapshot */
(function (root) {
  'use strict';
  var A = root.MatchcardAccount = root.MatchcardAccount || {};
  var adapters = null;

  function ad() { return adapters || {}; }

  function safeCall(fn, args) {
    if (typeof fn !== 'function') return Promise.resolve(null);
    try {
      return Promise.resolve(fn.apply(null, args || []));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  A.bind = function (next) {
    adapters = next || null;
    return A;
  };

  A.readLiveFlags = function () {
    var a = ad();
    return {
      isPro: !!(a.getIsPro && a.getIsPro()),
      isCoachPlan: !!(a.getIsCoachPlan && a.getIsCoachPlan()),
      isCoachSub: !!(a.getIsCoachSub && a.getIsCoachSub())
    };
  };

  A.isPro = function () { return A.readLiveFlags().isPro; };
  A.isCoachPlan = function () { return A.readLiveFlags().isCoachPlan; };
  A.isCoachSub = function () { return A.readLiveFlags().isCoachSub; };
  A.playerCap = function () {
    return A.deriveEntitlements(A.readLiveFlags()).maxPlayers;
  };
  A.canSyncPersonal = function () {
    return A.canPersonalBackup(A.deriveEntitlements(A.readLiveFlags()));
  };

  /**
   * Live Account from bound adapters (settings flags + sessions).
   * Use fromAuthSnapshot() when you already have a MatchcardAuth snapshot.
   */
  A.snapshot = async function () {
    var flags = A.readLiveFlags();
    var a = ad();
    var personal = null;
    var coach = null;
    try {
      var session = await safeCall(a.getPersonalSession);
      if (session && session.user && session.user.email) {
        personal = {
          email: String(session.user.email).toLowerCase(),
          userId: session.user.id || null
        };
      }
    } catch (e) {}
    try {
      var cs = a.getCoachSession ? a.getCoachSession() : null;
      if (cs && cs.email) {
        coach = { email: String(cs.email).toLowerCase(), userId: cs.userId || null };
      }
    } catch (e) {}

    // Fallback: Auth snapshot when Account has no session adapters wired yet.
    if (!personal && !coach && root.MatchcardAuth && typeof root.MatchcardAuth.snapshot === 'function') {
      try {
        var authSnap = await root.MatchcardAuth.snapshot();
        if (authSnap && (authSnap.personal || authSnap.coach)) {
          return A.fromAuthSnapshot(authSnap, flags);
        }
      } catch (e) {}
    }

    return A.buildAccount({
      personal: personal,
      coach: coach,
      isPro: flags.isPro,
      isCoachPlan: flags.isCoachPlan,
      isCoachSub: flags.isCoachSub
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
