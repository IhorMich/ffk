/* Matchcard Auth — lifecycle over injectable adapters */
(function (root) {
  'use strict';
  var A = root.MatchcardAuth = root.MatchcardAuth || {};
  var adapters = null;
  var listeners = [];

  function ad() {
    return adapters || {};
  }

  function safeCall(fn, args) {
    if (typeof fn !== 'function') return Promise.resolve(null);
    try {
      var out = fn.apply(null, args || []);
      return Promise.resolve(out);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  A.bind = function (next) {
    adapters = next || null;
    return A;
  };

  A.onChange = function (fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
    };
  };

  A.emitChange = function (snapshot) {
    listeners.slice().forEach(function (fn) {
      try { fn(snapshot); } catch (e) {}
    });
  };

  A.readFacts = async function () {
    var a = ad();
    var personalSession = null;
    try {
      personalSession = await safeCall(a.getPersonalSession);
    } catch (e) {
      personalSession = null;
    }
    var coachSession = null;
    try {
      coachSession = a.getCoachSession ? a.getCoachSession() : null;
    } catch (e) {
      coachSession = null;
    }
    var personalEmail = '';
    var personalUserId = '';
    if (personalSession && personalSession.user) {
      personalEmail = personalSession.user.email || '';
      personalUserId = personalSession.user.id || '';
    }
    return {
      personalEmail: personalEmail,
      personalUserId: personalUserId,
      coachEmail: (coachSession && coachSession.email) || '',
      coachUserId: (coachSession && coachSession.userId) || '',
      isCoachPlan: !!(a.getIsCoachPlan && a.getIsCoachPlan()),
      isPro: !!(a.getIsPro && a.getIsPro()),
      isCoachSub: !!(a.getIsCoachSub && a.getIsCoachSub())
    };
  };

  /**
   * @returns {Promise<object>} JSON auth snapshot
   */
  A.snapshot = async function () {
    var facts = await A.readFacts();
    return A.buildSnapshot(facts);
  };

  /**
   * Sign out personal and/or coach via adapters.
   * Never touches DOM. Adapters decide storage/cloud details.
   */
  A.signOutAll = async function (options) {
    var snap = await A.snapshot();
    var plan = A.planSignOut(snap, options);
    var a = ad();
    var errors = [];

    if (plan.personal) {
      try {
        await safeCall(a.signOutPersonal);
      } catch (e) {
        errors.push({ scope: 'personal', error: String((e && e.message) || e || 'signout') });
      }
      if (plan.clearPro) {
        try { await safeCall(a.clearPro); } catch (e) {
          errors.push({ scope: 'pro', error: String((e && e.message) || e || 'clear_pro') });
        }
      }
    }

    if (plan.coach) {
      try {
        await safeCall(a.signOutCoach);
      } catch (e) {
        errors.push({ scope: 'coach', error: String((e && e.message) || e || 'signout') });
      }
      if (plan.clearCoachPlan) {
        try { await safeCall(a.setCoachPlan, [false]); } catch (e) {
          errors.push({ scope: 'coach_plan', error: String((e && e.message) || e || 'plan') });
        }
      }
    }

    var next = await A.snapshot();
    A.emitChange(next);
    return { ok: !errors.length, plan: plan, snapshot: next, errors: errors };
  };

  /** Switch UI product mode without destroying the other product's session. */
  A.setMode = async function (mode) {
    var wantCoach = mode === 'coach';
    var a = ad();
    try {
      await safeCall(a.setCoachPlan, [wantCoach]);
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e || 'mode') };
    }
    var next = await A.snapshot();
    A.emitChange(next);
    return { ok: true, snapshot: next };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
