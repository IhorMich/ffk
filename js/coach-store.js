/* Matchcard Coach — local tree (never touches Free/Pro personal storage).
   Mirrors supabase/schema.sql so we can swap to cloud without rewriting UI. */
(function(global){
  const KEY = 'ffk_coach_v1';
  const SESSION_KEY = 'ffk_coach_session_v1';

  function uid(prefix){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function inviteCode(){
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for(let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }
  function emptyDb(){
    return {
      version: 4,
      accounts: {},
      academies: [],
      teams: [],
      team_players: [],
      memberships: [],
      team_matches: [],
      ratings: [],
      match_invites: [],
      parent_invites: [],
      leave_requests: [],
      device_tokens: [],
      activeTeamId: '',
      activeMatchId: ''
    };
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      return {
        version: 4,
        accounts: db.accounts && typeof db.accounts === 'object' ? db.accounts : {},
        academies: Array.isArray(db.academies) ? db.academies : [],
        teams: Array.isArray(db.teams) ? db.teams : [],
        team_players: Array.isArray(db.team_players) ? db.team_players : [],
        memberships: Array.isArray(db.memberships) ? db.memberships : [],
        team_matches: Array.isArray(db.team_matches) ? db.team_matches : [],
        ratings: Array.isArray(db.ratings) ? db.ratings : [],
        match_invites: Array.isArray(db.match_invites) ? db.match_invites : [],
        parent_invites: Array.isArray(db.parent_invites) ? db.parent_invites : [],
        leave_requests: Array.isArray(db.leave_requests) ? db.leave_requests : [],
        device_tokens: Array.isArray(db.device_tokens) ? db.device_tokens : [],
        activeTeamId: String(db.activeTeamId || ''),
        activeMatchId: String(db.activeMatchId || '')
      };
    }catch(e){
      return emptyDb();
    }
  }
  function writeDb(db){
    localStorage.setItem(KEY, JSON.stringify(db));
    try{
      if(global.CoachCloud && typeof global.CoachCloud.scheduleSync === 'function'){
        global.CoachCloud.scheduleSync();
      }
    }catch(e){}
  }
  function readSession(){
    try{
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || !s.userId || !s.email) return null;
      return {userId: String(s.userId), email: String(s.email)};
    }catch(e){ return null; }
  }
  function writeSession(session){
    if(!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  async function hashPass(pass){
    const data = new TextEncoder().encode(`ffk-coach:${pass}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function normalizeKickoff(raw){
    const s = String(raw || '').trim();
    if(!s) return '';
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return '';
    const h = Math.max(0, Math.min(23, Number(m[1])));
    const min = Math.max(0, Math.min(59, Number(m[2])));
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }
  function normalizeFee(fields){
    const mode = fields && fields.fee_type === 'paid' ? 'paid' : 'free';
    if(mode !== 'paid') return {fee_type: 'free', fee: ''};
    return {fee_type: 'paid', fee: String(fields.fee || '').trim().slice(0, 32)};
  }
  function kickoffMinutes(kickoff){
    const s = normalizeKickoff(kickoff);
    if(!s) return 12 * 60; // noon default for clustering
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  }
  function daysBetween(a, b){
    const da = Date.parse(`${a}T12:00:00`);
    const db = Date.parse(`${b}T12:00:00`);
    if(!Number.isFinite(da) || !Number.isFinite(db)) return 99;
    return Math.round((db - da) / 86400000);
  }
  function guessTournamentName(cluster){
    const named = (cluster || []).find(m => String(m.tournament || '').trim());
    return named ? String(named.tournament).trim() : '';
  }
  function maybePushGroup(groups, used, cluster, tournamentName){
    if(!cluster || cluster.length < 2) return;
    if(cluster.some(m => used.has(m.id))) return;
    cluster.forEach(m => used.add(m.id));
    const dates = [...new Set(cluster.map(m => m.date))].sort();
    groups.push({
      id: `sug_${cluster.map(m => m.id).join('_').slice(0, 40)}`,
      tournament: tournamentName || '',
      dates,
      matches: cluster.slice()
    });
  }

  const CoachStore = {
    getSession(){ return readSession(); },
    signOut(){
      writeSession(null);
      try{
        if(global.CoachCloud && typeof global.CoachCloud.cloudSignOut === 'function'){
          global.CoachCloud.cloudSignOut();
        }
      }catch(e){}
    },
    async signUp(email, password){
      email = String(email || '').trim().toLowerCase();
      password = String(password || '');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('bad_email');
      if(password.length < 6) throw new Error('bad_password');

      // Prefer Supabase auth when configured
      if(global.CoachCloud && global.CoachCloud.ready && global.CoachCloud.ready()){
        try{
          const session = await global.CoachCloud.cloudSignUp(email, password);
          const db = readDb();
          db.accounts[email] = {
            id: session.userId,
            email,
            passHash: '',
            first_name: '',
            last_name: '',
            photo: '',
            cover: '',
            coach_sub: true,
            createdAt: new Date().toISOString()
          };
          writeDb(db);
          writeSession(session);
          try{ await global.CoachCloud.pullRemoteIntoLocal(); }catch(e){}
          return session;
        }catch(e){
          // Fall through to local if cloud rejects (e.g. network)
          if(e && e.message === 'no_cloud'){ /* continue */ }
          else if(e && /already|exists|registered/i.test(String(e.message || e))) throw new Error('exists');
          else if(e && e.status === 422) throw new Error('exists');
        }
      }

      const db = readDb();
      if(db.accounts[email]) throw new Error('exists');
      const id = uid('usr');
      db.accounts[email] = {
        id,
        email,
        passHash: await hashPass(password),
        first_name: '',
        last_name: '',
        photo: '',
        cover: '',
        coach_sub: false,
        createdAt: new Date().toISOString()
      };
      writeDb(db);
      const session = {userId: id, email};
      writeSession(session);
      return session;
    },
    async signIn(email, password){
      email = String(email || '').trim().toLowerCase();
      password = String(password || '');
      if(global.CoachCloud && global.CoachCloud.ready && global.CoachCloud.ready()){
        try{
          const session = await global.CoachCloud.cloudSignIn(email, password);
          const db = readDb();
          if(!db.accounts[email]){
            db.accounts[email] = {
              id: session.userId,
              email,
              passHash: '',
              first_name: '',
              last_name: '',
              photo: '',
              cover: '',
              coach_sub: true,
              createdAt: new Date().toISOString()
            };
            writeDb(db);
          }
          writeSession(session);
          try{ await global.CoachCloud.pullRemoteIntoLocal(); }catch(e){}
          return session;
        }catch(e){
          if(e && e.message !== 'no_cloud') throw new Error('auth');
        }
      }
      const db = readDb();
      const acc = db.accounts[email];
      if(!acc) throw new Error('auth');
      const hash = await hashPass(password);
      if(acc.passHash !== hash) throw new Error('auth');
      const session = {userId: acc.id, email};
      writeSession(session);
      return session;
    },
    getAccount(session){
      if(!session || !session.userId) return null;
      const db = readDb();
      const hit = Object.values(db.accounts || {}).find(a => a && a.id === session.userId);
      return hit || null;
    },
    getProfile(session){
      const acc = this.getAccount(session);
      return {
        email: (acc && acc.email) || (session && session.email) || '',
        first_name: acc && acc.first_name ? String(acc.first_name) : '',
        last_name: acc && acc.last_name ? String(acc.last_name) : '',
        photo: acc && acc.photo ? String(acc.photo) : '',
        cover: acc && acc.cover ? String(acc.cover) : ''
      };
    },
    updateProfile(session, patch){
      if(!session) throw new Error('auth');
      const db = readDb();
      const email = Object.keys(db.accounts || {}).find(k => db.accounts[k] && db.accounts[k].id === session.userId);
      if(!email) throw new Error('auth');
      const acc = db.accounts[email];
      if(Object.prototype.hasOwnProperty.call(patch, 'first_name')){
        acc.first_name = String(patch.first_name || '').trim().slice(0, 40);
      }
      if(Object.prototype.hasOwnProperty.call(patch, 'last_name')){
        acc.last_name = String(patch.last_name || '').trim().slice(0, 40);
      }
      if(Object.prototype.hasOwnProperty.call(patch, 'photo')){
        acc.photo = patch.photo ? String(patch.photo) : '';
      }
      if(Object.prototype.hasOwnProperty.call(patch, 'cover')){
        acc.cover = patch.cover ? String(patch.cover) : '';
      }
      writeDb(db);
      return this.getProfile(session);
    },
    updateProfileMedia(session, patch){
      return this.updateProfile(session, patch);
    },
    myAcademy(session){
      const db = readDb();
      const uid = session && session.userId;
      if(!uid) return null;
      const mem = db.memberships.find(m =>
        m.user_id === uid &&
        m.academy_id &&
        (m.role === 'owner' || m.role === 'assistant') &&
        (m.status || 'active') !== 'revoked'
      );
      if(!mem) return null;
      return db.academies.find(a => a.id === mem.academy_id) || null;
    },
    isAcademyOwner(session){
      const academy = this.myAcademy(session);
      if(!academy || !session) return false;
      if(academy.owner_user_id && academy.owner_user_id === session.userId) return true;
      const db = readDb();
      return db.memberships.some(m =>
        m.user_id === session.userId &&
        m.academy_id === academy.id &&
        m.role === 'owner' &&
        (m.status || 'active') !== 'revoked'
      );
    },
    createAcademy(session, name){
      name = String(name || '').trim().slice(0, 80);
      if(!session) throw new Error('auth');
      if(!name) throw new Error('name');
      const db = readDb();
      if(this.myAcademy(session)) throw new Error('academy_limit');
      const academy = {
        id: uid('acd'),
        name,
        owner_user_id: session.userId,
        created_at: new Date().toISOString()
      };
      db.academies.push(academy);
      db.memberships.push({
        id: uid('mem'),
        user_id: session.userId,
        academy_id: academy.id,
        team_id: null,
        team_player_id: null,
        role: 'owner',
        email: session.email || '',
        invite_code: '',
        status: 'active',
        created_at: new Date().toISOString()
      });
      writeDb(db);
      return academy;
    },
    renameAcademy(session, name){
      name = String(name || '').trim().slice(0, 80);
      if(!session) throw new Error('auth');
      if(!name) throw new Error('name');
      if(!this.isAcademyOwner(session)) throw new Error('owner_only');
      const academy = this.myAcademy(session);
      if(!academy) throw new Error('forbidden');
      const db = readDb();
      db.academies = db.academies.map(a => a.id === academy.id ? {...a, name} : a);
      writeDb(db);
      return this.myAcademy(session);
    },
    listTeams(session, academyId){
      const db = readDb();
      if(!session || !this.myAcademy(session) || this.myAcademy(session).id !== academyId) return [];
      return db.teams.filter(t => t.academy_id === academyId);
    },
    createTeam(session, academyId, name, ageGroup){
      name = String(name || '').trim().slice(0, 60);
      ageGroup = String(ageGroup || '').trim().slice(0, 24);
      if(!session) throw new Error('auth');
      if(!name) throw new Error('name');
      const academy = this.myAcademy(session);
      if(!academy || academy.id !== academyId) throw new Error('forbidden');
      if(!this.isAcademyOwner(session)) throw new Error('owner_only');
      const db = readDb();
      const count = db.teams.filter(t => t.academy_id === academyId).length;
      const maxTeams = (typeof COACH_MAX_TEAMS === 'number') ? COACH_MAX_TEAMS : 10;
      if(count >= maxTeams) throw new Error('team_limit');
      let code = inviteCode();
      while(db.teams.some(t => t.invite_code === code)) code = inviteCode();
      const team = {
        id: uid('tem'),
        academy_id: academyId,
        name,
        age_group: ageGroup,
        invite_code: code,
        created_at: new Date().toISOString()
      };
      db.teams.push(team);
      if(!db.activeTeamId) db.activeTeamId = team.id;
      writeDb(db);
      return team;
    },
    updateTeam(session, teamId, fields){
      const team = this.getTeam(session, teamId);
      if(!team) throw new Error('forbidden');
      if(!this.isAcademyOwner(session)) throw new Error('owner_only');
      const db = readDb();
      const row = db.teams.find(t => t.id === teamId);
      if(!row) throw new Error('forbidden');
      if(Object.prototype.hasOwnProperty.call(fields, 'name')){
        const name = String(fields.name || '').trim().slice(0, 60);
        if(!name) throw new Error('name');
        row.name = name;
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'age_group')){
        row.age_group = String(fields.age_group || '').trim().slice(0, 24);
      }
      writeDb(db);
      return row;
    },
    removeTeam(session, teamId){
      const team = this.getTeam(session, teamId);
      if(!team) throw new Error('forbidden');
      if(!this.isAcademyOwner(session)) throw new Error('owner_only');
      const db = readDb();
      const matchIds = new Set(db.team_matches.filter(m => m.team_id === teamId).map(m => m.id));
      const playerIds = new Set(db.team_players.filter(p => p.team_id === teamId).map(p => p.id));
      db.teams = db.teams.filter(t => t.id !== teamId);
      db.team_players = db.team_players.filter(p => p.team_id !== teamId);
      db.team_matches = db.team_matches.filter(m => m.team_id !== teamId);
      db.ratings = db.ratings.filter(r => !matchIds.has(r.match_id) && !playerIds.has(r.team_player_id));
      db.match_invites = db.match_invites.filter(i => i.team_id !== teamId && !matchIds.has(i.match_id));
      db.parent_invites = db.parent_invites.filter(i => i.team_id !== teamId && !playerIds.has(i.team_player_id));
      db.memberships = db.memberships.filter(m => m.team_id !== teamId && !playerIds.has(m.team_player_id));
      if(db.activeTeamId === teamId){
        const next = db.teams.find(t => t.academy_id === team.academy_id);
        db.activeTeamId = next ? next.id : '';
      }
      if(matchIds.has(db.activeMatchId)) db.activeMatchId = '';
      writeDb(db);
    },
    getActiveTeamId(){
      return readDb().activeTeamId || '';
    },
    setActiveTeamId(teamId){
      const db = readDb();
      db.activeTeamId = String(teamId || '');
      writeDb(db);
    },
    getTeam(session, teamId){
      const teams = this.listTeams(session, (this.myAcademy(session) || {}).id);
      return teams.find(t => t.id === teamId) || null;
    },
    listPlayers(session, teamId){
      if(!this.getTeam(session, teamId)) return [];
      return readDb().team_players.filter(p => p.team_id === teamId);
    },
    addPlayer(session, teamId, fields){
      if(!this.getTeam(session, teamId)) throw new Error('forbidden');
      const first = String(fields.first_name || '').trim().slice(0, 40);
      const last = String(fields.last_name || '').trim().slice(0, 40);
      if(!first) throw new Error('name');
      const db = readDb();
      const maxP = (typeof COACH_MAX_PLAYERS_PER_TEAM === 'number') ? COACH_MAX_PLAYERS_PER_TEAM : 50;
      if(db.team_players.filter(p => p.team_id === teamId).length >= maxP) throw new Error('player_limit');
      const player = {
        id: uid('tpl'),
        team_id: teamId,
        first_name: first,
        last_name: last,
        number: String(fields.number || '').replace(/\D/g, '').slice(0, 4),
        position: String(fields.position || '').trim().toUpperCase().slice(0, 8),
        birth_date: String(fields.birth_date || '').trim().slice(0, 10),
        contact: String(fields.contact || '').trim().slice(0, 80),
        coach_notes: String(fields.coach_notes || '').trim().slice(0, 2000),
        photo: fields.photo ? String(fields.photo) : '',
        created_at: new Date().toISOString()
      };
      db.team_players.push(player);
      writeDb(db);
      return player;
    },
    updatePlayer(session, playerId, fields){
      const db = readDb();
      const player = db.team_players.find(p => p.id === playerId);
      if(!player || !this.getTeam(session, player.team_id)) throw new Error('forbidden');
      if(Object.prototype.hasOwnProperty.call(fields, 'first_name')){
        const first = String(fields.first_name || '').trim().slice(0, 40);
        if(!first) throw new Error('name');
        player.first_name = first;
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'last_name')){
        player.last_name = String(fields.last_name || '').trim().slice(0, 40);
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'number')){
        player.number = String(fields.number || '').replace(/\D/g, '').slice(0, 4);
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'position')){
        player.position = String(fields.position || '').trim().toUpperCase().slice(0, 8);
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'birth_date')){
        player.birth_date = String(fields.birth_date || '').trim().slice(0, 10);
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'contact')){
        player.contact = String(fields.contact || '').trim().slice(0, 80);
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'coach_notes')){
        // Staff-only notes — never included in parent/inbox payloads.
        player.coach_notes = String(fields.coach_notes || '').trim().slice(0, 2000);
      }
      if(Object.prototype.hasOwnProperty.call(fields, 'photo')){
        player.photo = fields.photo ? String(fields.photo) : '';
      }
      writeDb(db);
      return player;
    },
    removePlayer(session, playerId){
      const db = readDb();
      const player = db.team_players.find(p => p.id === playerId);
      if(!player) return;
      if(!this.getTeam(session, player.team_id)) throw new Error('forbidden');
      db.team_players = db.team_players.filter(p => p.id !== playerId);
      db.memberships = db.memberships.filter(m => m.team_player_id !== playerId);
      db.ratings = db.ratings.filter(r => r.team_player_id !== playerId);
      db.match_invites = db.match_invites.filter(i => i.team_player_id !== playerId);
      db.parent_invites = db.parent_invites.filter(i => i.team_player_id !== playerId);
      db.leave_requests = (db.leave_requests || []).filter(r => String(r.team_player_id) !== String(playerId));
      writeDb(db);
      try{
        if(global.ParentStore && typeof global.ParentStore.removeLinksForPlayer === 'function'){
          global.ParentStore.removeLinksForPlayer(playerId);
        }
      }catch(e){}
    },
    /** Pending leave requests from parents/players who changed club. */
    listLeaveRequests(session, opts){
      const status = opts && opts.status ? String(opts.status) : 'pending';
      const db = readDb();
      return (db.leave_requests || [])
        .filter(r => {
          if(!r || !r.team_player_id) return false;
          if(status !== 'all' && String(r.status || 'pending') !== status) return false;
          return !!this.getPlayer(session, r.team_player_id);
        })
        .slice()
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    },
    requestPlayerLeave(payload){
      const pid = String(payload && payload.team_player_id || '');
      const linkId = String(payload && payload.parent_link_id || '');
      if(!pid || !linkId) throw new Error('bad_leave');
      const db = readDb();
      const player = db.team_players.find(p => p.id === pid);
      if(!player) throw new Error('no_player');
      const existing = (db.leave_requests || []).find(r =>
        String(r.team_player_id) === pid && String(r.status || 'pending') === 'pending'
      );
      const now = new Date().toISOString();
      const row = {
        id: existing ? existing.id : uid('leave'),
        team_player_id: pid,
        team_id: player.team_id,
        parent_link_id: linkId,
        player_name: String(payload.player_name || [player.first_name, player.last_name].filter(Boolean).join(' ')).slice(0, 80),
        team_name: String(payload.team_name || '').slice(0, 60),
        academy_name: String(payload.academy_name || '').slice(0, 80),
        new_club: String(payload.new_club || '').slice(0, 60),
        new_team: String(payload.new_team || '').slice(0, 60),
        reason: String(payload.reason || 'club_change').slice(0, 40),
        status: 'pending',
        created_at: existing ? existing.created_at : now,
        updated_at: now
      };
      if(existing){
        db.leave_requests = db.leave_requests.map(r => r.id === existing.id ? row : r);
      }else{
        if(!Array.isArray(db.leave_requests)) db.leave_requests = [];
        db.leave_requests.push(row);
      }
      writeDb(db);
      try{
        if(global.InboxStore && typeof global.InboxStore.upsertCoachLeaveRequest === 'function'){
          global.InboxStore.upsertCoachLeaveRequest(row);
        }
      }catch(e){}
      return row;
    },
    /** Coach confirms leave (✓) or cancels request (✕). */
    resolveLeaveRequest(session, requestId, decision){
      const id = String(requestId || '');
      const ok = decision === 'accept' || decision === 'decline';
      if(!id || !ok) throw new Error('bad_decision');
      const db = readDb();
      const req = (db.leave_requests || []).find(r => r.id === id);
      if(!req) throw new Error('not_found');
      if(!this.getPlayer(session, req.team_player_id)) throw new Error('forbidden');
      const now = new Date().toISOString();
      if(decision === 'decline'){
        db.leave_requests = db.leave_requests.map(r =>
          r.id === id ? {...r, status: 'declined', updated_at: now} : r
        );
        writeDb(db);
        try{
          if(global.ParentStore && typeof global.ParentStore.setLeaveStatus === 'function'){
            global.ParentStore.setLeaveStatus(req.parent_link_id, 'declined');
          }
        }catch(e){}
        try{
          if(global.InboxStore && typeof global.InboxStore.resolveCoachLeaveRequest === 'function'){
            global.InboxStore.resolveCoachLeaveRequest(req.id, 'declined');
          }
        }catch(e){}
        return {request: {...req, status: 'declined'}, removed: false};
      }
      // Accept: unlink parent + remove player from roster.
      db.leave_requests = db.leave_requests.map(r =>
        r.id === id ? {...r, status: 'accepted', updated_at: now} : r
      );
      writeDb(db);
      const pid = req.team_player_id;
      try{
        if(global.ParentStore && typeof global.ParentStore.removeLink === 'function' && req.parent_link_id){
          global.ParentStore.removeLink(req.parent_link_id);
        }else if(global.ParentStore && typeof global.ParentStore.removeLinksForPlayer === 'function'){
          global.ParentStore.removeLinksForPlayer(pid);
        }
      }catch(e){}
      this.removePlayer(session, pid);
      try{
        if(global.InboxStore && typeof global.InboxStore.resolveCoachLeaveRequest === 'function'){
          global.InboxStore.resolveCoachLeaveRequest(req.id, 'accepted');
        }
      }catch(e){}
      return {request: {...req, status: 'accepted'}, removed: true};
    },
    getActiveMatchId(){
      return readDb().activeMatchId || '';
    },
    setActiveMatchId(matchId){
      const db = readDb();
      db.activeMatchId = String(matchId || '');
      writeDb(db);
    },
    listMatches(session, teamId){
      if(!this.getTeam(session, teamId)) return [];
      return readDb().team_matches
        .filter(m => m.team_id === teamId)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at)));
    },
    getMatch(session, matchId){
      const db = readDb();
      const m = db.team_matches.find(x => x.id === matchId);
      if(!m || !this.getTeam(session, m.team_id)) return null;
      return m;
    },
    createMatch(session, teamId, fields){
      if(!this.getTeam(session, teamId)) throw new Error('forbidden');
      const opponent = String(fields.opponent || '').trim().slice(0, 48);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(fields.date) ? fields.date : new Date().toISOString().slice(0, 10);
      if(!opponent) throw new Error('opponent');
      const roster = this.listPlayers(session, teamId);
      const rosterIds = new Set(roster.map(p => p.id));
      let squad = Array.isArray(fields.squad) ? fields.squad.map(String) : [];
      squad = [...new Set(squad.filter(id => rosterIds.has(id)))];
      if(!squad.length) throw new Error('squad');
      const kind = ['league','friendly','cup','tournament'].includes(fields.kind) ? fields.kind : 'league';
      const meetup = normalizeKickoff(fields.meetup);
      const kickoff = normalizeKickoff(fields.kickoff);
      const feeInfo = normalizeFee(fields);
      const tournament = kind === 'friendly'
        ? ''
        : String(fields.tournament || '').trim().slice(0, 48);
      let eventId = String(fields.event_id || '').trim().slice(0, 40);
      if(!eventId && tournament){
        // Auto-link to an existing event with the same competition name on this team.
        const existing = readDb().team_matches.find(m =>
          m.team_id === teamId
          && String(m.tournament || '').trim().toLowerCase() === tournament.toLowerCase()
          && m.event_id
        );
        if(existing) eventId = existing.event_id;
      }
      const db = readDb();
      const match = {
        id: uid('tmt'),
        team_id: teamId,
        date,
        opponent,
        address: String(fields.address || '').trim().slice(0, 120),
        score: String(fields.score || '').trim().slice(0, 16),
        venue: fields.venue === 'away' ? 'away' : 'home',
        kind,
        status: fields.status === 'played' ? 'played' : 'upcoming',
        squad,
        meetup,
        kickoff,
        fee_type: feeInfo.fee_type,
        fee: feeInfo.fee,
        tournament,
        event_id: eventId,
        comment: String(fields.comment || '').trim().slice(0, 400),
        created_at: new Date().toISOString()
      };
      db.team_matches.push(match);
      // Create pending invites for every squad player
      squad.forEach(pid => {
        const exists = db.match_invites.some(i => i.match_id === match.id && i.team_player_id === pid);
        if(exists) return;
        db.match_invites.push({
          id: uid('inv'),
          match_id: match.id,
          team_id: teamId,
          team_player_id: pid,
          status: 'pending',
          rsvp: '',
          rsvp_at: '',
          sent_at: '',
          created_at: new Date().toISOString()
        });
      });
      db.activeMatchId = match.id;
      writeDb(db);
      return match;
    },
    updateMatch(session, matchId, fields){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const db = readDb();
      const next = {...match};
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'score')){
        next.score = String(fields.score || '').trim().slice(0, 16);
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'address')){
        next.address = String(fields.address || '').trim().slice(0, 120);
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'comment')){
        next.comment = String(fields.comment || '').trim().slice(0, 400);
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'opponent')){
        const opponent = String(fields.opponent || '').trim().slice(0, 48);
        if(!opponent) throw new Error('opponent');
        next.opponent = opponent;
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'date')){
        if(/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) next.date = fields.date;
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'venue')){
        next.venue = fields.venue === 'away' ? 'away' : 'home';
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'kind')){
        next.kind = ['league','friendly','cup','tournament'].includes(fields.kind) ? fields.kind : next.kind;
        if(next.kind === 'friendly') next.tournament = '';
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'meetup')){
        next.meetup = normalizeKickoff(fields.meetup);
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'kickoff')){
        next.kickoff = normalizeKickoff(fields.kickoff);
      }
      if(fields && (Object.prototype.hasOwnProperty.call(fields, 'fee_type')
        || Object.prototype.hasOwnProperty.call(fields, 'fee'))){
        const feeInfo = normalizeFee({
          fee_type: Object.prototype.hasOwnProperty.call(fields, 'fee_type')
            ? fields.fee_type
            : next.fee_type,
          fee: Object.prototype.hasOwnProperty.call(fields, 'fee')
            ? fields.fee
            : next.fee
        });
        next.fee_type = feeInfo.fee_type;
        next.fee = feeInfo.fee;
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'tournament')){
        next.tournament = next.kind === 'friendly'
          ? ''
          : String(fields.tournament || '').trim().slice(0, 48);
      }
      if(fields && Object.prototype.hasOwnProperty.call(fields, 'event_id')){
        next.event_id = String(fields.event_id || '').trim().slice(0, 40);
      }
      if(fields && fields.status === 'played') next.status = 'played';
      if(fields && fields.status === 'upcoming') next.status = 'upcoming';
      if(next.score && next.status !== 'upcoming') next.status = 'played';
      db.team_matches = db.team_matches.map(m => m.id === matchId ? next : m);
      writeDb(db);
      return this.getMatch(session, matchId);
    },
    setMatchSquad(session, matchId, squadIds){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      if(match.status === 'played' && String(match.score || '').trim()){
        // Allow edits until fully wrapped; still ok for unfinished played.
      }
      const roster = this.listPlayers(session, match.team_id);
      const rosterIds = new Set(roster.map(p => p.id));
      let squad = Array.isArray(squadIds) ? squadIds.map(String) : [];
      squad = [...new Set(squad.filter(id => rosterIds.has(id)))];
      if(!squad.length) throw new Error('squad');
      const prev = new Set(this.matchSquadIds(session, match));
      const nextSet = new Set(squad);
      const db = readDb();
      db.team_matches = db.team_matches.map(m => m.id === matchId ? {...m, squad} : m);
      // Add invites for newly selected players
      squad.forEach(pid => {
        if(prev.has(pid)) return;
        const exists = db.match_invites.some(i => i.match_id === matchId && i.team_player_id === pid);
        if(exists) return;
        db.match_invites.push({
          id: uid('inv'),
          match_id: matchId,
          team_id: match.team_id,
          team_player_id: pid,
          status: 'pending',
          rsvp: '',
          rsvp_at: '',
          sent_at: '',
          created_at: new Date().toISOString()
        });
      });
      // Drop invites (and unsent only) for removed players without ratings
      const rated = new Set(
        db.ratings.filter(r => r.match_id === matchId).map(r => String(r.team_player_id))
      );
      db.match_invites = db.match_invites.filter(inv => {
        if(inv.match_id !== matchId) return true;
        if(nextSet.has(String(inv.team_player_id))) return true;
        if(rated.has(String(inv.team_player_id))) return true;
        return false;
      });
      writeDb(db);
      return {
        match: this.getMatch(session, matchId),
        added: squad.filter(id => !prev.has(String(id))),
        removed: [...prev].filter(id => !nextSet.has(String(id)))
      };
    },
    removeMatch(session, matchId, opts){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const db = readDb();
      const ratings = db.ratings.filter(r => r.match_id === matchId);
      const played = match.status === 'played' || !!String(match.score || '').trim();
      const force = !!(opts && opts.force);
      // Upcoming cancel stays safe; Results can force-delete played matches with scores/ratings.
      if((played || ratings.length) && !force){
        throw new Error('has_results');
      }
      // Calm notice for parents before wiping coach-side invites (upcoming cancel).
      if(!played && !force){
        try{
          if(global.InboxStore && typeof global.InboxStore.markMatchCancelled === 'function'){
            global.InboxStore.markMatchCancelled(matchId, {
              date: match.date,
              opponent: match.opponent,
              address: match.address,
              meetup: match.meetup,
              kickoff: match.kickoff
            });
          }
        }catch(e){}
      }else{
        try{
          if(global.InboxStore && typeof global.InboxStore.removeForMatch === 'function'){
            global.InboxStore.removeForMatch(matchId);
          }
        }catch(e){}
      }
      db.team_matches = db.team_matches.filter(m => m.id !== matchId);
      db.match_invites = db.match_invites.filter(i => i.match_id !== matchId);
      db.ratings = db.ratings.filter(r => r.match_id !== matchId);
      if(db.activeMatchId === matchId) db.activeMatchId = '';
      writeDb(db);
      return true;
    },
    listCompetitionNames(session, teamId){
      if(!this.getTeam(session, teamId)) return [];
      const names = readDb().team_matches
        .filter(m => m.team_id === teamId && String(m.tournament || '').trim())
        .map(m => String(m.tournament).trim());
      return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    },
    /**
     * Suggest grouping matches that look like one tournament / cup day.
     * Heuristics: same competition name within 2 days, OR same day + kickoffs within 3h
     * for cup/tournament (or any with a shared name).
     */
    suggestMatchGroups(session, teamId){
      if(!this.getTeam(session, teamId)) return [];
      const matches = this.listMatches(session, teamId).slice();
      const used = new Set();
      const groups = [];
      const byName = new Map();
      matches.forEach(m => {
        const name = String(m.tournament || '').trim().toLowerCase();
        if(!name) return;
        if(!byName.has(name)) byName.set(name, []);
        byName.get(name).push(m);
      });
      byName.forEach((list, nameKey) => {
        if(list.length < 2) return;
        list.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.kickoff||'').localeCompare(String(b.kickoff||'')));
        // Split into clusters if dates are farther than 2 days apart
        let cluster = [list[0]];
        for(let i = 1; i < list.length; i++){
          const prev = cluster[cluster.length - 1];
          const gap = Math.abs(daysBetween(prev.date, list[i].date));
          if(gap <= 2) cluster.push(list[i]);
          else{
            maybePushGroup(groups, used, cluster, list[0].tournament);
            cluster = [list[i]];
          }
        }
        maybePushGroup(groups, used, cluster, list[0].tournament);
      });
      // Same-day close kickoffs without (or with mixed) names — cup/tournament preferred
      const byDate = new Map();
      matches.forEach(m => {
        if(used.has(m.id)) return;
        if(!['cup','tournament'].includes(m.kind) && !String(m.tournament||'').trim()) return;
        if(!byDate.has(m.date)) byDate.set(m.date, []);
        byDate.get(m.date).push(m);
      });
      byDate.forEach((list) => {
        if(list.length < 2) return;
        list.sort((a, b) => kickoffMinutes(a.kickoff) - kickoffMinutes(b.kickoff));
        let cluster = [list[0]];
        for(let i = 1; i < list.length; i++){
          const prev = cluster[cluster.length - 1];
          const dt = Math.abs(kickoffMinutes(list[i].kickoff) - kickoffMinutes(prev.kickoff));
          // If either lacks kickoff, still group same-day cup/tournament matches
          const close = (!list[i].kickoff || !prev.kickoff) ? true : dt <= 180;
          if(close) cluster.push(list[i]);
          else{
            maybePushGroup(groups, used, cluster, guessTournamentName(cluster));
            cluster = [list[i]];
          }
        }
        maybePushGroup(groups, used, cluster, guessTournamentName(cluster));
      });
      return groups.filter(g => {
        // Only suggest if not already fully linked under one event_id
        const events = new Set(g.matches.map(m => m.event_id || '').filter(Boolean));
        if(events.size === 1 && g.matches.every(m => m.event_id === [...events][0])) return false;
        return g.matches.length >= 2;
      });
    },
    linkMatchesToEvent(session, matchIds, fields){
      const ids = (matchIds || []).map(String);
      if(ids.length < 2) throw new Error('group_small');
      const matches = ids.map(id => this.getMatch(session, id)).filter(Boolean);
      if(matches.length < 2) throw new Error('forbidden');
      const teamId = matches[0].team_id;
      if(matches.some(m => m.team_id !== teamId)) throw new Error('forbidden');
      const tournament = String((fields && fields.tournament) || matches.find(m => m.tournament)?.tournament || '').trim().slice(0, 48);
      if(!tournament) throw new Error('tournament');
      const eventId = String((fields && fields.event_id) || matches.find(m => m.event_id)?.event_id || uid('tev')).slice(0, 40);
      const db = readDb();
      const idSet = new Set(ids);
      db.team_matches = db.team_matches.map(m => {
        if(!idSet.has(m.id)) return m;
        return {
          ...m,
          tournament,
          event_id: eventId,
          kind: ['cup','tournament'].includes(m.kind) ? m.kind : (m.kind === 'friendly' ? 'tournament' : m.kind)
        };
      });
      writeDb(db);
      return {event_id: eventId, tournament, matchIds: ids};
    },
    finishMatch(session, matchId, score){
      return this.updateMatch(session, matchId, {
        score: score == null ? '' : score,
        status: 'played'
      });
    },
    buildMatchResultPayload(session, matchId, teamPlayerId){
      const base = this.buildMatchInvitePayload(session, matchId, teamPlayerId);
      if(!base) return null;
      const match = this.getMatch(session, matchId);
      const rating = this.getRatingForPlayer(session, matchId, teamPlayerId);
      if(!rating) return null;
      // Results are game-only: never include entry fee from the invite payload.
      return {
        match_id: base.match_id,
        team_id: base.team_id,
        team_player_id: base.team_player_id,
        player_name: base.player_name,
        academy_name: base.academy_name,
        team_name: base.team_name,
        team_code: base.team_code,
        coach_name: base.coach_name,
        date: base.date,
        opponent: base.opponent,
        address: base.address || '',
        venue: base.venue,
        kind: base.kind,
        meetup: base.meetup || '',
        kickoff: base.kickoff || '',
        tournament: base.tournament || '',
        type: 'match_result',
        score: match ? (match.score || '') : '',
        rating: Number(rating.rating) || 0,
        comment: String(rating.comment || '').slice(0, 400),
        match_comment: match ? String(match.comment || '').trim().slice(0, 400) : '',
        pitchPos: String(rating.pitchPos || '').slice(0, 8),
        minutes: Math.min(120, Math.max(0, Number(rating.minutes) || 0)),
        role: rating.role === 'sub' ? 'sub' : 'start',
        format: String(rating.format || '').slice(0, 16),
        match_len: Math.min(120, Math.max(0, Number(rating.matchLen) || 0))
      };
    },
    deliverMatchResults(session, matchId, opts){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      if(match.status !== 'played' && !match.score){
        throw new Error('not_finished');
      }
      const forceUnread = !(opts && opts.forceUnread === false);
      const onlyIds = opts && Array.isArray(opts.playerIds) ? new Set(opts.playerIds.map(String)) : null;
      const squad = this.listMatchPlayers(session, match);
      let delivered = 0;
      let waiting = 0;
      let skipped = 0;
      const now = new Date().toISOString();
      squad.forEach(p => {
        if(onlyIds && !onlyIds.has(String(p.id))) return;
        const payload = this.buildMatchResultPayload(session, matchId, p.id);
        if(!payload){
          skipped += 1;
          return;
        }
        const linked = this.parentLinkedForPlayer(p.id);
        if(linked && global.InboxStore && typeof global.InboxStore.upsertMatchResult === 'function'){
          global.InboxStore.upsertMatchResult({...payload, forceUnread});
        }
        const coachIsActive = typeof isCoachPlan === 'function' && isCoachPlan();
        if(linked && !coachIsActive){
          try{
            if(global.CoachPush && typeof global.CoachPush.notifyResult === 'function'){
              global.CoachPush.notifyResult(payload);
            }
          }catch(e){}
        }
        // Refresh parent invite snapshot + local parent link ratings
        try{
          this.createParentInvite(session, p.id);
        }catch(e){}
        try{
          if(global.ParentStore && typeof global.ParentStore.syncCoachRatings === 'function'){
            const detail = this.playerDetail(session, p.id);
            if(detail){
              global.ParentStore.syncCoachRatings(p.id, {
                ratings: detail.ratings.slice(0, 40).map(r => ({
                  date: r.date,
                  opponent: r.opponent,
                  score: r.score || '',
                  rating: Number(r.rating) || 0,
                  comment: String(r.comment || '').slice(0, 200),
                  pitchPos: r.pitchPos || ''
                })),
                avg: detail.avg,
                games: detail.games
              });
            }
          }
        }catch(e){}
        if(linked) delivered += 1;
        else waiting += 1;
      });
      // Keep status played
      this.updateMatch(session, matchId, {status: 'played', score: match.score || ''});
      return {delivered, waiting, skipped, at: now};
    },
    listInvites(session, matchId){
      const match = this.getMatch(session, matchId);
      if(!match) return [];
      return readDb().match_invites.filter(i => i.match_id === matchId);
    },
    parentLinkedForPlayer(teamPlayerId){
      const pid = String(teamPlayerId || '');
      if(!pid || !global.ParentStore || typeof global.ParentStore.listLinks !== 'function') return false;
      return global.ParentStore.listLinks().some(l => l && l.player && String(l.player.id) === pid);
    },
    buildMatchInvitePayload(session, matchId, teamPlayerId){
      const match = this.getMatch(session, matchId);
      if(!match) return null;
      const team = this.getTeam(session, match.team_id);
      const academy = this.myAcademy(session);
      const profile = this.getProfile(session);
      const tp = this.getPlayer(session, teamPlayerId);
      if(!tp) return null;
      const coachName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Coach';
      // Privacy: parent-facing payloads never include other children's names/ratings.
      // Team-wide share cards stay coach-only (manual share), not inbox delivery.
      return {
        match_id: match.id,
        team_id: match.team_id,
        team_player_id: tp.id,
        player_name: [tp.first_name, tp.last_name].filter(Boolean).join(' '),
        academy_name: academy ? academy.name : '',
        team_name: team ? team.name : '',
        team_code: team ? team.invite_code : '',
        coach_name: coachName,
        date: match.date,
        opponent: match.opponent,
        address: match.address || '',
        venue: match.venue,
        kind: match.kind,
        meetup: match.meetup || '',
        kickoff: match.kickoff || '',
        fee_type: match.fee_type === 'paid' ? 'paid' : 'free',
        fee: match.fee_type === 'paid' ? (match.fee || '') : '',
        tournament: match.tournament || ''
      };
    },
    deliverMatchInvites(session, matchId, opts){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const forceUnread = !!(opts && opts.forceUnread);
      const resetRsvp = !!(opts && opts.resetRsvp);
      const notice = opts && Object.prototype.hasOwnProperty.call(opts, 'invite_notice')
        ? (['updated', 'recalled', 'cancelled'].includes(opts.invite_notice) ? opts.invite_notice : '')
        : (resetRsvp ? 'updated' : '');
      const onlyIds = opts && Array.isArray(opts.playerIds) ? new Set(opts.playerIds.map(String)) : null;
      const db = readDb();
      const now = new Date().toISOString();
      let delivered = 0;
      let waiting = 0;
      db.match_invites = db.match_invites.map(inv => {
        if(inv.match_id !== matchId) return inv;
        if(onlyIds && !onlyIds.has(String(inv.team_player_id))) return inv;
        const payload = this.buildMatchInvitePayload(session, matchId, inv.team_player_id);
        if(!payload) return inv;
        const linked = this.parentLinkedForPlayer(inv.team_player_id);
        // Only put invites in the parent inbox when a parent is linked on this device.
        // Always writing here made the coach see "incoming" messages on the same phone.
        if(linked && global.InboxStore && typeof global.InboxStore.upsertMatchInvite === 'function'){
          global.InboxStore.upsertMatchInvite({
            ...payload,
            forceUnread,
            resetRsvp,
            invite_notice: notice,
            clearNotice: !notice
          });
        }
        // Keep parent invite snapshot fresh so a new claim/QR also carries the match
        try{
          const pinv = db.parent_invites.find(i => i.team_player_id === inv.team_player_id && i.status !== 'revoked');
          if(pinv && pinv.payload){
            const mi = Array.isArray(pinv.payload.mi) ? pinv.payload.mi.filter(x => x && x.match_id !== matchId) : [];
            mi.unshift({
              match_id: payload.match_id,
              team_id: payload.team_id,
              team_player_id: payload.team_player_id,
              player_name: payload.player_name,
              academy_name: payload.academy_name,
              team_name: payload.team_name,
              team_code: payload.team_code,
              coach_name: payload.coach_name,
              date: payload.date,
              opponent: payload.opponent,
              address: payload.address || '',
              venue: payload.venue,
              kind: payload.kind,
              meetup: payload.meetup || '',
              kickoff: payload.kickoff || '',
              fee_type: payload.fee_type === 'paid' ? 'paid' : 'free',
              fee: payload.fee_type === 'paid' ? (payload.fee || '') : '',
              tournament: payload.tournament || ''
            });
            pinv.payload = {...pinv.payload, mi: mi.slice(0, 8)};
            pinv.updated_at = now;
          }
        }catch(e){}
        const clearedRsvp = resetRsvp ? '' : (inv.rsvp || '');
        const clearedRsvpAt = resetRsvp ? '' : (inv.rsvp_at || '');
        if(linked){
          delivered += 1;
          // Do not fire a local push while the coach is the active mode on this phone.
          const coachIsActive = typeof isCoachPlan === 'function' && isCoachPlan();
          if(!coachIsActive){
            try{
              if(global.CoachPush && typeof global.CoachPush.notifyInvite === 'function'){
                global.CoachPush.notifyInvite(payload);
              }
            }catch(e){}
          }
          return {
            ...inv,
            status: clearedRsvp === 'accepted' || clearedRsvp === 'declined' ? inv.status : 'delivered',
            sent_at: now,
            channel: 'app',
            rsvp: clearedRsvp,
            rsvp_at: clearedRsvpAt
          };
        }
        waiting += 1;
        return {
          ...inv,
          status: clearedRsvp === 'accepted' || clearedRsvp === 'declined' ? inv.status : 'waiting_parent',
          sent_at: now,
          channel: 'app',
          rsvp: clearedRsvp,
          rsvp_at: clearedRsvpAt
        };
      });
      writeDb(db);
      return {delivered, waiting, invites: this.listInvites(session, matchId)};
    },
    /** Tell parents a child is no longer called up for this match. */
    recallMatchPlayers(session, matchId, playerIds){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const ids = Array.isArray(playerIds) ? playerIds.map(String).filter(Boolean) : [];
      if(!ids.length) return {delivered: 0};
      let delivered = 0;
      ids.forEach(pid => {
        const payload = this.buildMatchInvitePayload(session, matchId, pid);
        if(!payload) return;
        if(!this.parentLinkedForPlayer(pid)) return;
        if(global.InboxStore && typeof global.InboxStore.upsertMatchInvite === 'function'){
          global.InboxStore.upsertMatchInvite({
            ...payload,
            forceUnread: true,
            resetRsvp: true,
            invite_notice: 'recalled'
          });
          delivered += 1;
        }
      });
      return {delivered};
    },
    applyInviteRsvp(matchId, teamPlayerId, response){
      const rsvp = response === 'accepted' ? 'accepted' : response === 'declined' ? 'declined' : '';
      if(!rsvp) throw new Error('rsvp');
      const mid = String(matchId || '');
      const pid = String(teamPlayerId || '');
      if(!mid || !pid) throw new Error('forbidden');
      const db = readDb();
      const now = new Date().toISOString();
      let found = false;
      db.match_invites = db.match_invites.map(inv => {
        if(inv.match_id !== mid || String(inv.team_player_id) !== pid) return inv;
        found = true;
        return {...inv, rsvp, rsvp_at: now, status: inv.status === 'pending' ? 'delivered' : inv.status};
      });
      if(!found){
        const match = db.team_matches.find(m => m.id === mid);
        if(match){
          db.match_invites.push({
            id: uid('inv'),
            match_id: mid,
            team_id: match.team_id,
            team_player_id: pid,
            status: 'delivered',
            rsvp,
            rsvp_at: now,
            sent_at: now,
            created_at: now
          });
          found = true;
        }
      }
      if(!found) throw new Error('forbidden');
      writeDb(db);
      return db.match_invites.find(i => i.match_id === mid && String(i.team_player_id) === pid) || null;
    },
    syncInviteReadStatuses(session, matchId){
      const match = this.getMatch(session, matchId);
      if(!match || !global.InboxStore) return this.listInvites(session, matchId);
      const db = readDb();
      let changed = false;
      db.match_invites = db.match_invites.map(inv => {
        if(inv.match_id !== matchId) return inv;
        const msg = global.InboxStore.findMatchInvite(matchId, inv.team_player_id);
        if(!msg) return inv;
        let next = inv;
        if(msg.status === 'read' && inv.status !== 'read' && inv.rsvp !== 'accepted' && inv.rsvp !== 'declined'){
          changed = true;
          next = {...next, status: 'read', read_at: msg.read_at || new Date().toISOString()};
        }
        if((msg.rsvp === 'accepted' || msg.rsvp === 'declined') && msg.rsvp !== inv.rsvp){
          changed = true;
          next = {...next, rsvp: msg.rsvp, rsvp_at: msg.rsvp_at || new Date().toISOString()};
        }
        return next;
      });
      if(changed) writeDb(db);
      return this.listInvites(session, matchId);
    },
    markInvitesSent(session, matchId, playerIds){
      // Back-compat: route through in-app delivery
      return this.deliverMatchInvites(session, matchId, {playerIds, forceUnread: true}).invites;
    },
    inviteMessage(session, matchId){
      const match = this.getMatch(session, matchId);
      if(!match) return '';
      const team = this.getTeam(session, match.team_id);
      const profile = this.getProfile(session);
      const coachName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Coach';
      return [
        `Matchcard Coach`,
        `${team ? team.name : 'Team'} vs ${match.opponent}`,
        match.date,
        match.address ? `Address: ${match.address}` : '',
        `Coach: ${coachName}`,
        `Please confirm you can play.`
      ].filter(Boolean).join('\n');
    },
    deliverPendingForPlayer(session, teamPlayerId){
      // When a parent links on this device, push existing upcoming invites into inbox
      const db = readDb();
      const invites = db.match_invites.filter(i => i.team_player_id === teamPlayerId);
      let n = 0;
      invites.forEach(inv => {
        const match = db.team_matches.find(m => m.id === inv.match_id);
        if(!match) return;
        const payload = this.buildMatchInvitePayload(session, inv.match_id, teamPlayerId);
        if(!payload || !global.InboxStore) return;
        global.InboxStore.upsertMatchInvite(payload);
        n += 1;
      });
      if(n){
        const now = new Date().toISOString();
        db.match_invites = db.match_invites.map(i => {
          if(i.team_player_id !== teamPlayerId) return i;
          if(i.status === 'read') return i;
          return {...i, status: 'delivered', sent_at: i.sent_at || now, channel: 'app'};
        });
        writeDb(db);
      }
      return n;
    },
    matchSquadIds(session, match){
      if(!match) return [];
      const roster = this.listPlayers(session, match.team_id);
      const rosterIds = new Set(roster.map(p => p.id));
      const raw = Array.isArray(match.squad) ? match.squad.map(String) : [];
      const filtered = raw.filter(id => rosterIds.has(id));
      // Legacy matches without squad: treat full roster as available
      if(!filtered.length && !raw.length) return roster.map(p => p.id);
      return filtered;
    },
    listMatchPlayers(session, match){
      if(!match) return [];
      const ids = new Set(this.matchSquadIds(session, match));
      return this.listPlayers(session, match.team_id).filter(p => ids.has(p.id));
    },
    listRatings(session, matchId){
      const match = this.getMatch(session, matchId);
      if(!match) return [];
      return readDb().ratings.filter(r => r.match_id === matchId);
    },
    getRatingForPlayer(session, matchId, teamPlayerId){
      return this.listRatings(session, matchId).find(r => r.team_player_id === teamPlayerId) || null;
    },
    upsertRating(session, payload){
      const match = this.getMatch(session, payload.match_id);
      if(!match) throw new Error('forbidden');
      const players = this.listPlayers(session, match.team_id);
      if(!players.some(p => p.id === payload.team_player_id)) throw new Error('forbidden');
      const db = readDb();
      const existing = db.ratings.find(r => r.match_id === payload.match_id && r.team_player_id === payload.team_player_id);
      const row = {
        id: existing ? existing.id : uid('rtg'),
        match_id: payload.match_id,
        team_id: match.team_id,
        team_player_id: payload.team_player_id,
        player_name: String(payload.player_name || '').slice(0, 80),
        date: match.date,
        opponent: match.opponent,
        score: match.score,
        pitchPos: String(payload.pitchPos || 'RW').slice(0, 8),
        position: String(payload.position || 'fwd').slice(0, 8),
        minutes: Math.min(120, Math.max(1, Number(payload.minutes) || 60)),
        format: String(payload.format || '2x30').slice(0, 16),
        matchLen: Math.min(120, Math.max(1, Number(payload.matchLen) || 60)),
        role: payload.role === 'sub' ? 'sub' : 'start',
        venue: match.venue,
        kind: match.kind,
        comment: String(payload.comment || '').slice(0, 400),
        counts: payload.counts && typeof payload.counts === 'object' ? payload.counts : {},
        behaviors: payload.behaviors && typeof payload.behaviors === 'object' ? payload.behaviors : {},
        timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
        kickoffAt: Number(payload.kickoffAt) || 0,
        kickoffClock: String(payload.kickoffClock || '').slice(0, 40),
        actionRating: Number(payload.actionRating) || 6,
        effortRating: Number(payload.effortRating) || 6,
        rating: Number(payload.rating) || 6,
        updated_at: new Date().toISOString()
      };
      if(existing){
        db.ratings = db.ratings.map(r => r.id === existing.id ? row : r);
      }else{
        db.ratings.push(row);
      }
      // keep match score / played status in sync if provided from form
      if(payload.score){
        db.team_matches = db.team_matches.map(m => m.id === match.id
          ? {...m, score: String(payload.score).slice(0, 16), status: 'played'}
          : m);
      }else if(match.status !== 'played'){
        db.team_matches = db.team_matches.map(m => m.id === match.id
          ? {...m, status: 'played'}
          : m);
      }
      writeDb(db);
      return row;
    },
    _playerStatsFromRatings(list){
      const sorted = (list || []).slice().sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || '')) ||
        String(a.updated_at || '').localeCompare(String(b.updated_at || ''))
      );
      const scores = sorted.map(r => Number(r.rating) || 0);
      const avg = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
      const last = scores.length ? scores[scores.length - 1] : null;
      const best = scores.length ? Math.max(...scores) : null;
      const worst = scores.length ? Math.min(...scores) : null;
      const form = scores.slice(-5);
      const recent = scores.slice(-3);
      const prev = scores.slice(-6, -3);
      let trend = null;
      if(recent.length >= 2 && prev.length >= 2){
        const a = recent.reduce((x, y) => x + y, 0) / recent.length;
        const b = prev.reduce((x, y) => x + y, 0) / prev.length;
        trend = Math.round((a - b) * 10) / 10;
      }else if(scores.length >= 2){
        trend = Math.round((scores[scores.length - 1] - scores[scores.length - 2]) * 10) / 10;
      }
      const moments = {};
      let minutes = 0;
      let comments = 0;
      sorted.forEach(r => {
        minutes += Math.max(0, Number(r.minutes) || 0);
        if(String(r.comment || '').trim()) comments += 1;
        const c = r.counts && typeof r.counts === 'object' ? r.counts : {};
        Object.keys(c).forEach(k => {
          const n = Number(c[k]) || 0;
          if(n) moments[k] = (moments[k] || 0) + n;
        });
      });
      const topMoments = Object.keys(moments)
        .map(k => ({key: k, n: moments[k]}))
        .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
        .slice(0, 4);
      return {
        games: scores.length,
        avg,
        last,
        best,
        worst,
        form,
        trend,
        minutes,
        comments,
        topMoments,
        moments
      };
    },
    teamAnalytics(session, teamId, opts){
      if(!this.getTeam(session, teamId)){
        return {
          matches: 0, played: 0, ratings: 0, avg: null, best: null, worst: null,
          high: 0, mid: 0, low: 0, players: [], topMoments: [],
          record: {win: 0, draw: 0, loss: 0}
        };
      }
      const db = readDb();
      let matches = db.team_matches.filter(m => m.team_id === teamId);
      if(opts && Array.isArray(opts.matchIds)){
        const want = new Set(opts.matchIds.map(String));
        matches = matches.filter(m => want.has(String(m.id)));
      }
      const playedList = matches.filter(m => m.status === 'played' || !!String(m.score || '').trim());
      const matchIds = new Set(playedList.map(m => m.id));
      const ratings = db.ratings.filter(r => matchIds.has(r.match_id));
      const byPlayer = {};
      ratings.forEach(r => {
        if(!byPlayer[r.team_player_id]) byPlayer[r.team_player_id] = [];
        byPlayer[r.team_player_id].push(r);
      });
      const teamMoments = {};
      ratings.forEach(r => {
        const c = r.counts && typeof r.counts === 'object' ? r.counts : {};
        Object.keys(c).forEach(k => {
          const n = Number(c[k]) || 0;
          if(n) teamMoments[k] = (teamMoments[k] || 0) + n;
        });
      });
      const players = this.listPlayers(session, teamId).map(p => {
        const list = byPlayer[p.id] || [];
        const st = this._playerStatsFromRatings(list);
        return {
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' '),
          number: p.number,
          position: p.position || '',
          ...st
        };
      }).sort((a, b) => (b.avg || 0) - (a.avg || 0) || a.name.localeCompare(b.name));
      const all = ratings.map(r => Number(r.rating) || 0);
      const avg = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null;
      const best = all.length ? Math.max(...all) : null;
      const worst = all.length ? Math.min(...all) : null;
      let high = 0, mid = 0, low = 0;
      all.forEach(n => {
        if(n >= 7.5) high += 1;
        else if(n >= 6) mid += 1;
        else low += 1;
      });
      const topMoments = Object.keys(teamMoments)
        .map(k => ({key: k, n: teamMoments[k]}))
        .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
        .slice(0, 6);
      let win = 0, draw = 0, loss = 0;
      playedList.forEach(m => {
        const s = String(m.score || '').trim().match(/^(\d+)\s*[:\-]\s*(\d+)$/);
        if(!s) return;
        const us = Number(s[1]);
        const them = Number(s[2]);
        if(!Number.isFinite(us) || !Number.isFinite(them)) return;
        if(us > them) win += 1;
        else if(us < them) loss += 1;
        else draw += 1;
      });
      return {
        matches: matchIds.size,
        played: playedList.length,
        ratings: ratings.length,
        avg,
        best,
        worst,
        high,
        mid,
        low,
        topMoments,
        players,
        record: {win, draw, loss}
      };
    },
    getPlayer(session, playerId){
      const db = readDb();
      const player = db.team_players.find(p => p.id === playerId);
      if(!player || !this.getTeam(session, player.team_id)) return null;
      return player;
    },
    listRatingsForPlayer(session, playerId){
      const player = this.getPlayer(session, playerId);
      if(!player) return [];
      return readDb().ratings
        .filter(r => r.team_player_id === playerId)
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updated_at).localeCompare(String(a.updated_at)));
    },
    playerDetail(session, playerId){
      const player = this.getPlayer(session, playerId);
      if(!player) return null;
      const team = this.getTeam(session, player.team_id);
      const academy = this.myAcademy(session);
      const profile = this.getProfile(session);
      const ratings = this.listRatingsForPlayer(session, playerId);
      const st = this._playerStatsFromRatings(ratings);
      return {
        player,
        team,
        academy,
        coach: {
          name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Coach',
          email: profile.email || ''
        },
        ratings,
        avg: st.avg,
        games: st.games,
        last: st.last,
        best: st.best,
        worst: st.worst,
        form: st.form,
        trend: st.trend,
        minutes: st.minutes,
        comments: st.comments,
        topMoments: st.topMoments
      };
    },
    buildParentInvitePayload(session, playerId, opts){
      const detail = this.playerDetail(session, playerId);
      if(!detail) throw new Error('forbidden');
      const maxR = (opts && opts.maxRatings) || 12;
      const ratings = detail.ratings.slice(0, maxR).map(r => ({
        d: r.date,
        o: r.opponent,
        s: r.score || '',
        r: Number(r.rating) || 0,
        p: r.pitchPos || '',
        m: Number(r.minutes) || 0,
        role: r.role || ''
        // No personal coach comments in parent invite payload.
      }));
      const db = readDb();
      const mi = db.match_invites
        .filter(i => i.team_player_id === playerId)
        .map(i => this.buildMatchInvitePayload(session, i.match_id, playerId))
        .filter(Boolean)
        .slice(0, 6);
      const mr = this.packMatchResultsForPlayer
        ? this.packMatchResultsForPlayer(session, playerId)
        : [];
      return {
        v: 1,
        t: opts && opts.token ? opts.token : uid('ptk').slice(0, 24),
        code: opts && opts.code ? opts.code : inviteCode(),
        a: {id: detail.academy ? detail.academy.id : '', name: detail.academy ? detail.academy.name : ''},
        tm: {
          id: detail.team ? detail.team.id : '',
          name: detail.team ? detail.team.name : '',
          age_group: detail.team ? detail.team.age_group : '',
          invite_code: detail.team ? detail.team.invite_code : ''
        },
        c: {name: detail.coach.name, email: detail.coach.email},
        player: {
          id: detail.player.id,
          fn: detail.player.first_name,
          ln: detail.player.last_name,
          n: detail.player.number,
          pos: detail.player.position
        },
        r: ratings,
        mi,
        mr,
        avg: detail.avg,
        g: detail.games,
        last: detail.last,
        best: detail.best,
        worst: detail.worst,
        form: detail.form,
        trend: detail.trend,
        minutes: detail.minutes,
        topMoments: detail.topMoments,
        iat: new Date().toISOString()
      };
    },
    // Keep packed match results on parent invite for cross-device claim
    // (same-device path uses InboxStore + ParentStore.syncCoachRatings).
    packMatchResultsForPlayer(session, playerId){
      const db = readDb();
      return db.ratings
        .filter(r => r.team_player_id === playerId)
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updated_at||'').localeCompare(String(a.updated_at||'')))
        .slice(0, 8)
        .map(r => this.buildMatchResultPayload(session, r.match_id, playerId))
        .filter(Boolean);
    },
    createParentInvite(session, playerId){
      const player = this.getPlayer(session, playerId);
      if(!player) throw new Error('forbidden');
      const db = readDb();
      let invite = db.parent_invites.find(i => i.team_player_id === playerId && i.status !== 'revoked');
      const token = invite ? invite.token : uid('ptk').slice(0, 24);
      const code = invite ? invite.code : inviteCode();
      const payload = this.buildParentInvitePayload(session, playerId, {token, code, maxRatings: 12});
      const row = {
        id: invite ? invite.id : uid('pinv'),
        token,
        code,
        team_id: player.team_id,
        team_player_id: playerId,
        payload,
        status: 'open',
        created_at: invite ? invite.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if(invite){
        db.parent_invites = db.parent_invites.map(i => i.id === invite.id ? row : i);
      }else{
        db.parent_invites.push(row);
      }
      writeDb(db);
      return row;
    },
    findParentInviteByCode(code){
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if(!code) return null;
      return readDb().parent_invites.find(i => i.code === code && i.status !== 'revoked') || null;
    },
    findParentInviteByToken(token){
      token = String(token || '');
      if(!token) return null;
      return readDb().parent_invites.find(i => i.token === token && i.status !== 'revoked') || null;
    },
    parentInviteMessage(session, invite){
      if(!invite || !invite.payload) return '';
      const p = invite.payload;
      const child = [p.player.fn, p.player.ln].filter(Boolean).join(' ');
      const num = p.player.n ? `#${p.player.n} ` : '';
      const deep = global.ParentStore ? global.ParentStore.buildLink(p) : `ffk://parent?d=`;
      const web = global.ParentStore ? global.ParentStore.buildWebLink(p) : '';
      return [
        'Matchcard — parent invite',
        `Child: ${num}${child}`,
        `Team: ${p.tm && p.tm.name ? p.tm.name : ''}${p.tm && p.tm.age_group ? ` · ${p.tm.age_group}` : ''}`,
        `Coach: ${p.c && p.c.name ? p.c.name : ''}`,
        `Code: MC-${invite.code}`,
        '',
        'Open Matchcard → Player → Add via link, or open:',
        deep,
        web && web !== deep ? web : ''
      ].filter(Boolean).join('\n');
    },
    isCloudConfigured(){
      const c = global.FFK_COACH_CONFIG || {};
      return !!(c.supabaseUrl && c.supabaseAnonKey);
    },
    listAssistants(session){
      const academy = this.myAcademy(session);
      if(!academy) return [];
      return readDb().memberships.filter(m =>
        m.academy_id === academy.id &&
        m.role === 'assistant' &&
        (m.status || 'active') !== 'revoked'
      );
    },
    inviteAssistant(session, email, name){
      email = String(email || '').trim().toLowerCase();
      name = String(name || '').trim().slice(0, 60);
      if(!session) throw new Error('auth');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('bad_email');
      if(!this.isAcademyOwner(session)) throw new Error('owner_only');
      const academy = this.myAcademy(session);
      if(!academy) throw new Error('forbidden');
      const db = readDb();
      const existing = db.memberships.filter(m =>
        m.academy_id === academy.id &&
        m.role === 'assistant' &&
        (m.status || 'active') !== 'revoked'
      );
      const maxA = typeof COACH_MAX_ASSISTANTS === 'number' ? COACH_MAX_ASSISTANTS : 5;
      if(existing.length >= maxA) throw new Error('assistant_limit');
      if(existing.some(m => String(m.email || '').toLowerCase() === email)) throw new Error('exists');
      let code = inviteCode();
      while(db.memberships.some(m => m.invite_code === code)) code = inviteCode();
      const row = {
        id: uid('mem'),
        user_id: uid('ast'), // placeholder until claim
        academy_id: academy.id,
        team_id: null,
        team_player_id: null,
        role: 'assistant',
        email,
        name,
        invite_code: code,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      db.memberships.push(row);
      writeDb(db);
      return row;
    },
    removeAssistant(session, membershipId){
      if(!this.isAcademyOwner(session)) throw new Error('owner_only');
      const academy = this.myAcademy(session);
      if(!academy) throw new Error('forbidden');
      const db = readDb();
      db.memberships = db.memberships.map(m => {
        if(m.id !== membershipId || m.academy_id !== academy.id || m.role !== 'assistant') return m;
        return {...m, status: 'revoked'};
      });
      writeDb(db);
      return true;
    },
    claimAssistantInvite(session, code){
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if(!session || !code) throw new Error('bad_code');
      const db = readDb();
      const hit = db.memberships.find(m =>
        m.role === 'assistant' &&
        m.invite_code === code &&
        (m.status || 'pending') === 'pending'
      );
      if(!hit) throw new Error('bad_code');
      // Enforce email match when possible
      if(hit.email && session.email && hit.email.toLowerCase() !== String(session.email).toLowerCase()){
        throw new Error('email_mismatch');
      }
      const maxA = typeof COACH_MAX_ASSISTANTS === 'number' ? COACH_MAX_ASSISTANTS : 5;
      const active = db.memberships.filter(m =>
        m.academy_id === hit.academy_id &&
        m.role === 'assistant' &&
        m.status === 'active'
      );
      if(active.length >= maxA) throw new Error('assistant_limit');
      db.memberships = db.memberships.map(m => m.id === hit.id
        ? {...m, user_id: session.userId, status: 'active', claimed_at: new Date().toISOString()}
        : m
      );
      writeDb(db);
      return this.myAcademy(session);
    },
    saveDeviceToken(token, platform){
      token = String(token || '').trim();
      if(!token) return null;
      const session = this.getSession();
      const db = readDb();
      const row = {
        id: uid('tok'),
        user_id: session ? session.userId : '',
        token: token.slice(0, 512),
        platform: String(platform || 'unknown').slice(0, 24),
        updated_at: new Date().toISOString()
      };
      db.device_tokens = (db.device_tokens || []).filter(t => t.token !== row.token);
      db.device_tokens.unshift(row);
      db.device_tokens = db.device_tokens.slice(0, 8);
      writeDb(db);
      return row;
    },
    setCoachSub(session, on){
      const acc = this.getAccount(session);
      if(!acc) return null;
      const db = readDb();
      const email = acc.email;
      if(!db.accounts[email]) return null;
      db.accounts[email] = {...db.accounts[email], coach_sub: !!on};
      writeDb(db);
      return db.accounts[email];
    },
    hasCoachSub(session){
      const acc = this.getAccount(session);
      if(acc && acc.coach_sub) return true;
      try{
        if(global.settings && global.settings.coachSub === true) return true;
      }catch(e){}
      return false;
    }
  };

  global.CoachStore = CoachStore;
})(window);
