/* Matchcard Coach ↔ Supabase. No-op when URL/key empty; local CoachStore stays source of truth on device. */
(function(global){
  let client = null;
  let syncTimer = null;
  let syncing = false;

  function cfg(){
    return global.FFK_COACH_CONFIG || {};
  }
  function ready(){
    const c = cfg();
    return !!(c.supabaseUrl && c.supabaseAnonKey && global.supabase && typeof global.supabase.createClient === 'function');
  }
  function getClient(){
    if(!ready()) return null;
    if(client) return client;
    const c = cfg();
    client = global.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
      auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}
    });
    return client;
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

  function localDb(){
    try{ return JSON.parse(localStorage.getItem('ffk_coach_v1') || '{}'); }
    catch(e){ return {}; }
  }

  async function pushLocalSnapshot(){
    const sb = getClient();
    if(!sb) return {ok: false, reason: 'no_cloud'};
    const {data: {session}} = await sb.auth.getSession();
    if(!session) return {ok: false, reason: 'no_session'};
    const db = localDb();
    const uid = session.user.id;

    // Academies owned by this user
    const academies = (db.academies || []).filter(a => a.owner_user_id === uid || a.owner_user_id === (global.CoachStore.getSession() || {}).userId);
    for(const a of academies){
      await sb.from('academies').upsert({
        id: a.id,
        name: a.name,
        owner_user_id: uid,
        created_at: a.created_at || new Date().toISOString()
      }, {onConflict: 'id'});
    }
    for(const m of (db.memberships || [])){
      if(!m.academy_id && !m.team_id) continue;
      await sb.from('memberships').upsert({
        id: m.id,
        user_id: m.user_id === (global.CoachStore.getSession() || {}).userId ? uid : m.user_id,
        academy_id: m.academy_id || null,
        team_id: m.team_id || null,
        team_player_id: m.team_player_id || null,
        role: m.role,
        email: m.email || '',
        invite_code: m.invite_code || '',
        status: m.status || 'active',
        created_at: m.created_at || new Date().toISOString()
      }, {onConflict: 'id'});
    }
    for(const t of (db.teams || [])){
      await sb.from('teams').upsert({
        id: t.id,
        academy_id: t.academy_id,
        name: t.name,
        age_group: t.age_group || '',
        invite_code: t.invite_code,
        created_at: t.created_at || new Date().toISOString()
      }, {onConflict: 'id'});
    }
    for(const p of (db.team_players || [])){
      await sb.from('team_players').upsert({
        id: p.id,
        team_id: p.team_id,
        first_name: p.first_name,
        last_name: p.last_name || '',
        number: p.number || '',
        position: p.position || '',
        birth_date: p.birth_date || '',
        contact: p.contact || '',
        created_at: p.created_at || new Date().toISOString()
      }, {onConflict: 'id'});
    }
    for(const m of (db.team_matches || [])){
      await sb.from('team_matches').upsert({
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
        created_at: m.created_at || new Date().toISOString()
      }, {onConflict: 'id'});
    }
    for(const r of (db.ratings || [])){
      await sb.from('ratings').upsert({
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
      }, {onConflict: 'id'});
    }
    for(const inv of (db.parent_invites || [])){
      await sb.from('parent_invites').upsert({
        id: inv.id,
        token: inv.token,
        code: inv.code,
        team_id: inv.team_id,
        team_player_id: inv.team_player_id,
        payload: inv.payload || {},
        status: inv.status || 'open',
        created_at: inv.created_at || new Date().toISOString(),
        updated_at: inv.updated_at || new Date().toISOString()
      }, {onConflict: 'id'});
    }
    return {ok: true};
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

    const {data: academies} = await sb.from('academies').select('*').in('id', academyIds);
    const {data: teams} = await sb.from('teams').select('*').in('academy_id', academyIds);
    const teamIds = (teams || []).map(t => t.id);
    let players = [];
    let matches = [];
    let ratings = [];
    let parentInvites = [];
    if(teamIds.length){
      const p = await sb.from('team_players').select('*').in('team_id', teamIds);
      players = p.data || [];
      const m = await sb.from('team_matches').select('*').in('team_id', teamIds);
      matches = m.data || [];
      const matchIds = matches.map(x => x.id);
      if(matchIds.length){
        const r = await sb.from('ratings').select('*').in('match_id', matchIds);
        ratings = r.data || [];
      }
      const pi = await sb.from('parent_invites').select('*').in('team_id', teamIds);
      parentInvites = pi.data || [];
    }

    const raw = localDb();
    const db = {
      version: 3,
      accounts: raw.accounts || {},
      academies: academies || [],
      teams: teams || [],
      team_players: (players || []).map(p => ({...p, contact: p.contact || ''})),
      memberships: mems || [],
      team_matches: (matches || []).map(m => ({
        ...m,
        squad: Array.isArray(m.squad) ? m.squad : (m.squad || [])
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
      assistants: raw.assistants || [],
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
      await pushLocalSnapshot();
      await pullRemoteIntoLocal();
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
    cloudSignUp,
    cloudSignIn,
    cloudSignOut,
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
