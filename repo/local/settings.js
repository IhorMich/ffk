/* Matchcard LocalRepo — settings blob */
(function (root) {
  'use strict';
  var R = root.MatchcardLocalRepo = root.MatchcardLocalRepo || {};

  R.getSettings = function () {
    var s = R.getJson(R.KEYS.SETTINGS, {});
    return s && typeof s === 'object' ? s : {};
  };

  R.setSettings = function (settings) {
    return R.setJson(R.KEYS.SETTINGS, settings && typeof settings === 'object' ? settings : {});
  };

  R.getFilters = function () {
    return R.getJson(R.KEYS.FILTER, null);
  };

  R.setFilters = function (filters) {
    return R.setJson(R.KEYS.FILTER, filters);
  };

  R.getView = function () {
    return R.kvGet(R.KEYS.VIEW) || '';
  };

  R.setView = function (name) {
    return R.kvSet(R.KEYS.VIEW, String(name || ''));
  };

  R.getDraft = function (playerId) {
    return R.kvGet(R.draftKey(playerId));
  };

  R.setDraft = function (playerId, raw) {
    return R.kvSet(R.draftKey(playerId), String(raw || ''));
  };

  R.clearDraft = function (playerId) {
    R.kvRemove(R.draftKey(playerId));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
