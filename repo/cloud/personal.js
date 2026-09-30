/* Matchcard CloudRepo — personal_backups pull/push */
(function (root) {
  'use strict';
  var R = root.MatchcardCloudRepo = root.MatchcardCloudRepo || {};

  function ownerId(session) {
    return session && session.user && session.user.id ? String(session.user.id) : '';
  }

  /**
   * @returns {Promise<{payload:object, updatedAt:string}|null>}
   */
  R.fetchPersonalBackup = async function (session) {
    if (!session || !ownerId(session)) return null;

    var transport = R.getTransport();
    if (transport && typeof transport.fetchPersonal === 'function') {
      return transport.fetchPersonal(ownerId(session));
    }

    var sb = R.getClient();
    if (!sb) return null;
    var res = await sb.from(R.TABLES.PERSONAL_BACKUPS)
      .select('payload,updated_at')
      .eq('owner_user_id', ownerId(session))
      .maybeSingle();
    if (res.error) throw res.error;
    if (!res.data || !res.data.payload) return null;
    return {
      payload: res.data.payload,
      updatedAt: String(res.data.updated_at || '')
    };
  };

  /**
   * @returns {Promise<{ok:boolean, at?:string, reason?:string}>}
   */
  R.pushPersonalBackup = async function (session, payload, updatedAt) {
    if (!session || !ownerId(session)) return { ok: false, reason: 'no_session' };
    if (!payload) return { ok: false, reason: 'no_export' };
    var at = updatedAt || new Date().toISOString();

    var transport = R.getTransport();
    if (transport && typeof transport.pushPersonal === 'function') {
      await transport.pushPersonal(ownerId(session), payload, at);
      R.writeLocalSyncAt(at);
      R.setDirty(false);
      return { ok: true, at: at };
    }

    var sb = R.getClient();
    if (!sb) return { ok: false, reason: 'no_cloud' };
    var res = await sb.from(R.TABLES.PERSONAL_BACKUPS).upsert({
      owner_user_id: ownerId(session),
      payload: payload,
      updated_at: at
    }, { onConflict: 'owner_user_id' });
    if (res.error) throw res.error;
    R.writeLocalSyncAt(at);
    R.setDirty(false);
    return { ok: true, at: at };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
