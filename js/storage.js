const STORAGE_KEY = 'ffk_matches_v2';
const LEGACY_KEY = 'football_matches';
const DRAFT_KEY = 'ffk_draft';
const VIEW_KEY = 'ffk_view';
const EXPORT_KEY = 'ffk_last_export';
const SETTINGS_KEY = 'ffk_settings';
const FILTER_KEY = 'ffk_filters_v1';
const PLAYER_KEY = 'ffk_player_v1';
const ROSTER_KEY = 'ffk_roster_v1';
const MAX_PLAYERS = 32;
const FREE_MAX_PLAYERS = (typeof MatchcardAccount !== 'undefined' && MatchcardAccount.LIMITS)
  ? MatchcardAccount.LIMITS.FREE_MAX_PLAYERS : 1;
const PRO_MAX_PLAYERS = (typeof MatchcardAccount !== 'undefined' && MatchcardAccount.LIMITS)
  ? MatchcardAccount.LIMITS.PRO_MAX_PLAYERS : 32;
const COACH_MAX_ACADEMIES = (typeof MatchcardAccount !== 'undefined' && MatchcardAccount.LIMITS)
  ? MatchcardAccount.LIMITS.COACH_MAX_ACADEMIES : 1;
const COACH_MAX_TEAMS = (typeof MatchcardAccount !== 'undefined' && MatchcardAccount.LIMITS)
  ? MatchcardAccount.LIMITS.COACH_MAX_TEAMS : 10;
const COACH_MAX_PLAYERS_PER_TEAM = (typeof MatchcardAccount !== 'undefined' && MatchcardAccount.LIMITS)
  ? MatchcardAccount.LIMITS.COACH_MAX_PLAYERS_PER_TEAM : 50;
const COACH_MAX_ASSISTANTS = (typeof MatchcardAccount !== 'undefined' && MatchcardAccount.LIMITS)
  ? MatchcardAccount.LIMITS.COACH_MAX_ASSISTANTS : 5;

function localRepo(){
  return (typeof MatchcardLocalRepo !== 'undefined' && MatchcardLocalRepo)
    || (typeof window !== 'undefined' && window.MatchcardLocalRepo)
    || null;
}

const mediaCache = new Proxy({}, {
  get(_t, prop){
    if(typeof prop === 'symbol') return undefined;
    const repo = localRepo();
    if(repo && typeof repo.getMediaCached === 'function'){
      return repo.getMediaCached(String(prop)) || undefined;
    }
    return undefined;
  },
  set(_t, prop, value){
    const repo = localRepo();
    if(repo && typeof repo.putMedia === 'function'){
      const v = value || {photo:'', cover:''};
      repo.putMedia(String(prop), v.photo || '', v.cover || '');
    }
    return true;
  },
  deleteProperty(_t, prop){
    const repo = localRepo();
    if(repo && typeof repo.deleteMedia === 'function') repo.deleteMedia(String(prop));
    return true;
  },
  has(_t, prop){
    const repo = localRepo();
    return !!(repo && repo.getMediaCached && repo.getMediaCached(String(prop)));
  }
});

