/**
 * Wire MatchcardAccount to live settings / sessions.
 * Load after auth/*.js; settings helpers may appear later (lazy getters).
 */
(function () {
  'use strict';
  var Acc = typeof MatchcardAccount !== 'undefined' ? MatchcardAccount : null;
  if (!Acc || typeof Acc.bind !== 'function') {
    console.error('MatchcardAccount missing — load account/*.js before js/account.js');
    return;
  }

  function bindLive() {
    Acc.bind({
      getIsPro: function () {
        try {
          if (typeof settings !== 'undefined' && settings) return !!settings.isPro;
          if (window.settings) return !!window.settings.isPro;
        } catch (e) {}
        return false;
      },
      getIsCoachPlan: function () {
        try {
          if (typeof settings !== 'undefined' && settings) return !!settings.isCoach;
          if (window.settings) return !!window.settings.isCoach;
        } catch (e) {}
        return false;
      },
      getIsCoachSub: function () {
        try {
          if (typeof settings !== 'undefined' && settings && settings.coachSub === true) return true;
          if (window.settings && window.settings.coachSub === true) return true;
        } catch (e) {}
        try {
          var store = window.CoachStore;
          var session = store && store.getSession && store.getSession();
          if (session && store.hasCoachSub && store.hasCoachSub(session)) return true;
        } catch (e) {}
        return false;
      },
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
      }
    });

    // Publish limits for legacy callers (coach-store / storage).
    var L = Acc.LIMITS || {};
    if (typeof window.FREE_MAX_PLAYERS !== 'number') window.FREE_MAX_PLAYERS = L.FREE_MAX_PLAYERS;
    if (typeof window.PRO_MAX_PLAYERS !== 'number') window.PRO_MAX_PLAYERS = L.PRO_MAX_PLAYERS;
    if (typeof window.COACH_MAX_ACADEMIES !== 'number') window.COACH_MAX_ACADEMIES = L.COACH_MAX_ACADEMIES;
    if (typeof window.COACH_MAX_TEAMS !== 'number') window.COACH_MAX_TEAMS = L.COACH_MAX_TEAMS;
    if (typeof window.COACH_MAX_PLAYERS_PER_TEAM !== 'number') window.COACH_MAX_PLAYERS_PER_TEAM = L.COACH_MAX_PLAYERS_PER_TEAM;
    if (typeof window.COACH_MAX_ASSISTANTS !== 'number') window.COACH_MAX_ASSISTANTS = L.COACH_MAX_ASSISTANTS;
  }

  bindLive();
  window.MatchcardAccount = Acc;
  window.bindMatchcardAccount = bindLive;
})();
