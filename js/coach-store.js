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
        photo: acc && acc.photo ? String(acc.photo) : '',
        cover: acc && acc.cover ? String(acc.cover) : ''
      };
    },
    updateProfileMedia(session, patch){
      if(!session) throw new Error('auth');
      const db = readDb();
      const email = Object.keys(db.accounts || {}).find(k => db.accounts[k] && db.accounts[k].id === session.userId);
      if(!email) throw new Error('auth');
      const acc = db.accounts[email];
      if(Object.prototype.hasOwnProperty.call(patch, 'photo')){
        acc.photo = patch.photo ? String(patch.photo) : '';
      }
      if(Object.prototype.hasOwnProperty.call(patch, 'cover')){
        acc.cover = patch.cover ? String(patch.cover) : '';
      }
      writeDb(db);
      return this.getProfile(session);
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
        created_at: new Date().toISOString()
      };
      db.team_players.push(player);
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
        score: String(fields.score || '').trim().slice(0, 16),
        venue: fields.venue === 'away' ? 'away' : 'home',
        kind: ['league','friendly','cup','tournament'].includes(fields.kind) ? fields.kind : 'league',
        squad,
        created_at: new Date().toISOString()
      };
      db.team_matches.push(match);
      db.activeMatchId = match.id;
      writeDb(db);
      return match;
    },
    setMatchSquad(session, matchId, squadIds){
      const match = this.getMatch(session, matchId);
      if(!match) throw new Error('forbidden');
      const rosterIds = new Set(this.listPlayers(session, match.team_id).map(p => p.id));
      const squad = [...new Set((Array.isArray(squadIds) ? squadIds : []).map(String).filter(id => rosterIds.has(id)))];
      if(!squad.length) throw new Error('squad');
      const db = readDb();
      db.team_matches = db.team_matches.map(m => m.id === matchId ? {...m, squad} : m);
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
      // keep match score in sync if provided from form
      if(payload.score){
        db.team_matches = db.team_matches.map(m => m.id === match.id ? {...m, score: String(payload.score).slice(0, 16)} : m);
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
    isCloudConfigured(){
      const c = global.FFK_COACH_CONFIG || {};
      return !!(c.supabaseUrl && c.supabaseAnonKey);
    }
  };

  global.CoachStore = CoachStore;
})(window);
