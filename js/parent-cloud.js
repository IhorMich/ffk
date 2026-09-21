/* Matchcard parent/player cross-device sync through Supabase. */
(function(global){
  let syncing = false;
  let syncTimer = null;

  function ready(){
    return !!(global.CoachCloud && global.CoachCloud.ready && global.CoachCloud.ready());
  }
  function client(){
    return ready() && global.CoachCloud.getClient ? global.CoachCloud.getClient() : null;
  }
  async function ensureSession(){
    const sb = client();
    if(!sb) throw new Error('no_cloud');
    let {data, error} = await sb.auth.getSession();
    if(error) throw error;
    if(data && data.session) return data.session;
    const res = await sb.auth.signInAnonymously();
    if(res.error) throw res.error;
    if(!res.data || !res.data.session) throw new Error('auth');
    return res.data.session;
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
  async function publishInvite(invite){
    const sb = client();
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
    const sb = client();
    if(!sb || !token) throw new Error('no_cloud');
    const {data, error} = await sb.rpc('resolve_parent_invite', {invite_token: token});
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
    const sb = client();
    const profile = activeProfile();
    if(!sb || !token || !profile) throw new Error('bad_invite');
    await ensureSession();
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
    const sb = client();
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
    const sb = client();
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
    const playerIds = [...byPlayer.keys()].filter(Boolean);
    if(!playerIds.length) return;
    const pulled = await sb.from('player_chat_messages')
      .select('*')
      .in('team_player_id', playerIds)
      .order('created_at', {ascending: false});
    if(pulled.error) throw pulled.error;
    (pulled.data || []).forEach(row => {
      try{ global.InboxStore.importCloudChat(row); }catch(e){}
    });
  }
  async function syncParentData(){
    if(!ready() || syncing) return {ok: false, reason: ready() ? 'busy' : 'no_cloud'};
    syncing = true;
    try{
      const session = await ensureSession();
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
      (coachMode ? pullCoachData() : syncParentData()).catch(() => {});
    }, 1200);
  }
  async function pullCoachData(){
    const sb = client();
    const coach = global.CoachStore;
    const coachSession = coach && coach.getSession && coach.getSession();
    const academy = coachSession && coach.myAcademy && coach.myAcademy(coachSession);
    if(!sb || !coachSession || !academy) return {ok: false};
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
    ensureSession,
    tokenFromUrl,
    buildInviteUrl,
    publishInvite,
    resolveInvite,
    claimInvite,
    syncParentData,
    scheduleSync,
    pullCoachData,
    status(){ return {configured: ready(), syncing}; }
  };
})(window);
