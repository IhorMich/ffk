/* Matchcard push / local alerts — Capacitor PushNotifications + Android channel. */
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
  }

  async function wireListeners(Push){
    if(registered || !Push) return;
    registered = true;
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
      // Always surface as a system alert (sound channel) — not only a toast.
      notifyHeadsUp(title, body, true);
    });
    Push.addListener('pushNotificationActionPerformed', () => {});
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
      await wireListeners(Push);
      await Push.register();
      if(!quiet) toast(tt('coachPushOn', 'Push notifications enabled.'));
      syncSettingsUi();
      return {ok: true};
    }catch(e){
      console.warn(e);
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

  /** First install / every cold start: ask once, then keep registration warm. */
  async function bootstrap(){
    if(bootstrapped) return;
    bootstrapped = true;
    const s = read();
    if(!s.asked){
      // First launch — request permission immediately (no toast spam).
      await enable({quiet: true});
      return;
    }
    if(s.enabled){
      await enable({quiet: true});
    }
  }

  global.CoachPush = {
    enable,
    disable,
    isEnabled,
    notifyInvite,
    notifyResult,
    notifyLocal,
    bootstrap,
    getToken(){ return read().token || ''; },
    wasAsked(){ return !!read().asked; }
  };
})(window);