function idbGetMedia(id){
  const repo = localRepo();
  if(repo && typeof repo.getMedia === 'function') return repo.getMedia(id);
  return Promise.resolve(null);
}
function idbPutMedia(id, photo, cover){
  const repo = localRepo();
  if(repo && typeof repo.putMedia === 'function') return repo.putMedia(id, photo, cover);
  return Promise.resolve();
}
function idbDeleteMedia(id){
  const repo = localRepo();
  if(repo && typeof repo.deleteMedia === 'function') return repo.deleteMedia(id);
  return Promise.resolve();
}
function playerRecordForLs(p){
  const repo = localRepo();
  if(repo && typeof repo.playerRecordForLs === 'function') return repo.playerRecordForLs(p);
  return {...p, photo: '', cover: ''};
}
function isUsablePhoto(src){
  const repo = localRepo();
  if(repo && typeof repo.isUsablePhoto === 'function') return repo.isUsablePhoto(src);
  const p = String(src || '');
  if(p.startsWith('data:image/') && p.length > 64) return true;
  if(p.startsWith('blob:') && p.length > 8) return true;
  if(/^https?:\/\//i.test(p)) return true;
  return false;
}
function coachMediaKey(id){
  const repo = localRepo();
  if(repo && typeof repo.coachMediaKey === 'function') return repo.coachMediaKey(id);
  return 'coach:' + String(id || '');
}
function getCoachMediaPhoto(id){
  const key = coachMediaKey(id);
  const cached = mediaCache[key] && mediaCache[key].photo;
  return isUsablePhoto(cached) ? String(cached) : '';
}
function setCoachMediaPhoto(id, photo){
  const key = coachMediaKey(id);
  const nextPhoto = isUsablePhoto(photo) ? String(photo) : '';
  return idbPutMedia(key, nextPhoto, '');
}
async function hydrateAllMedia(){
  const ids = roster.ids.length ? roster.ids : (player && player.id ? [player.id] : []);
  // Also pick up orphan kid records if roster was incomplete.
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(!k || !k.startsWith('ffk_kid_') || k.startsWith('ffk_kid_m_')) continue;
      const id = k.slice('ffk_kid_'.length);
      if(id && !ids.includes(id)) ids.push(id);
    }
  }catch(e){}
  for(const id of ids){
    const fromLs = readPlayerRecord(id, true);
    const rec = await idbGetMedia(id);
    let photo = (rec && rec.photo) || '';
    let cover = (rec && rec.cover) || '';
    if(!photo && fromLs && fromLs.photo) photo = fromLs.photo;
    if(!cover && fromLs && fromLs.cover) cover = fromLs.cover;
    mediaCache[id] = {photo, cover};
    if(photo || cover) await idbPutMedia(id, photo, cover);
    if(fromLs && (fromLs.photo || fromLs.cover)){
      try{ localStorage.setItem(kidPlayerKey(id), JSON.stringify(playerRecordForLs({...fromLs, id}))); }catch(e){}
    }
  }
  if(player && player.id){
    const cur = mediaCache[player.id] || {photo:'', cover:''};
    player.photo = cur.photo;
    player.cover = cur.cover;
    try{ localStorage.setItem(PLAYER_KEY, JSON.stringify(playerRecordForLs(player))); }catch(e){}
  }
}
async function hydrateCoachMedia(){
  try{
    const store = typeof CoachStore !== 'undefined' ? CoachStore : (window.CoachStore || null);
    const session = store && store.getSession && store.getSession();
    if(!store || !session || typeof store.myAcademy !== 'function') return;
    const academy = store.myAcademy(session);
    if(!academy || typeof store.listTeams !== 'function') return;
    const teams = store.listTeams(session, academy.id) || [];
    for(const team of teams){
      if(!team) continue;
      const players = store.listPlayers(session, team.id) || [];
      for(const tp of players){
        if(!tp || !tp.id) continue;
        const key = coachMediaKey(tp.id);
        const rec = await idbGetMedia(key);
        if(rec && (rec.photo || rec.cover)){
          mediaCache[key] = {photo: rec.photo || '', cover: rec.cover || ''};
        }else if(isUsablePhoto(tp.photo)){
          // Migrate legacy LS-embedded photos into IDB, then drop from coach DB later.
          mediaCache[key] = {photo: String(tp.photo), cover: ''};
          await idbPutMedia(key, String(tp.photo), '');
        }
      }
    }
  }catch(e){}
}

