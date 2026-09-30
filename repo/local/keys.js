/* Matchcard LocalRepo — storage key names */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};
  R.KEYS = {
    MATCHES: 'ffk_matches_v2',
    MATCHES_LEGACY: 'football_matches',
    DRAFT: 'ffk_draft',
    VIEW: 'ffk_view',
    EXPORT: 'ffk_last_export',
    SETTINGS: 'ffk_settings',
    FILTER: 'ffk_filters_v1',
    PLAYER: 'ffk_player_v1',
    ROSTER: 'ffk_roster_v1'
  };
  R.playerKey = function (id) { return 'ffk_kid_' + String(id || ''); };
  R.matchesKey = function (id) { return 'ffk_kid_m_' + String(id || ''); };
  R.draftKey = function (id) { return R.KEYS.DRAFT + '_' + String(id || 'x'); };
  R.coachMediaKey = function (id) { return 'coach:' + String(id || ''); };
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
