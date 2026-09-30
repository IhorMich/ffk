/* Matchcard CloudRepo — local sync_at / dirty flags */
(function (root) {
  'use strict';
  var R = root.MatchcardCloudRepo = root.MatchcardCloudRepo || {};
  var mem = Object.create(null);

  function kvGet(key) {
    try {
      if (root.MatchcardLocalRepo && typeof root.MatchcardLocalRepo.kvGet === 'function') {
        return root.MatchcardLocalRepo.kvGet(key);
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(key);
    } catch (e) {}
    return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
  }

  function kvSet(key, value) {
    try {
      if (root.MatchcardLocalRepo && typeof root.MatchcardLocalRepo.kvSet === 'function') {
        return root.MatchcardLocalRepo.kvSet(key, value);
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(key, String(value));
        return true;
      }
    } catch (e) {
      return false;
    }
    mem[key] = String(value);
    return true;
  }

  function kvRemove(key) {
    try {
      if (root.MatchcardLocalRepo && typeof root.MatchcardLocalRepo.kvRemove === 'function') {
        root.MatchcardLocalRepo.kvRemove(key);
        return;
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined' && localStorage) localStorage.removeItem(key);
    } catch (e) {}
    delete mem[key];
  }

  R.resetMemoryMeta = function () {
    mem = Object.create(null);
    return R;
  };

  R.readLocalSyncAt = function () {
    return String(kvGet(R.KEYS.SYNC_AT) || '');
  };

  R.writeLocalSyncAt = function (iso) {
    return kvSet(R.KEYS.SYNC_AT, String(iso || ''));
  };

  R.isDirty = function () {
    return kvGet(R.KEYS.DIRTY) === '1';
  };

  R.setDirty = function (on) {
    if (on) kvSet(R.KEYS.DIRTY, '1');
    else kvRemove(R.KEYS.DIRTY);
    return !!on;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
