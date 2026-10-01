/* Matchcard push / local alerts — permission + Android FfkNotify channel.
   Remote FCM (Push.register) is skipped until google-services.json is present —
   calling register without Firebase crashes the Android process. */
(function(global){
  const KEY = 'ffk_push_v1';
  let registered = false;
  let bootstrapped = false;

  function read(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function write(data){
    localStorage.setItem(KEY, JSON.stringify(data || {}));
  }
  function toast(msg){
    if(typeof showToast === 'function') showToast(msg);
  }
  function tt(key, fallback){
    try{
      if(typeof t === 'function'){
        const v = t(key);
        if(v && v !== key) return v;
      }
    }catch(e){}
    return fallback || key;
  }
  function isNative(){
    try{
      return !!(global.Capacitor && typeof global.Capacitor.isNativePlatform === 'function' && global.Capacitor.isNativePlatform());
    }catch(e){ return false; }
  }
  function plugin(){
    try{
      if(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.PushNotifications){
        return global.Capacitor.Plugins.PushNotifications;
      }
    }catch(e){}
    return null;
  }
  /** Remote FCM only when explicitly configured (no google-services → never register). */
  function canRegisterRemote(){
    try{
      if(global.CoachCloud && typeof global.CoachCloud.hasPushBackend === 'function'){
        return !!global.CoachCloud.hasPushBackend();
      }
      if(global.FFK_PUSH_FCM === true) return true;
    }catch(e){}
    return false;
  }
  function nativeNotify(title, body){
    try{
      if(global.FfkNotify && typeof global.FfkNotify.show === 'function'){
        global.FfkNotify.show(String(title || 'Matchcard'), String(body || ''));
        return true;
      }
    }catch(e){}
    return false;
  }
  function syncSettingsUi(){
    try{
      if(typeof syncPushSettingsUi === 'function') syncPushSettingsUi();
    }catch(e){}
    try{
      if(typeof renderCloudPushStatus === 'function') renderCloudPushStatus();
    }catch(e){}
    try{
      if(global.ParentUI && typeof global.ParentUI.syncInboxBellUi === 'function'){
        global.ParentUI.syncInboxBellUi();
      }else if(typeof syncInboxBellUi === 'function'){
        syncInboxBellUi();
      }
    }catch(e){}
  }

  async function wireListeners(Push){
    if(registered || !Push) return;
    registered = true;
    try{
      Push.addListener('registration', async (token) => {
        const s = read();
        s.token = token && token.value ? token.value : '';
        s.platform = (global.Capacitor.getPlatform && global.Capacitor.getPlatform()) || 'native';
        write(s);
        if(global.CoachCloud && typeof global.CoachCloud.registerDeviceToken === 'function'){
          try{ await global.CoachCloud.registerDeviceToken(s.token, s.platform); }catch(e){}
        }
        if(global.CoachStore && typeof global.CoachStore.saveDeviceToken === 'function'){
          try{ global.CoachStore.saveDeviceToken(s.token, s.platform); }catch(e){}
        }
      });
      Push.addListener('registrationError', (err) => {
        console.warn('push registration', err);
      });
      Push.addListener('pushNotificationReceived', (n) => {
        const title = (n && n.title) || 'Matchcard';
        const body = (n && n.body) || '';
        notifyHeadsUp(title, body, true);
      });
      Push.addListener('pushNotificationActionPerformed', () => {});
    }catch(e){
      console.warn('push listeners', e);
      registered = false;
    }
  }

  async function enable(opts){
    opts = opts || {};
    const quiet = !!opts.quiet;
    const Push = plugin();
    const state = read();
    state.enabled = true;
    state.asked = true;
    write(state);

    // Web / PWA
    if(!Push || !isNative()){
      try{
        if(typeof Notification !== 'undefined' && Notification.permission === 'default'){
          await Notification.requestPermission();
        }
      }catch(e){}
      if(!quiet){
        toast(tt('coachPushLocalOn', 'Push ready on this phone (local). Cloud push needs Supabase + FCM.'));
      }
      syncSettingsUi();
      return {ok: true, local: true};
    }

    try{
      let perm = await Push.checkPermissions();
      if(perm.receive !== 'granted'){
        perm = await Push.requestPermissions();
      }
      state.asked = true;
      if(perm.receive !== 'granted'){
        state.enabled = false;
        write(state);
        if(!quiet) toast(tt('coachPushDenied', 'Notifications permission denied.'));
        syncSettingsUi();
        return {ok: false};
      }
      write(state);

      // Local heads-up via FfkNotify works with POST_NOTIFICATIONS alone.
      // Do NOT call Push.register() without Firebase — it kills the Android app.
      if(canRegisterRemote()){
        await wireListeners(Push);
        try{
          await Push.register();
        }catch(e){
          console.warn('push register skipped/failed', e);
        }
      }

      if(!quiet) toast(tt('coachPushOn', 'Push notifications enabled.'));
      syncSettingsUi();
      return {ok: true, local: !canRegisterRemote()};
    }catch(e){
      console.warn(e);
      // Still keep local enabled if permission may already be granted.
      if(!quiet) toast(tt('coachPushFail', 'Could not enable push.'));
      syncSettingsUi();
      return {ok: false};
    }
  }

  function disable(){
    const s = read();
    s.enabled = false;
    s.asked = true;
    write(s);
    toast(tt('coachPushOff', 'Push notifications off.'));
    syncSettingsUi();
  }

  function isEnabled(){
    return !!read().enabled;
  }

  /** Heads-up system notification (plays via notification stream — works on silent ringer). */
  function playAlertBeep(){
    try{
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if(!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
      setTimeout(() => { try{ ctx.close(); }catch(e){} }, 500);
    }catch(e){}
  }
  function notifyHeadsUp(title, body, force){
    const s = read();
    if(!force && !s.enabled) return;
    let shown = false;
    if(nativeNotify(title, body)) shown = true;
    else {
      try{
        if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
          new Notification(title || 'Matchcard', {
            body: body || '',
            silent: false,
            requireInteraction: false,
            tag: 'ffk-chat-' + Date.now()
          });
          shown = true;
        }
      }catch(e){}
    }
    playAlertBeep();
    if(!shown) toast(`${title || 'Matchcard'}: ${body || ''}`);
  }

  function notifyLocal(title, body){
    notifyHeadsUp(title, body, false);
  }

  /** Keep coach-only alerts quiet while the phone is in Player mode. */
  function queueCoachAlert(title, body){
    const s = read();
    const alerts = Array.isArray(s.coachAlerts) ? s.coachAlerts.slice(-9) : [];
    alerts.push({
      title: String(title || 'Matchcard'),
      body: String(body || ''),
      createdAt: new Date().toISOString()
    });
    s.coachAlerts = alerts;
    write(s);
  }

  function flushCoachAlerts(){
    try{
      if(typeof isCoachPlan === 'function' && !isCoachPlan()) return 0;
    }catch(e){ return 0; }
    const s = read();
    const alerts = Array.isArray(s.coachAlerts) ? s.coachAlerts : [];
    if(!alerts.length) return 0;
    s.coachAlerts = [];
    write(s);
    alerts.forEach(alert => notifyHeadsUp(alert.title, alert.body, false));
    return alerts.length;
  }

  function notifyInvite(payload){
    notifyLocal(
      tt('coachPushInviteTitle', 'Match invite'),
      `${payload && payload.opponent ? payload.opponent : ''} · ${payload && payload.date ? payload.date : ''}`.trim()
    );
  }
  function notifyResult(payload){
    notifyLocal(
      tt('coachPushResultTitle', 'Match card'),
      `${payload && payload.player_name ? payload.player_name : ''} · ${payload && payload.rating != null ? payload.rating : ''}`.trim()
    );
  }

  /** Cold start: never prompt. Only re-wire remote FCM if already enabled + backend ready. */

  const TRAIN_FIRED_KEY = 'ffk_train_fired_v1';
  function readFired(){
    try{ return JSON.parse(localStorage.getItem(TRAIN_FIRED_KEY) || '{}') || {}; }catch(e){ return {}; }
  }
  function writeFired(map){
    try{ localStorage.setItem(TRAIN_FIRED_KEY, JSON.stringify(map || {})); }catch(e){}
  }
  function trainingStartMs(tr){
    if(!tr || !tr.date || !tr.start_time) return 0;
    const ms = Date.parse(`${tr.date}T${tr.start_time}:00`);
    return Number.isFinite(ms) ? ms : 0;
  }
  function collectUpcomingTrainings(){
    const out = [];
    const today = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    try{
      if(typeof isCoachPlan === 'function' && isCoachPlan()){
        const store = global.CoachStore;
        const session = store && store.getSession && store.getSession();
        const teamId = store && store.getActiveTeamId && store.getActiveTeamId();
        if(session && teamId && store.listTrainingsInRange){
          store.listTrainingsInRange(session, teamId, today, to).forEach(tr => out.push(tr));
        }
      }
    }catch(e){}
    try{
      if(global.ParentStore && typeof global.ParentStore.listUpcomingTrainingsForLinks === 'function'
         && typeof global.ParentStore.listLinks === 'function'){
        global.ParentStore.listUpcomingTrainingsForLinks(global.ParentStore.listLinks())
          .forEach(tr => out.push(tr));
      }
    }catch(e){}
    const seen = new Set();
    return out.filter(tr => {
      const key = `${tr.team_id || ''}|${tr.date}|${tr.start_time}|${tr.id}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function nativeSchedule(id, title, body, whenMs){
    try{
      if(global.FfkNotify && typeof global.FfkNotify.schedule === 'function'){
        global.FfkNotify.schedule(String(id), String(title || 'Matchcard'), String(body || ''), Number(whenMs));
        return true;
      }
    }catch(e){}
    return false;
  }
  function nativeCancel(id){
    try{
      if(global.FfkNotify && typeof global.FfkNotify.cancel === 'function'){
        global.FfkNotify.cancel(String(id));
      }
    }catch(e){}
  }
  function resyncTrainingReminders(){
    const list = collectUpcomingTrainings();
    const now = Date.now();
    const fired = readFired();
    // Drop old fired keys
    Object.keys(fired).forEach(k => {
      if(fired[k] < now - 2 * 86400000) delete fired[k];
    });
    list.forEach(tr => {
      const mins = Number(tr.notify_minutes);
      if(!Number.isFinite(mins) || mins <= 0) return;
      const start = trainingStartMs(tr);
      if(!start || start <= now) return;
      const when = start - mins * 60000;
      const id = `train_${tr.id}_${tr.date}_${tr.start_time}`;
      if(when <= now){
        // Due now / overdue window (within start): fire once if in the last notify window
        if(!fired[id] && now < start){
          fired[id] = now;
          notifyHeadsUp(
            tt('coachPushTrainTitle', 'Training soon'),
            `${tr.date} ${tr.start_time}${tr.end_time ? '–' + tr.end_time : ''}${tr.address ? ' · ' + tr.address : ''}`.trim(),
            false
          );
        }
        nativeCancel(id);
        return;
      }
      // Schedule native alarm for future reminder
      nativeSchedule(
        id,
        tt('coachPushTrainTitle', 'Training soon'),
        `${tr.date} ${tr.start_time}${tr.end_time ? '–' + tr.end_time : ''}${tr.address ? ' · ' + tr.address : ''}`.trim(),
        when
      );
    });
    writeFired(fired);
  }
  let trainTimer = 0;
  function startTrainingReminderLoop(){
    if(trainTimer) return;
    const tick = () => {
      try{ resyncTrainingReminders(); }catch(e){}
    };
    tick();
    trainTimer = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') tick();
    });
  }

  async function bootstrap(){
    if(bootstrapped) return;
    bootstrapped = true;
    const s = read();
    if(!s.enabled) return;
    if(!canRegisterRemote()) return;
    try{
      await enable({quiet: true});
    }catch(e){
      console.warn('push bootstrap', e);
    }
  }

  global.CoachPush = {
    enable,
    disable,
    isEnabled,
    canRegisterRemote,
    notifyInvite,
    notifyResult,
    notifyLocal,
    notifyHeadsUp,
    queueCoachAlert,
    flushCoachAlerts,
    bootstrap,
    resyncTrainingReminders,
    startTrainingReminderLoop,
    getToken(){ return read().token || ''; },
    wasAsked(){ return !!read().asked; }
  };
  try{ startTrainingReminderLoop(); }catch(e){}
})(window);
