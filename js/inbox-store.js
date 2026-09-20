/* In-app inbox for parents/guardians (match invites etc.).
   Shared on-device bus — not WhatsApp/SMS. Cloud sync later via Supabase. */
(function(global){
  const KEY = 'ffk_inbox_v1';

  function uid(prefix){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function emptyDb(){
    return {version: 1, messages: []};
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      return {
        version: 1,
        messages: Array.isArray(db.messages) ? db.messages : []
      };
    }catch(e){
      return emptyDb();
    }
  }
  function writeDb(db){
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  const InboxStore = {
    listAll(){
      return readDb().messages.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },
    listForPlayers(playerIds){
      const want = new Set((playerIds || []).map(String).filter(Boolean));
      if(!want.size) return [];
      return this.listAll().filter(m =>
        m.type !== 'coach_leave_request' && want.has(String(m.team_player_id || ''))
      );
    },
    listForCoach(){
      return this.listAll().filter(m => m.type === 'coach_leave_request');
    },
    get(id){
      return readDb().messages.find(m => m.id === id) || null;
    },
    findMatchInvite(matchId, teamPlayerId){
      return readDb().messages.find(m =>
        m.type === 'match_invite' &&
        m.match_id === matchId &&
        m.team_player_id === teamPlayerId
      ) || null;
    },
    findMatchResult(matchId, teamPlayerId){
      return readDb().messages.find(m =>
        m.type === 'match_result' &&
        m.match_id === matchId &&
        m.team_player_id === teamPlayerId
      ) || null;
    },
    upsertMatchInvite(payload){
      const db = readDb();
      const matchId = String(payload.match_id || '');
      const playerId = String(payload.team_player_id || '');
      if(!matchId || !playerId) throw new Error('bad_message');
      const existing = db.messages.find(m =>
        m.type === 'match_invite' && m.match_id === matchId && m.team_player_id === playerId
      );
      const now = new Date().toISOString();
      const notice = ['updated', 'recalled', 'cancelled'].includes(payload.invite_notice)
        ? payload.invite_notice
        : '';
      const resetRsvp = !!(payload.resetRsvp || notice === 'updated' || notice === 'recalled' || notice === 'cancelled');
      const keepRsvp = !resetRsvp
        && existing
        && (existing.rsvp === 'accepted' || existing.rsvp === 'declined');
      const row = {
        id: existing ? existing.id : uid('msg'),
        type: 'match_invite',
        match_id: matchId,
        team_id: String(payload.team_id || ''),
        team_player_id: playerId,
        player_name: String(payload.player_name || '').slice(0, 80),
        academy_name: String(payload.academy_name || '').slice(0, 80),
        team_name: String(payload.team_name || '').slice(0, 60),
        team_code: String(payload.team_code || '').slice(0, 12),
        coach_name: String(payload.coach_name || '').slice(0, 80),
        date: String(payload.date || '').slice(0, 10),
        opponent: String(payload.opponent || '').slice(0, 48),
        address: String(payload.address || '').slice(0, 120),
        venue: payload.venue === 'away' ? 'away' : 'home',
        kind: String(payload.kind || 'league').slice(0, 16),
        meetup: String(payload.meetup || '').slice(0, 8),
        kickoff: String(payload.kickoff || '').slice(0, 8),
        fee_type: payload.fee_type === 'paid' ? 'paid' : 'free',
        fee: payload.fee_type === 'paid' ? String(payload.fee || '').slice(0, 32) : '',
        tournament: String(payload.tournament || '').slice(0, 48),
        // Never persist other children's names on parent messages.
        squad_names: [],
        invite_notice: notice || (existing && existing.invite_notice === 'recalled' && !payload.clearNotice
          ? 'recalled'
          : ''),
        status: existing && existing.status === 'read' && !payload.forceUnread
          ? 'read'
          : 'delivered',
        rsvp: keepRsvp ? existing.rsvp : '',
        rsvp_at: keepRsvp ? (existing.rsvp_at || '') : '',
        created_at: existing ? existing.created_at : now,
        updated_at: now,
        read_at: existing && existing.status === 'read' && !payload.forceUnread
          ? (existing.read_at || '')
          : '',
        sent_count: (existing ? (Number(existing.sent_count) || 1) : 0) + 1
      };
      if(existing){
        db.messages = db.messages.map(m => m.id === existing.id ? row : m);
      }else{
        db.messages.push(row);
      }
      writeDb(db);
      return row;
    },
    /** Turn open invites for a match into calm cancelled notices (keep history, no silent delete). */
    markMatchCancelled(matchId, extra){
      const id = String(matchId || '');
      if(!id) return 0;
      const db = readDb();
      const now = new Date().toISOString();
      let n = 0;
      db.messages = db.messages.map(m => {
        if(m.type !== 'match_invite' || String(m.match_id || '') !== id) return m;
        if(m.invite_notice === 'cancelled') return m;
        n += 1;
        return {
          ...m,
          ...(extra && typeof extra === 'object' ? {
            date: extra.date != null ? String(extra.date).slice(0, 10) : m.date,
            opponent: extra.opponent != null ? String(extra.opponent).slice(0, 48) : m.opponent,
            address: extra.address != null ? String(extra.address).slice(0, 120) : m.address,
            meetup: extra.meetup != null ? String(extra.meetup).slice(0, 8) : m.meetup,
            kickoff: extra.kickoff != null ? String(extra.kickoff).slice(0, 8) : m.kickoff
          } : {}),
          invite_notice: 'cancelled',
          rsvp: '',
          rsvp_at: '',
          status: 'delivered',
          read_at: '',
          updated_at: now
        };
      });
      writeDb(db);
      return n;
    },
    upsertMatchResult(payload){
      const db = readDb();
      const matchId = String(payload.match_id || '');
      const playerId = String(payload.team_player_id || '');
      if(!matchId || !playerId) throw new Error('bad_message');
      const existing = db.messages.find(m =>
        m.type === 'match_result' && m.match_id === matchId && m.team_player_id === playerId
      );
      const now = new Date().toISOString();
      const row = {
        id: existing ? existing.id : uid('msg'),
        type: 'match_result',
        match_id: matchId,
        team_id: String(payload.team_id || ''),
        team_player_id: playerId,
        player_name: String(payload.player_name || '').slice(0, 80),
        academy_name: String(payload.academy_name || '').slice(0, 80),
        team_name: String(payload.team_name || '').slice(0, 60),
        team_code: String(payload.team_code || '').slice(0, 12),
        coach_name: String(payload.coach_name || '').slice(0, 80),
        date: String(payload.date || '').slice(0, 10),
        opponent: String(payload.opponent || '').slice(0, 48),
        address: String(payload.address || '').slice(0, 120),
        venue: payload.venue === 'away' ? 'away' : 'home',
        kind: String(payload.kind || 'league').slice(0, 16),
        meetup: String(payload.meetup || '').slice(0, 8),
        kickoff: String(payload.kickoff || '').slice(0, 8),
        tournament: String(payload.tournament || '').slice(0, 48),
        score: String(payload.score || '').slice(0, 16),
        rating: Number(payload.rating) || 0,
        comment: String(payload.comment || '').slice(0, 400),
        match_comment: String(payload.match_comment || '').slice(0, 400),
        pitchPos: String(payload.pitchPos || '').slice(0, 8),
        minutes: Math.min(120, Math.max(0, Number(payload.minutes) || 0)),
        role: payload.role === 'sub' ? 'sub' : 'start',
        format: String(payload.format || '').slice(0, 16),
        match_len: Math.min(120, Math.max(0, Number(payload.match_len) || 0)),
        status: existing && existing.status === 'read' && !payload.forceUnread
          ? 'read'
          : 'delivered',
        created_at: existing ? existing.created_at : now,
        updated_at: now,
        read_at: existing && existing.status === 'read' && !payload.forceUnread
          ? (existing.read_at || '')
          : '',
        sent_count: (existing ? (Number(existing.sent_count) || 1) : 0) + 1
      };
      if(existing){
        db.messages = db.messages.map(m => m.id === existing.id ? row : m);
      }else{
        db.messages.push(row);
      }
      writeDb(db);
      return row;
    },
    upsertCoachLeaveRequest(payload){
      const db = readDb();
      const requestId = String(payload.id || payload.request_id || '');
      if(!requestId) throw new Error('bad_message');
      const existing = db.messages.find(m =>
        m.type === 'coach_leave_request' && String(m.request_id || '') === requestId
      );
      const now = new Date().toISOString();
      const row = {
        id: existing ? existing.id : uid('msg'),
        type: 'coach_leave_request',
        request_id: requestId,
        team_id: String(payload.team_id || ''),
        team_player_id: String(payload.team_player_id || ''),
        parent_link_id: String(payload.parent_link_id || ''),
        player_name: String(payload.player_name || '').slice(0, 80),
        team_name: String(payload.team_name || '').slice(0, 60),
        academy_name: String(payload.academy_name || '').slice(0, 80),
        new_club: String(payload.new_club || '').slice(0, 60),
        new_team: String(payload.new_team || '').slice(0, 60),
        decision: String(payload.status || '') === 'accepted'
          ? 'accepted'
          : (String(payload.status || '') === 'declined' ? 'declined' : ''),
        status: existing && existing.status === 'read' ? 'read' : 'delivered',
        created_at: existing ? existing.created_at : (payload.created_at || now),
        updated_at: now,
        read_at: existing && existing.status === 'read' ? (existing.read_at || '') : ''
      };
      if(existing) db.messages = db.messages.map(m => m.id === existing.id ? row : m);
      else db.messages.push(row);
      writeDb(db);
      return row;
    },
    resolveCoachLeaveRequest(requestId, decision){
      const rid = String(requestId || '');
      const result = decision === 'accepted' ? 'accepted' : decision === 'declined' ? 'declined' : '';
      if(!rid || !result) return null;
      const db = readDb();
      const now = new Date().toISOString();
      db.messages = db.messages.map(m => {
        if(m.type !== 'coach_leave_request' || String(m.request_id || '') !== rid) return m;
        return {...m, decision: result, status: 'read', read_at: m.read_at || now, updated_at: now};
      });
      writeDb(db);
      return db.messages.find(m =>
        m.type === 'coach_leave_request' && String(m.request_id || '') === rid
      ) || null;
    },
    importMessages(list){
      const out = [];
      (list || []).forEach(raw => {
        if(!raw || !raw.match_id || !raw.team_player_id) return;
        if(raw.type === 'match_result'){
          out.push(this.upsertMatchResult({...raw, forceUnread: false}));
        }else{
          out.push(this.upsertMatchInvite({...raw, forceUnread: false}));
        }
      });
      return out;
    },
    markRead(id){
      const db = readDb();
      const now = new Date().toISOString();
      db.messages = db.messages.map(m => {
        if(m.id !== id) return m;
        return {...m, status: 'read', read_at: m.read_at || now, updated_at: now};
      });
      writeDb(db);
      return this.get(id);
    },
    setMatchInviteRsvp(messageId, response){
      const rsvp = response === 'accepted' ? 'accepted' : response === 'declined' ? 'declined' : '';
      if(!rsvp) throw new Error('rsvp');
      const db = readDb();
      const msg = db.messages.find(m => m.id === messageId);
      if(!msg || msg.type !== 'match_invite') throw new Error('forbidden');
      const now = new Date().toISOString();
      const row = {
        ...msg,
        rsvp,
        rsvp_at: now,
        invite_notice: msg.invite_notice === 'updated' ? '' : (msg.invite_notice || ''),
        status: 'read',
        read_at: msg.read_at || now,
        updated_at: now
      };
      db.messages = db.messages.map(m => m.id === messageId ? row : m);
      writeDb(db);
      try{
        if(global.CoachStore && typeof global.CoachStore.applyInviteRsvp === 'function'){
          global.CoachStore.applyInviteRsvp(row.match_id, row.team_player_id, rsvp);
        }
      }catch(e){}
      return this.get(messageId);
    },
    removeForMatch(matchId){
      const id = String(matchId || '');
      if(!id) return 0;
      const db = readDb();
      const before = db.messages.length;
      db.messages = db.messages.filter(m => String(m.match_id || '') !== id);
      writeDb(db);
      return before - db.messages.length;
    },
    unreadCountForPlayers(playerIds){
      return this.listForPlayers(playerIds).filter(m => m.status !== 'read').length;
    },
    unreadCountForCoach(){
      return this.listForCoach().filter(m => m.status !== 'read').length;
    }
  };

  global.InboxStore = InboxStore;
})(window);
