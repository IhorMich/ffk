/* Matchcard Parent links — academy-confirmed child + coach stats.
   Never writes into Free/Pro personal matches. */
(function(global){
  const KEY = 'ffk_parent_v1';

  function uid(prefix){
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function emptyDb(){
    return {version: 2, links: [], pendingPayload: null, trainingsByTeam: {}};
  }
  function isBrokenLabel(s){
    return !s || s === '[object Object]';
  }
  function repairNamed(obj, fallback){
    if(!obj || typeof obj !== 'object') return obj || fallback || null;
    if(!isBrokenLabel(obj.name)) return obj;
    const fixed = fallback && !isBrokenLabel(fallback.name) ? fallback.name : '';
    return {...obj, name: fixed};
  }
  /** Recover coach/team/academy labels ruined by double-normalize String(object). */
  function repairLink(link){
    if(!link || typeof link !== 'object') return link;
    let invitePayload = null;
    try{
      if(link.token && global.CoachStore && typeof global.CoachStore.findParentInviteByToken === 'function'){
        const hit = global.CoachStore.findParentInviteByToken(link.token);
        invitePayload = hit && hit.payload;
      }else if(link.code && global.CoachStore && typeof global.CoachStore.findParentInviteByCode === 'function'){
        const hit = global.CoachStore.findParentInviteByCode(link.code);
        invitePayload = hit && hit.payload;
      }
    }catch(e){}
    let fromInvite = null;
    try{
      if(invitePayload) fromInvite = normalizePayload(invitePayload);
    }catch(e){}
    const next = {
      ...link,
      academy: repairNamed(link.academy, fromInvite && fromInvite.academy),
      team: repairNamed(link.team, fromInvite && fromInvite.team),
      coach: repairNamed(link.coach, fromInvite && fromInvite.coach)
    };
    const changed =
      (link.academy && link.academy.name) !== (next.academy && next.academy.name) ||
      (link.team && link.team.name) !== (next.team && next.team.name) ||
      (link.coach && link.coach.name) !== (next.coach && next.coach.name);
    return changed ? next : link;
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      const links = Array.isArray(db.links) ? db.links.map(repairLink) : [];
      const changed = links.some((l, i) => l !== db.links[i]);
      const out = {
        version: 2,
        links,
        pendingPayload: db.pendingPayload || null,
        trainingsByTeam: db.trainingsByTeam && typeof db.trainingsByTeam === 'object' ? db.trainingsByTeam : {}
      };
      if(changed){
        try{ localStorage.setItem(KEY, JSON.stringify(out)); }catch(e){}
      }
      return out;
    }catch(e){
      return emptyDb();
    }
  }
  function writeDb(db){
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function currentPersonalPlayerId(){
    try{
      const roster = JSON.parse(localStorage.getItem('ffk_roster_v1') || 'null');
      if(roster && roster.currentId) return String(roster.currentId).slice(0, 32);
    }catch(e){}
    try{
      const player = JSON.parse(localStorage.getItem('ffk_player_v1') || 'null');
      if(player && player.id) return String(player.id).slice(0, 32);
    }catch(e){}
    return '';
  }
  function normName(s){
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function personalProfile(id){
    const pid = String(id || '');
    if(!pid) return null;
    try{
      const raw = localStorage.getItem('ffk_kid_' + pid);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    try{
      const raw = JSON.parse(localStorage.getItem('ffk_player_v1') || 'null');
      if(raw && String(raw.id || '') === pid) return raw;
    }catch(e){}
    return null;
  }

  /** Prefer string fields; never String(object) → "[object Object]". */
  function textField(...candidates){
    for(const c of candidates){
      if(c == null || c === '') continue;
      if(typeof c === 'string' || typeof c === 'number'){
        const s = String(c).trim();
        if(s && s !== '[object Object]') return s;
        continue;
      }
      if(typeof c === 'object' && c.name != null && typeof c.name !== 'object'){
        const s = String(c.name).trim();
        if(s && s !== '[object Object]') return s;
      }
    }
    return '';
  }
  function normalizePayload(raw){
    if(!raw || typeof raw !== 'object') throw new Error('bad_payload');
    if(Number(raw.v) !== 1) throw new Error('bad_version');
    const player = raw.player || {};
    const fn = String(player.fn || player.first_name || '').trim();
    if(!fn) throw new Error('bad_player');
    const ratings = Array.isArray(raw.r || raw.ratings) ? (raw.r || raw.ratings) : [];
    // Accept both compact invite shape (a/tm/c) and already-normalized
    // claim shape (academy/team/coach). Re-normalizing must not turn
    // nested objects into the literal string "[object Object]".
    const academyObj = raw.a && typeof raw.a === 'object' ? raw.a
      : (raw.academy && typeof raw.academy === 'object' ? raw.academy : null);
    const teamObj = raw.tm && typeof raw.tm === 'object' ? raw.tm
      : (raw.team && typeof raw.team === 'object' ? raw.team : null);
    const coachObj = raw.c && typeof raw.c === 'object' ? raw.c
      : (raw.coach && typeof raw.coach === 'object' ? raw.coach : null);
    return {
      v: 1,
      token: String(raw.t || raw.token || '').slice(0, 48),
      code: String(raw.code || '').toUpperCase().slice(0, 12),
      academy: {
        id: String((academyObj && academyObj.id) || raw.aid || '').slice(0, 48),
        name: textField(academyObj && academyObj.name, raw.an, raw.academy).slice(0, 80)
      },
      team: {
        id: String((teamObj && teamObj.id) || raw.tid || '').slice(0, 48),
        name: textField(teamObj && teamObj.name, raw.tn, raw.team).slice(0, 60),
        age_group: textField(teamObj && teamObj.age_group, raw.ag).slice(0, 24),
        invite_code: String((teamObj && teamObj.invite_code) || raw.tc || '').slice(0, 12)
      },
      coach: {
        name: textField(coachObj && coachObj.name, raw.cn, raw.coach).slice(0, 80),
        email: textField(coachObj && coachObj.email, raw.ce).slice(0, 80)
      },
      player: {
        id: String(player.id || '').slice(0, 48),
        first_name: fn.slice(0, 40),
        last_name: String(player.ln || player.last_name || '').trim().slice(0, 40),
        number: String(player.n || player.number || '').slice(0, 4),
        position: String(player.pos || player.position || '').slice(0, 8)
      },
      ratings: ratings.slice(0, 40).map(r => ({
        date: String(r.d || r.date || '').slice(0, 10),
        opponent: String(r.o || r.opponent || '').slice(0, 48),
        score: String(r.s || r.score || '').slice(0, 16),
        rating: Number(r.r != null ? r.r : r.rating) || 0,
        pitchPos: String(r.p || r.pitchPos || '').slice(0, 8),
        minutes: Number(r.m != null ? r.m : r.minutes) || 0,
        role: String(r.role || '').slice(0, 8)
      })),
      avg: raw.avg != null ? Number(raw.avg) : null,
      games: Number(raw.g != null ? raw.g : raw.games) || 0,
      last: raw.last != null ? Number(raw.last) : null,
      best: raw.best != null ? Number(raw.best) : null,
      worst: raw.worst != null ? Number(raw.worst) : null,
      form: Array.isArray(raw.form) ? raw.form.map(n => Number(n) || 0).slice(-5) : [],
      trend: raw.trend != null ? Number(raw.trend) : null,
      minutes: raw.minutes != null ? Number(raw.minutes) : 0,
      topMoments: Array.isArray(raw.topMoments)
        ? raw.topMoments.slice(0, 6).map(m => ({
            key: String(m.key || m.k || '').slice(0, 24),
            n: Number(m.n) || 0
          })).filter(m => m.key && m.n)
        : [],
      issued_at: String(raw.iat || raw.issued_at || new Date().toISOString()),
      mi: Array.isArray(raw.mi || raw.match_invites) ? (raw.mi || raw.match_invites) : []
    };
  }

  const ParentStore = {
    listLinks(){
      return readDb().links.slice().sort((a, b) => String(b.claimedAt).localeCompare(String(a.claimedAt)));
    },
    getLink(id){
      return readDb().links.find(l => l.id === id) || null;
    },
    currentPersonalPlayerId(){
      return currentPersonalPlayerId();
    },
    linksForPersonalPlayer(personalPlayerId){
      const pid = String(personalPlayerId || '');
      if(!pid) return [];
      const links = this.listLinks();
      const exact = links.filter(l => String(l && l.personal_player_id || '') === pid);
      if(exact.length) return exact;

      // One-time migration for links created before personal_player_id existed.
      const profile = personalProfile(pid);
      const first = normName(profile && profile.firstName);
      const last = normName(profile && profile.lastName);
      const byName = links.filter(link => {
        if(!link || link.personal_player_id || !link.player) return false;
        const lf = normName(link.player.first_name);
        const ll = normName(link.player.last_name);
        return first && first === lf && (!last || !ll || last === ll);
      });
      if(byName.length === 1){
        this.bindPersonalPlayer(byName[0].id, pid);
        return [{...byName[0], personal_player_id: pid}];
      }
      try{
        const roster = JSON.parse(localStorage.getItem('ffk_roster_v1') || 'null');
        const ids = roster && Array.isArray(roster.ids) ? roster.ids : [];
        const unbound = links.filter(l => l && !l.personal_player_id);
        if(ids.length === 1 && unbound.length === 1){
          this.bindPersonalPlayer(unbound[0].id, pid);
          return [{...unbound[0], personal_player_id: pid}];
        }
      }catch(e){}
      return [];
    },
    bindPersonalPlayer(linkId, personalPlayerId){
      const lid = String(linkId || '');
      const pid = String(personalPlayerId || '').slice(0, 32);
      if(!lid || !pid) return null;
      const db = readDb();
      let hit = null;
      db.links = db.links.map(link => {
        if(link.id !== lid) return link;
        hit = {...link, personal_player_id: pid, updatedAt: new Date().toISOString()};
        return hit;
      });
      if(hit) writeDb(db);
      return hit;
    },
    setPending(payload){
      const db = readDb();
      db.pendingPayload = payload;
      writeDb(db);
      return payload;
    },
    getPending(){
      return readDb().pendingPayload || null;
    },
    clearPending(){
      const db = readDb();
      db.pendingPayload = null;
      writeDb(db);
    },
    parseInviteInput(text){
      text = String(text || '').trim();
      if(!text) throw new Error('empty');
      // Full deep link / URL with d= or ffk_parent=
      let m = text.match(/[?&#](?:d|ffk_parent)=([A-Za-z0-9\-_=]+)/);
      if(m) return this.decodePayload(m[1]);
      // Test-mode short app link (same device: resolved from CoachStore).
      m = text.match(/[?&#]code=(?:MC-)?([A-Za-z0-9]{4,8})/i);
      if(m && global.CoachStore && typeof global.CoachStore.findParentInviteByCode === 'function'){
        const hit = global.CoachStore.findParentInviteByCode(m[1]);
        if(hit && hit.payload) return normalizePayload(hit.payload);
      }
      // Bare base64 payload
      if(/^[A-Za-z0-9\-_=]{40,}$/.test(text) && !/^MC-/i.test(text)){
        try{ return this.decodePayload(text); }catch(e){}
      }
      // Prefixed
      m = text.match(/FFKP1:([A-Za-z0-9\-_=]+)/i);
      if(m) return this.decodePayload(m[1]);
      // Short code — resolve from coach store on same device if present
      const code = text.replace(/^MC-/i, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if(code.length >= 4 && global.CoachStore && typeof global.CoachStore.findParentInviteByCode === 'function'){
        const hit = global.CoachStore.findParentInviteByCode(code);
        if(hit && hit.payload) return normalizePayload(hit.payload);
      }
      throw new Error('bad_invite');
    },
    encodePayload(payload){
      const json = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
      return b64;
    },
    decodePayload(b64){
      let s = String(b64 || '').trim().replace(/-/g, '+').replace(/_/g, '/');
      while(s.length % 4) s += '=';
      const json = decodeURIComponent(escape(atob(s)));
      return normalizePayload(JSON.parse(json));
    },
    buildLink(payload){
      const data = this.encodePayload(payload);
      return `ffk://parent?d=${data}`;
    },
    buildCodeLink(code){
      const value = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      return value ? `ffk://parent?code=${value}` : '';
    },
    buildCodeWebLink(code){
      const value = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      // Short URL → compact QR (open.html still accepts older shares).
      return value ? `https://ihormich.github.io/ffk/?code=${value}` : '';
    },
    buildWebLink(payload){
      const data = this.encodePayload(payload);
      // Stable public URL: Capacitor's internal localhost URL is not shareable.
      return `https://ihormich.github.io/ffk/?ffk_parent=${data}`;
    },
    claim(payload){
      const norm = normalizePayload(payload);
      if(!norm.academy.name || !norm.team.name) throw new Error('bad_payload');
      const db = readDb();
      const existing = db.links.find(l =>
        (norm.token && l.token === norm.token) ||
        (norm.player.id && l.player && l.player.id === norm.player.id && l.academy && l.academy.name === norm.academy.name)
      );
      const personalPlayerId = (existing && existing.personal_player_id) || currentPersonalPlayerId();
      const row = {
        id: existing ? existing.id : uid('plink'),
        token: norm.token,
        code: norm.code,
        personal_player_id: personalPlayerId,
        academy: norm.academy,
        team: norm.team,
        coach: norm.coach,
        player: norm.player,
        ratings: norm.ratings,
        avg: norm.avg,
        games: norm.games || norm.ratings.length,
        last: norm.last,
        best: norm.best,
        worst: norm.worst,
        form: Array.isArray(norm.form) ? norm.form : [],
        trend: norm.trend,
        minutes: norm.minutes || 0,
        topMoments: Array.isArray(norm.topMoments) ? norm.topMoments : [],
        issued_at: norm.issued_at,
        claimedAt: existing ? existing.claimedAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        leave_status: existing && existing.leave_status === 'pending' ? 'pending' : '',
        leave_requested_at: existing && existing.leave_status === 'pending' ? (existing.leave_requested_at || '') : ''
      };
      if(existing){
        db.links = db.links.map(l => l.id === existing.id ? row : l);
      }else{
        db.links.push(row);
      }
      db.pendingPayload = null;
      writeDb(db);
      // Import match invites packed in parent QR/link
      try{
        const rawMi = (payload && (payload.mi || payload.match_invites)) || (norm && norm.mi) || [];
        if(global.InboxStore && Array.isArray(rawMi) && rawMi.length){
          global.InboxStore.importMessages(rawMi.map(m => ({
            ...m,
            type: 'match_invite',
            team_player_id: m.team_player_id || norm.player.id,
            player_name: m.player_name || [norm.player.first_name, norm.player.last_name].filter(Boolean).join(' ')
          })));
        }
        const rawMr = (payload && (payload.mr || payload.match_results)) || [];
        if(global.InboxStore && Array.isArray(rawMr) && rawMr.length){
          global.InboxStore.importMessages(rawMr.map(m => ({
            ...m,
            type: 'match_result',
            team_player_id: m.team_player_id || norm.player.id,
            player_name: m.player_name || [norm.player.first_name, norm.player.last_name].filter(Boolean).join(' ')
          })));
        }
      }catch(e){}
      // Same-device: pull coach invites for this player into inbox
      try{
        const coach = global.CoachStore;
        const session = coach && coach.getSession && coach.getSession();
        if(session && norm.player.id && typeof coach.deliverPendingForPlayer === 'function'){
          coach.deliverPendingForPlayer(session, norm.player.id);
        }
      }catch(e){}
      try{
        if(global.CoachStore && typeof global.CoachStore.markParentInviteClaimed === 'function'){
          global.CoachStore.markParentInviteClaimed({
            token: row.token,
            code: row.code,
            team_player_id: row.player && row.player.id
          });
        }
      }catch(e){}
      try{
        if(global.ParentCloud && typeof global.ParentCloud.rememberCoachLink === 'function'){
          global.ParentCloud.rememberCoachLink(row);
        }
      }catch(e){}
      return row;
    },
    linkedPlayerIds(personalPlayerId){
      const links = personalPlayerId
        ? this.linksForPersonalPlayer(personalPlayerId)
        : this.listLinks();
      return links.map(l => l.player && l.player.id).filter(Boolean);
    },
    listInbox(personalPlayerId){
      if(!global.InboxStore) return [];
      return global.InboxStore.listForPlayers(this.linkedPlayerIds(personalPlayerId));
    },
    unreadInboxCount(personalPlayerId){
      if(!global.InboxStore) return 0;
      return global.InboxStore.unreadCountForPlayers(this.linkedPlayerIds(personalPlayerId));
    },

    cacheTeamTrainings(teamId, list){
      teamId = String(teamId || '');
      if(!teamId) return;
      const db = readDb();
      db.trainingsByTeam = db.trainingsByTeam || {};
      db.trainingsByTeam[teamId] = (Array.isArray(list) ? list : []).slice(0, 60).map(t => ({
        id: String(t.id || ''),
        team_id: teamId,
        rule_id: t.rule_id || '',
        date: String(t.date || '').slice(0, 10),
        title: String(t.title || '').slice(0, 48),
        start_time: String(t.start_time || '').slice(0, 8),
        end_time: String(t.end_time || '').slice(0, 8),
        address: String(t.address || '').slice(0, 120),
        notify_minutes: Number(t.notify_minutes) || 60,
        recurring: !!t.recurring
      }));
      writeDb(db);
    },
    listTrainingsForTeam(teamId){
      teamId = String(teamId || '');
      const cached = ((readDb().trainingsByTeam || {})[teamId]) || [];
      // Prefer live coach local data on the same device.
      try{
        if(global.CoachStore && typeof global.CoachStore.listTrainingsForTeamPublic === 'function'){
          const today = new Date().toISOString().slice(0, 10);
          const to = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
          const live = global.CoachStore.listTrainingsForTeamPublic(teamId, today, to);
          if(live && live.length) return live;
        }
      }catch(e){}
      return cached.slice();
    },
    listUpcomingTrainingsForLinks(links){
      const today = new Date().toISOString().slice(0, 10);
      const out = [];
      const seen = new Set();
      (links || []).forEach(link => {
        const teamId = link && link.team && link.team.id;
        if(!teamId) return;
        this.listTrainingsForTeam(teamId).forEach(tr => {
          if(!tr || !tr.date || tr.date < today) return;
          const key = `${tr.team_id}|${tr.date}|${tr.start_time}|${tr.id}`;
          if(seen.has(key)) return;
          seen.add(key);
          out.push({
            ...tr,
            team_name: (link.team && link.team.name) || '',
            academy_name: (link.academy && link.academy.name) || '',
            player_name: [link.player && link.player.first_name, link.player && link.player.last_name].filter(Boolean).join(' ')
          });
        });
      });
      return out.sort((a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.start_time).localeCompare(String(b.start_time))
      );
    },
    syncCoachRatings(playerId, data){
      const pid = String(playerId || '');
      if(!pid || !data) return null;
      const db = readDb();
      let hit = null;
      db.links = db.links.map(l => {
        if(!l.player || String(l.player.id) !== pid) return l;
        const nextPlayer = {...(l.player || {})};
        if(data.player && typeof data.player === 'object'){
          if(data.player.number != null) nextPlayer.number = String(data.player.number || '').slice(0, 4);
          if(data.player.position != null) nextPlayer.position = String(data.player.position || '').slice(0, 8);
          if(data.player.first_name) nextPlayer.first_name = String(data.player.first_name).slice(0, 40);
          if(data.player.last_name != null) nextPlayer.last_name = String(data.player.last_name || '').slice(0, 40);
        }
        const nextTeam = {...(l.team || {})};
        if(data.team && typeof data.team === 'object'){
          if(data.team.id) nextTeam.id = String(data.team.id).slice(0, 40);
          if(data.team.name) nextTeam.name = String(data.team.name).slice(0, 60);
          if(data.team.age_group != null) nextTeam.age_group = String(data.team.age_group || '').slice(0, 24);
        }
        hit = {
          ...l,
          player: nextPlayer,
          team: nextTeam,
          ratings: Array.isArray(data.ratings) ? data.ratings.slice(0, 40) : (l.ratings || []),
          avg: data.avg != null ? data.avg : l.avg,
          games: data.games != null ? data.games : l.games,
          last: data.last != null ? data.last : l.last,
          best: data.best != null ? data.best : l.best,
          worst: data.worst != null ? data.worst : l.worst,
          form: Array.isArray(data.form) ? data.form.slice(-5) : (l.form || []),
          trend: data.trend != null ? data.trend : l.trend,
          minutes: data.minutes != null ? data.minutes : l.minutes,
          topMoments: Array.isArray(data.topMoments) ? data.topMoments.slice(0, 6) : (l.topMoments || []),
          updatedAt: new Date().toISOString()
        };
        return hit;
      });
      if(hit) writeDb(db);
      return hit;
    },
    removeLink(id){
      const db = readDb();
      db.links = db.links.filter(l => l.id !== id);
      writeDb(db);
    },
    removeLinksForPlayer(playerId){
      const pid = String(playerId || '');
      if(!pid) return 0;
      const db = readDb();
      const before = db.links.length;
      db.links = db.links.filter(l => !(l.player && String(l.player.id) === pid));
      writeDb(db);
      return before - db.links.length;
    },
    setLeaveStatus(linkId, status){
      const id = String(linkId || '');
      const st = status === 'pending' || status === 'declined' || status === 'accepted' ? status : '';
      if(!id) return null;
      const db = readDb();
      let hit = null;
      db.links = db.links.map(l => {
        if(l.id !== id) return l;
        hit = {
          ...l,
          leave_status: st === 'accepted' ? '' : st,
          leave_requested_at: st === 'pending'
            ? (l.leave_requested_at || new Date().toISOString())
            : (st ? (l.leave_requested_at || '') : ''),
          updatedAt: new Date().toISOString()
        };
        return hit;
      });
      if(hit) writeDb(db);
      return hit;
    },
    /** Parent/player asks coach to unlink after a club change — not instant. */
    requestLeave(linkId, meta){
      const link = this.getLink(linkId);
      if(!link || !link.player || !link.player.id) throw new Error('no_link');
      if(link.leave_status === 'pending') return {link, request: null, already: true};
      const coach = global.CoachStore;
      if(!coach || typeof coach.requestPlayerLeave !== 'function') throw new Error('no_coach');
      const req = coach.requestPlayerLeave({
        team_player_id: link.player.id,
        parent_link_id: link.id,
        player_name: [link.player.first_name, link.player.last_name].filter(Boolean).join(' '),
        team_name: (link.team && typeof link.team.name === 'string' && link.team.name !== '[object Object]')
          ? link.team.name
          : '',
        academy_name: (link.academy && typeof link.academy.name === 'string' && link.academy.name !== '[object Object]')
          ? link.academy.name
          : '',
        new_club: meta && meta.new_club ? meta.new_club : '',
        new_team: meta && meta.new_team ? meta.new_team : '',
        reason: 'club_change'
      });
      const updated = this.setLeaveStatus(link.id, 'pending');
      return {link: updated || link, request: req, already: false};
    }
  };

  global.ParentStore = ParentStore;
})(window);
