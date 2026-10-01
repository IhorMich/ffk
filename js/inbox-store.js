/* In-app inbox for parents/guardians (match invites etc.).
   Shared on-device bus — not WhatsApp/SMS. Cloud sync later via Supabase. */
(function(global){
  const KEY = 'ffk_inbox_v1';

  function uid(prefix){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function emptyDb(){
    return {version: 2, messages: [], deleted: {}};
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      return {
        version: 2,
        messages: Array.isArray(db.messages) ? db.messages : [],
        deleted: db.deleted && typeof db.deleted === 'object' ? db.deleted : {}
      };
    }catch(e){
      return emptyDb();
    }
  }
  function writeDb(db, quiet){
    localStorage.setItem(KEY, JSON.stringify(db));
    if(quiet) return;
    try{
      if(global.ParentCloud && typeof global.ParentCloud.scheduleSync === 'function'){
        global.ParentCloud.scheduleSync();
      }
    }catch(e){}
  }
  function deletionKey(message){
    if(!message) return '';
    if(message.type === 'chat_message') return `chat:${message.id}`;
    if(message.type === 'coach_leave_request') return `coach_leave:${message.request_id || message.id}`;
    if(message.type === 'player_leave_decision') return `leave_decision:${message.request_id || message.id}`;
    if(message.type === 'match_invite') return `match_invite:${message.match_id}:${message.team_player_id}`;
    if(message.type === 'match_result') return `match_result:${message.match_id}:${message.team_player_id}`;
    return `${message.type || 'message'}:${message.id || ''}`;
  }
  function safeLabel(v, max){
    let s = '';
    if(v == null) s = '';
    else if(typeof v === 'object'){
      if(Array.isArray(v)){
        s = v.map(x => safeLabel(x, max)).filter(Boolean).join(' ');
      }else if(v.name != null){
        s = safeLabel(v.name, max);
      }else if(v.first_name || v.last_name){
        s = [safeLabel(v.first_name, 40), safeLabel(v.last_name, 40)].filter(Boolean).join(' ');
      }else{
        s = safeLabel(v.title || v.label || v.email || '', max);
      }
    }else s = String(v);
    s = String(s || '').trim();
    if(!s || s === '[object Object]' || /\[object Object\]/i.test(s)) s = '';
    return s.slice(0, max || 80);
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
      ).map(m => m.type === 'chat_message'
        ? {...m, status: m.read_by_parent ? 'read' : 'delivered'}
        : m);
    },
    listForCoach(){
      return this.listAll()
        .filter(m => m.type === 'coach_leave_request' || m.type === 'chat_message')
        .map(m => m.type === 'chat_message'
          ? {...m, status: m.read_by_coach ? 'read' : 'delivered'}
          : m);
    },
    get(id){
      return readDb().messages.find(m => m.id === id) || null;
    },
    listDeleted(){
      return {...readDb().deleted};
    },
    editChatMessage(id, text){
      const value = String(text || '').trim().slice(0, 500);
      if(!id || !value) return null;
      const db = readDb();
      const now = new Date().toISOString();
      let hit = null;
      db.messages = db.messages.map(m => {
        if(m.id !== id || m.type !== 'chat_message') return m;
        hit = {...m, text: value, edited_at: now, updated_at: now};
        return hit;
      });
      if(hit) writeDb(db);
      return hit;
    },
    deleteMessages(ids){
      const list = (ids || []).map(String).filter(Boolean);
      let removed = 0;
      list.forEach(id => {
        if(this.deleteMessage(id)) removed += 1;
      });
      return removed;
    },
    deleteMessage(id){
      const db = readDb();
      const message = db.messages.find(m => m.id === id);
      if(!message) return null;
      const key = deletionKey(message);
      db.messages = db.messages.filter(m => m.id !== id);
      if(key) db.deleted[key] = new Date().toISOString();
      if(message.cloud_notice_id){
        db.deleted[`notice:${message.cloud_notice_id}`] = new Date().toISOString();
      }
      writeDb(db);
      try{
        if(global.ParentCloud && typeof global.ParentCloud.dismissParentNotices === 'function'
           && (message.type === 'match_invite' || message.type === 'match_result')){
          global.ParentCloud.dismissParentNotices({
            noticeId: message.cloud_notice_id || '',
            matchId: message.match_id || '',
            teamPlayerId: message.team_player_id || ''
          }).catch(() => {});
        }
      }catch(e){}
      return message;
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
      const delKey = `match_invite:${matchId}:${playerId}`;
      if(db.deleted[delKey] && !payload.forceUnread){
        return null;
      }
      if(db.deleted[delKey] && payload.forceUnread){
        delete db.deleted[delKey];
      }
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
        end_time: String(payload.end_time || '').slice(0, 8),
        fee_type: payload.fee_type === 'paid' ? 'paid' : 'free',
        fee: payload.fee_type === 'paid' ? String(payload.fee || '').slice(0, 32) : '',
        tournament: String(payload.tournament || '').slice(0, 48),
        // Never persist other children's names on parent messages.
        squad_names: [],
        invite_notice: notice || (existing && existing.invite_notice === 'recalled' && !payload.clearNotice
          ? 'recalled'
          : ''),
        cloud_notice_id: String(payload.cloud_notice_id || existing && existing.cloud_notice_id || ''),
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
            kickoff: extra.kickoff != null ? String(extra.kickoff).slice(0, 8) : m.kickoff,
            end_time: extra.end_time != null ? String(extra.end_time).slice(0, 8) : m.end_time
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
      const delKey = `match_result:${matchId}:${playerId}`;
      if(db.deleted[delKey] && !payload.forceUnread){
        return null;
      }
      if(db.deleted[delKey] && payload.forceUnread){
        delete db.deleted[delKey];
      }
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
        end_time: String(payload.end_time || '').slice(0, 8),
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
        cloud_notice_id: String(payload.cloud_notice_id || existing && existing.cloud_notice_id || ''),
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
      const delKey = `coach_leave:${requestId}`;
      const force = !!(payload && (payload.force || payload.resend));
      if(db.deleted[delKey]){
        if(!force) return null;
        delete db.deleted[delKey];
      }
      const existing = db.messages.find(m =>
        m.type === 'coach_leave_request' && String(m.request_id || '') === requestId
      );
      const now = new Date().toISOString();
      const statusRaw = String(payload.status || '');
      const decided = statusRaw === 'accepted' || statusRaw === 'declined';
      const row = {
        id: existing ? existing.id : uid('msg'),
        type: 'coach_leave_request',
        request_id: requestId,
        team_id: String(payload.team_id || ''),
        team_player_id: String(payload.team_player_id || ''),
        parent_link_id: String(payload.parent_link_id || ''),
        player_name: safeLabel(payload.player_name, 80),
        team_name: safeLabel(payload.team_name, 60),
        academy_name: safeLabel(payload.academy_name, 80),
        new_club: safeLabel(payload.new_club, 60),
        new_team: safeLabel(payload.new_team, 60),
        decision: decided
          ? statusRaw
          : (force ? '' : ((existing && existing.decision) || '')),
        status: force || !existing || existing.status !== 'read' || !existing.decision
          ? 'delivered'
          : (existing.status === 'read' ? 'read' : 'delivered'),
        created_at: force ? now : (existing ? existing.created_at : (payload.created_at || now)),
        updated_at: now,
        read_at: force || !decided ? '' : (existing && existing.read_at) || ''
      };
      if(force){
        row.status = 'delivered';
        row.decision = '';
        row.read_at = '';
      }
      if(existing) db.messages = db.messages.map(m => m.id === existing.id ? row : m);
      else db.messages.push(row);
      writeDb(db);
      return row;
    },
    upsertPlayerLeaveDecision(payload){
      const db = readDb();
      const requestId = String(payload.id || payload.request_id || '');
      const playerId = String(payload.team_player_id || '');
      if(!requestId || !playerId) throw new Error('bad_message');
      if(db.deleted[`leave_decision:${requestId}`]) return null;
      const existing = db.messages.find(m =>
        m.type === 'player_leave_decision' && String(m.request_id || '') === requestId
      );
      const now = new Date().toISOString();
      const row = {
        id: existing ? existing.id : uid('msg'),
        type: 'player_leave_decision',
        request_id: requestId,
        team_id: String(payload.team_id || ''),
        team_player_id: playerId,
        player_name: String(payload.player_name || '').slice(0, 80),
        team_name: String(payload.team_name || '').slice(0, 60),
        academy_name: String(payload.academy_name || '').slice(0, 80),
        leave_decision: payload.leave_decision === 'accepted' ? 'accepted' : 'declined',
        status: 'delivered',
        created_at: existing ? existing.created_at : now,
        updated_at: now,
        read_at: ''
      };
      if(existing) db.messages = db.messages.map(m => m.id === existing.id ? row : m);
      else db.messages.push(row);
      writeDb(db);
      return row;
    },
    sendChatMessage(payload){
      const playerId = String(payload && payload.team_player_id || '');
      const role = payload && payload.sender_role === 'coach' ? 'coach' : 'parent';
      const text = String(payload && payload.text || '').trim().slice(0, 500);
      if(!playerId || !text) throw new Error('bad_message');
      const db = readDb();
      const now = new Date().toISOString();
      const row = {
        id: uid('chat'),
        type: 'chat_message',
        team_player_id: playerId,
        team_id: String(payload.team_id || ''),
        player_name: safeLabel(payload.player_name, 80),
        team_name: safeLabel(payload.team_name, 60),
        academy_name: safeLabel(payload.academy_name, 80),
        coach_name: safeLabel(payload.coach_name, 80),
        sender_role: role,
        text,
        broadcast_id: String(payload.broadcast_id || ''),
        read_by_parent: role === 'parent',
        read_by_coach: role === 'coach',
        status: 'delivered',
        created_at: now,
        updated_at: now,
        read_at: ''
      };
      db.messages.push(row);
      writeDb(db);
      return row;
    },
    /** One coach text → fan-out as 1:1 chat rows (no group thread). */
    broadcastCoachMessage(payload){
      const text = String(payload && payload.text || '').trim().slice(0, 500);
      const players = Array.isArray(payload && payload.players) ? payload.players : [];
      if(!text) throw new Error('bad_message');
      if(!players.length) throw new Error('no_recipients');
      const broadcastId = uid('bc');
      const sent = [];
      players.forEach(p => {
        const playerId = String(p && (p.team_player_id || p.id) || '');
        if(!playerId) return;
        try{
          sent.push(this.sendChatMessage({
            team_player_id: playerId,
            team_id: p.team_id || payload.team_id || '',
            player_name: p.player_name || p.name || '',
            team_name: p.team_name || payload.team_name || '',
            academy_name: p.academy_name || payload.academy_name || '',
            coach_name: payload.coach_name || '',
            sender_role: 'coach',
            text,
            broadcast_id: broadcastId
          }));
        }catch(e){}
      });
      if(!sent.length) throw new Error('no_recipients');
      return {broadcast_id: broadcastId, count: sent.length, messages: sent};
    },
    importCloudChat(raw){
      if(!raw || !raw.id || !raw.team_player_id) return null;
      const db = readDb();
      if(db.deleted[`chat:${raw.id}`]) return null;
      const existing = db.messages.find(m => m.id === raw.id);
      // Keep local read receipts if the user already opened the thread —
      // cloud flags can lag until the next full push of mark_player_chat_read.
      const readByParent = !!raw.read_by_parent || !!(existing && existing.read_by_parent);
      const readByCoach = !!raw.read_by_coach || !!(existing && existing.read_by_coach);
      const row = {
        ...(existing || {}),
        id: String(raw.id),
        type: 'chat_message',
        team_player_id: String(raw.team_player_id),
        team_id: String(raw.team_id || existing && existing.team_id || ''),
        player_name: safeLabel(raw.player_name || existing && existing.player_name, 80),
        team_name: safeLabel(raw.team_name || existing && existing.team_name, 60),
        academy_name: safeLabel(raw.academy_name || existing && existing.academy_name, 80),
        coach_name: safeLabel(raw.coach_name || existing && existing.coach_name, 80),
        sender_role: raw.sender_role === 'coach' ? 'coach' : 'parent',
        sender_user_id: String(raw.sender_user_id || existing && existing.sender_user_id || ''),
        text: String(raw.body || raw.text || '').slice(0, 500),
        broadcast_id: String(raw.broadcast_id || existing && existing.broadcast_id || ''),
        edited_at: raw.edited_at || (existing && existing.edited_at) || '',
        read_by_parent: readByParent,
        read_by_coach: readByCoach,
        status: 'delivered',
        created_at: raw.created_at || existing && existing.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cloud_synced: true
      };
      const isNew = !existing;
      if(existing) db.messages = db.messages.map(m => m.id === row.id ? row : m);
      else db.messages.push(row);
      writeDb(db, true);
      return {row, isNew};
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
    markRead(id, readerRole){
      const db = readDb();
      const now = new Date().toISOString();
      let touched = null;
      db.messages = db.messages.map(m => {
        if(m.id !== id) return m;
        if(m.type === 'chat_message'){
          const role = readerRole === 'coach' ? 'coach' : 'parent';
          touched = {
            ...m,
            read_by_parent: role === 'parent' ? true : !!m.read_by_parent,
            read_by_coach: role === 'coach' ? true : !!m.read_by_coach,
            updated_at: now
          };
          return touched;
        }
        touched = {...m, status: 'read', read_at: m.read_at || now, updated_at: now};
        return touched;
      });
      writeDb(db);
      try{
        if(touched && (touched.type === 'match_invite' || touched.type === 'match_result')
           && global.ParentCloud && typeof global.ParentCloud.markParentNoticesRead === 'function'){
          global.ParentCloud.markParentNoticesRead({
            noticeId: touched.cloud_notice_id || '',
            matchId: touched.match_id || '',
            teamPlayerId: touched.team_player_id || ''
          }).catch(() => {});
        }
      }catch(e){}
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
      return this.listForPlayers(playerIds).filter(m => {
        if(m.type === 'chat_message'){
          // Only incoming unread chats for the parent.
          return m.sender_role === 'coach' && !m.read_by_parent;
        }
        return m.status !== 'read';
      }).length;
    },
    unreadCountForCoach(){
      return this.listForCoach().filter(m => {
        if(m.type === 'chat_message'){
          // Only incoming unread chats for the coach.
          return m.sender_role === 'parent' && !m.read_by_coach;
        }
        return m.status !== 'read';
      }).length;
    }
  };

  global.InboxStore = InboxStore;
})(window);
