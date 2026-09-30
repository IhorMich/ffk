/* Matchcard Data — migrate + repair pure helpers */
(function (root) {
  'use strict';
  var D = root.MatchcardData = root.MatchcardData || {};

  /** Normalize older backup shapes toward BACKUP_VERSION. */
  D.migrateBackupPayload = function (payload) {
    if (payload == null) return { ok: false, reason: 'empty', payload: null };
    if (Array.isArray(payload)) {
      return {
        ok: true,
        from: 0,
        to: D.BACKUP_VERSION,
        payload: {
          version: D.BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          currentId: '',
          players: [],
          matches: payload.slice(),
          settings: {}
        }
      };
    }
    if (typeof payload !== 'object') return { ok: false, reason: 'not_object', payload: null };
    var from = Number(payload.version) || 0;
    var next = Object.assign({}, payload);
    if (!next.version) next.version = D.BACKUP_VERSION;
    if (!Array.isArray(next.matches)) next.matches = [];
    if (!Array.isArray(next.players) && next.player) {
      next.players = [{ player: next.player, matches: next.matches.slice() }];
    }
    if (!Array.isArray(next.players)) next.players = [];
    if (!next.settings || typeof next.settings !== 'object') next.settings = {};
    next.version = D.BACKUP_VERSION;
    return { ok: true, from: from, to: D.BACKUP_VERSION, payload: next };
  };

  /** Repair roster object in memory. */
  D.repairRoster = function (roster, maxPlayers) {
    var max = Math.max(1, Number(maxPlayers) || D.MAX_PLAYERS);
    var ids = [];
    var seen = {};
    (roster && Array.isArray(roster.ids) ? roster.ids : []).forEach(function (id) {
      var sid = String(id || '');
      if (!sid || seen[sid]) return;
      seen[sid] = true;
      ids.push(sid);
    });
    if (ids.length > max) ids = ids.slice(0, max);
    var currentId = String((roster && roster.currentId) || '');
    if (!currentId || ids.indexOf(currentId) === -1) currentId = ids[0] || '';
    return {
      roster: { currentId: currentId, ids: ids },
      changed: !roster ||
        String(roster.currentId || '') !== currentId ||
        JSON.stringify(roster.ids || []) !== JSON.stringify(ids)
    };
  };

  /** Deduplicate matches by stable id (keep first). */
  D.repairMatchList = function (list) {
    var out = [];
    var seen = {};
    var removed = 0;
    (Array.isArray(list) ? list : []).forEach(function (m) {
      if (!m || typeof m !== 'object') { removed++; return; }
      var id = Number(m.id);
      var key = (Number.isFinite(id) && id > 0) ? String(Math.floor(id)) : '';
      if (key) {
        if (seen[key]) { removed++; return; }
        seen[key] = true;
      }
      out.push(m);
    });
    return { matches: out, removed: removed, changed: removed > 0 };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof globalThis !== 'undefined' ? globalThis : this);
