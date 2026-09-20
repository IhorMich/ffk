/* Coach push notifications — Capacitor PushNotifications + local fallback. */
(function(global){
  const KEY = 'ffk_push_v1';
  let registered = false;

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

  async function enable(){
    const Push = plugin();
    const state = read();
    state.enabled = true;
    write(state);
    if(!Push || !isNative()){
      toast(tt('coachPushLocalOn', 'Push ready on this phone (local). Cloud push needs Supabase + FCM.'));
      return {ok: true, local: true};
    }
    try{
      let perm = await Push.checkPermissions();
      if(perm.receive !== 'granted'){
        perm = await Push.requestPermissions();
      }
      if(perm.receive !== 'granted'){
        toast(tt('coachPushDenied', 'Notifications permission denied.'));
        return {ok: false};
      }
      await Push.register();
      if(!registered){
        registered = true;
        Push.addListener('registration', async (token) => {
          const s = read();
          s.token = token && token.value ? token.value : '';
          s.platform = (global.Capacitor.getPlatform && global.Capacitor.getPlatform()) || 'native';
          write(s);
          if(global.CoachCloud && typeof global.CoachCloud.registerDeviceToken === 'function'){
            try{ await global.CoachCloud.registerDeviceToken(s.token, s.platform); }catch(e){}
          }
          // Also keep on coach local db
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
          if(body) toast(`${title}: ${body}`);
        });
        Push.addListener('pushNotificationActionPerformed', () => {});
      }
      toast(tt('coachPushOn', 'Push notifications enabled.'));
      return {ok: true};
    }catch(e){
      console.warn(e);
      toast(tt('coachPushFail', 'Could not enable push.'));
      return {ok: false};
    }
  }

  function disable(){
    const s = read();
    s.enabled = false;
    write(s);
    toast(tt('coachPushOff', 'Push notifications off.'));
  }

  function isEnabled(){
    return !!read().enabled;
  }

  /** Local heads-up when coach sends invite/result (same-device parent). */
  function notifyLocal(title, body){
    const s = read();
    if(!s.enabled) return;
    try{
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        new Notification(title || 'Matchcard', {body: body || ''});
        return;
      }
    }catch(e){}
    toast(`${title || 'Matchcard'}: ${body || ''}`);
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

  global.CoachPush = {
    enable,
    disable,
    isEnabled,
    notifyInvite,
    notifyResult,
    getToken(){ return read().token || ''; }
  };
})(window);
