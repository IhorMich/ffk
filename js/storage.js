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
const IDB_NAME = 'ffk';
const IDB_STORE = 'media';
const mediaCache = {};

function idbOpen(){
  return new Promise((resolve, reject) => {
    if(typeof indexedDB === 'undefined'){ reject(new Error('no idb')); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbGetMedia(id){
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(String(id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  })).catch(() => null);
}
function idbPutMedia(id, photo, cover){
  mediaCache[id] = {photo: photo || '', cover: cover || ''};
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({photo: photo || '', cover: cover || ''}, String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => {});
}
function idbDeleteMedia(id){
  delete mediaCache[id];
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => {});
}
function playerRecordForLs(p){
  return {...p, photo: '', cover: ''};
}
async function hydrateAllMedia(){
  const ids = roster.ids.length ? roster.ids : (player && player.id ? [player.id] : []);
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

function loadSettings(){
  try{
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
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
      pwaTransferSeen: s.pwaTransferSeen === true,
      introMark: String(s.introMark || '')
    };
    if(s.langManual !== true) saveSettings();
  }catch(e){}
}
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function kidPlayerKey(id){ return 'ffk_kid_' + id; }
function kidMatchesKey(id){ return 'ffk_kid_m_' + id; }
function draftStorageKey(id){ return DRAFT_KEY + '_' + (id || roster.currentId || 'x'); }
function saveRoster(){
  try{ localStorage.setItem(ROSTER_KEY, JSON.stringify({currentId: roster.currentId, ids: roster.ids})); }catch(e){}
}
function writePlayerRecord(id, p){
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
    const stored = JSON.parse(localStorage.getItem(ROSTER_KEY) || 'null');
    if(stored && Array.isArray(stored.ids) && stored.ids.length){
      roster.ids = stored.ids.map(String).filter(Boolean).slice(0, MAX_PLAYERS);
      roster.currentId = roster.ids.includes(String(stored.currentId)) ? String(stored.currentId) : roster.ids[0];
      player = readPlayerRecord(roster.currentId);
      if(!player){
        try{
          const raw = localStorage.getItem(PLAYER_KEY);
          player = raw ? normalizePlayer(JSON.parse(raw), roster.currentId) : normalizePlayer(defaultPlayer(), roster.currentId);
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
    localStorage.setItem(PLAYER_KEY, JSON.stringify(playerRecordForLs(player)));
  }catch(e){
    showToast(t('toastSaveFail'));
  }
}

function loadMatches(){
  try{
    const id = roster.currentId;
    const kidRaw = id ? localStorage.getItem(kidMatchesKey(id)) : null;
    let raw = kidRaw;
    if(!raw && roster.ids.length <= 1) raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    const {list, dirty} = parseMatchList(raw);
    matches = list;
    if(id && (dirty || (!kidRaw && matches.length))) saveMatches();
  }catch(e){ matches = []; }
}
function saveMatches(){
  try{
    const json = JSON.stringify(matches);
    if(roster.currentId) localStorage.setItem(kidMatchesKey(roster.currentId), json);
    localStorage.setItem(STORAGE_KEY, json);
  }catch(e){ showToast(t('toastSaveFail')); }
}

function normalizeMatch(m){
  if(!m || typeof m !== 'object') return null;
  const pitchPos = isPitchCode(m.pitchPos) ? m.pitchPos : (isPitchCode(m.position) ? m.position : (ratingPosOf(m.position) || 'fwd'));
  const pos = ratingPosOf(m.pitchPos || m.position);
  const counts = {};
  METRICS.forEach(x => counts[x.key] = Math.max(0, Number(m.counts?.[x.key]) || 0));
  const behaviors = {};
  BEHAVIOR.forEach(b => {
    const v = Number(m.behaviors?.[b.key]);
    behaviors[b.key] = v >= 1 && v <= 5 ? v : 3;
  });
  const kind = ['league','friendly','cup','tournament'].includes(m.kind) ? m.kind : 'league';
  const format = (FORMAT_MIN[m.format] || m.format === 'custom') ? m.format : '2x30';
  const matchLen = formatLength(format, m.matchLen || m.minutes);
  const minutes = Math.min(120, Math.max(1, Number(m.minutes) || matchLen));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : todayStr();
  const action = actionScore(counts, pos, minutes, matchLen);
  const effort = effortScore(behaviors);
  return {
    id: Number(m.id) || Date.now(),
    player: String(m.player || displayName()),
    date,
    season: String(m.season || '').trim().slice(0,16) || seasonFromDate(date),
    opponent: String(m.opponent || ''),
    score: String(m.score || ''),
    position: pos,
    pitchPos,
    team: String(m.team || player.team || player.club || '').trim().slice(0,40),
    tournament: String(m.tournament || '').slice(0,48),
    venue: m.venue === 'away' ? 'away' : 'home',
    role: m.role === 'sub' ? 'sub' : 'start',
    kind,
    format,
    matchLen,
    minutes,
    comment: String(m.comment || ''),
    counts, behaviors,
    timeline: normalizeTimeline(m.timeline),
    kickoffAt: Number(m.kickoffAt) || 0,
    kickoffClock: String(m.kickoffClock || '').slice(0, 24).replace(/[\s·]+$/, ''),
    actionRating: action,
    effortRating: effort,
    rating: overallScore(counts, behaviors, pos, minutes, matchLen)
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
