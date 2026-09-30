/* Matchcard LocalRepo — match lists per player */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};

  R.parseMatchListRaw = function (raw) {
    try {
      var parsed = raw ? JSON.parse(raw) : [];
      var list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.matches) ? parsed.matches : []);
      return list;
    } catch (e) {
      return [];
    }
  };

  R.getMatches = function (playerId, opts) {
    var sid = String(playerId || '');
    var list = [];
    if (sid) {
      list = R.parseMatchListRaw(R.kvGet(R.matchesKey(sid)));
    }
    var allowLegacy = !opts || opts.allowLegacy !== false;
    if (allowLegacy && (!list || !list.length)) {
      var rosterIds = (R.getRoster && R.getRoster().ids) || [];
      if (rosterIds.length <= 1) {
        var legacy = R.parseMatchListRaw(R.kvGet(R.KEYS.MATCHES));
        if (!legacy.length) legacy = R.parseMatchListRaw(R.kvGet(R.KEYS.MATCHES_LEGACY));
        if (legacy.length) list = legacy;
      }
    }
    if (typeof repairMatchList === 'function') {
      list = repairMatchList(list).matches;
    }
    return list;
  };

  R.setMatches = function (playerId, matches) {
    var list = Array.isArray(matches) ? matches : [];
    if (typeof repairMatchList === 'function') list = repairMatchList(list).matches;
    var json = JSON.stringify(list);
    var ok = true;
    if (playerId) ok = R.kvSet(R.matchesKey(playerId), json) && ok;
    ok = R.kvSet(R.KEYS.MATCHES, json) && ok;
    return ok;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
