/* Matchcard Sync — pure match-list merge helpers */
(function (root) {
  'use strict';
  var S = root.MatchcardSync = root.MatchcardSync || {};

  S.matchFingerprint = function (m) {
    if (!m || typeof m !== 'object') return '';
    return [
      String(m.date || ''),
      String(m.opponent || '').trim().toLowerCase(),
      String(m.score || '').trim(),
      String(m.minutes || ''),
      String(m.position || m.pitchPos || '')
    ].join('|');
  };

  S.stableMatchId = function (m) {
    var n = Number(m && m.id);
    if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
    return '';
  };

  /**
   * Merge remote matches into local without duplicates (by id or fingerprint).
   * Does not mutate inputs. Returns { matches, added, skipped }.
   */
  S.mergeMatchLists = function (localList, remoteList) {
    var local = Array.isArray(localList) ? localList.slice() : [];
    var remote = Array.isArray(remoteList) ? remoteList : [];
    var ids = {};
    var fingers = {};
    local.forEach(function (m) {
      var id = S.stableMatchId(m);
      if (id) ids[id] = true;
      var f = S.matchFingerprint(m);
      if (f) fingers[f] = true;
    });
    var added = 0;
    var skipped = 0;
    var stamp = Date.now();
    remote.forEach(function (raw) {
      if (!raw || typeof raw !== 'object') return;
      var id = S.stableMatchId(raw);
      var finger = S.matchFingerprint(raw);
      if (id && ids[id]) { skipped++; return; }
      if (finger && fingers[finger]) { skipped++; return; }
      var row = Object.assign({}, raw);
      if (!id || ids[String(row.id)]) {
        while (ids[String(stamp)]) stamp += 1;
        row.id = stamp++;
        id = String(row.id);
      }
      local.push(row);
      if (id) ids[id] = true;
      if (finger) fingers[finger] = true;
      added++;
    });
    return { matches: local, added: added, skipped: skipped };
  };

  /**
   * Validate minimal personal backup shape.
   */
  S.validateBackupPayload = function (payload) {
    if (payload == null) return { ok: false, reason: 'empty' };
    if (Array.isArray(payload)) {
      return { ok: true, kind: 'matches_array', matchCount: payload.length };
    }
    if (typeof payload !== 'object') return { ok: false, reason: 'not_object' };
    var version = Number(payload.version) || 0;
    var matches = Array.isArray(payload.matches) ? payload.matches.length : 0;
    var players = Array.isArray(payload.players) ? payload.players.length : 0;
    if (!matches && !players && !payload.player) {
      return { ok: false, reason: 'no_data', version: version };
    }
    return { ok: true, kind: 'bundle', version: version, matchCount: matches, playerCount: players };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