function loadSettings(){
  try{
    const repo = localRepo();
    const s = (repo && typeof repo.getSettings === 'function')
      ? (repo.getSettings() || {})
      : JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings = {
      club: String(s.club || '').slice(0,40),
      player: String(s.player || '').slice(0,40),
      position: ['fwd','mid','def','gk'].includes(s.position) ? s.position : 'fwd',
      format: (FORMAT_MIN[s.format] || s.format === 'custom') ? s.format : (Object.keys(FORMAT_MIN).find(k => FORMAT_MIN[k] === Number(s.minutes)) || '2x30'),
      minutes: String(s.minutes || '60'),
      lang: (s.langManual === true && LANGS.includes(s.lang)) ? s.lang : detectLang(),
      langManual: s.langManual === true,
      seasonCloseDeclined: String(s.seasonCloseDeclined || ''),
      theme: (s.theme === 'day' || s.theme === 'light') ? 'day' : 'dark',
      iconSet: (typeof ICON_SET_ORDER !== 'undefined' && ICON_SET_ORDER.includes(s.iconSet)) ? s.iconSet : 'clear',
      onboarded: s.onboarded === true,
      onboardSkin: String(s.onboardSkin || ''),
      isPro: s.isPro === true,
      isCoach: s.isCoach === true,
      coachSub: s.coachSub === true,
      coachSubPlan: String(s.coachSubPlan || ''),
      pwaTransferSeen: s.pwaTransferSeen === true,
      introMark: String(s.introMark || ''),
      accountPrompted: s.accountPrompted === true,
      devBilling: s.devBilling === true,
      shareMilestonesSeen: String(s.shareMilestonesSeen || '')
    };
    if(s.langManual !== true) saveSettings();
  }catch(e){}
}
function saveSettings(){
  const repo = localRepo();
  if(repo && typeof repo.setSettings === 'function'){
    repo.setSettings(settings);
    return;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function kidPlayerKey(id){
  const repo = localRepo();
  if(repo && typeof repo.playerKey === 'function') return repo.playerKey(id);
  return 'ffk_kid_' + id;
}
function kidMatchesKey(id){
  const repo = localRepo();
  if(repo && typeof repo.matchesKey === 'function') return repo.matchesKey(id);
  return 'ffk_kid_m_' + id;
}
function draftStorageKey(id){
  const repo = localRepo();
  if(repo && typeof repo.draftKey === 'function') return repo.draftKey(id || roster.currentId || 'x');
  return DRAFT_KEY + '_' + (id || roster.currentId || 'x');
}
function saveRoster(){
  const repo = localRepo();
  if(repo && typeof repo.setRoster === 'function'){
    repo.setRoster({currentId: roster.currentId, ids: roster.ids});
    return;
  }
  try{ localStorage.setItem(ROSTER_KEY, JSON.stringify({currentId: roster.currentId, ids: roster.ids})); }catch(e){}
}
function writePlayerRecord(id, p){
  const repo = localRepo();
  if(repo && typeof repo.setPlayer === 'function'){
    repo.setPlayer(id, p);
    return;
  }
  const row = {...p, id};
  mediaCache[id] = {photo: row.photo || '', cover: row.cover || ''};
  try{
    localStorage.setItem(kidPlayerKey(id), JSON.stringify(playerRecordForLs(row)));
  }catch(e){
    showToast(t('toastSaveFail'));
  }
  idbPutMedia(id, row.photo, row.cover);
}
function readPlayerRecord(id, rawLs){
  const repo = localRepo();
  if(repo && typeof repo.getPlayer === 'function'){
    const row = repo.getPlayer(id, {rawLs: !!rawLs});
    if(!row) return null;
    return rawLs ? row : normalizePlayer(row, id);
  }
  try{
    const raw = localStorage.getItem(kidPlayerKey(id));
    if(!raw) return null;
    const p = normalizePlayer(JSON.parse(raw), id);
    if(rawLs) return p;
    const m = mediaCache[id];
    if(m){
      p.photo = m.photo || '';
      p.cover = m.cover || '';
    }
    return p;
  }catch(e){ return null; }
}
/** Free/Pro players with hydrated photos — safe for Coach UI (other scripts can't see let roster). */
function listPersonalPlayersWithMedia(){
  const out = [];
  const seen = new Set();
  const repo = localRepo();
  let ids = [];
  try{
    if(repo && typeof repo.listPlayerIds === 'function'){
      ids = repo.listPlayerIds().map(String).filter(Boolean);
    }else{
      const stored = JSON.parse(localStorage.getItem(ROSTER_KEY) || 'null');
      if(stored && Array.isArray(stored.ids)) ids = stored.ids.map(String).filter(Boolean);
      try{
        const cur = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
        if(cur && cur.id){
          const cid = String(cur.id);
          if(!ids.includes(cid)) ids.unshift(cid);
        }
      }catch(e){}
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(!k || !k.startsWith('ffk_kid_') || k.startsWith('ffk_kid_m_')) continue;
        const id = k.slice('ffk_kid_'.length);
        if(id && !ids.includes(id)) ids.push(id);
      }
    }
  }catch(e){}
  ids.forEach(id => {
    const sid = String(id);
    if(seen.has(sid)) return;
    seen.add(sid);
    const p = readPlayerRecord(sid);
    if(!p) return;
    const photo = (mediaCache[sid] && mediaCache[sid].photo) || p.photo || '';
    if(!isUsablePhoto(photo) && !(p.firstName || p.lastName)) return;
    out.push({
      id: sid,
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      birthDate: p.birthDate || '',
      photo: isUsablePhoto(photo) ? photo : ''
    });
  });
  return out;
}
/** Personal profiles plus full match history for parent → coach synchronization. */
function listPersonalPlayerHistories(){
  const profiles = listPersonalPlayersWithMedia();
  const repo = localRepo();
  return profiles.map(profile => {
    let list = [];
    try{
      if(typeof roster !== 'undefined' && String(roster.currentId || '') === String(profile.id)
        && typeof matches !== 'undefined' && Array.isArray(matches)){
        list = matches.slice();
      }else if(repo && typeof repo.getMatches === 'function'){
        list = (repo.getMatches(profile.id) || []).map(normalizeMatch).filter(Boolean);
      }else{
        list = parseMatchList(localStorage.getItem(kidMatchesKey(profile.id))).list;
      }
    }catch(e){}
    return {...profile, matches: list};
  });
}
function parseMatchList(raw){
  const parsed = raw ? JSON.parse(raw) : [];
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.matches) ? parsed.matches : []);
  let dirty = false;
  const out = list.map(rawMatch => {
    if(rawMatch && typeof rawMatch === 'object' && !String(rawMatch.season || '').trim()) dirty = true;
    return normalizeMatch(rawMatch);
  }).filter(Boolean);
  return {list: out, dirty};
}

