/* Matchcard Sync — pure plan for personal backup (no DOM / network) */
(function (root) {
  'use strict';
  var S = root.MatchcardSync = root.MatchcardSync || {};

  function cmpIso(a, b) {
    var x = String(a || '');
    var y = String(b || '');
    if (!x && !y) return 0;
    if (!x) return -1;
    if (!y) return 1;
    if (x === y) return 0;
    return x < y ? -1 : 1;
  }

  S.compareTimestamps = cmpIso;

  /**
   * Decide pull/push steps for a personal backup blob.
   * @param {object} input
   * @returns {object} plan JSON
   */
  S.planPersonalSync = function (input) {
    var i = input || {};
    var wantPull = i.pull !== false;
    var wantPush = i.push !== false;
    var localAt = String(i.localAt || '');
    var remoteAt = String(i.remoteAt || '');
    var hasRemote = !!i.hasRemote;
    var localDirty = !!i.localDirty;
    var force = !!i.force;
    var ready = i.ready !== false;
    var isPro = i.isPro !== false;
    var hasSession = i.hasSession !== false;

    if (!ready) {
      return { ok: false, reason: 'no_cloud', steps: [], status: 'error' };
    }
    if (!isPro) {
      return { ok: false, reason: 'not_pro', steps: [], status: 'free' };
    }
    if (!hasSession) {
      return { ok: false, reason: 'no_session', steps: [], status: 'need_account' };
    }

    var steps = [];
    var conflict = null;
    var relation = 'unknown';

    if (!hasRemote) {
      relation = 'remote_empty';
    } else if (!localAt) {
      relation = 'local_never_synced';
    } else {
      var c = cmpIso(remoteAt, localAt);
      relation = c < 0 ? 'local_newer' : (c > 0 ? 'remote_newer' : 'equal');
    }

    if (localDirty && (relation === 'remote_newer' || relation === 'local_never_synced' && hasRemote)) {
      conflict = 'local_dirty_and_remote_present';
    }

      var localSparse = !!i.localSparse;
    var remoteRicher = !!i.remoteRicher;
    var remoteHasMedia = !!i.remoteHasMedia;
    var localHasMedia = !!i.localHasMedia;

    var shouldPull = false;
    if (wantPull && hasRemote) {
      if (force) shouldPull = true;
      else if (relation === 'remote_newer' || relation === 'local_never_synced') shouldPull = true;
      else if (conflict === 'local_dirty_and_remote_present' && relation === 'remote_newer') shouldPull = true;
      // Empty/sparse PC must pull even if a stale local sync clock looks newer.
      else if (localSparse || remoteRicher) shouldPull = true;
      // Cloud has photo/cover that this device is missing.
      else if (remoteHasMedia && !localHasMedia) shouldPull = true;
    }

    if (shouldPull) {
      steps.push({
        action: 'pull_merge',
        reason: conflict || relation,
        remoteAt: remoteAt
      });
    } else if (wantPull && hasRemote && relation === 'equal') {
      steps.push({ action: 'skip_pull', reason: 'equal', remoteAt: remoteAt });
    } else if (wantPull && hasRemote && relation === 'local_newer') {
      steps.push({ action: 'skip_pull', reason: 'local_newer', remoteAt: remoteAt });
    } else if (wantPull && !hasRemote) {
      steps.push({ action: 'skip_pull', reason: 'remote_empty' });
    }

    if (wantPush) {
      // Sparse local + richer remote: skip push unless we already queued a pull
      // (lifecycle re-checks after merge and will skip if still sparse).
      if (!force && hasRemote && remoteRicher && localSparse && !shouldPull) {
        steps.push({ action: 'skip_push', reason: 'keep_richer_remote' });
      } else {
        var pushReason = 'export';
        if (localDirty) pushReason = 'local_dirty';
        else if (relation === 'local_newer') pushReason = 'local_newer';
        else if (shouldPull) pushReason = 'after_merge';
        else if (!hasRemote) pushReason = 'seed_remote';
        else if (relation === 'equal' && !localDirty) pushReason = 'refresh_remote';
        if (shouldPull && localSparse) pushReason = 'after_merge_guarded';
        steps.push({ action: 'push', reason: pushReason });
      }
    }

    return {
      ok: true,
      reason: 'planned',
      status: 'syncing',
      relation: relation,
      conflict: conflict,
      localAt: localAt,
      remoteAt: remoteAt,
      localDirty: localDirty,
      steps: steps
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
