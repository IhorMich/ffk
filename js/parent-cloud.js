/* Matchcard parent/player cross-device sync through Supabase. */
(function(global){
  const COACH_LINKS_KEY = 'ffk_cloud_parent_links_v1';
  const PERSONAL_SYNC_AT_KEY = 'ffk_personal_backup_sync_at';
  const PERSONAL_DIRTY_KEY = 'ffk_personal_backup_dirty';
  let syncing = false;
  let syncTimer = null;
  let personalSyncState = {status: 'idle', at: '', error: '', relation: '', conflict: null};

  function cloudRepo(){
    return global.MatchcardCloudRepo || global.CloudRepo || null;
  }
  function wireCloudRepo(){
    const Cloud = cloudRepo();
    if(!Cloud || typeof Cloud.configure !== 'function') return false;
    Cloud.configure({
      ready: () => ready(),
      isPro: () => isProUser(),
      getSession: () => getSession(),
      getClient: () => parentClient()
    });
    return true;
  }

  function ready(){
    return !!(global.CoachCloud && global.CoachCloud.ready && global.CoachCloud.ready());
  }
  function refreshInboxBell(){
    try{
      if(global.ParentUI && typeof global.ParentUI.syncInboxBellUi === 'function'){
        global.ParentUI.syncInboxBellUi();
      }else if(typeof syncInboxBellUi === 'function'){
        syncInboxBellUi();
      }
    }catch(e){}
  }
  function notifyIncomingChats(incoming){
    const list = Array.isArray(incoming) ? incoming : [];
    refreshInboxBell();
    if(!list.length) return;
    // Skip historical backfill — alert for recent messages (wider window for delayed bg poll).
    const cutoff = Date.now() - 15 * 60 * 1000;
    const fresh = list.filter(m => {
      const t = Date.parse(m && m.created_at || '');
      return Number.isFinite(t) && t >= cutoff;
    });
    if(!fresh.length) return;
    // Don't spam heads-up while the user is already in the chat screen.
    try{
      const page = document.getElementById('chatPage');
      if(page && !page.hidden) return;
    }catch(e){}
    // One heads-up per team broadcast (not one per roster fan-out row).
    const seenBroadcast = new Set();
    const collapsed = [];
    fresh.forEach(m => {
      const bc = String(m && m.broadcast_id || '').trim();
      if(bc){
        if(seenBroadcast.has(bc)) return;
        seenBroadcast.add(bc);
      }
      collapsed.push(m);
    });
    const newest = collapsed[0];
    const isTeam = !!(newest && newest.broadcast_id);
    const who = isTeam
      ? (typeof t === 'function' ? (t('chatTeamFromCoach') || t('chatTeamTitle') || 'Главный тренер') : 'Главный тренер')
      : (newest.sender_role === 'coach'
        ? (newest.coach_name || newest.player_name || 'Matchcard')
        : (newest.player_name || newest.coach_name || 'Matchcard'));
    const body = String(newest.text || '').trim().slice(0, 120);
    const title = !isTeam && collapsed.length > 1
      ? `${who} (${collapsed.length})`
      : who;
    try{
      if(global.CoachPush && typeof global.CoachPush.notifyHeadsUp === 'function'){
        const pushOn = !!(global.CoachPush.isEnabled && global.CoachPush.isEnabled());
        global.CoachPush.notifyHeadsUp(
          title,
          body || 'Новое сообщение',
          pushOn,
          newest.team_player_id || '',
          isTeam ? 'team' : 'personal'
        );
      }else if(global.CoachPush && typeof global.CoachPush.notifyLocal === 'function'){
        global.CoachPush.notifyLocal(
          title,
          body || 'Новое сообщение',
          newest.team_player_id || '',
          isTeam ? 'team' : 'personal'
        );
      }
    }catch(e){}
  }
  let chatPollTimer = 0;
  let chatPolling = false;
  let chatPollStartedAt = 0;
  let chatPollTicks = 0;
  let bgPollWired = false;
  const CHAT_POLL_MS = 2000;
  const CHAT_POLL_OPEN_MS = 1200;
  const CHAT_FULL_EVERY = 10; // every N light pulls also push local changes
  function chatPageOpen(){
    try{
      const page = document.getElementById('chatPage');
      return !!(page && !page.hidden);
    }catch(e){ return false; }
  }
  function nativeBgPollStart(intervalMs){
    try{
      if(global.FfkNotify && typeof global.FfkNotify.startBackgroundChatPoll === 'function'){
        global.FfkNotify.startBackgroundChatPoll(Number(intervalMs) || 12000);
        return true;
      }
    }catch(e){}
    return false;
  }
  function nativeBgPollStop(){
    try{
      if(global.FfkNotify && typeof global.FfkNotify.stopBackgroundChatPoll === 'function'){
        global.FfkNotify.stopBackgroundChatPoll();
      }
    }catch(e){}
  }
  function wireBackgroundChatPoll(){
    if(bgPollWired) return;
    bgPollWired = true;
    const onHidden = () => {
      // Android freezes WebView timers when minimized — wake via AlarmManager/Handler.
      nativeBgPollStart(12000);
    };
    const onVisible = () => {
      nativeBgPollStop();
      try{
        if(ready()) pollInboxChats({push: true}).catch(() => {});
      }catch(e){}
    };
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'hidden') onHidden();
      else onVisible();
    });
    try{
      const App = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
      if(App && typeof App.addListener === 'function'){
        App.addListener('appStateChange', (state) => {
          if(state && state.isActive) onVisible();
          else onHidden();
        });
      }
    }catch(e){}
    if(document.visibilityState === 'hidden') onHidden();
  }
  function restartChatPollTimer(){
    if(chatPollTimer){
      clearInterval(chatPollTimer);
      chatPollTimer = 0;
    }
    const interval = chatPageOpen() ? CHAT_POLL_OPEN_MS : CHAT_POLL_MS;
    const tick = () => {
      try{
        if(!ready()) return;
        // If a previous poll hung, unblock after 20s so desktop chat keeps moving.
        if(chatPolling && chatPollStartedAt && Date.now() - chatPollStartedAt > 20000){
          chatPolling = false;
        }
        chatPollTicks += 1;
        const push = (chatPollTicks % CHAT_FULL_EVERY) === 0;
        pollInboxChats({push}).catch(() => {});
      }catch(e){}
    };
    chatPollTimer = setInterval(tick, interval);
  }
  function startChatPoll(){
    if(chatPollTimer) return;
    restartChatPollTimer();
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible'){
        restartChatPollTimer();
        try{ pollInboxChats({push: true}).catch(() => {}); }catch(e){}
      }
    });
    // Speed up while the chat dialog is open.
    try{
      const page = document.getElementById('chatPage');
      if(page && typeof MutationObserver === 'function'){
        new MutationObserver(() => restartChatPollTimer()).observe(page, {
          attributes: true,
          attributeFilter: ['hidden']
        });
      }
    }catch(e){}
    setTimeout(() => {
      try{ pollInboxChats({push: true}).catch(() => {}); }catch(e){}
    }, 500);
    try{ wireBackgroundChatPoll(); }catch(e){}
  }
  function refreshChatUi(){
    try{
      if(typeof renderChatThread === 'function') renderChatThread();
      else if(global.ParentUI && typeof global.ParentUI.renderChatThread === 'function'){
        global.ParentUI.renderChatThread();
      }
      const sheet = document.getElementById('inboxSheet');
      const list = document.getElementById('inboxSheetList');
      if(sheet && !sheet.hidden && list && typeof inboxRowsHtml === 'function' && typeof inboxMessages === 'function'){
        list.innerHTML = inboxRowsHtml(inboxMessages());
      }
      refreshInboxBell();
    }catch(e){}
  }
  async function pollInboxChats(opts){
    opts = opts || {};
    const push = !!opts.push;
    if(!ready() || chatPolling) return {ok: false, reason: 'busy'};
    chatPolling = true;
    chatPollStartedAt = Date.now();
    try{
      const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
      if(coachMode){
        const sb = coachClient();
        const coach = global.CoachStore;
        const coachSession = coach && coach.getSession && coach.getSession();
        if(!sb || !coachSession) return {ok: false, reason: 'no_session'};
        const {data: authData, error: authErr} = await sb.auth.getSession();
        if(authErr) throw authErr;
        const session = authData && authData.session;
        if(!session) return {ok: false, reason: 'no_session'};
        const academy = coach.myAcademy && coach.myAcademy(coachSession);
        const teams = academy && coach.listTeams ? coach.listTeams(coachSession, academy.id) : [];
        const playerIds = [];
        (teams || []).forEach(team => {
          (coach.listPlayers ? coach.listPlayers(coachSession, team.id) : []).forEach(player => {
            if(player && player.id) playerIds.push(player.id);
          });
        });
        let links = coachLinks();
        // Refresh link cache only on full push ticks — keeps light polls snappy on desktop.
        if(push && playerIds.length){
          try{
            const linksRes = await sb.from('parent_player_links')
              .select('team_player_id,personal_player_id,parent_user_id')
              .in('team_player_id', playerIds)
              .neq('status', 'revoked');
            if(!linksRes.error && Array.isArray(linksRes.data) && linksRes.data.length){
              links = linksRes.data;
              try{ localStorage.setItem(COACH_LINKS_KEY, JSON.stringify(links)); }catch(e){}
            }
          }catch(e){}
        }
        // Always include roster players so we can pull chats even if link cache is stale.
        const byId = new Map(links.map(l => [String(l.team_player_id || ''), l]));
        playerIds.forEach(id => {
          if(!byId.has(String(id))) byId.set(String(id), {team_player_id: id});
        });
        const chatRes = await syncChats(session, [...byId.values()], 'coach', {
          pullOnly: !push,
          recentLimit: push ? 0 : 120
        });
        notifyIncomingChats(chatRes && chatRes.incoming);
        refreshChatUi();
        return {ok: true, incoming: (chatRes && chatRes.incoming) || []};
      }

      // Parent / Free mode
      const sb = parentClient();
      if(!sb) return {ok: false, reason: 'no_cloud'};
      let session = null;
      try{ session = await getSession(); }catch(e){}
      if(!session){
        try{ session = await ensureSession(false); }catch(e){ return {ok: false, reason: 'no_session'}; }
      }
      const links = global.ParentStore && global.ParentStore.listLinks
        ? global.ParentStore.listLinks()
        : [];
      const chatRes = await syncChats(session, links, 'parent', {
        pullOnly: !push,
        recentLimit: push ? 0 : 120
      });
      notifyIncomingChats(chatRes && chatRes.incoming);
      try{ await pullParentNotices(session); }catch(e){}
      refreshChatUi();
      return {ok: true, incoming: (chatRes && chatRes.incoming) || []};
    }catch(error){
      console.warn('Chat poll', error);
      return {ok: false, error};
    }finally{
      chatPolling = false;
      chatPollStartedAt = 0;
    }
  }
  function coachClient(){
    return ready() && global.CoachCloud.getClient ? global.CoachCloud.getClient() : null;
  }
  function parentClient(){
    if(!ready()) return null;
    if(global.CoachCloud.getParentClient) return global.CoachCloud.getParentClient();
    return coachClient();
  }
  function client(role){
    return role === 'coach' ? coachClient() : parentClient();
  }
  function tt(key, fallback){
    try{
      if(typeof t === 'function'){
        const value = t(key);
        if(value && value !== key) return value;
      }
    }catch(e){}
    return fallback || key;
  }
  function normalizeCredentials(email, password){
    const credentials = {
      email: String(email || '').trim().toLowerCase(),
      password: String(password || '')
    };
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) throw new Error('bad_email');
    if(credentials.password.length < 6) throw new Error('bad_password');
    return credentials;
  }
  async function getSession(){
    const sb = parentClient();
    if(!sb) return null;
    const {data, error} = await sb.auth.getSession();
    if(error) throw error;
    return (data && data.session) || null;
  }
  /** Free personal account (also used for parent cloud links). */
  async function signUp(email, password){
    const sb = parentClient();
    if(!sb) throw new Error('no_cloud');
    const credentials = normalizeCredentials(email, password);
    const {data, error} = await sb.auth.signUp(credentials);
    if(error){
      if(/already|exists|registered/i.test(String(error.message || ''))) throw new Error('exists');
      throw error;
    }
    if(data && data.session) return data.session;
    throw new Error('confirm_email');
  }
  async function signIn(email, password){
    const sb = parentClient();
    if(!sb) throw new Error('no_cloud');
    const credentials = normalizeCredentials(email, password);
    const {data, error} = await sb.auth.signInWithPassword(credentials);
    if(error){
      if(/not.?confirmed|confirm/i.test(String(error.message || error.code || ''))) throw new Error('confirm_email');
      throw new Error('auth');
    }
    if(data && data.session) return data.session;
    throw new Error('auth');
  }
  async function signOut(){
    const sb = parentClient();
    if(sb) await sb.auth.signOut();
  }
  function isNativeShell(){
    try{
      if(typeof global.isNativeApp === 'function') return !!global.isNativeApp();
      const C = global.Capacitor;
      if(C && typeof C.isNativePlatform === 'function') return !!C.isNativePlatform();
    }catch(e){}
    return false;
  }
  function authRedirectTo(){
    if(isNativeShell()) return 'ffk://auth-callback';
    try{
      if(global.location && /^https:/i.test(global.location.href)){
        const path = String(global.location.pathname || '/');
        const base = path.includes('/ffk') ? path.replace(/\/[^/]*$/, '/') : '/ffk/';
        return global.location.origin + (base.endsWith('/') ? base : base + '/');
      }
    }catch(e){}
    return 'https://ihormich.github.io/ffk/';
  }
  function capPlugin(name){
    try{
      const C = global.Capacitor;
      if(!C) return null;
      if(C.Plugins && C.Plugins[name]) return C.Plugins[name];
      if(typeof C.registerPlugin === 'function') return C.registerPlugin(name);
    }catch(e){}
    return null;
  }
  async function openAuthUrl(url){
    const href = String(url || '');
    if(!href) throw new Error('auth');
    if(isNativeShell()){
      const Browser = capPlugin('Browser');
      if(Browser && typeof Browser.open === 'function'){
        await Browser.open({url: href, presentationStyle: 'popover'});
        return;
      }
    }
    global.location.href = href;
  }
  async function closeAuthBrowser(){
    try{
      const Browser = capPlugin('Browser');
      if(Browser && typeof Browser.close === 'function') await Browser.close();
    }catch(e){}
  }
  function parseAuthCallbackUrl(rawUrl){
    const text = String(rawUrl || '');
    if(!text) return {code: '', access_token: '', refresh_token: ''};
    let normalized = text;
    if(/^ffk:/i.test(normalized)) normalized = normalized.replace(/^ffk:/i, 'https://ffk.local');
    try{
      const u = new URL(normalized);
      const hash = String(u.hash || '').replace(/^#/, '');
      const hashParams = new URLSearchParams(hash);
      return {
        code: u.searchParams.get('code') || hashParams.get('code') || '',
        access_token: u.searchParams.get('access_token') || hashParams.get('access_token') || '',
        refresh_token: u.searchParams.get('refresh_token') || hashParams.get('refresh_token') || ''
      };
    }catch(e){
      const code = (text.match(/[?&#]code=([^&#]+)/i) || [])[1] || '';
      const access_token = (text.match(/[?&#]access_token=([^&#]+)/i) || [])[1] || '';
      const refresh_token = (text.match(/[?&#]refresh_token=([^&#]+)/i) || [])[1] || '';
      return {
        code: decodeURIComponent(code),
        access_token: decodeURIComponent(access_token),
        refresh_token: decodeURIComponent(refresh_token)
      };
    }
  }
  async function handleAuthCallbackUrl(rawUrl){
    const sb = parentClient();
    if(!sb) throw new Error('no_cloud');
    const parts = parseAuthCallbackUrl(rawUrl);
    let session = null;
    if(parts.code){
      const {data, error} = await sb.auth.exchangeCodeForSession(parts.code);
      if(error) throw error;
      session = data && data.session;
    }else if(parts.access_token && parts.refresh_token){
      const {data, error} = await sb.auth.setSession({
        access_token: parts.access_token,
        refresh_token: parts.refresh_token
      });
      if(error) throw error;
      session = data && data.session;
    }
    await closeAuthBrowser();
    return session || null;
  }
  async function consumeAuthRedirectFromLocation(){
    try{
      if(!global.location) return null;
      const href = String(global.location.href || '');
      if(!/[?&#](code|access_token)=/i.test(href)) return null;
      const session = await handleAuthCallbackUrl(href);
      try{
        const clean = global.location.origin + global.location.pathname + global.location.search
          .replace(/([?&])(code|access_token|refresh_token|provider|type)=[^&]*/gi, '$1')
          .replace(/[?&]$/, '');
        global.history.replaceState({}, '', clean.split('#')[0]);
      }catch(e){}
      return session;
    }catch(e){
      return null;
    }
  }
  async function signInWithGoogle(){
    const sb = parentClient();
    if(!sb) throw new Error('no_cloud');
    try{ localStorage.setItem('ffk_oauth_role', 'parent'); }catch(e){}
    const native = isNativeShell();
    const {data, error} = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectTo(),
        skipBrowserRedirect: native,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    });
    if(error) throw error;
    if(native){
      if(!data || !data.url) throw new Error('auth');
      await openAuthUrl(data.url);
    }
    return true;
  }
  let authDeepLinksBound = false;
  function bindAuthDeepLinks(onSession){
    if(authDeepLinksBound) return;
    authDeepLinksBound = true;
    const notify = async (session) => {
      if(!session) return;
      try{ if(typeof onSession === 'function') await onSession(session); }catch(e){}
    };
    consumeAuthRedirectFromLocation().then(notify).catch(() => {});
    try{
      const App = capPlugin('App');
      if(App && typeof App.addListener === 'function'){
        App.addListener('appUrlOpen', async (event) => {
          const url = event && event.url ? String(event.url) : '';
          if(!/auth-callback|access_token=|code=/i.test(url)) return;
          let role = '';
          try{ role = localStorage.getItem('ffk_oauth_role') || ''; }catch(e){}
          if(role === 'coach') return;
          try{
            const session = await handleAuthCallbackUrl(url);
            await notify(session);
          }catch(e){}
        });
        if(typeof App.getLaunchUrl === 'function'){
          App.getLaunchUrl().then(async (res) => {
            const url = res && res.url ? String(res.url) : '';
            if(!url) return;
            if(!/auth-callback|access_token=|code=/i.test(url)) return;
            let role = '';
            try{ role = localStorage.getItem('ffk_oauth_role') || ''; }catch(e){}
            if(role === 'coach') return;
            try{
              const session = await handleAuthCallbackUrl(url);
              await notify(session);
            }catch(e){}
          }).catch(() => {});
        }
      }
    }catch(e){}
  }
  /** Parent account: prefer existing session, then anonymous if the project allows it. */
  async function signInWithEmail(email, password){
    try{
      return await signIn(email, password);
    }catch(e){
      if(e && e.message === 'auth'){
        return signUp(email, password);
      }
      throw e;
    }
  }
  async function ensureSession(interactive){
    const sb = parentClient();
    if(!sb) throw new Error('no_cloud');
    const existing = await getSession();
    if(existing) return existing;
    // Never interrupt claim/RSVP with email+password browser prompts.
    // Cross-device sync uses Settings → Free account or Google when the user wants it.
    if(typeof sb.auth.signInAnonymously === 'function'){
      try{
        const anon = await sb.auth.signInAnonymously();
        if(anon.data && anon.data.session) return anon.data.session;
      }catch(e){}
    }
    throw new Error('no_session');
  }
  function tokenFromUrl(raw){
    const text = String(raw || '');
    const m = text.match(/[?&#]token=([A-Za-z0-9_-]{12,64})/i);
    return m ? m[1] : '';
  }
  function buildInviteUrl(token){
    const value = String(token || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    return value ? `https://ihormich.github.io/ffk/open.html?token=${encodeURIComponent(value)}` : '';
  }
  function coachLinks(){
    try{
      const list = JSON.parse(localStorage.getItem(COACH_LINKS_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }
  function isCoachPlayerLinked(teamPlayerId){
    const id = String(teamPlayerId || '');
    return !!id && coachLinks().some(link => String(link.team_player_id || '') === id);
  }
  /** Keep coach-side link cache warm right after a same-device claim. */
  function rememberCoachLink(link){
    const teamPlayerId = String(link && (link.team_player_id || (link.player && link.player.id)) || '');
    if(!teamPlayerId) return;
    const personalPlayerId = String(link && link.personal_player_id || '');
    let parentUserId = String(link && link.parent_user_id || '');
    if(!parentUserId){
      try{
        const sb = parentClient();
        // Best-effort: syncChats needs parent_user_id for coach→parent delivery.
        sb && sb.auth.getSession().then(res => {
          const uid = res && res.data && res.data.session && res.data.session.user && res.data.session.user.id;
          if(!uid) return;
          try{
            const prev = coachLinks().map(row =>
              String(row.team_player_id || '') === teamPlayerId
                ? {...row, parent_user_id: String(uid)}
                : row
            );
            localStorage.setItem(COACH_LINKS_KEY, JSON.stringify(prev));
          }catch(e){}
        }).catch(() => {});
      }catch(e){}
    }
    try{
      const prev = coachLinks().filter(row => String(row.team_player_id || '') !== teamPlayerId);
      prev.push({
        team_player_id: teamPlayerId,
        personal_player_id: personalPlayerId,
        parent_user_id: parentUserId,
        status: 'active'
      });
      localStorage.setItem(COACH_LINKS_KEY, JSON.stringify(prev));
    }catch(e){}
  }
  async function publishInvite(invite){
    const sb = client('coach');
    if(!sb || !invite) throw new Error('no_cloud');
    if(global.CoachCloud && typeof global.CoachCloud.pushLocalSnapshot === 'function'){
      const pushed = await global.CoachCloud.pushLocalSnapshot();
      if(!pushed || !pushed.ok) throw new Error('sync');
    }
    const {error} = await sb.from('parent_invites').upsert({
      id: invite.id,
      token: invite.token,
      code: invite.code,
      team_id: invite.team_id,
      team_player_id: invite.team_player_id,
      payload: invite.payload || {},
      status: invite.status || 'open',
      created_at: invite.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {onConflict: 'id'});
    if(error) throw error;
    return buildInviteUrl(invite.token);
  }
  async function resolveInvite(token){
    const sb = client('parent');
    if(!sb || !token) throw new Error('no_cloud');
    const {data, error} = await sb.rpc('resolve_parent_invite', {invite_token: token});
    if(error) throw error;
    if(!data) throw new Error('bad_invite');
    return data;
  }
  function normalizeInviteCode(raw){
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }
  function codeFromText(raw){
    const text = String(raw || '');
    const fromQuery = text.match(/[?&#]code=(?:MC-)?([A-Za-z0-9]{4,8})/i);
    if(fromQuery) return normalizeInviteCode(fromQuery[1]);
    const trimmed = text.trim();
    if(/^(?:MC-)?[A-Za-z0-9]{4,8}$/i.test(trimmed)){
      return normalizeInviteCode(trimmed.replace(/^MC-/i, ''));
    }
    return '';
  }
  async function resolveInviteByCode(code){
    const sb = client('parent');
    const cleaned = normalizeInviteCode(code);
    if(!sb || cleaned.length < 4) throw new Error('bad_invite');
    const {data, error} = await sb.rpc('resolve_parent_invite_by_code', {invite_code: cleaned});
    if(error) throw error;
    if(!data) throw new Error('bad_invite');
    return data;
  }
  function activeProfile(){
    const id = global.ParentStore && global.ParentStore.currentPersonalPlayerId
      ? global.ParentStore.currentPersonalPlayerId()
      : '';
    if(!id) return null;
    if(typeof listPersonalPlayerHistories === 'function'){
      return listPersonalPlayerHistories().find(p => String(p.id) === String(id)) || null;
    }
    return null;
  }
  async function claimInvite(token){
    const sb = client('parent');
    const profile = activeProfile();
    if(!sb || !token || !profile) throw new Error('bad_invite');
    try{
      await ensureSession(false);
    }catch(e){
      // Local claim still works without a cloud session.
      if(e && (e.message === 'no_session' || e.message === 'no_cloud' || e.message === 'auth')){
        return null;
      }
      throw e;
    }
    const {data, error} = await sb.rpc('claim_parent_invite', {
      invite_token: token,
      personal_id: profile.id,
      personal_first_name: profile.firstName || '',
      personal_last_name: profile.lastName || '',
      personal_birth_date: profile.birthDate || ''
    });
    if(error) throw error;
    return data;
  }
  function dataUrlBlob(src){
    const m = String(src || '').match(/^data:([^;,]+);base64,(.+)$/);
    if(!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type: m[1] || 'image/jpeg'});
  }
  async function pushProfile(link, profile, session){
    const sb = client('parent');
    if(!sb || !link || !profile || !session) return;
    let photoPath = '';
    const blob = dataUrlBlob(profile.photo);
    if(blob){
      photoPath = `${session.user.id}/${profile.id}/photo.jpg`;
      const uploaded = await sb.storage.from('player-media').upload(photoPath, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true
      });
      if(uploaded.error) throw uploaded.error;
    }
    const {error: profileError} = await sb.from('personal_players').upsert({
      id: profile.id,
      owner_user_id: session.user.id,
      first_name: profile.firstName || '',
      last_name: profile.lastName || '',
      birth_date: profile.birthDate || '',
      ...(photoPath ? {photo_path: photoPath} : {}),
      updated_at: new Date().toISOString()
    }, {onConflict: 'id'});
    if(profileError) throw profileError;
    const rows = (profile.matches || []).map(match => ({
      parent_user_id: session.user.id,
      personal_player_id: profile.id,
      team_player_id: link.player.id,
      local_match_id: String(match.id || ''),
      match_data: match,
      updated_at: new Date().toISOString()
    })).filter(row => row.local_match_id);
    if(rows.length){
      const {error} = await sb.from('parent_matches').upsert(rows, {
        onConflict: 'parent_user_id,personal_player_id,local_match_id'
      });
      if(error) throw error;
    }
  }
  async function notifyChatPush(messageId){
    const id = String(messageId || '').trim();
    if(!id || !ready()) return {ok: false, reason: 'no_cloud'};
    const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
    const sb = coachMode ? coachClient() : parentClient();
    if(!sb) return {ok: false, reason: 'no_client'};
    try{
      const {data, error} = await sb.functions.invoke('send-chat-push', {
        body: {message_id: id}
      });
      if(error) throw error;
      return data || {ok: true};
    }catch(error){
      console.warn('Chat push', error);
      return {ok: false, error};
    }
  }
  async function resolveParentUserIds(sb, teamPlayerId){
    const pid = String(teamPlayerId || '');
    if(!sb || !pid) return [];
    const cached = (coachLinks() || [])
      .filter(l => String(l.team_player_id || '') === pid && l.parent_user_id)
      .map(l => String(l.parent_user_id));
    if(cached.length) return [...new Set(cached)];
    try{
      const {data, error} = await sb.from('parent_player_links')
        .select('parent_user_id,team_player_id,status')
        .eq('team_player_id', pid)
        .eq('status', 'active');
      if(error) throw error;
      const ids = (data || []).map(r => String(r.parent_user_id || '')).filter(Boolean);
      if(ids.length){
        try{
          const prev = coachLinks().filter(row => String(row.team_player_id || '') !== pid);
          ids.forEach(uid => {
            prev.push({
              team_player_id: pid,
              personal_player_id: '',
              parent_user_id: uid,
              status: 'active'
            });
          });
          localStorage.setItem(COACH_LINKS_KEY, JSON.stringify(prev));
        }catch(e){}
      }
      return [...new Set(ids)];
    }catch(e){
      return [];
    }
  }
  /** Upsert one outgoing chat row then wake the other device via FCM. */
  async function pushChatMessage(message){
    if(!ready() || !message || !message.id) return {ok: false, reason: 'bad'};
    const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
    const senderRole = message.sender_role === 'coach' ? 'coach' : 'parent';
    const sb = coachMode ? coachClient() : parentClient();
    if(!sb) return {ok: false, reason: 'no_client'};
    let session = null;
    try{
      const {data} = await sb.auth.getSession();
      session = data && data.session;
    }catch(e){}
    if(!session){
      try{ session = await ensureSession(false); }catch(e){}
    }
    if(!session) return {ok: false, reason: 'no_session'};
    let parentUserIds = [];
    if(senderRole === 'parent'){
      parentUserIds = [session.user.id];
    }else{
      if(message.parent_user_id) parentUserIds = [String(message.parent_user_id)];
      else parentUserIds = await resolveParentUserIds(sb, message.team_player_id);
    }
    if(!parentUserIds.length) return {ok: false, reason: 'no_parent'};
    const results = [];
    const isBroadcast = !!String(message.broadcast_id || '').trim();
    for(const parentUserId of parentUserIds){
      const row = {
        id: parentUserIds.length > 1
          ? `${message.id}_${String(parentUserId).slice(0, 8)}`
          : message.id,
        team_player_id: message.team_player_id,
        parent_user_id: parentUserId,
        sender_user_id: message.sender_user_id || session.user.id,
        sender_role: senderRole,
        body: message.text || message.body || '',
        broadcast_id: String(message.broadcast_id || ''),
        edited_at: message.edited_at || null,
        read_by_parent: !!message.read_by_parent,
        read_by_coach: !!message.read_by_coach,
        created_at: message.created_at || new Date().toISOString()
      };
      const {error} = await sb.from('player_chat_messages').upsert(row, {onConflict: 'id'});
      if(error){
        results.push({ok: false, error});
        continue;
      }
      // Team broadcasts: DB trigger still wakes FCM (collapse_key dedupes). Skip client
      // re-invoke here so parents don't get a drip of N identical alerts.
      if(!isBroadcast){
        const pushed = await notifyChatPush(row.id);
        results.push({ok: true, push: pushed, id: row.id});
      }else{
        results.push({ok: true, push: {skipped: 'broadcast'}, id: row.id});
      }
    }
    const ok = results.some(r => r.ok);
    return {ok, results};
  }
  /** Upsert a full team broadcast once, then one FCM per unique parent. */
  async function pushChatBroadcast(messages){
    const list = (Array.isArray(messages) ? messages : []).filter(m => m && m.id);
    if(!list.length) return {ok: false, reason: 'empty'};
    const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
    const sb = coachMode ? coachClient() : parentClient();
    if(!sb || !ready()) return {ok: false, reason: 'no_client'};
    let session = null;
    try{
      const {data} = await sb.auth.getSession();
      session = data && data.session;
    }catch(e){}
    if(!session){
      try{ session = await ensureSession(false); }catch(e){}
    }
    if(!session) return {ok: false, reason: 'no_session'};
    const broadcastId = String(list[0].broadcast_id || '').trim() || list[0].id;
    const rows = [];
    const notifyParents = new Map(); // parentUserId → representative message id
    for(const message of list){
      const parentUserIds = message.parent_user_id
        ? [String(message.parent_user_id)]
        : await resolveParentUserIds(sb, message.team_player_id);
      for(const parentUserId of parentUserIds){
        const id = parentUserIds.length > 1
          ? `${message.id}_${String(parentUserId).slice(0, 8)}`
          : message.id;
        rows.push({
          id,
          team_player_id: message.team_player_id,
          parent_user_id: parentUserId,
          sender_user_id: message.sender_user_id || session.user.id,
          sender_role: 'coach',
          body: message.text || message.body || '',
          broadcast_id: broadcastId,
          edited_at: message.edited_at || null,
          read_by_parent: !!message.read_by_parent,
          read_by_coach: !!message.read_by_coach,
          created_at: message.created_at || new Date().toISOString()
        });
        if(!notifyParents.has(parentUserId)) notifyParents.set(parentUserId, id);
      }
    }
    if(!rows.length) return {ok: false, reason: 'no_parent'};
    // Chunk upserts to avoid payload limits on large squads.
    for(let i = 0; i < rows.length; i += 40){
      const chunk = rows.slice(i, i + 40);
      const {error} = await sb.from('player_chat_messages').upsert(chunk, {onConflict: 'id'});
      if(error) return {ok: false, error};
    }
    // One push per parent (DB trigger may also fire — FCM collapse_key merges them).
    const pushResults = [];
    for(const messageId of notifyParents.values()){
      pushResults.push(await notifyChatPush(messageId));
    }
    return {ok: true, count: rows.length, parents: notifyParents.size, pushResults};
  }
  function noticeTitleBody(noticeType, payload){
    const opponent = String(payload && payload.opponent || '').trim();
    const date = String(payload && payload.date || '').trim();
    const when = [opponent, date].filter(Boolean).join(' · ');
    if(noticeType === 'match_result'){
      return {
        title: 'Matchcard',
        body: `Карточка матча${when ? ': ' + when : ''}`.slice(0, 180)
      };
    }
    if(noticeType === 'match_cancelled'){
      return {
        title: 'Матч отменён',
        body: when || 'Матч отменён'
      };
    }
    if(noticeType === 'match_recalled'){
      return {
        title: 'Вызов снят',
        body: when || 'Игрок больше не в заявке'
      };
    }
    if(noticeType === 'match_updated'){
      return {
        title: 'Изменение матча',
        body: when || 'Обновлены детали матча'
      };
    }
    return {
      title: 'Приглашение на матч',
      body: when || 'Новое приглашение на матч'
    };
  }
  /** Coach → remote parent inbox card + FCM (works with app fully closed). */
  async function pushParentNotice(input){
    if(!ready() || !input || !input.team_player_id) return {ok: false, reason: 'bad'};
    const sb = coachClient() || parentClient();
    if(!sb) return {ok: false, reason: 'no_client'};
    let session = null;
    try{
      const {data} = await sb.auth.getSession();
      session = data && data.session;
    }catch(e){}
    if(!session){
      try{ session = await ensureSession(false); }catch(e){}
    }
    if(!session) return {ok: false, reason: 'no_session'};
    const noticeType = String(input.notice_type || 'match_invite');
    const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
    const parents = input.parent_user_id
      ? [String(input.parent_user_id)]
      : await resolveParentUserIds(sb, input.team_player_id);
    if(!parents.length) return {ok: false, reason: 'no_parent'};
    const copy = noticeTitleBody(noticeType, payload);
    const title = String(input.title || copy.title).slice(0, 80);
    const body = String(input.body || copy.body).slice(0, 180);
    const baseId = String(input.id || `${noticeType}_${payload.match_id || 'x'}_${input.team_player_id}`);
    const out = [];
    for(const parentUserId of parents){
      const id = parents.length > 1 ? `${baseId}_${String(parentUserId).slice(0, 8)}` : baseId;
      const row = {
        id,
        parent_user_id: parentUserId,
        team_player_id: String(input.team_player_id),
        notice_type: noticeType,
        title,
        body,
        payload,
        created_at: input.created_at || new Date().toISOString(),
        read_at: null
      };
      const {error} = await sb.from('parent_notices').upsert(row, {onConflict: 'id'});
      if(error){
        out.push({ok: false, error});
        continue;
      }
      try{
        await sb.functions.invoke('send-chat-push', {body: {notice_id: id}});
      }catch(e){}
      out.push({ok: true, id});
    }
    return {ok: out.some(r => r.ok), results: out};
  }
  async function pullParentNotices(session){
    const sb = parentClient();
    if(!sb || !session || !global.InboxStore) return {ok: false, imported: 0};
    const {data, error} = await sb.from('parent_notices')
      .select('id,team_player_id,notice_type,title,body,payload,created_at,read_at')
      .eq('parent_user_id', session.user.id)
      .order('created_at', {ascending: false})
      .limit(80);
    if(error) return {ok: false, error};
    const deleted = global.InboxStore.listDeleted ? global.InboxStore.listDeleted() : {};
    let imported = 0;
    const staleNoticeIds = [];
    for(const row of (data || [])){
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      const type = String(row.notice_type || '');
      const playerId = String(row.team_player_id || payload.team_player_id || '');
      const matchId = String(payload.match_id || '');
      const inviteKey = `match_invite:${matchId}:${playerId}`;
      const resultKey = `match_result:${matchId}:${playerId}`;
      const noticeKey = `notice:${row.id}`;
      try{
        if(deleted[noticeKey]){
          staleNoticeIds.push(row.id);
          continue;
        }
        if(type === 'match_result'){
          const delAt = deleted[resultKey];
          if(delAt && (!row.created_at || new Date(row.created_at).getTime() <= new Date(delAt).getTime())){
            staleNoticeIds.push(row.id);
            continue;
          }
          const existing = global.InboxStore.findMatchResult
            ? global.InboxStore.findMatchResult(matchId, playerId)
            : null;
          const locallyRead = !!(existing && existing.status === 'read');
          if(locallyRead && !row.read_at){
            try{
              await sb.from('parent_notices').update({read_at: new Date().toISOString()}).eq('id', row.id);
            }catch(e){}
          }
          if(typeof global.InboxStore.upsertMatchResult === 'function'){
            global.InboxStore.upsertMatchResult({
              ...payload,
              team_player_id: playerId,
              cloud_notice_id: row.id,
              forceUnread: !row.read_at && !locallyRead
            });
            imported += 1;
          }
        }else if(typeof global.InboxStore.upsertMatchInvite === 'function'){
          const delAt = deleted[inviteKey];
          if(delAt && (!row.created_at || new Date(row.created_at).getTime() <= new Date(delAt).getTime())){
            staleNoticeIds.push(row.id);
            continue;
          }
          const existing = global.InboxStore.findMatchInvite
            ? global.InboxStore.findMatchInvite(matchId, playerId)
            : null;
          const locallyRead = !!(existing && existing.status === 'read');
          if(locallyRead && !row.read_at){
            try{
              await sb.from('parent_notices').update({read_at: new Date().toISOString()}).eq('id', row.id);
            }catch(e){}
          }
          const notice = type === 'match_invite' ? ''
            : (type === 'match_updated' ? 'updated'
              : (type === 'match_recalled' ? 'recalled'
                : (type === 'match_cancelled' ? 'cancelled' : (payload.invite_notice || ''))));
          global.InboxStore.upsertMatchInvite({
            ...payload,
            team_player_id: playerId,
            cloud_notice_id: row.id,
            invite_notice: notice || undefined,
            forceUnread: !row.read_at && !locallyRead,
            resetRsvp: !!notice && !locallyRead,
            clearNotice: !notice
          });
          imported += 1;
        }
      }catch(e){}
    }
    if(staleNoticeIds.length){
      try{
        await sb.from('parent_notices').delete().in('id', staleNoticeIds).eq('parent_user_id', session.user.id);
      }catch(e){}
    }
    return {ok: true, imported};
  }
  async function dismissParentNotices(opts){
    opts = opts || {};
    const sb = parentClient();
    if(!sb || !ready()) return {ok: false};
    let session = null;
    try{ session = await getSession(); }catch(e){}
    if(!session){
      try{ session = await ensureSession(false); }catch(e){ return {ok: false}; }
    }
    try{
      if(opts.noticeId){
        await sb.from('parent_notices').delete().eq('id', String(opts.noticeId)).eq('parent_user_id', session.user.id);
      }
      if(opts.matchId && opts.teamPlayerId){
        const {data} = await sb.from('parent_notices')
          .select('id,payload,team_player_id')
          .eq('parent_user_id', session.user.id)
          .eq('team_player_id', String(opts.teamPlayerId));
        const ids = (data || []).filter(row => {
          const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
          return String(p.match_id || '') === String(opts.matchId);
        }).map(row => row.id);
        if(ids.length){
          await sb.from('parent_notices').delete().in('id', ids);
        }
      }
      return {ok: true};
    }catch(e){
      return {ok: false, error: e};
    }
  }
  async function markParentNoticesRead(opts){
    opts = opts || {};
    const sb = parentClient();
    if(!sb || !ready()) return {ok: false};
    let session = null;
    try{ session = await getSession(); }catch(e){}
    if(!session){
      try{ session = await ensureSession(false); }catch(e){ return {ok: false}; }
    }
    try{
      const now = new Date().toISOString();
      if(opts.noticeId){
        await sb.from('parent_notices').update({read_at: now}).eq('id', String(opts.noticeId)).eq('parent_user_id', session.user.id);
      }
      if(opts.matchId && opts.teamPlayerId){
        const {data} = await sb.from('parent_notices')
          .select('id,payload,team_player_id,read_at')
          .eq('parent_user_id', session.user.id)
          .eq('team_player_id', String(opts.teamPlayerId))
          .is('read_at', null);
        const ids = (data || []).filter(row => {
          const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
          return String(p.match_id || '') === String(opts.matchId);
        }).map(row => row.id);
        if(ids.length){
          await sb.from('parent_notices').update({read_at: now}).in('id', ids);
        }
      }
      return {ok: true};
    }catch(e){
      return {ok: false, error: e};
    }
  }
  async function syncChats(session, links, senderRole, opts){
    opts = opts || {};
    const pullOnly = !!opts.pullOnly;
    const recentLimit = Number(opts.recentLimit) > 0 ? Math.floor(Number(opts.recentLimit)) : 0;
    const sb = client(senderRole === 'coach' ? 'coach' : 'parent');
    if(!sb || !session || !global.InboxStore) return {ok: false, incoming: []};
    const byPlayer = new Map((links || []).map(link => [
      String(link.team_player_id || link.player && link.player.id || ''),
      link
    ]));
    if(!pullOnly){
      const rows = global.InboxStore.listAll()
        .filter(m =>
          m.type === 'chat_message'
          && m.sender_role === senderRole
          && byPlayer.has(String(m.team_player_id || ''))
        )
        .map(m => {
          const link = byPlayer.get(String(m.team_player_id));
          return {
            id: m.id,
            team_player_id: m.team_player_id,
            parent_user_id: senderRole === 'parent'
              ? session.user.id
              : link.parent_user_id,
            sender_user_id: m.sender_user_id || session.user.id,
            sender_role: m.sender_role,
            body: m.text,
            broadcast_id: String(m.broadcast_id || ''),
            edited_at: m.edited_at || null,
            read_by_parent: !!m.read_by_parent,
            read_by_coach: !!m.read_by_coach,
            created_at: m.created_at || new Date().toISOString()
          };
        }).filter(row => row.parent_user_id && row.sender_user_id);
      if(rows.length){
        const {error} = await sb.from('player_chat_messages').upsert(rows, {onConflict: 'id'});
        if(error) throw error;
        // Wake the other phone via FCM even if their app is fully closed.
        // One notify per team broadcast — not one per fan-out row.
        const seenBroadcast = new Set();
        const freshIds = [];
        rows.forEach(r => {
          const t = Date.parse(r.created_at || '');
          if(!Number.isFinite(t) || Date.now() - t >= 90 * 1000) return;
          const bc = String(r.broadcast_id || '').trim();
          if(bc){
            if(seenBroadcast.has(bc)) return;
            seenBroadcast.add(bc);
          }
          if(r.id) freshIds.push(r.id);
        });
        freshIds.slice(0, 8).forEach(id => {
          notifyChatPush(id).catch(() => {});
        });
      }
      const readIds = global.InboxStore.listAll()
        .filter(m =>
          m.type === 'chat_message'
          && m.sender_role !== senderRole
          && byPlayer.has(String(m.team_player_id || ''))
          && (senderRole === 'parent' ? m.read_by_parent : m.read_by_coach)
        )
        .map(m => m.id);
      for(const id of readIds){
        const marked = await sb.rpc('mark_player_chat_read', {message_id: id});
        if(marked.error) throw marked.error;
      }
      const deleted = global.InboxStore.listDeleted ? global.InboxStore.listDeleted() : {};
      const deletedChatIds = Object.keys(deleted)
        .filter(key => key.startsWith('chat:'))
        .map(key => key.slice('chat:'.length))
        .filter(Boolean);
      for(const id of deletedChatIds){
        const removed = await sb.rpc('delete_player_chat_message', {message_id: id});
        if(removed.error) throw removed.error;
      }
    }
    const playerIds = [...byPlayer.keys()].filter(Boolean);
    if(!playerIds.length) return {ok: true, incoming: []};
    let query = sb.from('player_chat_messages')
      .select('*')
      .in('team_player_id', playerIds)
      .order('created_at', {ascending: false});
    if(recentLimit) query = query.limit(recentLimit);
    const pulled = await query;
    if(pulled.error) throw pulled.error;
    const incoming = [];
    (pulled.data || []).forEach(row => {
      const link = byPlayer.get(String(row.team_player_id)) || {};
      let playerName = link.player && [link.player.first_name, link.player.last_name].filter(Boolean).join(' ');
      let teamName = link.team && link.team.name || '';
      if(!playerName && global.CoachStore && global.CoachStore.getSession){
        try{
          const coachSession = global.CoachStore.getSession();
          const player = coachSession && global.CoachStore.getPlayer(coachSession, row.team_player_id);
          const team = player && global.CoachStore.getTeam(coachSession, player.team_id);
          playerName = player && [player.first_name, player.last_name].filter(Boolean).join(' ');
          teamName = team && team.name || teamName;
        }catch(e){}
      }
      try{
        const imported = global.InboxStore.importCloudChat({
          ...row,
          player_name: playerName || '',
          team_name: teamName,
          academy_name: link.academy && link.academy.name || '',
          coach_name: String(row.broadcast_id || '').trim()
            ? tt('chatTeamFromCoach', 'Head coach')
            : ((link.coach && typeof link.coach.name === 'string' && link.coach.name !== '[object Object]')
              ? link.coach.name
              : '')
        });
        const msg = imported && imported.row ? imported.row : null;
        if(imported && imported.isNew && msg && msg.sender_role && msg.sender_role !== senderRole){
          incoming.push(msg);
        }
      }catch(e){}
    });
    return {ok: true, incoming};
  }
  async function syncParentData(options){
    if(!ready() || syncing) return {ok: false, reason: ready() ? 'busy' : 'no_cloud'};
    syncing = true;
    try{
      const session = await ensureSession(!!(options && options.interactive));
      const links = global.ParentStore && global.ParentStore.listLinks
        ? global.ParentStore.listLinks()
        : [];
      const profiles = typeof listPersonalPlayerHistories === 'function'
        ? listPersonalPlayerHistories()
        : [];
      for(const link of links){
        const profile = profiles.find(p => String(p.id) === String(link.personal_player_id || ''));
        if(!profile) continue;
        if(link.token){
          try{ await claimInvite(link.token); }catch(e){
            // Already-claimed links still synchronize through their existing membership.
          }
        }
        await pushProfile(link, profile, session);
      }
      const chatRes = await syncChats(session, links, 'parent');
      notifyIncomingChats(chatRes && chatRes.incoming);
      try{ await pullParentNotices(session); }catch(e){}
      try{
        const teamIds = [...new Set(links.map(l => l && l.team && l.team.id).filter(Boolean))];
        if(teamIds.length){
          const sb = parentClient();
          const rulesRes = await sb.from('training_rules').select('*').in('team_id', teamIds);
          const rowsRes = await sb.from('team_trainings').select('*').in('team_id', teamIds);
          if(!rulesRes.error && !rowsRes.error && global.CoachStore){
            // Expand using a temporary local view without wiping coach DB:
            // cache expanded lists per team for ParentStore.
            const today = new Date().toISOString().slice(0, 10);
            const toDate = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
            const ymdAdd = (ymd, days) => {
              const t0 = Date.parse(ymd + 'T12:00:00');
              const d = new Date(t0 + days * 86400000);
              return d.toISOString().slice(0, 10);
            };
            const ymdWd = (ymd) => new Date(Date.parse(ymd + 'T12:00:00')).getDay();
            const rules = rulesRes.data || [];
            const rows = rowsRes.data || [];
            teamIds.forEach(teamId => {
              const teamRules = rules.filter(r => r.team_id === teamId && r.active !== false);
              const teamRows = rows.filter(r => r.team_id === teamId);
              const overrides = new Map();
              teamRows.forEach(r => { if(r.rule_id) overrides.set(r.date + '|' + r.rule_id, r); });
              const out = [];
              teamRules.forEach(rule => {
                const days = Array.isArray(rule.weekdays) ? rule.weekdays.map(Number) : [];
                let cur = today;
                while(cur <= toDate){
                  if(days.includes(ymdWd(cur))){
                    const ov = overrides.get(cur + '|' + rule.id);
                    if(ov && ov.status === 'cancelled'){ /* skip */ }
                    else if(ov){
                      out.push({
                        id: ov.id, team_id: teamId, rule_id: rule.id, date: ov.date,
                        title: ov.title || rule.title || '', start_time: ov.start_time || rule.start_time || '',
                        end_time: ov.end_time || rule.end_time || '', address: ov.address || rule.address || '',
                        notify_minutes: Number(ov.notify_minutes != null ? ov.notify_minutes : rule.notify_minutes) || 60,
                        recurring: true
                      });
                    }else{
                      out.push({
                        id: 'occ_' + rule.id + '_' + cur, team_id: teamId, rule_id: rule.id, date: cur,
                        title: rule.title || '', start_time: rule.start_time || '', end_time: rule.end_time || '',
                        address: rule.address || '', notify_minutes: Number(rule.notify_minutes) || 60, recurring: true
                      });
                    }
                  }
                  cur = ymdAdd(cur, 1);
                }
              });
              teamRows.filter(r => !r.rule_id && r.status !== 'cancelled' && r.date >= today && r.date <= toDate)
                .forEach(r => out.push({
                  id: r.id, team_id: teamId, rule_id: '', date: r.date, title: r.title || '',
                  start_time: r.start_time || '', end_time: r.end_time || '', address: r.address || '',
                  notify_minutes: Number(r.notify_minutes) || 60, recurring: false
                }));
              out.sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)));
              if(global.ParentStore && global.ParentStore.cacheTeamTrainings){
                global.ParentStore.cacheTeamTrainings(teamId, out);
              }
            });
          }
        }
      }catch(e){ console.warn('parent trainings pull', e); }
      if(typeof renderParentUi === 'function'){
        try{ renderParentUi(); }catch(e){}
      }
      try{
        if(global.CoachPush && typeof global.CoachPush.resyncTrainingReminders === 'function'){
          global.CoachPush.resyncTrainingReminders();
        }
      }catch(e){}
      return {ok: true};
    }catch(error){
      if(typeof reportError === 'function') reportError(error, {scope: 'sync.parent', silent: true});
      else console.warn('Parent cloud sync', error);
      return {ok: false, error};
    }finally{
      syncing = false;
    }
  }
  function scheduleSync(){
    if(!ready()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
      const task = coachMode
        ? pullCoachData()
        : syncParentData().then(() => syncPersonalBackup({pull: true, push: true}));
      Promise.resolve(task).catch(() => {});
    }, 1200);
  }
  function isProUser(){
    // Historical name: gates personal cloud sync. Free + Pro accounts may sync.
    try{
      if(global.MatchcardAccount && typeof global.MatchcardAccount.canSyncPersonal === 'function'){
        return !!global.MatchcardAccount.canSyncPersonal();
      }
    }catch(e){}
    return true;
  }
  function readLocalSyncAt(){
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.readLocalSyncAt === 'function') return Cloud.readLocalSyncAt();
    try{ return String(localStorage.getItem(PERSONAL_SYNC_AT_KEY) || ''); }catch(e){ return ''; }
  }
  function writeLocalSyncAt(iso){
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.writeLocalSyncAt === 'function'){
      Cloud.writeLocalSyncAt(iso);
      return;
    }
    try{ localStorage.setItem(PERSONAL_SYNC_AT_KEY, String(iso || '')); }catch(e){}
  }
  function readPersonalDirty(){
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.isDirty === 'function') return Cloud.isDirty();
    try{ return localStorage.getItem(PERSONAL_DIRTY_KEY) === '1'; }catch(e){ return false; }
  }
  function writePersonalDirty(on){
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.setDirty === 'function'){
      Cloud.setDirty(!!on);
      return;
    }
    try{
      if(on) localStorage.setItem(PERSONAL_DIRTY_KEY, '1');
      else localStorage.removeItem(PERSONAL_DIRTY_KEY);
    }catch(e){}
  }
  function markPersonalDirty(){
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.markPersonalDirty === 'function'){
      wireCloudRepo();
      Cloud.markPersonalDirty();
      return;
    }
    writePersonalDirty(true);
    if(global.MatchcardSync && typeof global.MatchcardSync.markLocalDirty === 'function'){
      try{ global.MatchcardSync.markLocalDirty(); }catch(e){}
    }
  }
  function setPersonalSyncState(next){
    personalSyncState = Object.assign({}, personalSyncState, next || {});
    if(typeof global.updateCloudSyncStatusUi === 'function'){
      try{ global.updateCloudSyncStatusUi(personalSyncState); }catch(e){}
    }
  }
  async function pushPersonalBackup(session, payload, updatedAt){
    wireCloudRepo();
    const Cloud = cloudRepo();
    let body = payload;
    if(!body){
      if(typeof exportPayloadForCloud === 'function') body = await exportPayloadForCloud();
      else if(typeof exportPayload === 'function') body = exportPayload();
    }
    if(Cloud && typeof Cloud.pushPersonalBackup === 'function'){
      const out = await Cloud.pushPersonalBackup(session, body, updatedAt);
      if(out && out.ok) setPersonalSyncState({status: 'ok', at: out.at || '', error: ''});
      return out;
    }
    const sb = parentClient();
    if(!sb || !session) return {ok: false, reason: 'skip'};
    if(!body) return {ok: false, reason: 'no_export'};
    const at = updatedAt || new Date().toISOString();
    const {error} = await sb.from('personal_backups').upsert({
      owner_user_id: session.user.id,
      payload: body,
      updated_at: at
    }, {onConflict: 'owner_user_id'});
    if(error) throw error;
    writeLocalSyncAt(at);
    writePersonalDirty(false);
    setPersonalSyncState({status: 'ok', at: at, error: ''});
    return {ok: true, at: at};
  }
  async function fetchPersonalBackup(session){
    wireCloudRepo();
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.fetchPersonalBackup === 'function'){
      return Cloud.fetchPersonalBackup(session);
    }
    const sb = parentClient();
    if(!sb || !session) return null;
    const {data, error} = await sb.from('personal_backups')
      .select('payload,updated_at')
      .eq('owner_user_id', session.user.id)
      .maybeSingle();
    if(error) throw error;
    if(!data || !data.payload) return null;
    return {payload: data.payload, updatedAt: String(data.updated_at || '')};
  }
  async function pullPersonalBackup(session){
    const remote = await fetchPersonalBackup(session);
    if(!remote) return {ok: true, empty: true};
    const remoteAt = remote.updatedAt;
    const localAt = readLocalSyncAt();
    const plan = (global.MatchcardSync && typeof global.MatchcardSync.planPersonalSync === 'function')
      ? global.MatchcardSync.planPersonalSync({
          pull: true, push: false,
          localAt, remoteAt, hasRemote: true,
          localDirty: readPersonalDirty(),
          ready: true, isPro: true, hasSession: true
        })
      : null;
    if(plan && plan.steps.every(s => s.action !== 'pull_merge')){
      return {ok: true, skipped: true, plan};
    }
    if(localAt && remoteAt && remoteAt <= localAt && !(plan && plan.conflict)){
      return {ok: true, skipped: true};
    }
    if(typeof applyImportBundle === 'function'){
      try{ applyImportBundle(remote.payload); }catch(e){
        console.warn('Personal backup import', e);
        return {ok: false, error: e};
      }
    }
    if(remoteAt) writeLocalSyncAt(remoteAt);
    writePersonalDirty(true);
    setPersonalSyncState({status: 'ok', at: remoteAt || new Date().toISOString(), error: ''});
    return {ok: true, pulled: true, at: remoteAt};
  }
  function bindPersonalSyncEngine(){
    const Sync = global.MatchcardSync;
    if(!Sync || typeof Sync.bind !== 'function') return false;
    wireCloudRepo();
    const Cloud = cloudRepo();
    if(Cloud && typeof Cloud.buildSyncAdapters === 'function'){
      Sync.bind(Cloud.buildSyncAdapters({
        exportLocal: async () => {
          if(typeof exportPayloadForCloud === 'function') return exportPayloadForCloud();
          return (typeof exportPayload === 'function' ? exportPayload() : null);
        },
        applyRemote: (payload) => {
          if(typeof applyImportBundle !== 'function') throw new Error('no_import');
          applyImportBundle(payload);
        },
        nowIso: () => new Date().toISOString(),
        onState: (st) => setPersonalSyncState(st)
      }));
      return true;
    }
    Sync.bind({
      ready: () => ready(),
      isPro: () => isProUser(),
      getSession: () => getSession(),
      readLocalAt: async () => readLocalSyncAt(),
      writeLocalAt: async (iso) => writeLocalSyncAt(iso),
      isDirty: async () => readPersonalDirty(),
      setDirty: async (on) => writePersonalDirty(!!on),
      fetchRemote: async (session) => fetchPersonalBackup(session),
      applyRemote: async (payload) => {
        if(typeof applyImportBundle !== 'function') throw new Error('no_import');
        applyImportBundle(payload);
      },
      exportLocal: async () => {
        if(typeof exportPayloadForCloud === 'function') return exportPayloadForCloud();
        if(typeof exportPayload !== 'function') return null;
        return exportPayload();
      },
      pushRemote: async (session, payload, at) => {
        const out = await pushPersonalBackup(session, payload, at);
        if(!out || !out.ok) throw new Error((out && out.reason) || 'push');
      },
      nowIso: () => new Date().toISOString(),
      onState: (st) => setPersonalSyncState(st)
    });
    return true;
  }
  async function syncPersonalBackup(options){
    const opts = options || {};
    if(bindPersonalSyncEngine() && global.MatchcardSync && typeof global.MatchcardSync.runPersonalSync === 'function'){
      const out = await global.MatchcardSync.runPersonalSync(opts);
      personalSyncState = Object.assign({}, personalSyncState, (out && out.state) || {});
      return out;
    }
    // Fallback without SyncEngine
    if(!ready()) return {ok: false, reason: 'no_cloud'};
    if(!isProUser()){
      setPersonalSyncState({status: 'need_account', at: '', error: ''});
      return {ok: false, reason: 'no_sync'};
    }
    setPersonalSyncState({status: 'syncing', error: ''});
    try{
      const session = await getSession();
      if(!session || !session.user){
        setPersonalSyncState({status: 'need_account', at: '', error: ''});
        return {ok: false, reason: 'no_session'};
      }
      if(opts.pull !== false) await pullPersonalBackup(session);
      if(opts.push !== false) await pushPersonalBackup(session);
      return {ok: true, state: personalSyncState};
    }catch(error){
      console.warn('Personal backup sync', error);
      if(typeof reportError === 'function'){
        reportError(error, {scope: 'sync.personal', silent: true, data: {phase: 'fallback'}});
      }
      setPersonalSyncState({
        status: 'error',
        error: String((error && error.message) || 'sync')
      });
      return {ok: false, error};
    }
  }
  async function pullCoachData(){
    const sb = client('coach');
    const coach = global.CoachStore;
    const coachSession = coach && coach.getSession && coach.getSession();
    const academy = coachSession && coach.myAcademy && coach.myAcademy(coachSession);
    if(!sb || !coachSession || !academy) return {ok: false};
    const {data: authData, error: authErr} = await sb.auth.getSession();
    if(authErr) throw authErr;
    const session = authData && authData.session;
    if(!session) return {ok: false, reason: 'no_session'};
    const teams = coach.listTeams ? coach.listTeams(coachSession, academy.id) : [];
    const playerIds = [];
    teams.forEach(team => {
      (coach.listPlayers ? coach.listPlayers(coachSession, team.id) : []).forEach(player => {
        if(player && player.id) playerIds.push(player.id);
      });
    });
    if(!playerIds.length) return {ok: true, empty: true};
    const matchesRes = await sb.from('parent_matches')
      .select('team_player_id,match_data')
      .in('team_player_id', playerIds);
    if(matchesRes.error) throw matchesRes.error;
    if(global.ParentStatsStore && typeof global.ParentStatsStore.publishMatch === 'function'){
      (matchesRes.data || []).forEach(row => {
        try{ global.ParentStatsStore.publishMatch(row.team_player_id, row.match_data); }catch(e){}
      });
    }
    const linksRes = await sb.from('parent_player_links')
      .select('team_player_id,personal_player_id,parent_user_id')
      .in('team_player_id', playerIds)
      .neq('status', 'revoked');
    if(linksRes.error) throw linksRes.error;
    const nextLinks = Array.isArray(linksRes.data) ? linksRes.data : [];
    // Never wipe a healthy coach link cache with an empty transient result.
    // Empty is only trusted when we also have no local players to query.
    try{
      const prev = coachLinks();
      if(nextLinks.length || !prev.length || !playerIds.length){
        localStorage.setItem(COACH_LINKS_KEY, JSON.stringify(nextLinks));
      }
    }catch(e){}
    const profileIds = [...new Set(nextLinks.map(l => l.personal_player_id).filter(Boolean))];
    if(profileIds.length){
      const profilesRes = await sb.from('personal_players')
        .select('id,photo_path')
        .in('id', profileIds);
      if(profilesRes.error) throw profilesRes.error;
      const profiles = new Map((profilesRes.data || []).map(p => [String(p.id), p]));
      for(const link of nextLinks){
        const profile = profiles.get(String(link.personal_player_id));
        if(!profile || !profile.photo_path || typeof setCoachMediaPhoto !== 'function') continue;
        const signed = await sb.storage.from('player-media').createSignedUrl(profile.photo_path, 3600);
        if(!signed.error && signed.data && signed.data.signedUrl){
          try{ setCoachMediaPhoto(link.team_player_id, signed.data.signedUrl); }catch(e){}
        }
      }
    }
    const chatLinks = (nextLinks && nextLinks.length) ? nextLinks : coachLinks();
    const chatRes = await syncChats(session, chatLinks, 'coach');
    notifyIncomingChats(chatRes && chatRes.incoming);
    if(typeof syncCoachChildPlayerUi === 'function'){
      try{ syncCoachChildPlayerUi(); }catch(e){}
    }
    try{
      if(typeof renderParentUi === 'function') renderParentUi();
      else refreshInboxBell();
    }catch(e){ refreshInboxBell(); }
    return {ok: true};
  }

  global.ParentCloud = {
    ready,
    getSession,
    ensureSession,
    signUp,
    signIn,
    signOut,
    signInWithEmail,
    signInWithGoogle,
    handleAuthCallbackUrl,
    bindAuthDeepLinks,
    consumeAuthRedirectFromLocation,
    tokenFromUrl,
    buildInviteUrl,
    coachLinks,
    isCoachPlayerLinked,
    rememberCoachLink,
    publishInvite,
    resolveInvite,
    resolveInviteByCode,
    codeFromText,
    claimInvite,
    syncParentData,
    syncPersonalBackup,
    markPersonalDirty,
    scheduleSync,
    pullCoachData,
    startChatPoll,
    pollInboxChats,
    notifyChatPush,
    pushChatMessage,
    pushChatBroadcast,
    pushParentNotice,
    pullParentNotices,
    dismissParentNotices,
    markParentNoticesRead,
    personalSyncState(){ return personalSyncState; },
    status(){ return {configured: ready(), syncing, personal: personalSyncState}; }
  };
  try{ startChatPoll(); }catch(e){}
})(window);
