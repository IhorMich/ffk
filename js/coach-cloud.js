/* Matchcard Coach ↔ Supabase. No-op when URL/key empty; local CoachStore stays source of truth on device. */
(function(global){
  let clients = {coach: null, parent: null};
  let syncTimer = null;
  let syncing = false;

  function cfg(){
    return global.FFK_COACH_CONFIG || {};
  }
  function ready(){
    const c = cfg();
    const url = String(c.supabaseUrl || '');
    const key = String(c.supabaseAnonKey || '');
    return !!(
      /^https:\/\//i.test(url)
      && key
      && !/^sb_secret_/i.test(key)
      && global.supabase
      && typeof global.supabase.createClient === 'function'
    );
  }
  function makeClient(storageKey){
    const c = cfg();
    const auth = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    };
    if(storageKey) auth.storageKey = storageKey;
    return global.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {auth});
  }
  function getClient(){
    if(!ready()) return null;
    // Keep default storage key so existing coach logins survive the update.
    if(!clients.coach) clients.coach = makeClient();
    return clients.coach;
  }
  function getParentClient(){
    if(!ready()) return null;
    // Separate key so parent sync never reuses the coach account session.
    if(!clients.parent) clients.parent = makeClient('ffk-parent-auth');
    return clients.parent;
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

  async function cloudSignUp(email, password){
    const sb = getClient();
    if(!sb) throw new Error('no_cloud');
    const {data, error} = await sb.auth.signUp({email, password});
    if(error) throw error;
    const user = data.user;
    if(!user) throw new Error('auth');
    return {userId: user.id, email: user.email || email, cloud: true};
  }
  async function cloudSignIn(email, password){
    const sb = getClient();
    if(!sb) throw new Error('no_cloud');
    const {data, error} = await sb.auth.signInWithPassword({email, password});
    if(error) throw error;
    const user = data.user;
    if(!user) throw new Error('auth');
    return {userId: user.id, email: user.email || email, cloud: true};
  }
  async function cloudSignOut(){
    const sb = getClient();
    if(sb) await sb.auth.signOut();
  }

  const OAUTH_ROLE_KEY = 'ffk_oauth_role';
  function isNativeShell(){
    try{
      return !!(global.Capacitor && typeof global.Capacitor.isNativePlatform === 'function' && global.Capacitor.isNativePlatform());
    }catch(e){ return false; }
  }
  function authRedirectTo(){
    if(isNativeShell()) return 'ffk://auth-callback';
    try{
      if(global.location && /^https?:/i.test(global.location.origin || '')){
        return global.location.origin + (global.location.pathname || '/').replace(/\/?$/, '/') ;
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
    const sb = getClient();
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
    try{ localStorage.removeItem(OAUTH_ROLE_KEY); }catch(e){}
    return session || null;
  }
  async function signInWithGoogle(){
    const sb = getClient();
    if(!sb) throw new Error('no_cloud');
    try{ localStorage.setItem(OAUTH_ROLE_KEY, 'coach'); }catch(e){}
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
  async function adoptGoogleSession(session){
    const user = session && session.user;
    if(!user) throw new Error('auth');
    const email = String(user.email || '').trim().toLowerCase();
    if(!email) throw new Error('auth');
    const db = localDb();
    if(!db.accounts) db.accounts = {};
    const paid = !!(global.settings && global.settings.coachSub === true);
    db.accounts[email] = Object.assign({}, db.accounts[email] || {}, {
      id: user.id,
      email,
      passHash: '',
      first_name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || '').toString().slice(0, 40),
      last_name: '',
      photo: '',
      cover: '',
      coach_sub: paid || !!(db.accounts[email] && db.accounts[email].coach_sub),
      createdAt: (db.accounts[email] && db.accounts[email].createdAt) || new Date().toISOString()
    });
    try{ localStorage.setItem('ffk_coach_v1', JSON.stringify(db)); }catch(e){}
    const coachSession = {userId: user.id, email, cloud: true};
    try{
      if(global.CoachStore && typeof global.CoachStore.writeSessionExternal === 'function'){
        global.CoachStore.writeSessionExternal(coachSession);
      }else{
        localStorage.setItem('ffk_coach_session_v1', JSON.stringify(coachSession));
      }
    }catch(e){
      try{ localStorage.setItem('ffk_coach_session_v1', JSON.stringify(coachSession)); }catch(err){}
    }
    try{ await pullRemoteIntoLocal(); }catch(e){}
    return coachSession;
  }
  let authDeepLinksBound = false;
  function bindAuthDeepLinks(onSession){
    if(authDeepLinksBound) return;
    authDeepLinksBound = true;
    const notify = async (session) => {
      if(!session) return;
      try{
        const adopted = await adoptGoogleSession(session);
        if(typeof onSession === 'function') await onSession(adopted);
      }catch(e){}
    };
    const maybeHandle = async (url) => {
      if(!/auth-callback|access_token=|code=/i.test(url)) return;
      let role = '';
      try{ role = localStorage.getItem(OAUTH_ROLE_KEY) || ''; }catch(e){}
      if(role && role !== 'coach') return;
      try{
        const session = await handleAuthCallbackUrl(url);
        await notify(session);
      }catch(e){}
    };
    try{
      if(global.location && /[?&#](code|access_token)=/i.test(String(global.location.href || ''))){
        let role = '';
        try{ role = localStorage.getItem(OAUTH_ROLE_KEY) || ''; }catch(e){}
        if(!role || role === 'coach'){
          handleAuthCallbackUrl(global.location.href).then(notify).catch(() => {});
        }
      }
    }catch(e){}
    try{
      const App = capPlugin('App');
      if(App && typeof App.addListener === 'function'){
        App.addListener('appUrlOpen', async (event) => {
          await maybeHandle(event && event.url ? String(event.url) : '');
        });
        if(typeof App.getLaunchUrl === 'function'){
          App.getLaunchUrl().then(async (res) => {
            await maybeHandle(res && res.url ? String(res.url) : '');
          }).catch(() => {});
        }
      }
    }catch(e){}
  }

  function localDb(){
    try{ return JSON.parse(localStorage.getItem('ffk_coach_v1') || '{}'); }
    catch(e){ return {}; }
  }
  function isUuid(value){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }
  async function upsertChecked(query){
    const {error} = await query;
    if(error) throw error;
  }

  async function pushLocalSnapshot(){
    const sb = getClient();
    if(!sb) return {ok: false, reason: 'no_cloud'};
    const {data: {session}} = await sb.auth.getSession();
    if(!session) return {ok: false, reason: 'no_session'};
    const db = localDb();
    const uid = session.user.id;
    const localUserId = (global.CoachStore.getSession() || {}).userId;

    try{
      // Academies owned by this user
      const academies = (db.academies || []).filter(a => a.owner_user_id === uid || a.owner_user_id === localUserId);
      for(const a of academies){
        await upsertChecked(sb.from('academies').upsert({
          id: a.id,
          name: a.name,
          owner_user_id: uid,
          created_at: a.created_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const m of (db.memberships || [])){
        if(!m.academy_id && !m.team_id) continue;
        const userId = m.user_id === localUserId ? uid : m.user_id;
        // Pending assistant invites keep placeholder ids like ast_* until claim.
        if(!isUuid(userId)) continue;
        await upsertChecked(sb.from('memberships').upsert({
          id: m.id,
          user_id: userId,
          academy_id: m.academy_id || null,
          team_id: m.team_id || null,
          team_player_id: m.team_player_id || null,
          role: m.role,
          email: m.email || '',
          invite_code: m.invite_code || '',
          status: m.status || 'active',
          created_at: m.created_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const t of (db.teams || [])){
        await upsertChecked(sb.from('teams').upsert({
          id: t.id,
          academy_id: t.academy_id,
          name: t.name,
          age_group: t.age_group || '',
          invite_code: t.invite_code,
          created_at: t.created_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const p of (db.team_players || [])){
        await upsertChecked(sb.from('team_players').upsert({
          id: p.id,
          team_id: p.team_id,
          first_name: p.first_name,
          last_name: p.last_name || '',
          number: p.number || '',
          position: p.position || '',
          birth_date: p.birth_date || '',
          contact: p.contact || '',
          coach_notes: String(p.coach_notes || '').slice(0, 2000),
          created_at: p.created_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const m of (db.team_matches || [])){
        await upsertChecked(sb.from('team_matches').upsert({
          id: m.id,
          team_id: m.team_id,
          date: m.date,
          opponent: m.opponent,
          address: m.address || '',
          score: m.score || '',
          venue: m.venue || 'home',
          kind: m.kind || 'league',
          status: m.status || (m.score ? 'played' : 'upcoming'),
          squad: m.squad || [],
          meetup: m.meetup || '',
          kickoff: m.kickoff || '',
          fee_type: m.fee_type === 'paid' ? 'paid' : 'free',
          fee: m.fee_type === 'paid' ? (m.fee || '') : '',
          tournament: m.tournament || '',
          event_id: m.event_id || '',
          comment: m.comment || '',
          created_at: m.created_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const r of (db.ratings || [])){
        await upsertChecked(sb.from('ratings').upsert({
          id: r.id,
          match_id: r.match_id,
          team_id: r.team_id,
          team_player_id: r.team_player_id,
          player_name: r.player_name || '',
          pitch_pos: r.pitchPos || r.pitch_pos || '',
          position: r.position || 'fwd',
          minutes: r.minutes || 60,
          format: r.format || '2x30',
          match_len: r.matchLen || r.match_len || 60,
          role: r.role || 'start',
          comment: r.comment || '',
          counts: r.counts || {},
          behaviors: r.behaviors || {},
          timeline: r.timeline || [],
          action_rating: r.actionRating || r.action_rating || 6,
          effort_rating: r.effortRating || r.effort_rating || 6,
          rating: r.rating || 6,
          updated_at: r.updated_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const inv of (db.parent_invites || [])){
        await upsertChecked(sb.from('parent_invites').upsert({
          id: inv.id,
          token: inv.token,
          code: inv.code,
          team_id: inv.team_id,
          team_player_id: inv.team_player_id,
          payload: inv.payload || {},
          status: inv.status || 'open',
          created_at: inv.created_at || new Date().toISOString(),
          updated_at: inv.updated_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      return {ok: true};
    }catch(error){
      console.warn('Coach cloud push', error);
      return {ok: false, error};
    }
  }

  async function pullRemoteIntoLocal(){
    const sb = getClient();
    if(!sb) return {ok: false, reason: 'no_cloud'};
    const {data: {session}} = await sb.auth.getSession();
    if(!session) return {ok: false, reason: 'no_session'};
    const uid = session.user.id;

    const {data: mems, error: memErr} = await sb.from('memberships').select('*').eq('user_id', uid);
    if(memErr) throw memErr;
    const academyIds = [...new Set((mems || []).map(m => m.academy_id).filter(Boolean))];
    if(!academyIds.length) return {ok: true, empty: true};

    const {data: academies, error: academyErr} = await sb.from('academies').select('*').in('id', academyIds);
    if(academyErr) throw academyErr;
    const {data: teams, error: teamErr} = await sb.from('teams').select('*').in('academy_id', academyIds);
    if(teamErr) throw teamErr;
    const teamIds = (teams || []).map(t => t.id);
    let players = [];
    let matches = [];
    let ratings = [];
    let parentInvites = [];
    if(teamIds.length){
      const p = await sb.from('team_players').select('*').in('team_id', teamIds);
      if(p.error) throw p.error;
      players = p.data || [];
      const m = await sb.from('team_matches').select('*').in('team_id', teamIds);
      if(m.error) throw m.error;
      matches = m.data || [];
      const matchIds = matches.map(x => x.id);
      if(matchIds.length){
        const r = await sb.from('ratings').select('*').in('match_id', matchIds);
        if(r.error) throw r.error;
        ratings = r.data || [];
      }
      const pi = await sb.from('parent_invites').select('*').in('team_id', teamIds);
      if(pi.error) throw pi.error;
      parentInvites = pi.data || [];
    }

    const raw = localDb();
    const remoteMems = mems || [];
    // Keep local pending assistant invites (placeholder user ids) that are not in remote yet.
    const remoteMemIds = new Set(remoteMems.map(m => String(m.id)));
    const pendingLocalMems = (raw.memberships || []).filter(m =>
      m && !remoteMemIds.has(String(m.id)) && !isUuid(m.user_id)
    );
    const db = {
      version: 4,
      accounts: raw.accounts || {},
      academies: academies || [],
      teams: teams || [],
      team_players: (players || []).map(p => ({
        ...p,
        contact: p.contact || '',
        coach_notes: String(p.coach_notes || '').slice(0, 2000)
      })),
      memberships: remoteMems.concat(pendingLocalMems),
      team_matches: (matches || []).map(m => ({
        ...m,
        squad: Array.isArray(m.squad) ? m.squad : (m.squad || []),
        meetup: m.meetup || '',
        kickoff: m.kickoff || '',
        fee_type: m.fee_type === 'paid' ? 'paid' : 'free',
        fee: m.fee_type === 'paid' ? (m.fee || '') : '',
        tournament: m.tournament || '',
        event_id: m.event_id || '',
        comment: m.comment || ''
      })),
      ratings: (ratings || []).map(r => ({
        ...r,
        pitchPos: r.pitch_pos || r.pitchPos || '',
        matchLen: r.match_len || r.matchLen || 60,
        actionRating: r.action_rating || r.actionRating || 6,
        effortRating: r.effort_rating || r.effortRating || 6
      })),
      match_invites: raw.match_invites || [],
      parent_invites: parentInvites || [],
      leave_requests: Array.isArray(raw.leave_requests) ? raw.leave_requests : [],
      device_tokens: raw.device_tokens || [],
      activeTeamId: raw.activeTeamId || (teams && teams[0] && teams[0].id) || '',
      activeMatchId: raw.activeMatchId || ''
    };
    // Keep local account profile fields
    const email = (session.user.email || '').toLowerCase();
    if(email && !db.accounts[email]){
      db.accounts[email] = {
        id: uid,
        email,
        passHash: '',
        first_name: '',
        last_name: '',
        photo: '',
        cover: '',
        coach_sub: true,
        createdAt: new Date().toISOString()
      };
    }
    localStorage.setItem('ffk_coach_v1', JSON.stringify(db));
    localStorage.setItem('ffk_coach_session_v1', JSON.stringify({userId: uid, email, cloud: true}));
    return {ok: true};
  }

  function scheduleSync(){
    if(!ready()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncNow().catch(() => {}); }, 1200);
  }

  async function syncNow(){
    if(!ready() || syncing) return {ok: false};
    syncing = true;
    try{
      const pushed = await pushLocalSnapshot();
      if(!pushed || !pushed.ok){
        throw pushed && pushed.error || new Error(pushed && pushed.reason || 'push');
      }
      await pullRemoteIntoLocal();
      if(global.ParentCloud && typeof global.ParentCloud.pullCoachData === 'function'){
        await global.ParentCloud.pullCoachData();
      }
      if(typeof renderCoachUi === 'function') renderCoachUi();
      return {ok: true};
    }catch(e){
      console.warn('Coach cloud sync', e);
      return {ok: false, error: e};
    }finally{
      syncing = false;
    }
  }

  async function registerDeviceToken(token, platform){
    const sb = getClient();
    if(!sb || !token) return null;
    const {data: {session}} = await sb.auth.getSession();
    if(!session) return null;
    const row = {
      id: `tok_${token.slice(0, 24)}`,
      user_id: session.user.id,
      token: String(token).slice(0, 512),
      platform: String(platform || 'unknown').slice(0, 24),
      updated_at: new Date().toISOString()
    };
    await sb.from('device_tokens').upsert(row, {onConflict: 'id'});
    return row;
  }

  const CoachCloud = {
    ready,
    getClient,
    getParentClient,
    cloudSignUp,
    cloudSignIn,
    cloudSignOut,
    signInWithGoogle,
    handleAuthCallbackUrl,
    bindAuthDeepLinks,
    adoptGoogleSession,
    scheduleSync,
    syncNow,
    pushLocalSnapshot,
    pullRemoteIntoLocal,
    registerDeviceToken,
    status(){
      return {
        configured: ready(),
        mode: ready() ? 'supabase' : 'local',
        syncing
      };
    }
  };

  global.CoachCloud = CoachCloud;
})(window);
