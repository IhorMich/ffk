/* Matchcard Account — products + hard limits */
(function (root) {
  'use strict';
  var A = root.MatchcardAccount = root.MatchcardAccount || {};

  A.PRODUCT = {
    FREE: 'free',
    PRO: 'pro',
    COACH: 'coach'
  };

  A.LIMITS = {
    FREE_MAX_PLAYERS: 1,
    PRO_MAX_PLAYERS: 32,
    COACH_MAX_ACADEMIES: 1,
    COACH_MAX_TEAMS: 10,
    COACH_MAX_PLAYERS_PER_TEAM: 50,
    COACH_MAX_ASSISTANTS: 5
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
