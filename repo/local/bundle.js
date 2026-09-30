/* Matchcard LocalRepo — backup bundle helpers */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};

  /**
   * Build export bundle from already-normalized in-memory snapshots.
   * Persistence layer does not call DOM/globals.
   */
  R.buildExportBundle = function (input) {
    var i = input || {};
    var players = Array.isArray(i.players) ? i.players : [];
    return {
      version: (root.MatchcardData && MatchcardData.BACKUP_VERSION) || 4,
      exportedAt: new Date().toISOString(),
      currentId: String(i.currentId || ''),
      player: i.player || null,
      players: players,
      settings: i.settings || {},
      matches: Array.isArray(i.matches) ? i.matches : []
    };
  };

  R.readAllPlayerSnapshots = function () {
    var ids = R.listPlayerIds();
    return ids.map(function (id) {
      var player = R.getPlayer(id) || { id: id };
      var matches = R.getMatches(id);
      return { player: player, matches: matches };
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
