/* Matchcard LocalRepo — JSON kv over injectable store */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};
  var mem = Object.create(null);
  var driver = null;

  function defaultDriver() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        return {
          getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
          setItem: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
          removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
          keys: function () {
            var out = [];
            try {
              for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key) out.push(key);
              }
            } catch (e) {}
            return out;
          }
        };
      }
    } catch (e) {}
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); return true; },
      removeItem: function (k) { delete mem[k]; },
      keys: function () { return Object.keys(mem); }
    };
  }

  R.useKvDriver = function (next) {
    driver = next || null;
    return R;
  };

  R.resetMemoryKv = function () {
    mem = Object.create(null);
    return R;
  };

  function kv() {
    return driver || defaultDriver();
  }

  R.kvGet = function (key) {
    return kv().getItem(String(key));
  };

  R.kvSet = function (key, value) {
    return kv().setItem(String(key), String(value));
  };

  R.kvRemove = function (key) {
    kv().removeItem(String(key));
  };

  R.kvKeys = function () {
    return kv().keys();
  };

  R.getJson = function (key, fallback) {
    try {
      var raw = R.kvGet(key);
      if (raw == null || raw === '') return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  R.setJson = function (key, value) {
    try {
      return !!R.kvSet(key, JSON.stringify(value));
    } catch (e) {
      return false;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
