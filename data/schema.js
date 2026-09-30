/* Matchcard Data — schema constants for local integrity */
(function (root) {
  'use strict';
  var D = root.MatchcardData = root.MatchcardData || {};

  D.BACKUP_VERSION = 4;
  D.MAX_PLAYERS = 32;
  D.FREE_MAX_PLAYERS = 1;
  D.ROLE_CODES = ['gk', 'def', 'mid', 'fwd'];
  D.KINDS = ['league', 'friendly', 'cup', 'tournament'];
  D.VENUES = ['home', 'away'];
  D.ROLES = ['start', 'sub'];

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof globalThis !== 'undefined' ? globalThis : this);
