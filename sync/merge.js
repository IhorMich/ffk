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

  /** Count matches in a personal backup (root + nested players). */
  S.backupMatchCount = function (payload) {
    if (payload == null) return 0;
    if (Array.isArray(payload)) return payload.length;
    if (typeof payload !== 'object') return 0;
    var n = Array.isArray(payload.matches) ? payload.matches.length : 0;
    if (Array.isArray(payload.players)) {
      payload.players.forEach(function (entry) {
        if (!entry || typeof entry !== 'object') return;
        var nested = Array.isArray(entry.matches) ? entry.matches
          : (entry.player && Array.isArray(entry.player.matches) ? entry.player.matches : null);
        if (nested && nested.length > n) n = nested.length;
      });
    }
    return n;
  };

  /** True when backup embeds at least one data-url photo/cover. */
  S.backupHasMedia = function (payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    function has(p) {
      if (!p || typeof p !== 'object') return false;
      var photo = String(p.photo || '');
      var cover = String(p.cover || '');
      return (photo.indexOf('data:image/') === 0 && photo.length > 64)
        || (cover.indexOf('data:image/') === 0 && cover.length > 64);
    }
    if (has(payload.player)) return true;
    if (Array.isArray(payload.players)) {
      for (var i = 0; i < payload.players.length; i++) {
        var entry = payload.players[i];
        if (has(entry) || has(entry && entry.player)) return true;
      }
    }
    return false;
  };

  /** Copy photo/cover from richer remote into a local export that lost media. */
  S.mergeBackupMedia = function (localPayload, remotePayload) {
    if (!localPayload || typeof localPayload !== 'object' || Array.isArray(localPayload)) return localPayload;
    if (!remotePayload || typeof remotePayload !== 'object' || Array.isArray(remotePayload)) return localPayload;
    function pick(localP, remoteP) {
      var out = Object.assign({}, localP || {});
      var rp = remoteP || {};
      var photo = String(out.photo || '');
      var cover = String(out.cover || '');
      if (!(photo.indexOf('data:image/') === 0 && photo.length > 64)) {
        var rpPhoto = String(rp.photo || '');
        if (rpPhoto.indexOf('data:image/') === 0 && rpPhoto.length > 64) out.photo = rpPhoto;
      }
      if (!(cover.indexOf('data:image/') === 0 && cover.length > 64)) {
        var rpCover = String(rp.cover || '');
        if (rpCover.indexOf('data:image/') === 0 && rpCover.length > 64) out.cover = rpCover;
      }
      return out;
    }
    var next = Object.assign({}, localPayload);
    if (remotePayload.player) next.player = pick(next.player, remotePayload.player);
    if (Array.isArray(next.players) && Array.isArray(remotePayload.players) && remotePayload.players.length) {
      var remoteById = {};
      remotePayload.players.forEach(function (entry) {
        var p = entry && (entry.player || entry);
        var id = p && p.id ? String(p.id) : '';
        if (id) remoteById[id] = p;
      });
      var remoteFirst = remotePayload.players[0] && (remotePayload.players[0].player || remotePayload.players[0]);
      next.players = next.players.map(function (entry, idx) {
        var localP = entry && (entry.player || entry);
        var id = localP && localP.id ? String(localP.id) : '';
        var remoteP = (id && remoteById[id]) || (idx === 0 ? remoteFirst : null);
        var merged = pick(localP, remoteP);
        if (entry && entry.player) return Object.assign({}, entry, { player: merged });
        return merged;
      });
    }
    return next;
  };

  /** True when backup has no matches worth protecting over a richer remote. */
  S.isSparseBackup = function (payload) {
    return S.backupMatchCount(payload) === 0;
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
