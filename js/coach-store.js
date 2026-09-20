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
      version: 1,
      accounts: {},
      academies: [],
      teams: [],
      team_players: [],
      memberships: [],
      activeTeamId: ''
    };
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      return {
        version: 1,
        accounts: db.accounts && typeof db.accounts === 'object' ? db.accounts : {},
        academies: Array.isArray(db.academies) ? db.academies : [],
        teams: Array.isArray(db.teams) ? db.teams : [],
        team_players: Array.isArray(db.team_players) ? db.team_players : [],
        memberships: Array.isArray(db.memberships) ? db.memberships : [],
        activeTeamId: String(db.activeTeamId || '')
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
      writeDb(db);
    },
    isCloudConfigured(){
      const c = global.FFK_COACH_CONFIG || {};
      return !!(c.supabaseUrl && c.supabaseAnonKey);
    }
  };

  global.CoachStore = CoachStore;
})(window);
