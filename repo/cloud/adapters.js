/* Matchcard CloudRepo — adapters for MatchcardSync.bind */
(function (root) {
  'use strict';
  var R = root.MatchcardCloudRepo = root.MatchcardCloudRepo || {};

  /**
   * Build SyncEngine adapters. App supplies export/apply/UI hooks only.
   * @param {{exportLocal:Function, applyRemote:Function, onState?:Function, nowIso?:Function}} hooks
   */
  R.buildSyncAdapters = function (hooks) {
    var h = hooks || {};
    return {
      ready: function () { return R.ready(); },
      isPro: function () { return R.isPro(); },
      getSession: function () { return R.getSession(); },
      readLocalAt: async function () { return R.readLocalSyncAt(); },
      writeLocalAt: async function (iso) { R.writeLocalSyncAt(iso); },
      isDirty: async function () { return R.isDirty(); },
      setDirty: async function (on) { R.setDirty(!!on); },
      fetchRemote: async function (session) { return R.fetchPersonalBackup(session); },
      applyRemote: async function (payload) {
        if (typeof h.applyRemote !== 'function') throw new Error('no_import');
        return h.applyRemote(payload);
      },
      exportLocal: async function () {
        if (typeof h.exportLocal !== 'function') return null;
        return h.exportLocal();
      },
      pushRemote: async function (session, payload, at) {
        var out = await R.pushPersonalBackup(session, payload, at);
        if (!out || !out.ok) throw new Error((out && out.reason) || 'push');
        return out;
      },
      nowIso: function () {
        return typeof h.nowIso === 'function' ? h.nowIso() : new Date().toISOString();
      },
      onState: function (st) {
        if (typeof h.onState === 'function') h.onState(st);
      }
    };
  };

  /** Mark local personal data dirty for next Pro push. */
  R.markPersonalDirty = function () {
    R.setDirty(true);
    if (root.MatchcardSync && typeof root.MatchcardSync.markLocalDirty === 'function') {
      try { root.MatchcardSync.markLocalDirty(); } catch (e) {}
    }
    return true;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
