/* TEMPO Coach ↔ Supabase. No-op when URL/key empty; local CoachStore stays source of truth on device. */
(function(global){
  let clients = {coach: null, parent: null};
  let syncTimer = null;
  let syncing = false;
  let syncAgain = false;

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
    try{
      if(syncTimer) clearTimeout(syncTimer);
      syncTimer = null;
    }catch(e){}
    const sb = getClient();
    // Local only — do not revoke the phone session when signing out on desktop (or vice versa).
    if(sb) await sb.auth.signOut({scope: 'local'});
  }

  /** Keep coach JWT alive across overnight / background without forcing a password re-login. */
  async function ensureCloudSession(){
    const sb = getClient();
    if(!sb) return null;
    try{
      const {data} = await sb.auth.getSession();
      let session = data && data.session;
      if(session && session.expires_at){
        const skewMs = 90 * 1000;
        if(Number(session.expires_at) * 1000 > Date.now() + skewMs) return session;
      }else if(session){
        return session;
      }
    }catch(e){}
    try{
      if(typeof sb.auth.refreshSession !== 'function') return null;
      const {data, error} = await sb.auth.refreshSession();
      if(error) return null;
      return (data && data.session) || null;
    }catch(e){
      return null;
    }
  }

  let sessionWatchWired = false;
  function watchCloudSession(){
    if(sessionWatchWired) return;
    sessionWatchWired = true;
    const poke = () => { ensureCloudSession().catch(() => {}); };
    try{
      document.addEventListener('visibilitychange', () => {
        if(document.visibilityState === 'visible') poke();
      });
    }catch(e){}
    try{
      const App = (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App) || null;
      if(App && typeof App.addListener === 'function'){
        App.addListener('appStateChange', (state) => {
          if(state && state.isActive) poke();
        });
      }
    }catch(e){}
    // Warm once after boot.
    setTimeout(poke, 1500);
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
    try{
      const pendingRemoved = Array.isArray(db.removed_player_ids) && db.removed_player_ids.length;
      if(pendingRemoved){
        try{ await pushLocalSnapshot(); }catch(e){}
      }
      await pullRemoteIntoLocal();
    }catch(e){}
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
  async function reconcileDeletedRows(sb, table, teams, localRows, opts){
    const teamIds = [...new Set((teams || []).map(t => t && t.id).filter(Boolean))];
    if(!teamIds.length) return {dropped: []};
    const protectIds = new Set((opts && opts.protectIds) || []);
    const dropped = [];
    for(const teamId of teamIds){
      const keep = new Set(
        (localRows || [])
          .filter(row => row && String(row.team_id) === String(teamId))
          .map(row => String(row.id))
      );
      const {data: remote, error} = await sb.from(table).select('id').eq('team_id', teamId);
      if(error) throw error;
      const drop = (remote || [])
        .map(row => String(row.id))
        .filter(id => id && !keep.has(id) && !protectIds.has(id));
      for(let i = 0; i < drop.length; i += 80){
        const chunk = drop.slice(i, i + 80);
        const {error: delErr} = await sb.from(table).delete().in('id', chunk);
        if(delErr) throw delErr;
        // RLS can "succeed" with 0 rows — verify and only treat confirmed gone as dropped.
        const {data: left, error: leftErr} = await sb.from(table).select('id').in('id', chunk);
        if(leftErr) throw leftErr;
        const leftIds = new Set((left || []).map(r => String(r.id)));
        chunk.forEach(id => { if(!leftIds.has(id)) dropped.push(id); });
      }
    }
    return {dropped};
  }

  async function pushLocalSnapshot(){
    const sb = getClient();
    if(!sb) return {ok: false, reason: 'no_cloud'};
    const {data: {session}} = await sb.auth.getSession();
    if(!session) return {ok: false, reason: 'no_session'};
    let db = localDb();
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
      // Re-read right before players — a delete may have landed while earlier upserts ran.
      db = localDb();
      const removedSet = new Set(
        (Array.isArray(db.removed_player_ids) ? db.removed_player_ids : [])
          .map(id => String(id || ''))
          .filter(Boolean)
      );
      const localPlayers = (db.team_players || []).filter(p => p && !removedSet.has(String(p.id)));
      for(const p of localPlayers){
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
      // Local is source of truth: remove cloud players deleted on this device,
      // otherwise the next pull resurrects them ~1s after removePlayer.
      // Protect linked players only when they were NOT intentionally removed —
      // otherwise coach cannot delete a child who already has a parent claim.
      let protectedPlayerIds = [];
      try{
        const teamIds = [...new Set((db.teams || []).map(t => t && t.id).filter(Boolean))];
        if(teamIds.length){
          const remotePlayers = await sb.from('team_players').select('id').in('team_id', teamIds);
          if(remotePlayers.error) throw remotePlayers.error;
          const remoteIds = (remotePlayers.data || []).map(r => r && r.id).filter(Boolean);
          for(let i = 0; i < remoteIds.length; i += 80){
            const chunk = remoteIds.slice(i, i + 80);
            const linked = await sb.from('parent_player_links')
              .select('team_player_id')
              .neq('status', 'revoked')
              .in('team_player_id', chunk);
            if(linked.error) throw linked.error;
            (linked.data || []).forEach(r => {
              const pid = r && r.team_player_id ? String(r.team_player_id) : '';
              if(pid && !removedSet.has(pid)) protectedPlayerIds.push(pid);
            });
          }
        }
      }catch(e){
        console.warn('protect linked players', e);
      }
      const playerReconcile = await reconcileDeletedRows(sb, 'team_players', db.teams || [], localPlayers, {
        protectIds: protectedPlayerIds
      });
      // Only drop tombstones that were confirmed deleted from cloud.
      if(removedSet.size){
        const confirmed = new Set((playerReconcile && playerReconcile.dropped) || []);
        // Also drop tombstones already absent remotely (previous sync finished the delete).
        try{
          const teamIds = [...new Set((db.teams || []).map(t => t && t.id).filter(Boolean))];
          if(teamIds.length){
            const remotePlayers = await sb.from('team_players').select('id').in('team_id', teamIds);
            if(!remotePlayers.error){
              const stillRemote = new Set((remotePlayers.data || []).map(r => r && String(r.id)).filter(Boolean));
              [...removedSet].forEach(id => {
                if(!stillRemote.has(id)) confirmed.add(id);
              });
            }
          }else{
            // No teams left — treat all tombstones as done only if remote select would be empty.
            [...removedSet].forEach(id => confirmed.add(id));
          }
        }catch(e){
          // Keep tombstones on verify failure — never wipe them blindly.
        }
        const nextRemoved = [...removedSet].filter(id => !confirmed.has(id));
        if(nextRemoved.length !== (db.removed_player_ids || []).length){
          const raw = localDb();
          raw.removed_player_ids = nextRemoved;
          // Preserve concurrent local roster edits (delete mid-push).
          if(Array.isArray(raw.team_players)){
            raw.team_players = raw.team_players.filter(p => p && !removedSet.has(String(p.id)));
          }
          try{ localStorage.setItem('ffk_coach_v1', JSON.stringify(raw)); }catch(e){}
          db.removed_player_ids = nextRemoved;
        }
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
          end_time: m.end_time || '',
          fee_type: m.fee_type === 'paid' ? 'paid' : 'free',
          fee: m.fee_type === 'paid' ? (m.fee || '') : '',
          tournament: m.tournament || '',
          event_id: m.event_id || '',
          comment: m.comment || '',
          created_at: m.created_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const rule of (db.training_rules || [])){
        await upsertChecked(sb.from('training_rules').upsert({
          id: rule.id,
          team_id: rule.team_id,
          title: rule.title || '',
          weekdays: Array.isArray(rule.weekdays) ? rule.weekdays : [],
          start_time: rule.start_time || '',
          end_time: rule.end_time || '',
          address: rule.address || '',
          notify_minutes: Number(rule.notify_minutes) || 60,
          active: rule.active !== false,
          created_at: rule.created_at || new Date().toISOString(),
          updated_at: rule.updated_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      for(const tr of (db.team_trainings || [])){
        await upsertChecked(sb.from('team_trainings').upsert({
          id: tr.id,
          team_id: tr.team_id,
          rule_id: tr.rule_id || null,
          date: tr.date,
          title: tr.title || '',
          start_time: tr.start_time || '',
          end_time: tr.end_time || '',
          address: tr.address || '',
          notify_minutes: Number(tr.notify_minutes) || 60,
          status: tr.status === 'cancelled' ? 'cancelled' : 'scheduled',
          created_at: tr.created_at || new Date().toISOString(),
          updated_at: tr.updated_at || new Date().toISOString()
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
      const inviteRows = db.parent_invites || [];
      const remoteInviteStatus = new Map();
      const inviteIds = inviteRows.map(inv => inv && inv.id).filter(Boolean);
      for(let i = 0; i < inviteIds.length; i += 80){
        const chunk = inviteIds.slice(i, i + 80);
        try{
          const remote = await sb.from('parent_invites').select('id,status').in('id', chunk);
          if(!remote.error){
            (remote.data || []).forEach(row => {
              if(row && row.id) remoteInviteStatus.set(String(row.id), row.status);
            });
          }
        }catch(e){}
      }
      let inviteStatusDirty = false;
      for(const inv of inviteRows){
        // Never reopen an invite a parent already claimed in the cloud.
        const remoteStatus = remoteInviteStatus.get(String(inv.id));
        let status = inv.status || 'open';
        if(remoteStatus === 'claimed' || remoteStatus === 'revoked'){
          status = remoteStatus;
          if(inv.status !== status){
            inv.status = status;
            inviteStatusDirty = true;
          }
        }
        await upsertChecked(sb.from('parent_invites').upsert({
          id: inv.id,
          token: inv.token,
          code: inv.code,
          team_id: inv.team_id,
          team_player_id: inv.team_player_id,
          payload: inv.payload || {},
          status,
          created_at: inv.created_at || new Date().toISOString(),
          updated_at: inv.updated_at || new Date().toISOString()
        }, {onConflict: 'id'}));
      }
      if(inviteStatusDirty){
        try{
          const raw = localDb();
          if(raw && Array.isArray(raw.parent_invites)){
            const byId = new Map(inviteRows.map(i => [String(i.id), i.status]));
            raw.parent_invites = raw.parent_invites.map(i => {
              const next = byId.get(String(i.id));
              return next && next !== i.status ? {...i, status: next} : i;
            });
            localStorage.setItem('ffk_coach_v1', JSON.stringify(raw));
          }
        }catch(e){}
      }
      await reconcileDeletedRows(sb, 'team_matches', db.teams || [], db.team_matches || []);
      await reconcileDeletedRows(sb, 'training_rules', db.teams || [], db.training_rules || []);
      await reconcileDeletedRows(sb, 'team_trainings', db.teams || [], db.team_trainings || []);
      await reconcileDeletedRows(sb, 'parent_invites', db.teams || [], db.parent_invites || []);
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
    let trainingRules = [];
    let teamTrainings = [];
    let ratings = [];
    let parentInvites = [];
    if(teamIds.length){
      const p = await sb.from('team_players').select('*').in('team_id', teamIds);
      if(p.error) throw p.error;
      players = p.data || [];
      const m = await sb.from('team_matches').select('*').in('team_id', teamIds);
      if(m.error) throw m.error;
      matches = m.data || [];
      const trules = await sb.from('training_rules').select('*').in('team_id', teamIds);
      if(!trules.error) trainingRules = trules.data || [];
      const trows = await sb.from('team_trainings').select('*').in('team_id', teamIds);
      if(!trows.error) teamTrainings = trows.data || [];
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
    // Merge live local deletions that landed while remote fetches were in flight.
    // Without this, pull overwrites a mid-sync removePlayer and resurrects the roster.
    const live = localDb();
    const removedSet = new Set([
      ...((Array.isArray(raw.removed_player_ids) ? raw.removed_player_ids : [])),
      ...((Array.isArray(live.removed_player_ids) ? live.removed_player_ids : []))
    ].map(id => String(id || '')).filter(Boolean));
    const pulledPlayers = (players || [])
      .filter(p => p && !removedSet.has(String(p.id)))
      .map(p => ({
        ...p,
        contact: p.contact || '',
        coach_notes: String(p.coach_notes || '').slice(0, 2000)
      }));
    const keepPlayerIds = new Set(pulledPlayers.map(p => String(p.id)));
    const db = {
      version: 5,
      accounts: (live.accounts && Object.keys(live.accounts).length ? live.accounts : raw.accounts) || {},
      academies: academies || [],
      teams: teams || [],
      team_players: pulledPlayers,
      memberships: remoteMems.concat(pendingLocalMems),
      team_matches: (matches || []).map(m => ({
        ...m,
        squad: Array.isArray(m.squad)
          ? m.squad.filter(id => keepPlayerIds.has(String(id)))
          : (m.squad || []),
        meetup: m.meetup || '',
        kickoff: m.kickoff || '',
        end_time: m.end_time || '',
        fee_type: m.fee_type === 'paid' ? 'paid' : 'free',
        fee: m.fee_type === 'paid' ? (m.fee || '') : '',
        tournament: m.tournament || '',
        event_id: m.event_id || '',
        comment: m.comment || ''
      })),
      training_rules: (trainingRules || []).map(r => ({
        ...r,
        weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
        notify_minutes: Number(r.notify_minutes) || 60,
        active: r.active !== false
      })),
      team_trainings: (teamTrainings || []).map(r => ({
        ...r,
        rule_id: r.rule_id || null,
        notify_minutes: Number(r.notify_minutes) || 60,
        status: r.status === 'cancelled' ? 'cancelled' : 'scheduled'
      })),
      ratings: (ratings || [])
        .filter(r => r && keepPlayerIds.has(String(r.team_player_id)))
        .map(r => ({
          ...r,
          pitchPos: r.pitch_pos || r.pitchPos || '',
          matchLen: r.match_len || r.matchLen || 60,
          actionRating: r.action_rating || r.actionRating || 6,
          effortRating: r.effort_rating || r.effortRating || 6
        })),
      match_invites: Array.isArray(live.match_invites) ? live.match_invites : (raw.match_invites || []),
      parent_invites: (parentInvites || []).filter(i =>
        !i || !i.team_player_id || keepPlayerIds.has(String(i.team_player_id))
      ),
      leave_requests: Array.isArray(live.leave_requests) ? live.leave_requests : (Array.isArray(raw.leave_requests) ? raw.leave_requests : []),
      device_tokens: Array.isArray(live.device_tokens) ? live.device_tokens : (raw.device_tokens || []),
      removed_player_ids: [...removedSet],
      activeTeamId: live.activeTeamId || raw.activeTeamId || (teams && teams[0] && teams[0].id) || '',
      activeMatchId: live.activeMatchId || raw.activeMatchId || ''
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
    if(syncing){
      syncAgain = true;
      return;
    }
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncNow().catch(() => {}); }, 1200);
  }

  async function syncNow(){
    if(!ready()) return {ok: false};
    if(syncing){
      syncAgain = true;
      return {ok: false, deferred: true};
    }
    syncing = true;
    let last = {ok: false};
    try{
      do{
        syncAgain = false;
        const pushed = await pushLocalSnapshot();
        if(!pushed || !pushed.ok){
          throw pushed && pushed.error || new Error(pushed && pushed.reason || 'push');
        }
        await pullRemoteIntoLocal();
        if(global.ParentCloud && typeof global.ParentCloud.pullCoachData === 'function'){
          await global.ParentCloud.pullCoachData();
        }
        last = {ok: true};
      }while(syncAgain);
      if(typeof renderCoachUi === 'function'){
        const ae = document.activeElement;
        const picking = ae && (
          ae.tagName === 'SELECT' ||
          (ae.closest && (ae.closest('#coachPlayerFormWrap') || ae.closest('#coachPlayerBody') || ae.closest('#playerEdit')))
        );
        if(!picking) renderCoachUi();
      }
      return last;
    }catch(e){
      console.warn('Coach cloud sync', e);
      return {ok: false, error: e};
    }finally{
      syncing = false;
      if(syncAgain){
        syncAgain = false;
        scheduleSync();
      }
    }
  }

  async function registerDeviceToken(token, platform){
    let sb = getClient();
    try{
      if(typeof isCoachPlan === 'function' && !isCoachPlan() && getParentClient){
        sb = getParentClient() || sb;
      }
    }catch(e){}
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


  async function sendParentInviteEmail(payload){
    const sb = getClient();
    if(!sb) return {ok: false, reason: 'no_cloud'};
    const {data: sessData, error: sessErr} = await sb.auth.getSession();
    if(sessErr) throw sessErr;
    const session = sessData && sessData.session;
    if(!session || !session.access_token) return {ok: false, reason: 'auth'};
    const {data, error} = await sb.functions.invoke('send-parent-invite', {
      body: {
        to: payload && payload.to,
        childName: payload && payload.childName,
        code: payload && payload.code,
        link: payload && payload.link,
        teamName: payload && payload.teamName,
        coachName: payload && payload.coachName
      }
    });
    let body = data;
    if(error){
      try{
        const ctx = error.context;
        if(ctx && typeof ctx.json === 'function'){
          body = await ctx.json();
        }else if(ctx && typeof ctx.text === 'function'){
          const raw = await ctx.text();
          try{ body = JSON.parse(raw); }catch(e){ body = {error: raw}; }
        }
      }catch(e){}
      const err = String((body && body.error) || (error && error.message) || error || '');
      if(err === 'resend_not_configured' || /503/.test(err)){
        return {ok: false, reason: 'not_configured', error: err};
      }
      return {ok: false, reason: 'send_failed', error: err, detail: body && body.detail};
    }
    if(body && body.ok) return {ok: true, id: body.id || null, code: body.code || payload.code, to: body.to || payload.to};
    const err = body && body.error ? String(body.error) : 'send_failed';
    if(err === 'resend_not_configured') return {ok: false, reason: 'not_configured'};
    return {ok: false, reason: 'send_failed', error: err, detail: body && body.detail};
  }

  const CoachCloud = {
    ready,
    getClient,
    getParentClient,
    cloudSignUp,
    cloudSignIn,
    cloudSignOut,
    ensureCloudSession,
    watchCloudSession,
    signInWithGoogle,
    handleAuthCallbackUrl,
    bindAuthDeepLinks,
    adoptGoogleSession,
    sendParentInviteEmail,
    scheduleSync,
    syncNow,
    pushLocalSnapshot,
    pullRemoteIntoLocal,
    registerDeviceToken,
    hasPushBackend(){ return global.FFK_PUSH_FCM === true; },
    status(){
      return {
        configured: ready(),
        mode: ready() ? 'supabase' : 'local',
        syncing
      };
    }
  };

  global.CoachCloud = CoachCloud;
  try{ watchCloudSession(); }catch(e){}
})(window);
