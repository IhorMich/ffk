/* Matchcard LocalRepo — roster + player records */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};

  R.getRoster = function () {
    var raw = R.getJson(R.KEYS.ROSTER, null);
    if (!raw || typeof raw !== 'object') return { currentId: '', ids: [] };
    var ids = Array.isArray(raw.ids) ? raw.ids.map(String).filter(Boolean) : [];
    if (typeof repairRoster === 'function') {
      return repairRoster({ currentId: raw.currentId, ids: ids }, 32).roster;
    }
    var currentId = String(raw.currentId || '');
    if (currentId && ids.indexOf(currentId) === -1) currentId = ids[0] || '';
    if (!currentId && ids.length) currentId = ids[0];
    return { currentId: currentId, ids: ids };
  };

  R.setRoster = function (roster) {
    var next = roster && typeof roster === 'object'
      ? { currentId: String(roster.currentId || ''), ids: Array.isArray(roster.ids) ? roster.ids.map(String).filter(Boolean) : [] }
      : { currentId: '', ids: [] };
    if (typeof repairRoster === 'function') next = repairRoster(next, 32).roster;
    return R.setJson(R.KEYS.ROSTER, next);
  };

  R.listPlayerIds = function () {
    var ids = R.getRoster().ids.slice();
    var seen = {};
    ids.forEach(function (id) { seen[id] = true; });
    R.kvKeys().forEach(function (k) {
      if (!k || k.indexOf('ffk_kid_') !== 0 || k.indexOf('ffk_kid_m_') === 0) return;
      var id = k.slice('ffk_kid_'.length);
      if (id && !seen[id]) {
        seen[id] = true;
        ids.push(id);
      }
    });
    return ids;
  };

  R.getPlayer = function (id, opts) {
    var sid = String(id || '');
    if (!sid) return null;
    var raw = R.getJson(R.playerKey(sid), null);
    if (!raw || typeof raw !== 'object') return null;
    var row = Object.assign({}, raw, { id: sid });
    if (opts && opts.rawLs) return row;
    var media = R.getMediaCached(sid);
    if (media) {
      row.photo = media.photo || '';
      row.cover = media.cover || '';
    }
    return row;
  };

  R.setPlayer = function (id, player) {
    var sid = String(id || (player && player.id) || '');
    if (!sid) return false;
    var row = Object.assign({}, player || {}, { id: sid });
    var photo = row.photo || '';
    var cover = row.cover || '';
    R.putMedia(sid, photo, cover);
    return R.setJson(R.playerKey(sid), R.playerRecordForLs(row));
  };

  R.deletePlayer = function (id) {
    var sid = String(id || '');
    if (!sid) return;
    R.kvRemove(R.playerKey(sid));
    R.kvRemove(R.matchesKey(sid));
    R.deleteMedia(sid);
  };

  R.setActivePlayerMirror = function (player) {
    if (!player || !player.id) return false;
    return R.setJson(R.KEYS.PLAYER, R.playerRecordForLs(player));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
