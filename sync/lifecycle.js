/* Matchcard Sync — run personal sync over adapters */
(function (root) {
  'use strict';
  var S = root.MatchcardSync = root.MatchcardSync || {};
  var adapters = null;
  var state = { status: 'idle', at: '', error: '', relation: '', conflict: null };

  function ad() { return adapters || {}; }

  function safeCall(fn, args) {
    if (typeof fn !== 'function') return Promise.resolve(null);
    try {
      return Promise.resolve(fn.apply(null, args || []));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  S.bind = function (next) {
    adapters = next || null;
    return S;
  };

  S.getState = function () {
    return Object.assign({}, state);
  };

  S.setState = function (next) {
    state = Object.assign({}, state, next || {});
    var a = ad();
    if (typeof a.onState === 'function') {
      try { a.onState(S.getState()); } catch (e) {}
    }
    return S.getState();
  };

  S.markLocalDirty = function () {
    var a = ad();
    if (typeof a.setDirty === 'function') {
      try { a.setDirty(true); } catch (e) {}
    }
    return true;
  };

  /**
   * Full personal backup sync.
   * Adapters:
   *  ready(), isPro(), getSession(),
   *  readLocalAt(), writeLocalAt(iso),
   *  isDirty(), setDirty(bool),
   *  fetchRemote(), // → { payload, updatedAt } | null
   *  applyRemote(payload),
   *  exportLocal(), pushRemote(payload, updatedAt),
   *  onState(state), nowIso()
   */
  S.runPersonalSync = async function (options) {
    var opts = options || {};
    var a = ad();
    var ready = !(typeof a.ready === 'function') || !!a.ready();
    var isPro = !(typeof a.isPro === 'function') || !!a.isPro();
    var session = null;
    try { session = await safeCall(a.getSession); } catch (e) { session = null; }
    var hasSession = !!(session && session.user);

    if (!ready) {
      return S.setState({ status: 'error', error: 'no_cloud' }), { ok: false, reason: 'no_cloud', state: S.getState() };
    }
    if (!isPro) {
      S.setState({ status: 'free', at: '', error: '', relation: '', conflict: null });
      return { ok: false, reason: 'not_pro', state: S.getState() };
    }
    if (!hasSession) {
      S.setState({ status: 'need_account', at: '', error: '', relation: '', conflict: null });
      return { ok: false, reason: 'no_session', state: S.getState() };
    }

    S.setState({ status: 'syncing', error: '' });

    try {
      var localAt = '';
      try { localAt = String((await safeCall(a.readLocalAt)) || ''); } catch (e) { localAt = ''; }
      var dirty = false;
      try { dirty = !!(await safeCall(a.isDirty)); } catch (e) { dirty = false; }

      var remote = null;
      if (opts.pull !== false) {
        remote = await safeCall(a.fetchRemote, [session]);
      } else {
        // Still need remote meta for push-only plan? optional
        try { remote = await safeCall(a.fetchRemote, [session]); } catch (e) { remote = null; }
      }

      var hasRemote = !!(remote && remote.payload);
      var remoteAt = hasRemote ? String(remote.updatedAt || '') : '';

      var plan = S.planPersonalSync({
        pull: opts.pull,
        push: opts.push,
        localAt: localAt,
        remoteAt: remoteAt,
        hasRemote: hasRemote,
        localDirty: dirty,
        force: !!opts.force,
        ready: true,
        isPro: true,
        hasSession: true
      });

      if (!plan.ok) {
        S.setState({ status: plan.status || 'error', error: plan.reason || '' });
        return { ok: false, reason: plan.reason, plan: plan, state: S.getState() };
      }

      var results = [];
      for (var i = 0; i < plan.steps.length; i++) {
        var step = plan.steps[i];
        if (step.action === 'pull_merge') {
          var check = S.validateBackupPayload(remote.payload);
          if (!check.ok) {
            results.push({ step: step, ok: false, reason: check.reason });
            throw new Error('bad_remote_payload');
          }
          await safeCall(a.applyRemote, [remote.payload]);
          if (remoteAt && typeof a.writeLocalAt === 'function') {
            await safeCall(a.writeLocalAt, [remoteAt]);
            localAt = remoteAt;
          }
          if (typeof a.setDirty === 'function') await safeCall(a.setDirty, [true]); // merged local may differ
          results.push({ step: step, ok: true, validation: check });
        } else if (step.action === 'push') {
          var payload = await safeCall(a.exportLocal);
          if (!payload) {
            results.push({ step: step, ok: false, reason: 'no_export' });
            throw new Error('no_export');
          }
          var nowIso = (typeof a.nowIso === 'function' ? a.nowIso() : new Date().toISOString());
          await safeCall(a.pushRemote, [session, payload, nowIso]);
          if (typeof a.writeLocalAt === 'function') await safeCall(a.writeLocalAt, [nowIso]);
          if (typeof a.setDirty === 'function') await safeCall(a.setDirty, [false]);
          localAt = nowIso;
          results.push({ step: step, ok: true, at: nowIso });
        } else {
          results.push({ step: step, ok: true, skipped: true });
        }
      }

      S.setState({
        status: 'ok',
        at: localAt,
        error: '',
        relation: plan.relation,
        conflict: plan.conflict
      });
      return { ok: true, plan: plan, results: results, state: S.getState() };
    } catch (error) {
      S.setState({
        status: 'error',
        error: String((error && error.message) || error || 'sync'),
        relation: '',
        conflict: null
      });
      if (typeof root.reportError === 'function') {
        try { root.reportError(error, { scope: 'sync.engine', silent: true }); } catch (e) {}
      }
      return { ok: false, error: error, state: S.getState() };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