function loadPlayer(){
  try{
    const repo = localRepo();
    const stored = (repo && typeof repo.getRoster === 'function')
      ? repo.getRoster()
      : JSON.parse(localStorage.getItem(ROSTER_KEY) || 'null');
    if(stored && Array.isArray(stored.ids) && stored.ids.length){
      const repaired = (typeof repairRoster === 'function')
        ? repairRoster(stored, MAX_PLAYERS)
        : {roster: {
            ids: stored.ids.map(String).filter(Boolean).slice(0, MAX_PLAYERS),
            currentId: stored.ids.map(String).includes(String(stored.currentId))
              ? String(stored.currentId)
              : String(stored.ids[0])
          }, changed: false};
      roster.ids = repaired.roster.ids;
      roster.currentId = repaired.roster.currentId;
      if(repaired.changed) saveRoster();
      player = readPlayerRecord(roster.currentId);
      if(!player){
        try{
          const raw = (repo && repo.getJson)
            ? JSON.stringify(repo.getJson(PLAYER_KEY, null))
            : localStorage.getItem(PLAYER_KEY);
          const parsed = raw && raw !== 'null' ? JSON.parse(raw) : null;
          player = parsed ? normalizePlayer(parsed, roster.currentId) : normalizePlayer(defaultPlayer(), roster.currentId);
        }catch(e){ player = normalizePlayer(defaultPlayer(), roster.currentId); }
        writePlayerRecord(roster.currentId, player);
      }
    }
  }catch(e){ roster = {currentId:'', ids:[]}; player = null; }
  if(!roster.currentId || !roster.ids.length){
    try{
      const raw = localStorage.getItem(PLAYER_KEY);
      if(raw){
        player = normalizePlayer(JSON.parse(raw));
      } else {
        const name = splitLegacyName(settings.player);
        player = normalizePlayer({
          firstName: name.firstName || defaultPlayer().firstName,
          lastName: name.lastName,
          club: settings.club === 'FFK' ? 'FC FFK' : (settings.club || ''),
          primary: GROUP_TO_POS[settings.position] || 'RW',
          extra: settings.position === 'fwd' ? ['CM'] : [],
          season: currentSeason()
        });
      }
    }catch(e){ player = defaultPlayer(); }
    const id = player.id || newPlayerId();
    player.id = id;
    roster = {currentId: id, ids: [id]};
    writePlayerRecord(id, player);
    saveRoster();
    savePlayer();
  }
  extraSelected = [...(player.extra || [])];
  syncSettingsFromPlayer();
}
function normalizePlayer(p, id){
  const d = defaultPlayer();
  if(!p || typeof p !== 'object') return {...d, id: String(id || d.id || '')};
  const primary = isPitchCode(p.primary) ? p.primary : d.primary;
  const extra = Array.isArray(p.extra) ? [...new Set(p.extra.filter(x => isPitchCode(x) && x !== primary))] : [];
  const num = String(p.number ?? '').replace(/\D/g,'');
  return {
    id: String(p.id || id || '').slice(0, 32),
    firstName: String(p.firstName || '').slice(0,24),
    lastName: String(p.lastName || '').slice(0,32),
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate || '') ? p.birthDate : '',
    photo: String(p.photo || '').startsWith('data:image/') ? p.photo : '',
    cover: String(p.cover || '').startsWith('data:image/') ? p.cover : '',
    team: String(p.team || '').slice(0,40),
    club: String(p.club || '').slice(0,40),
    number: num ? String(Math.min(99, Number(num))) : '',
    primary,
    extra,
    season: String(p.season || currentSeason()).slice(0,16),
    seasonOpen: p.seasonOpen !== false
  };
}
function savePlayer(){
  if(!player.id){
    player.id = roster.currentId || newPlayerId();
    if(!roster.ids.includes(player.id)) roster.ids.push(player.id);
    roster.currentId = player.id;
    saveRoster();
  }
  writePlayerRecord(player.id, player);
  try{
    const repo = localRepo();
    if(repo && typeof repo.setActivePlayerMirror === 'function'){
      repo.setActivePlayerMirror(player);
    }else{
      localStorage.setItem(PLAYER_KEY, JSON.stringify(playerRecordForLs(player)));
    }
  }catch(e){
    showToast(t('toastSaveFail'));
  }
  try{
    if(window.ParentCloud && typeof window.ParentCloud.markPersonalDirty === 'function'){
      window.ParentCloud.markPersonalDirty();
    }
  }catch(e){}
}

