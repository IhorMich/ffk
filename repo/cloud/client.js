/* Matchcard CloudRepo — injectable client / session / entitlement */
(function (root) {
  'use strict';
  var R = root.MatchcardCloudRepo = root.MatchcardCloudRepo || {};
  var cfg = {
    ready: null,
    isPro: null,
    getSession: null,
    getClient: null,
    transport: null
  };

  R.configure = function (next) {
    cfg = Object.assign({}, cfg, next || {});
    return R;
  };

  R.resetConfig = function () {
    cfg = { ready: null, isPro: null, getSession: null, getClient: null, transport: null };
    return R;
  };

  R.useTransport = function (transport) {
    cfg.transport = transport || null;
    return R;
  };

  R.ready = function () {
    if (typeof cfg.ready === 'function') return !!cfg.ready();
    return !!(cfg.getClient && cfg.getClient());
  };

  R.isPro = function () {
    if (typeof cfg.isPro === 'function') return !!cfg.isPro();
    return true;
  };

  R.getSession = function () {
    if (typeof cfg.getSession !== 'function') return Promise.resolve(null);
    try {
      return Promise.resolve(cfg.getSession());
    } catch (e) {
      return Promise.reject(e);
    }
  };

  R.getClient = function () {
    if (typeof cfg.getClient === 'function') {
      try { return cfg.getClient(); } catch (e) { return null; }
    }
    return null;
  };

  R.getTransport = function () {
    return cfg.transport || null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
