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
      version: 2,
      accounts: {},
      academies: [],
      teams: [],
      team_players: [],
      memberships: [],
      team_matches: [],
      ratings: [],
      match_invites: [],
      parent_invites: [],
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
        version: 2,
        accounts: db.accounts && typeof db.accounts === 'object' ? db.accounts : {},
        academies: Array.isArray(db.academies) ? db.academies : [],
        teams: Array.isArray(db.teams) ? db.teams : [],
        team_players: Array.isArray(db.team_players) ? db.team_players : [],
        memberships: Array.isArray(db.memberships) ? db.memberships : [],
        team_matches: Array.isArray(db.team_matches) ? db.team_matches : [],
        ratings: Array.isArray(db.ratings) ? db.ratings : [],
        match_invites: Array.isArray(db.match_invites) ? db.match_invites : [],
        parent_invites: Array.isArray(db.parent_invites) ? db.parent_invites : [],
        activeTeamId: String(db.activeTeamId || ''),
        activeMatchId: String(db.activeMatchId || '')
      };
    }catch(e){
      return emptyDb();
    }
  }
  function writeDb(db){
    localStorage.setItem(KEY, JSON.stringify(db));
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

  const CoachStore = {
    getSession(){ return readSession(); },
    signOut(){ writeSession(null); },
    async signUp(email, password){
      email = String(email || '').trim().toLowerCase();
      password = String(password || '');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('bad_email');
      if(password.length < 6) throw new Error('bad_password');
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
        createdAt: new Date().toISOString()
      };
      writeDb(db);
      const session = {userId: id, email};
      writeSession(session);
      return session;
    },
    async signIn(email, password){
      email = String(email || '').trim().toLowerCase();
      const db = readDb();
      const acc = db.accounts[email];
      if(!acc) throw new Error('auth');
      const hash = await hashPass(password);
      if(hash !== acc.passHash) throw new Error('auth');
      const session = {userId: acc.id, email: acc.email};
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
      const mem = db.memberships.find(m => m.user_id === uid && m.role === 'owner' && m.academy_id);
      if(!mem) return null;
      return db.academies.find(a => a.id === mem.academy_id) || null;
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
        created_at: new Date().toISOString()
      });
      writeDb(db);
      return academy;
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
      writeDb(db);
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
      const db = readDb();
      const match = {
        id: uid('tmt'),
        team_id: teamId,
        date,
        opponent,
        address: String(fields.address || '').trim().slice(0, 120),
        score: String(fields.score || '').trim().slice(0, 16),
        venue: fields.venue === 'away' ? 'away' : 'home',
        kind: ['league','friendly','cup','tournament'].includes(fields.kind) ? fields.kind : 'league',
        status: fields.status === 'played' ? 'played' : 'upcoming',
        squad,
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
      if(fields && fields.status === 'played') next.status = 'played';
      if(fields && fields.status === 'upcoming') next.status = 'upcoming';
      if(next.score && next.status !== 'upcoming') next.status = 'played';
      db.team_matches = db.team_matches.map(m => m.id === matchId ? next : m);
      writeDb(db);
      return this.getMatch(session, matchId);
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
      return {
        ...base,
        type: 'match_result',
        score: match ? (match.score || '') : '',
        rating: Number(rating.rating) || 0,
        comment: String(rating.comment || '').slice(0, 400),
        pitchPos: String(rating.pitchPos || '').slice(0, 8)
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
        if(global.InboxStore && typeof global.InboxStore.upsertMatchResult === 'function'){
          global.InboxStore.upsertMatchResult({...payload, forceUnread});
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
      const players = this.listMatchPlayers(session, match);
      const tp = this.getPlayer(session, teamPlayerId);
      if(!tp) return null;
      const coachName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Coach';
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
        squad_names: players.map(p => {
          const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
          return p.number ? `#${p.number} ${n}` : n;
        })
      };
    },
    deliverMatchInvites(session, matchId, opts){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const forceUnread = !!(opts && opts.forceUnread);
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
        if(global.InboxStore && typeof global.InboxStore.upsertMatchInvite === 'function'){
          global.InboxStore.upsertMatchInvite({...payload, forceUnread});
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
              squad_names: payload.squad_names
            });
            pinv.payload = {...pinv.payload, mi: mi.slice(0, 8)};
            pinv.updated_at = now;
          }
        }catch(e){}
        if(linked){
          delivered += 1;
          return {...inv, status: 'delivered', sent_at: now, channel: 'app'};
        }
        waiting += 1;
        return {...inv, status: 'waiting_parent', sent_at: now, channel: 'app'};
      });
      writeDb(db);
      return {delivered, waiting, invites: this.listInvites(session, matchId)};
    },
    syncInviteReadStatuses(session, matchId){
      const match = this.getMatch(session, matchId);
      if(!match || !global.InboxStore) return this.listInvites(session, matchId);
      const db = readDb();
      let changed = false;
      db.match_invites = db.match_invites.map(inv => {
        if(inv.match_id !== matchId) return inv;
        const msg = global.InboxStore.findMatchInvite(matchId, inv.team_player_id);
        if(msg && msg.status === 'read' && inv.status !== 'read'){
          changed = true;
          return {...inv, status: 'read', read_at: msg.read_at || new Date().toISOString()};
        }
        return inv;
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
      const players = this.listMatchPlayers(session, match);
      const names = players.map(p => {
        const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
        return p.number ? `#${p.number} ${n}` : n;
      }).join(', ');
      const code = team ? team.invite_code : '';
      return [
        `Matchcard Coach`,
        `${team ? team.name : 'Team'} vs ${match.opponent}`,
        match.date,
        match.address ? `Address: ${match.address}` : '',
        names ? `Squad: ${names}` : '',
        code ? `Team code: ${code}` : '',
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
    setMatchSquad(session, matchId, squadIds){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const rosterIds = new Set(this.listPlayers(session, match.team_id).map(p => p.id));
      const squad = [...new Set((Array.isArray(squadIds) ? squadIds : []).map(String).filter(id => rosterIds.has(id)))];
      if(!squad.length) throw new Error('squad');
      const db = readDb();
      db.team_matches = db.team_matches.map(m => m.id === matchId ? {...m, squad} : m);
      // Sync invites with squad
      const existing = db.match_invites.filter(i => i.match_id === matchId);
      const have = new Set(existing.map(i => i.team_player_id));
      squad.forEach(pid => {
        if(have.has(pid)) return;
        db.match_invites.push({
          id: uid('inv'),
          match_id: matchId,
          team_id: match.team_id,
          team_player_id: pid,
          status: 'pending',
          sent_at: '',
          created_at: new Date().toISOString()
        });
      });
      db.match_invites = db.match_invites.filter(i => i.match_id !== matchId || squad.includes(i.team_player_id));
      writeDb(db);
      return this.getMatch(session, matchId);
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
    teamAnalytics(session, teamId){
      if(!this.getTeam(session, teamId)) return {matches: 0, ratings: 0, avg: null, players: []};
      const db = readDb();
      const matchIds = new Set(db.team_matches.filter(m => m.team_id === teamId).map(m => m.id));
      const ratings = db.ratings.filter(r => matchIds.has(r.match_id));
      const byPlayer = {};
      ratings.forEach(r => {
        if(!byPlayer[r.team_player_id]) byPlayer[r.team_player_id] = [];
        byPlayer[r.team_player_id].push(Number(r.rating) || 0);
      });
      const players = this.listPlayers(session, teamId).map(p => {
        const list = byPlayer[p.id] || [];
        const avg = list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null;
        return {
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' '),
          number: p.number,
          games: list.length,
          avg
        };
      }).sort((a, b) => (b.avg || 0) - (a.avg || 0) || a.name.localeCompare(b.name));
      const all = ratings.map(r => Number(r.rating) || 0);
      const avg = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null;
      return {
        matches: matchIds.size,
        ratings: ratings.length,
        avg,
        players
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
      const scores = ratings.map(r => Number(r.rating) || 0);
      const avg = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
      return {
        player,
        team,
        academy,
        coach: {
          name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || 'Coach',
          email: profile.email || ''
        },
        ratings,
        avg,
        games: ratings.length
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
        c: String(r.comment || '').slice(0, 120),
        p: r.pitchPos || ''
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
        `Academy: ${p.a && p.a.name ? p.a.name : ''}`,
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
    }
  };

  global.CoachStore = CoachStore;
})(window);
