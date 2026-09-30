/* Matchcard parent/player cross-device sync through Supabase. */
(function(global){
  const COACH_LINKS_KEY = 'ffk_cloud_parent_links_v1';
  const PERSONAL_SYNC_AT_KEY = 'ffk_personal_backup_sync_at';
  let syncing = false;
  let syncTimer = null;
  let personalSyncState = {status: 'idle', at: '', error: ''};

  function ready(){
    return !!(global.CoachCloud && global.CoachCloud.ready && global.CoachCloud.ready());
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
  /** Parent account: anonymous when the project allows it, otherwise email + password. */
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
  async function promptEmailSession(){
    if(typeof prompt !== 'function') throw new Error('auth');
    const email = prompt(tt('parentCloudEmailPrompt', 'Email for syncing across devices:'));
    if(!email) throw new Error('auth');
    const password = prompt(tt('parentCloudPasswordPrompt', 'Password (at least 6 characters):'));
    if(!password) throw new Error('auth');
    return signInWithEmail(email, password);
  }
  async function ensureSession(interactive){
    const sb = parentClient();
    if(!sb) throw new Error('no_cloud');
    const existing = await getSession();
    if(existing) return existing;
    if(typeof sb.auth.signInAnonymously === 'function'){
      const anon = await sb.auth.signInAnonymously();
      if(anon.data && anon.data.session) return anon.data.session;
    }
    if(!interactive) throw new Error('no_session');
    return promptEmailSession();
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
    await ensureSession(true);
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
  async function syncChats(session, links, senderRole){
    const sb = client(senderRole === 'coach' ? 'coach' : 'parent');
    if(!sb || !session || !global.InboxStore) return;
    const byPlayer = new Map((links || []).map(link => [
      String(link.team_player_id || link.player && link.player.id || ''),
      link
    ]));
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
          edited_at: m.edited_at || null,
          read_by_parent: !!m.read_by_parent,
          read_by_coach: !!m.read_by_coach,
          created_at: m.created_at || new Date().toISOString()
        };
      }).filter(row => row.parent_user_id && row.sender_user_id);
    if(rows.length){
      const {error} = await sb.from('player_chat_messages').upsert(rows, {onConflict: 'id'});
      if(error) throw error;
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
    const playerIds = [...byPlayer.keys()].filter(Boolean);
    if(!playerIds.length) return;
    const pulled = await sb.from('player_chat_messages')
      .select('*')
      .in('team_player_id', playerIds)
      .order('created_at', {ascending: false});
    if(pulled.error) throw pulled.error;
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
        global.InboxStore.importCloudChat({
          ...row,
          player_name: playerName || '',
          team_name: teamName,
          academy_name: link.academy && link.academy.name || '',
          coach_name: link.coach && link.coach.name || ''
        });
      }catch(e){}
    });
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
      await syncChats(session, links, 'parent');
      if(typeof renderParentUi === 'function'){
        try{ renderParentUi(); }catch(e){}
      }
      return {ok: true};
    }catch(error){
      console.warn('Parent cloud sync', error);
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
        : syncParentData().then(() => syncPersonalBackup({pull: false, push: true}));
      Promise.resolve(task).catch(() => {});
    }, 1200);
  }
  function isProUser(){
    return typeof isPro === 'function' && isPro();
  }
  function readLocalSyncAt(){
    try{ return String(localStorage.getItem(PERSONAL_SYNC_AT_KEY) || ''); }catch(e){ return ''; }
  }
  function writeLocalSyncAt(iso){
    try{ localStorage.setItem(PERSONAL_SYNC_AT_KEY, String(iso || '')); }catch(e){}
  }
  function setPersonalSyncState(next){
    personalSyncState = Object.assign({}, personalSyncState, next || {});
    if(typeof global.updateCloudSyncStatusUi === 'function'){
      try{ global.updateCloudSyncStatusUi(personalSyncState); }catch(e){}
    }
  }
  async function pushPersonalBackup(session){
    const sb = parentClient();
    if(!sb || !session || !isProUser()) return {ok: false, reason: 'skip'};
    if(typeof exportPayload !== 'function') return {ok: false, reason: 'no_export'};
    const payload = exportPayload();
    const updatedAt = new Date().toISOString();
    const {error} = await sb.from('personal_backups').upsert({
      owner_user_id: session.user.id,
      payload,
      updated_at: updatedAt
    }, {onConflict: 'owner_user_id'});
    if(error) throw error;
    writeLocalSyncAt(updatedAt);
    setPersonalSyncState({status: 'ok', at: updatedAt, error: ''});
    return {ok: true, at: updatedAt};
  }
  async function pullPersonalBackup(session){
    const sb = parentClient();
    if(!sb || !session || !isProUser()) return {ok: false, reason: 'skip'};
    const {data, error} = await sb.from('personal_backups')
      .select('payload,updated_at')
      .eq('owner_user_id', session.user.id)
      .maybeSingle();
    if(error) throw error;
    if(!data || !data.payload) return {ok: true, empty: true};
    const remoteAt = String(data.updated_at || '');
    const localAt = readLocalSyncAt();
    if(remoteAt && localAt && remoteAt <= localAt) return {ok: true, skipped: true};
    if(typeof applyImportBundle === 'function'){
      try{ applyImportBundle(data.payload); }catch(e){
        console.warn('Personal backup import', e);
        return {ok: false, error: e};
      }
    }
    if(remoteAt) writeLocalSyncAt(remoteAt);
    setPersonalSyncState({status: 'ok', at: remoteAt || new Date().toISOString(), error: ''});
    return {ok: true, pulled: true, at: remoteAt};
  }
  async function syncPersonalBackup(options){
    const opts = options || {};
    if(!ready()) return {ok: false, reason: 'no_cloud'};
    if(!isProUser()){
      setPersonalSyncState({status: 'free', at: '', error: ''});
      return {ok: false, reason: 'not_pro'};
    }
    setPersonalSyncState({status: 'syncing', error: ''});
    try{
      const session = await getSession();
      if(!session || !session.user){
        setPersonalSyncState({status: 'need_account', at: '', error: ''});
        return {ok: false, reason: 'no_session'};
      }
      if(opts.pull !== false){
        await pullPersonalBackup(session);
      }
      if(opts.push !== false){
        await pushPersonalBackup(session);
      }
      return {ok: true, state: personalSyncState};
    }catch(error){
      console.warn('Personal backup sync', error);
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
    try{ localStorage.setItem(COACH_LINKS_KEY, JSON.stringify(linksRes.data || [])); }catch(e){}
    const profileIds = [...new Set((linksRes.data || []).map(l => l.personal_player_id).filter(Boolean))];
    if(profileIds.length){
      const profilesRes = await sb.from('personal_players')
        .select('id,photo_path')
        .in('id', profileIds);
      if(profilesRes.error) throw profilesRes.error;
      const profiles = new Map((profilesRes.data || []).map(p => [String(p.id), p]));
      for(const link of (linksRes.data || [])){
        const profile = profiles.get(String(link.personal_player_id));
        if(!profile || !profile.photo_path || typeof setCoachMediaPhoto !== 'function') continue;
        const signed = await sb.storage.from('player-media').createSignedUrl(profile.photo_path, 3600);
        if(!signed.error && signed.data && signed.data.signedUrl){
          try{ setCoachMediaPhoto(link.team_player_id, signed.data.signedUrl); }catch(e){}
        }
      }
    }
    await syncChats(session, linksRes.data || [], 'coach');
    if(typeof syncCoachChildPlayerUi === 'function'){
      try{ syncCoachChildPlayerUi(); }catch(e){}
    }
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
    publishInvite,
    resolveInvite,
    resolveInviteByCode,
    codeFromText,
    claimInvite,
    syncParentData,
    syncPersonalBackup,
    scheduleSync,
    pullCoachData,
    personalSyncState(){ return personalSyncState; },
    status(){ return {configured: ready(), syncing, personal: personalSyncState}; }
  };
})(window);