function loadMatches(){
  try{
    const id = roster.currentId;
    const repo = localRepo();
    let list = [];
    let dirty = false;
    if(repo && typeof repo.getMatches === 'function'){
      list = (repo.getMatches(id) || []).map(rawMatch => {
        if(rawMatch && typeof rawMatch === 'object' && !String(rawMatch.season || '').trim()) dirty = true;
        return normalizeMatch(rawMatch);
      }).filter(Boolean);
    }else{
      const kidRaw = id ? localStorage.getItem(kidMatchesKey(id)) : null;
      let raw = kidRaw;
      const parsed = parseMatchList(raw);
      list = parsed.list;
      dirty = parsed.dirty;
      if((!list || !list.length) && roster.ids.length <= 1){
        const legacyRaw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
        if(legacyRaw && legacyRaw !== raw){
          const fallback = parseMatchList(legacyRaw);
          if(fallback.list.length){
            list = fallback.list;
            dirty = true;
          }
        }
      }
    }
    matches = list;
    if(typeof repairMatchList === 'function'){
      const fixed = repairMatchList(matches);
      if(fixed.changed){
        matches = fixed.matches;
        dirty = true;
      }
    }
    if(id && dirty) saveMatches();
  }catch(e){ matches = []; }
}
function saveMatches(){
  try{
    const repo = localRepo();
    if(repo && typeof repo.setMatches === 'function'){
      if(!repo.setMatches(roster.currentId, matches)) showToast(t('toastSaveFail'));
    }else{
      const json = JSON.stringify(matches);
      if(roster.currentId) localStorage.setItem(kidMatchesKey(roster.currentId), json);
      localStorage.setItem(STORAGE_KEY, json);
    }
  }catch(e){ showToast(t('toastSaveFail')); }
  try{
    if(window.ParentCloud && typeof window.ParentCloud.markPersonalDirty === 'function'){
      window.ParentCloud.markPersonalDirty();
    }
  }catch(e){}
}

function normalizeMatch(m){
  if(!m || typeof m !== 'object') return null;
  const kind = ['league','friendly','cup','tournament'].includes(m.kind) ? m.kind : 'league';
  const format = (FORMAT_MIN[m.format] || m.format === 'custom') ? m.format : '2x30';
  const matchLen = formatLength(format, m.matchLen || m.minutes);
  const minutes = Math.min(120, Math.max(1, Number(m.minutes) || matchLen));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : todayStr();
  const scored = calculateRating({
    counts: m.counts,
    behaviors: m.behaviors,
    position: m.position,
    pitchPos: m.pitchPos,
    minutes,
    matchLen
  });
  return {
    id: (Number(m.id) > 0 ? Math.floor(Number(m.id)) : 0) || Date.now(),
    player: String(m.player || displayName()),
    date,
    season: String(m.season || '').trim().slice(0,16) || seasonFromDate(date),
    opponent: String(m.opponent || ''),
    score: String(m.score || ''),
    position: scored.position,
    pitchPos: scored.pitchPos,
    team: String(m.team || player.team || player.club || '').trim().slice(0,40),
    tournament: String(m.tournament || '').slice(0,48),
    venue: m.venue === 'away' ? 'away' : 'home',
    role: m.role === 'sub' ? 'sub' : 'start',
    kind,
    format,
    matchLen,
    minutes,
    comment: String(m.comment || ''),
    counts: scored.counts,
    behaviors: scored.behaviorValues,
    timeline: normalizeTimeline(m.timeline),
    kickoffAt: Number(m.kickoffAt) || 0,
    kickoffClock: String(m.kickoffClock || '').slice(0, 24).replace(/[\s·]+$/, ''),
    actionRating: scored.action,
    effortRating: scored.effort,
    rating: scored.overall
  };
}
function normalizeTimeline(raw){
  if(!Array.isArray(raw)) return [];
  const out = [];
  raw.slice(0, 80).forEach(ev => {
    if(!ev || !ev.key) return;
    out.push({
      key: String(ev.key),
      at: Number(ev.at) || 0,
      minute: Math.max(1, Number(ev.minute) || 1),
      period: Math.max(1, Number(ev.period) || 1),
      inPeriod: Math.max(1, Number(ev.inPeriod) || Number(ev.minute) || 1)
    });
  });
  return out;
}
