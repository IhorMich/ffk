/* Parent sideline stats shared for coach child pages (local device bus). */
(function(global){
  const KEY = 'ffk_parent_stats_v1';

  function emptyDb(){
    return {version: 2, byPlayer: {}};
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      return {
        version: 2,
        byPlayer: db.byPlayer && typeof db.byPlayer === 'object' ? db.byPlayer : {}
      };
    }catch(e){
      return emptyDb();
    }
  }
  function writeDb(db){
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function compactMatch(m){
    if(!m) return null;
    return {
      id: String(m.id || ''),
      date: String(m.date || '').slice(0, 10),
      opponent: String(m.opponent || m.opp || '').slice(0, 48),
      score: String(m.score || '').slice(0, 16),
      kind: String(m.kind || '').slice(0, 20),
      tournament: String(m.tournament || '').slice(0, 60),
      venue: m.venue === 'away' ? 'away' : 'home',
      rating: Number(m.rating) || 0,
      actionRating: Number(m.actionRating) || 0,
      effortRating: Number(m.effortRating) || 0,
      comment: String(m.comment || '').slice(0, 400),
      pitchPos: String(m.pitchPos || m.pos || '').slice(0, 8),
      position: String(m.position || '').slice(0, 8),
      minutes: Number(m.minutes) || 0,
      matchLen: Number(m.matchLen) || 0,
      format: String(m.format || '').slice(0, 20),
      role: m.role === 'sub' ? 'sub' : 'start',
      counts: m.counts && typeof m.counts === 'object' ? {...m.counts} : {},
      behaviors: m.behaviors && typeof m.behaviors === 'object' ? {...m.behaviors} : {},
      timeline: Array.isArray(m.timeline) ? m.timeline.slice(0, 240).map(e => ({
        key: String(e && e.key || '').slice(0, 32),
        minute: Math.max(0, Number(e && e.minute) || 0),
        period: Math.max(0, Number(e && e.period) || 0),
        inPeriod: Math.max(0, Number(e && e.inPeriod) || 0),
        at: Number(e && e.at) || 0
      })) : [],
      updated_at: new Date().toISOString()
    };
  }

  const ParentStatsStore = {
    listForPlayer(teamPlayerId){
      const id = String(teamPlayerId || '');
      if(!id) return [];
      const list = readDb().byPlayer[id];
      return Array.isArray(list)
        ? list.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
        : [];
    },
    avgForPlayer(teamPlayerId){
      const list = this.listForPlayer(teamPlayerId);
      if(!list.length) return null;
      const sum = list.reduce((a, r) => a + (Number(r.rating) || 0), 0);
      return Math.round((sum / list.length) * 10) / 10;
    },
    publishMatch(teamPlayerId, match){
      const id = String(teamPlayerId || '');
      const row = compactMatch(match);
      if(!id || !row || !row.date) return null;
      const db = readDb();
      const cur = Array.isArray(db.byPlayer[id]) ? db.byPlayer[id].slice() : [];
      const idx = cur.findIndex(x => x.id && row.id && x.id === row.id);
      if(idx >= 0) cur[idx] = row;
      else cur.unshift(row);
      db.byPlayer[id] = cur.slice(0, 80);
      writeDb(db);
      return row;
    },
    /** After parent saves a personal match — attach to linked academy children. */
    publishFromPersonal(match, personalPlayerId){
      if(!match || !global.ParentStore || typeof global.ParentStore.listLinks !== 'function') return 0;
      const links = global.ParentStore.listLinks();
      if(!links.length) return 0;
      const profileId = String(personalPlayerId || '');
      const matchName = String(match.player || '').trim().toLowerCase();
      let n = 0;
      links.forEach(l => {
        if(!l || !l.player || !l.player.id) return;
        const child = [l.player.first_name, l.player.last_name].filter(Boolean).join(' ').trim().toLowerCase();
        const first = String(l.player.first_name || '').trim().toLowerCase();
        // Attach if names match, or only one linked child on this phone
        const exact = profileId && String(l.personal_player_id || '') === profileId;
        const ok = profileId
          ? exact
          : ((!l.personal_player_id && links.length === 1)
            || !matchName
            || (child && (matchName === child || matchName.includes(first) || first && matchName.startsWith(first))));
        if(!ok) return;
        this.publishMatch(l.player.id, match);
        n += 1;
      });
      return n;
    },
    /** Backfill every existing personal match after a player is linked to a coach. */
    syncAllPersonalHistory(){
      if(typeof listPersonalPlayerHistories !== 'function'
        || !global.ParentStore || typeof global.ParentStore.listLinks !== 'function') return 0;
      const profiles = listPersonalPlayerHistories();
      const links = global.ParentStore.listLinks();
      let n = 0;
      links.forEach(link => {
        if(!link || !link.player || !link.player.id) return;
        let profile = profiles.find(p =>
          link.personal_player_id && String(p.id) === String(link.personal_player_id)
        );
        if(!profile){
          const lf = String(link.player.first_name || '').trim().toLowerCase();
          const ll = String(link.player.last_name || '').trim().toLowerCase();
          const matches = profiles.filter(p => {
            const pf = String(p.firstName || '').trim().toLowerCase();
            const pl = String(p.lastName || '').trim().toLowerCase();
            return pf && pf === lf && (!ll || !pl || pl === ll);
          });
          if(matches.length === 1) profile = matches[0];
        }
        if(!profile && links.length === 1 && profiles.length === 1) profile = profiles[0];
        if(!profile) return;
        if(!link.personal_player_id && typeof global.ParentStore.bindPersonalPlayer === 'function'){
          try{ global.ParentStore.bindPersonalPlayer(link.id, profile.id); }catch(e){}
        }
        (profile.matches || []).forEach(match => {
          if(this.publishMatch(link.player.id, match)) n += 1;
        });
      });
      return n;
    },
    summaryForPlayer(teamPlayerId){
      const list = this.listForPlayer(teamPlayerId);
      const scores = list.map(r => Number(r.rating) || 0).filter(n => n > 0);
      const moments = {};
      const behaviorTotals = {};
      const behaviorGames = {};
      let minutes = 0;
      list.forEach(r => {
        minutes += Number(r.minutes) || 0;
        Object.entries(r.counts || {}).forEach(([key, raw]) => {
          const value = Number(raw) || 0;
          if(value) moments[key] = (moments[key] || 0) + value;
        });
        Object.entries(r.behaviors || {}).forEach(([key, raw]) => {
          const value = Number(raw) || 0;
          if(!value) return;
          behaviorTotals[key] = (behaviorTotals[key] || 0) + value;
          behaviorGames[key] = (behaviorGames[key] || 0) + 1;
        });
      });
      const behaviors = {};
      Object.keys(behaviorTotals).forEach(key => {
        behaviors[key] = Math.round((behaviorTotals[key] / behaviorGames[key]) * 10) / 10;
      });
      return {
        games: list.length,
        avg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
        best: scores.length ? Math.max(...scores) : null,
        worst: scores.length ? Math.min(...scores) : null,
        last: scores.length ? scores[0] : null,
        minutes,
        moments,
        behaviors
      };
    }
  };

  global.ParentStatsStore = ParentStatsStore;
})(window);
