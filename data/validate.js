/* Matchcard Data — pure validators (no DOM / storage) */
(function (root) {
  'use strict';
  var D = root.MatchcardData = root.MatchcardData || {};

  function issue(code, path, detail) {
    return { code: code, path: path || '', detail: detail || '' };
  }

  D.validateRoster = function (roster) {
    var issues = [];
    if (!roster || typeof roster !== 'object') {
      return { ok: false, issues: [issue('roster_missing', 'roster')] };
    }
    var ids = Array.isArray(roster.ids) ? roster.ids.map(String).filter(Boolean) : [];
    if (!ids.length) issues.push(issue('roster_empty', 'roster.ids'));
    if (ids.length > D.MAX_PLAYERS) {
      issues.push(issue('roster_too_many', 'roster.ids', String(ids.length)));
    }
    var uniq = {};
    ids.forEach(function (id) {
      if (uniq[id]) issues.push(issue('roster_dup_id', 'roster.ids', id));
      uniq[id] = true;
    });
    var current = String(roster.currentId || '');
    if (current && ids.length && ids.indexOf(current) === -1) {
      issues.push(issue('roster_current_orphan', 'roster.currentId', current));
    }
    if (!current && ids.length) {
      issues.push(issue('roster_current_missing', 'roster.currentId'));
    }
    return { ok: issues.length === 0, issues: issues, ids: ids, currentId: current };
  };

  D.validatePlayer = function (player, idHint) {
    var issues = [];
    if (!player || typeof player !== 'object') {
      return { ok: false, issues: [issue('player_missing', 'player')] };
    }
    var id = String(player.id || idHint || '');
    if (!id) issues.push(issue('player_id_missing', 'player.id'));
    if (String(player.firstName || '').length > 24) issues.push(issue('player_first_long', 'player.firstName'));
    if (String(player.lastName || '').length > 32) issues.push(issue('player_last_long', 'player.lastName'));
    var birth = String(player.birthDate || '');
    if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
      issues.push(issue('player_birth_bad', 'player.birthDate', birth));
    }
    return { ok: issues.length === 0, issues: issues, id: id };
  };

  D.validateMatch = function (match, index) {
    var issues = [];
    var path = 'matches[' + (index == null ? '?' : index) + ']';
    if (!match || typeof match !== 'object') {
      return { ok: false, issues: [issue('match_missing', path)] };
    }
    var id = Number(match.id);
    if (!(Number.isFinite(id) && id > 0)) issues.push(issue('match_id_bad', path + '.id'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(match.date || ''))) {
      issues.push(issue('match_date_bad', path + '.date', String(match.date || '')));
    }
    if (match.kind && D.KINDS.indexOf(match.kind) === -1) {
      issues.push(issue('match_kind_bad', path + '.kind', String(match.kind)));
    }
    if (match.venue && D.VENUES.indexOf(match.venue) === -1) {
      issues.push(issue('match_venue_bad', path + '.venue', String(match.venue)));
    }
    if (match.counts && typeof match.counts !== 'object') {
      issues.push(issue('match_counts_bad', path + '.counts'));
    }
    if (match.behaviors && typeof match.behaviors !== 'object') {
      issues.push(issue('match_behaviors_bad', path + '.behaviors'));
    }
    var rating = Number(match.rating);
    if (match.rating != null && !(rating >= 0 && rating <= 10)) {
      issues.push(issue('match_rating_bad', path + '.rating', String(match.rating)));
    }
    return { ok: issues.length === 0, issues: issues, id: Number.isFinite(id) ? String(Math.floor(id)) : '' };
  };

  D.validateMatchList = function (list) {
    var issues = [];
    var arr = Array.isArray(list) ? list : [];
    var ids = {};
    arr.forEach(function (m, i) {
      var v = D.validateMatch(m, i);
      issues = issues.concat(v.issues);
      if (v.id) {
        if (ids[v.id]) issues.push(issue('match_dup_id', 'matches', v.id));
        ids[v.id] = true;
      }
    });
    return { ok: issues.length === 0, issues: issues, count: arr.length };
  };

  D.validateBackupPayload = function (payload) {
    var issues = [];
    if (payload == null) return { ok: false, issues: [issue('backup_empty', '')] };
    if (Array.isArray(payload)) {
      var ml = D.validateMatchList(payload);
      return { ok: ml.ok, issues: ml.issues, kind: 'matches_array', version: 0 };
    }
    if (typeof payload !== 'object') {
      return { ok: false, issues: [issue('backup_not_object', '')] };
    }
    var version = Number(payload.version) || 0;
    if (version && version > D.BACKUP_VERSION) {
      issues.push(issue('backup_version_future', 'version', String(version)));
    }
    if (payload.players && !Array.isArray(payload.players)) {
      issues.push(issue('backup_players_bad', 'players'));
    }
    if (payload.matches && !Array.isArray(payload.matches)) {
      issues.push(issue('backup_matches_bad', 'matches'));
    }
    if (Array.isArray(payload.matches)) {
      issues = issues.concat(D.validateMatchList(payload.matches).issues);
    }
    var hasData = !!(
      (Array.isArray(payload.matches) && payload.matches.length) ||
      (Array.isArray(payload.players) && payload.players.length) ||
      payload.player
    );
    if (!hasData) issues.push(issue('backup_no_data', ''));
    return { ok: issues.length === 0, issues: issues, kind: 'bundle', version: version };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof globalThis !== 'undefined' ? globalThis : this);
