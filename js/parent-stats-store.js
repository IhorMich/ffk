/* Parent sideline stats shared for coach child pages (local device bus). */
(function(global){
  const KEY = 'ffk_parent_stats_v1';

  function emptyDb(){
    return {version: 1, byPlayer: {}};
  }
  function readDb(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return emptyDb();
      const db = JSON.parse(raw);
      if(!db || typeof db !== 'object') return emptyDb();
      return {
        version: 1,
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
      rating: Number(m.rating) || 0,
      comment: String(m.comment || '').slice(0, 200),
      pitchPos: String(m.pitchPos || m.pos || '').slice(0, 8),
      minutes: Number(m.minutes) || 0,
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
    publishFromPersonal(match){
      if(!match || !global.ParentStore || typeof global.ParentStore.listLinks !== 'function') return 0;
      const links = global.ParentStore.listLinks();
      if(!links.length) return 0;
      const matchName = String(match.player || '').trim().toLowerCase();
      let n = 0;
      links.forEach(l => {
        if(!l || !l.player || !l.player.id) return;
        const child = [l.player.first_name, l.player.last_name].filter(Boolean).join(' ').trim().toLowerCase();
        const first = String(l.player.first_name || '').trim().toLowerCase();
        // Attach if names match, or only one linked child on this phone
        const ok = links.length === 1
          || !matchName
          || (child && (matchName === child || matchName.includes(first) || first && matchName.startsWith(first)));
        if(!ok) return;
        this.publishMatch(l.player.id, match);
        n += 1;
      });
      return n;
    }
  };

  global.ParentStatsStore = ParentStatsStore;
})(window);
