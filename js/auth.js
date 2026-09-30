/**
 * Wire MatchcardAuth to live ParentCloud / CoachStore / settings.
 * Load after parent-cloud + coach-store + settings helpers exist.
 */
(function () {
  'use strict';
  var A = typeof MatchcardAuth !== 'undefined' ? MatchcardAuth : null;
  if (!A || typeof A.bind !== 'function') {
    console.error('MatchcardAuth missing — load auth/*.js before js/auth.js');
    return;
  }

  function bindLive() {
    A.bind({
      getPersonalSession: async function () {
        if (!window.ParentCloud || typeof window.ParentCloud.getSession !== 'function') return null;
        if (window.ParentCloud.ready && !window.ParentCloud.ready()) return null;
        try { return await window.ParentCloud.getSession(); } catch (e) { return null; }
      },
      getCoachSession: function () {
        try {
          return window.CoachStore && window.CoachStore.getSession
            ? window.CoachStore.getSession()
            : null;
        } catch (e) { return null; }
      },
      getIsCoachPlan: function () {
        return typeof isCoachPlan === 'function' ? !!isCoachPlan() : !!(window.settings && window.settings.isCoach);
      },
      getIsPro: function () {
        return typeof isPro === 'function' ? !!isPro() : !!(window.settings && window.settings.isPro);
      },
      getIsCoachSub: function () {
        return typeof isCoachSub === 'function' ? !!isCoachSub() : !!(window.settings && window.settings.coachSub);
      },
      signOutPersonal: async function () {
        if (window.ParentCloud && typeof window.ParentCloud.signOut === 'function') {
          await window.ParentCloud.signOut();
        }
      },
      signOutCoach: async function () {
        if (window.CoachStore && typeof window.CoachStore.signOut === 'function') {
          var out = window.CoachStore.signOut();
          if (out && typeof out.then === 'function') await out;
        }
      },
      clearPro: async function () {
        if (typeof isPro === 'function' && isPro()) {
          if (window.settings) window.settings.isPro = false;
          if (typeof saveSettings === 'function') saveSettings();
          if (typeof syncProUi === 'function') syncProUi();
        }
      },
      setCoachPlan: async function (on) {
        if (typeof setCoachPlan === 'function') setCoachPlan(!!on);
      }
    });
  }

  bindLive();
  window.MatchcardAuth = A;
  window.bindMatchcardAuth = bindLive;
})();
