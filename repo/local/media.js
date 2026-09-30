/* Matchcard LocalRepo — media cache + IDB (browser) / memory fallback */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};
  var IDB_NAME = 'ffk';
  var IDB_STORE = 'media';
  var cache = Object.create(null);
  var memMedia = Object.create(null);

  R.isUsablePhoto = function (src) {
    var p = String(src || '');
    if (p.indexOf('data:image/') === 0 && p.length > 64) return true;
    if (p.indexOf('blob:') === 0 && p.length > 8) return true;
    if (/^https?:\/\//i.test(p)) return true;
    return false;
  };

  R.playerRecordForLs = function (p) {
    var row = Object.assign({}, p || {});
    row.photo = '';
    row.cover = '';
    return row;
  };

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('no idb'));
        return;
      }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  R.getMediaCached = function (id) {
    var key = String(id || '');
    return cache[key] || null;
  };

  R.getMedia = function (id) {
    var key = String(id || '');
    if (cache[key]) return Promise.resolve(cache[key]);
    if (typeof indexedDB === 'undefined') {
      var m = memMedia[key] || { photo: '', cover: '' };
      cache[key] = m;
      return Promise.resolve(m);
    }
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function () {
          var rec = req.result || { photo: '', cover: '' };
          cache[key] = { photo: rec.photo || '', cover: rec.cover || '' };
          resolve(cache[key]);
        };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () {
      var fallback = memMedia[key] || { photo: '', cover: '' };
      cache[key] = fallback;
      return fallback;
    });
  };

  R.putMedia = function (id, photo, cover) {
    var key = String(id || '');
    var row = { photo: photo || '', cover: cover || '' };
    cache[key] = row;
    memMedia[key] = row;
    if (typeof indexedDB === 'undefined') return Promise.resolve();
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(row, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () {});
  };

  R.deleteMedia = function (id) {
    var key = String(id || '');
    delete cache[key];
    delete memMedia[key];
    if (typeof indexedDB === 'undefined') return Promise.resolve();
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () {});
  };

  R.clearMediaCache = function () {
    cache = Object.create(null);
    memMedia = Object.create(null);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
