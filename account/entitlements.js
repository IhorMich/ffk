/* Matchcard Account — derive entitlements from plan flags */
(function (root) {
  'use strict';
  var A = root.MatchcardAccount = root.MatchcardAccount || {};

  /**
   * @param {{isPro?:boolean, isCoachSub?:boolean, isCoachPlan?:boolean}} flags
   */
  A.deriveEntitlements = function (flags) {
    var f = flags || {};
    var pro = !!f.isPro;
    var coachSub = !!f.isCoachSub;
    var L = A.LIMITS || {};
    return {
      product: pro ? A.PRODUCT.PRO : A.PRODUCT.FREE,
      pro: pro,
      coachSub: coachSub,
      maxPlayers: pro
        ? (L.PRO_MAX_PLAYERS || 32)
        : (L.FREE_MAX_PLAYERS || 1),
      personalBackup: pro,
      unlimitedSeasons: pro,
      charts: pro,
      coachMaxAcademies: L.COACH_MAX_ACADEMIES || 1,
      coachMaxTeams: L.COACH_MAX_TEAMS || 10,
      coachMaxPlayersPerTeam: L.COACH_MAX_PLAYERS_PER_TEAM || 50,
      coachMaxAssistants: L.COACH_MAX_ASSISTANTS || 5
    };
  };

  A.canAddPlayer = function (entitlements, currentCount) {
    var e = entitlements || A.deriveEntitlements({});
    var n = Number(currentCount) || 0;
    return n < (e.maxPlayers || 1);
  };

  A.canPersonalBackup = function (entitlements) {
    var e = entitlements || {};
    return !!e.personalBackup;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
