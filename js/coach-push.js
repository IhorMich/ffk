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
  function notifyHeadsUp(title, body, force){
    const s = read();
    if(!force && !s.enabled) return;
    if(nativeNotify(title, body)) return;
    try{
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        new Notification(title || 'Matchcard', {
          body: body || '',
          silent: false,
          requireInteraction: false,
          tag: 'ffk-alert'
        });
        return;
      }
    }catch(e){}
    toast(`${title || 'Matchcard'}: ${body || ''}`);
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
    notifyInvite,
    notifyResult,
    notifyLocal,
    queueCoachAlert,
    flushCoachAlerts,
    bootstrap,
    getToken(){ return read().token || ''; },
    wasAsked(){ return !!read().asked; }
  };
})(window);
