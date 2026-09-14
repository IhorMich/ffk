const STORAGE_KEY = 'ffk_matches_v2';
const LEGACY_KEY = 'football_matches';
const DRAFT_KEY = 'ffk_draft';
const VIEW_KEY = 'ffk_view';
const EXPORT_KEY = 'ffk_last_export';
const SETTINGS_KEY = 'ffk_settings';
const FILTER_KEY = 'ffk_filters_v1';
const PLAYER_KEY = 'ffk_player_v1';
const ROSTER_KEY = 'ffk_roster_v1';
const MAX_PLAYERS = 8;
const ROLE_CODES = ['gk','def','mid','fwd'];
const POS_CODES = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'];
const POS_GROUP = {
  GK:'gk', CB:'def', LB:'def', RB:'def', LWB:'def', RWB:'def',
  CDM:'mid', CM:'mid', CAM:'mid', LM:'mid', RM:'mid',
  LW:'fwd', RW:'fwd', ST:'fwd', CF:'fwd'
};
const GROUP_TO_POS = {gk:'GK', def:'CB', mid:'CM', fwd:'RW'};

function langLatin(){
  return LANG_LATIN.includes(settings.lang);
}
function detectLang(){
  const list = [navigator.language].concat(navigator.languages || []);
  for(const raw of list){
    const s = String(raw || '').toLowerCase();
    if(!s) continue;
    if(s.startsWith('uk') || s.startsWith('ua')) return 'uk';
    const two = s.slice(0, 2);
    if(LANGS.includes(two)) return two;
  }
  return 'en';
}
function t(key, vars){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || I18N.ru[key] || key;
  if(vars) Object.keys(vars).forEach(k => { s = s.split('{'+k+'}').join(vars[k]); });
  return s;
}
function applyFont(){
  document.documentElement.style.setProperty('--font', APP_FONT);
}
function isLightTheme(){ return settings.theme === 'light'; }
function applyTheme(){
  const light = isLightTheme();
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = light ? '#F3F5FA' : '#0B1220';
  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(apple) apple.content = light ? 'default' : 'black-translucent';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = light ? '☾' : '☀';
    btn.setAttribute('aria-label', t('themeAria'));
  });
}
function toggleTheme(){
  settings.theme = isLightTheme() ? 'dark' : 'light';
  saveSettings();
  applyTheme();
  if(typeof chartMatches === 'function') drawChart(chartMatches());
}
function cssVar(name, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function canvasFont(weight, size){
  return weight + ' ' + size + 'px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
}
function metricLabel(key){ return t('m_'+key); }
function profileMetricLabel(key){
  const custom = t('pf_'+key);
  return (!custom || custom === 'pf_'+key) ? metricLabel(key) : custom;
}
function behaviorLabel(key){ return t('b_'+key); }
function posLabel(key){ return ({fwd:t('posFwd'), mid:t('posMid'), def:t('posDef'), gk:t('posGk')})[key] || key; }
function isRoleCode(code){ return ROLE_CODES.includes(code); }
function isPosCode(code){ return POS_CODES.includes(code); }
function isPitchCode(code){ return isRoleCode(code) || isPosCode(code); }
function pitchPosLabel(code){
  if(isRoleCode(code)) return posLabel(code);
  if(!isPosCode(code)) return code;
  const name = t('pc_'+code);
  if(name === 'pc_'+code) return code;
  return name === code ? code : `${name} (${code})`;
}
function pitchPosLabelShort(code){
  if(isRoleCode(code)) return posLabel(code);
  if(!isPosCode(code)) return code;
  const name = t('ps_'+code);
  if(name === 'ps_'+code || name === code) return code;
  return `${name} (${code})`;
}
function ratingPosOf(code){
  if(POS_GROUP[code]) return POS_GROUP[code];
  if(isRoleCode(code)) return code;
  return guessPos(code);
}
function defaultPitch(){
  if(isPitchCode(player.primary)) return player.primary;
  return isRoleCode(settings.position) ? settings.position : 'fwd';
}
function orderedPitchCodes(){
  const pref = [player.primary, ...(player.extra || [])].filter(c => isPosCode(c));
  return [...new Set(pref.concat(POS_CODES))];
}
function posSelectHtml(short){
  const lab = code => escapeHtml(short ? pitchPosLabelShort(code) : pitchPosLabel(code));
  const roles = ROLE_CODES.map(code => `<option value="${code}">${lab(code)}</option>`).join('');
  const details = orderedPitchCodes().map(code => `<option value="${code}">${lab(code)}</option>`).join('');
  return `<optgroup label="${escapeHtml(t('posBasic'))}">${roles}</optgroup><optgroup label="${escapeHtml(t('posExtended'))}">${details}</optgroup>`;
}
function fillPitchSelect(sel, preferred, short){
  const want = isPitchCode(preferred) ? preferred : (isPitchCode(sel.value) ? sel.value : defaultPitch());
  sel.innerHTML = posSelectHtml(short !== false);
  sel.value = isPitchCode(want) ? want : defaultPitch();
}
function fillMatchPitchSelects(preferred){
  fillPitchSelect(document.getElementById('f-position'), preferred, true);
  fillPitchSelect(document.getElementById('live-position'), document.getElementById('f-position').value, true);
}
function matchPosDisplay(m){
  if(isPitchCode(m.pitchPos)) return pitchPosLabel(m.pitchPos);
  if(isPitchCode(m.position)) return pitchPosLabel(m.position);
  return posLabel(ratingPosOf(m.position));
}
function venueLabel(v){ return v === 'away' ? t('venueAway') : t('venueHome'); }
function roleLabel(r){ return r === 'sub' ? t('roleSub') : t('roleStart'); }
function kindLabel(key){ return ({league:t('kindLeague'), friendly:t('kindFriendly'), cup:t('kindCup'), tournament:t('kindTournament')})[key] || key; }
function syncCompetitionField(){
  const kind = document.getElementById('f-kind').value;
  const wrap = document.getElementById('tournamentWrap');
  const label = document.getElementById('tournamentLabel');
  const input = document.getElementById('f-tournament');
  if(kind === 'friendly'){
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  if(kind === 'league'){
    label.textContent = t('labelCompLeague');
    input.placeholder = t('phCompLeague');
  } else if(kind === 'cup'){
    label.textContent = t('labelCompCup');
    input.placeholder = t('phCompCup');
  } else {
    label.textContent = t('labelCompTournament');
    input.placeholder = t('phTournament');
  }
}
function applyI18n(){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  document.documentElement.lang = LANG_HTML[lang] || lang;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('.tabbtn').forEach(b => {
    const lab = b.querySelector('.tab-lab');
    if(lab) b.setAttribute('aria-label', lab.textContent);
  });
  document.querySelectorAll('input[type=date]').forEach(el => { el.lang = LANG_HTML[lang] || lang; });
  renderMetrics();
  renderBehaviors();
  renderLiveGrid();
  renderFocusBanner();
  fillSeasonSelects();
  syncSeasonUi();
  renderHistory();
  renderStats();
  updateHero();
  setEditUi(!!editingId);
  applyHeader();
  fillPrimarySelect();
  fillMatchPitchSelects(document.getElementById('f-position').value);
  renderExtraChips();
  syncCompetitionField();
  syncDateShown();
  updatePhotoMeta();
  renderRoster();
  if(lastReportMatch){
    document.getElementById('reportCard').innerHTML = renderReportHtml(lastReportMatch);
    document.getElementById('reportStory').innerHTML = matchStoryHtml(lastReportMatch);
  }
  renderLiveClock();
}
const BASE_RATING = 6.0;

const METRICS = [
  {key:'goals', icon:'⚽', positions:['fwd','mid','def'], live:['fwd','mid'], w:{fwd:0.7, mid:0.55, def:0.45, gk:0}},
  {key:'shots', icon:'🥅', positions:['fwd','mid'], live:['fwd'], w:{fwd:0.2, mid:0.15, def:0, gk:0}},
  {key:'assists', icon:'🎯', positions:['fwd','mid','def'], live:['fwd','mid'], w:{fwd:0.5, mid:0.5, def:0.35, gk:0}},
  {key:'dribbles', icon:'🌀', positions:['fwd','mid'], live:['fwd'], w:{fwd:0.15, mid:0.1, def:0, gk:0}},
  {key:'openings', icon:'🏃', positions:['fwd'], live:['fwd'], w:{fwd:0.2, mid:0, def:0, gk:0}},
  {key:'chances', icon:'✨', positions:['mid'], live:['mid'], w:{fwd:0, mid:0.32, def:0, gk:0}},
  {key:'passes', icon:'📤', positions:['fwd','mid','def'], live:['fwd','mid'], w:{fwd:0.15, mid:0.25, def:0.15, gk:0}},
  {key:'buildpass', icon:'➡', positions:['mid','def','gk'], live:['mid','def','gk'], w:{fwd:0, mid:0.07, def:0.1, gk:0.12}},
  {key:'tackles', icon:'🛡', positions:['fwd','mid','def'], live:['mid','def'], w:{fwd:0.1, mid:0.25, def:0.4, gk:0}},
  {key:'interceptions', icon:'🪝', positions:['mid','def','gk'], live:['def','gk'], w:{fwd:0, mid:0.18, def:0.35, gk:0.28}},
  {key:'clearances', icon:'🧹', positions:['def'], live:['def'], w:{fwd:0, mid:0, def:0.22, gk:0}},
  {key:'blocks', icon:'🧱', positions:['def'], live:['def'], w:{fwd:0, mid:0, def:0.28, gk:0}},
  {key:'duelswon', icon:'💪', positions:['fwd','mid','def'], live:['mid','def'], w:{fwd:0.1, mid:0.2, def:0.3, gk:0}},
  {key:'support', icon:'🤝', positions:['fwd','mid','def'], live:[], w:{fwd:0.15, mid:0.2, def:0.25, gk:0}},
  {key:'saves', icon:'🧤', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:0.4}},
  {key:'claims', icon:'🪂', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:0.3}},
  {key:'gkpass', icon:'👟', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:0.15}},
  {key:'conceded', icon:'📉', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:-0.18}},
  {key:'losses', icon:'✖', positions:['fwd','mid','def'], live:['fwd','mid','def'], w:{fwd:-0.2, mid:-0.15, def:-0.1, gk:0}},
  {key:'ledtogoal', icon:'⛔', positions:['fwd','mid','def','gk'], live:['def','gk'], w:{fwd:-0.8, mid:-0.8, def:-0.85, gk:-0.55}},
  {key:'badpass', icon:'↩', positions:['fwd','mid','def','gk'], live:[], w:{fwd:-0.1, mid:-0.15, def:-0.1, gk:-0.15}},
  {key:'badtouch', icon:'🫳', positions:['fwd','mid','def'], live:[], w:{fwd:-0.1, mid:-0.1, def:-0.1, gk:0}},
  {key:'duelslost', icon:'🤼', positions:['fwd','mid','def'], live:[], w:{fwd:-0.1, mid:-0.15, def:-0.25, gk:0}},
  {key:'fouls', icon:'🟨', positions:['fwd','mid','def','gk'], live:[], w:{fwd:-0.25, mid:-0.25, def:-0.2, gk:-0.2}},
  {key:'owngoal', icon:'😬', positions:['fwd','mid','def','gk'], live:[], w:{fwd:-1, mid:-1, def:-1, gk:-1}},
];
const BEHAVIOR = [
  {key:'effort', inRating:true},
  {key:'team', inRating:true},
  {key:'coach', inRating:true},
  {key:'discipline', inRating:true},
  {key:'mood', inRating:false},
];

let settings = {club:'', player:'', position:'fwd', format:'2x30', minutes:'60', lang:'ru', seasonCloseDeclined:'', theme:'dark'};
let roster = {currentId:'', ids:[]};
let player = defaultPlayer();
let extraSelected = [];
let photoDraft;
let coverDraft;
let photoSheetTarget = 'photo';
let lastReportMatch = null;
let matches = [];
let editingId = null;
let form = emptyForm();
let liveStack = [];
let matchClock = emptyClock();
let liveClockTimer = 0;
const WARSAW_TZ = 'Europe/Warsaw';
function emptyClock(){
  return {startedAt:null, pausedAt:null, pauseMs:0, events:[], period:1, phase:'idle', periodPlayMs:0, periodRunAt:null, playMs:0};
}

function emptyForm(){
  const counts = {}, behaviors = {};
  METRICS.forEach(m => counts[m.key] = 0);
  BEHAVIOR.forEach(b => behaviors[b.key] = 3);
  return {counts, behaviors};
}
function currentPitch(){
  const v = document.getElementById('f-position').value;
  return isPitchCode(v) ? v : defaultPitch();
}
function currentPos(){ return ratingPosOf(document.getElementById('f-position').value || defaultPitch()); }
function metricsFor(pos){ return METRICS.filter(m => m.positions.includes(pos)); }
function weightOf(m, pos){ return m.w[pos] ?? 0; }
function clamp10(n){ return Math.round(Math.max(0, Math.min(10, n)) * 10) / 10; }

const FORMAT_MIN = { '3x15':45, '3x20':60, '3x25':75, '2x25':50, '2x30':60, '2x35':70, '2x40':80, '2x45':90 };
function formatLength(id, custom){
  if(id === 'custom') return Math.min(120, Math.max(1, Number(custom) || 60));
  return FORMAT_MIN[id] || 60;
}
function periodShape(fmt, custom){
  fmt = fmt || document.getElementById('f-format')?.value || '2x30';
  if(custom === undefined) custom = document.getElementById('f-matchlen')?.value;
  const m = String(fmt).match(/^(\d+)x(\d+)$/);
  if(m) return {parts: Number(m[1]), each: Number(m[2])};
  const len = formatLength(fmt, custom);
  return {parts: 2, each: Math.max(1, Math.round(len / 2))};
}
function formatTag(fmt, custom){
  const {parts, each} = periodShape(fmt, custom);
  return parts + '×' + each;
}
function clockPhase(){
  if(matchClock.phase) return matchClock.phase;
  if(!matchClock.startedAt) return 'idle';
  if(matchClock.pausedAt) return 'break';
  return 'run';
}
function warsawClock(ms){
  try{
    return new Intl.DateTimeFormat('pl-PL', {timeZone: WARSAW_TZ, hour:'2-digit', minute:'2-digit', hour12:false}).format(new Date(ms));
  }catch(e){
    const d = new Date(ms);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
}
function halfLabel(n, fmt, custom){
  const {parts} = periodShape(fmt, custom);
  n = Math.max(1, Number(n) || 1);
  if(parts !== 2) return t('clockHalfN', {n});
  if(n === 1) return t('clockHalf1');
  if(n === 2) return t('clockHalf2');
  return t('clockHalfN', {n});
}
function periodPlayNow(now){
  now = now || Date.now();
  let ms = Number(matchClock.periodPlayMs) || 0;
  if(clockPhase() === 'run' && matchClock.periodRunAt) ms += Math.max(0, now - matchClock.periodRunAt);
  return Math.max(0, ms);
}
function playingMs(now){
  now = now || Date.now();
  const frozen = Number(matchClock.playMs) || 0;
  if(clockPhase() === 'run') return frozen + periodPlayNow(now);
  return frozen + (Number(matchClock.periodPlayMs) || 0);
}
function clockStamp(now){
  now = now || Date.now();
  const {parts, each} = periodShape();
  const period = Math.min(parts, Math.max(1, Number(matchClock.period) || 1));
  const playMin = periodPlayNow(now) / 60000;
  const minute = Math.max(1, Math.floor(playMin));
  const matchMin = Math.max(1, Math.floor(playingMs(now) / 60000));
  return {clock: warsawClock(now), period, minute, matchMin, playMin, each, parts};
}
function hydrateClock(raw){
  const base = emptyClock();
  if(!raw || typeof raw !== 'object') return base;
  const events = Array.isArray(raw.events) ? raw.events : [];
  if(raw.phase){
    return {
      startedAt: Number(raw.startedAt) || null,
      pausedAt: Number(raw.pausedAt) || null,
      pauseMs: Number(raw.pauseMs) || 0,
      events,
      period: Math.max(1, Number(raw.period) || 1),
      phase: raw.phase,
      periodPlayMs: Number(raw.periodPlayMs) || 0,
      periodRunAt: Number(raw.periodRunAt) || null,
      playMs: Number(raw.playMs) || 0
    };
  }
  const startedAt = Number(raw.startedAt) || null;
  if(!startedAt) return {...base, events};
  const pausedAt = Number(raw.pausedAt) || null;
  const pauseMs = Number(raw.pauseMs) || 0;
  const end = pausedAt || Date.now();
  const played = Math.max(0, end - startedAt - pauseMs);
  const {parts, each} = periodShape();
  const eachMs = each * 60000;
  const period = Math.min(parts, Math.max(1, Math.floor(played / eachMs) + 1));
  const periodPlayMs = played - (period - 1) * eachMs;
  const phase = pausedAt ? (period >= parts && periodPlayMs >= eachMs * 0.95 ? 'done' : 'break') : 'run';
  return {
    startedAt, pausedAt, pauseMs: 0, events,
    period, phase, periodPlayMs,
    periodRunAt: phase === 'run' ? Date.now() - periodPlayMs : null,
    playMs: (period - 1) * eachMs
  };
}
function syncPlayedDefault(fromSettings){
  const fmt = document.getElementById('f-format').value;
  const custom = document.getElementById('f-matchlen').value;
  const len = formatLength(fmt, custom);
  document.getElementById('customLengthWrap').hidden = fmt !== 'custom';
  if(fromSettings) document.getElementById('f-minutes').value = String(len);
}
function behaviorAvg(behaviors){
  const rated = BEHAVIOR.filter(b => b.inRating).map(b => Number(behaviors[b.key]) || 3);
  return rated.reduce((a,b)=>a+b,0) / rated.length;
}
function stackedWeight(n, w){
  n = Math.max(0, Math.floor(Number(n)||0));
  if(!n || !w) return 0;
  const decay = w < 0 ? 0.75 : 0.88;
  let sum = 0;
  for(let i=0;i<n;i++) sum += w * Math.pow(decay, i);
  return sum;
}
function actionSum(counts, pos){
  let sum = 0;
  metricsFor(pos).forEach(m => sum += stackedWeight(counts[m.key], weightOf(m, pos)));
  return sum;
}
function actionScore(counts, pos){
  return clamp10(BASE_RATING + actionSum(counts, pos));
}
function effortScore(behaviors){
  return clamp10(BASE_RATING + (behaviorAvg(behaviors) - 3) * 2);
}
function overallScore(counts, behaviors, pos){
  return clamp10(BASE_RATING + actionSum(counts, pos) + (behaviorAvg(behaviors) - 3) * 0.5);
}
function fmtNum(n, digits){
  const s = Number(n).toFixed(digits);
  return settings.lang === 'en' ? s : s.replace('.', ',');
}
function fmtRating(r){
  const n = Math.round(Number(r) * 10) / 10;
  return fmtNum(n, Math.abs(n - Math.round(n)) < 0.05 ? 0 : 1);
}
function fmtSigned(n, digits){
  const abs = fmtNum(Math.abs(n), digits);
  if(n > 0) return '+'+abs;
  if(n < 0) return '−'+abs;
  return (settings.lang === 'en' ? '+' : '+') + fmtNum(0, digits);
}
function slavicForm(n){
  const n10 = n % 10, n100 = n % 100;
  if(n10 === 1 && n100 !== 11) return 0;
  if(n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 1;
  return 2;
}
function metricNoun(key, n){
  const parts = String(t('mn_'+key) || '').split('|');
  if(parts[0] === 'mn_'+key || !parts[0]) return metricLabel(key).toLowerCase();
  if(langLatin()) return n === 1 ? parts[0] : (parts[1] || parts[0]);
  return parts[slavicForm(n)] || parts[0];
}
function actionSplit(counts, pos){
  let plus = 0, minus = 0;
  metricsFor(pos).forEach(m => {
    const v = stackedWeight(counts[m.key], weightOf(m, pos));
    if(v > 0) plus += v;
    else if(v < 0) minus += v;
  });
  return {plus: Math.round(plus * 100) / 100, minus: Math.round(minus * 100) / 100};
}
function goalMinutes(m){
  return (Array.isArray(m.timeline) ? m.timeline : [])
    .filter(ev => ev && ev.key === 'goals')
    .map(ev => Math.max(1, Number(ev.minute) || 1));
}
function eventSign(key, pos){
  const met = METRICS.find(x => x.key === key);
  if(!met) return 0;
  const w = weightOf(met, pos);
  if(w > 0) return 1;
  if(w < 0) return -1;
  return 0;
}
function timedEvents(m){
  const pos = ['fwd','mid','def','gk'].includes(m.position) ? m.position : ratingPosOf(m.position || m.pitchPos);
  const {parts, each} = periodShape(m.format, m.matchLen);
  const totalMin = Math.max(parts * each, Number(m.matchLen) || 0, Number(m.minutes) || 0, 1);
  const lateFrom = Math.max(2, totalMin - Math.min(12, Math.max(6, Math.round(each * 0.35))));
  const earlyTo = Math.min(10, Math.max(6, Math.round(each * 0.4)));
  return (Array.isArray(m.timeline) ? m.timeline : []).filter(ev => ev && ev.key).map(ev => {
    const minute = Math.max(1, Number(ev.minute) || 1);
    const period = Math.min(parts, Math.max(1, Number(ev.period) || Math.floor((minute - 1) / each) + 1));
    return {key: ev.key, minute, period, parts, each, sign: eventSign(ev.key, pos), late: minute >= lateFrom, early: minute <= earlyTo, lateFrom, earlyTo};
  });
}
function skewPeriod(events, sign, parts){
  const pool = events.filter(e => e.sign === sign);
  if(pool.length < 4) return null;
  const buckets = Array(parts).fill(0);
  pool.forEach(e => { buckets[e.period - 1]++; });
  let maxI = 0;
  buckets.forEach((v, i) => { if(v > buckets[maxI]) maxI = i; });
  const share = buckets[maxI] / pool.length;
  if(buckets[maxI] < 3 || share < (1 / parts) + 0.17) return null;
  return {period: maxI + 1, n: buckets[maxI], total: pool.length, pct: Math.round(share * 100)};
}
function edgeShare(events, sign, edge){
  const pool = events.filter(e => e.sign === sign);
  if(pool.length < 4) return null;
  const hit = pool.filter(e => e[edge]).length;
  if(hit < 3 || hit / pool.length < 0.55) return null;
  return {n: hit, total: pool.length, from: pool[0].lateFrom, earlyTo: pool[0].earlyTo, pct: Math.round(100 * hit / pool.length)};
}
function topKey(events, sign){
  const map = {};
  events.filter(e => e.sign === sign).forEach(e => { map[e.key] = (map[e.key] || 0) + 1; });
  const key = Object.keys(map).sort((a,b)=> map[b] - map[a])[0];
  if(!key || map[key] < 2) return null;
  return {key, n: map[key]};
}
function goalBand(list){
  const mins = [];
  list.forEach(m => goalMinutes(m).forEach(x => mins.push(x)));
  if(mins.length < 4) return null;
  const bands = [[1,15,0],[16,30,0],[31,45,0],[46,60,0],[61,90,0]];
  mins.forEach(m => {
    const b = bands.find(x => m >= x[0] && m <= x[1]) || bands[bands.length - 1];
    b[2]++;
  });
  bands.sort((a,c)=> c[2] - a[2]);
  const best = bands[0];
  if(best[2] < 3 || best[2] / mins.length < 0.45) return null;
  return {a: best[0], b: best[1], k: best[2], n: mins.length};
}
function matchStoryLines(m){
  const who = m.opponent || t('unnamed');
  const fmt = formatTag(m.format, m.matchLen);
  const lines = [];
  if(m.kickoffClock) lines.push(t('storyOpen', {who, kick: m.kickoffClock, fmt}));
  else lines.push(t('storyOpenNoKick', {who, fmt}));
  const ev = timedEvents(m);
  const goals = goalMinutes(m);
  if(goals.length) lines.push(t('storyGoals', {mins: goals.map(x => t('minLbl', {n:x})).join(', ')}));
  if(!ev.length){
    lines.push(t('storyNoTime'));
    lines.push(t('storyNeedClock'));
    return lines;
  }
  if(ev.length < 4){
    lines.push(t('storyThin', {n: ev.length}));
    return lines;
  }
  const parts = ev[0].parts;
  const plusH = skewPeriod(ev, 1, parts);
  const minusH = skewPeriod(ev, -1, parts);
  if(plusH) lines.push(t('storyPlusHalf', {half: halfLabel(plusH.period, m.format, m.matchLen), a: plusH.n, n: plusH.total, p: plusH.pct}));
  if(minusH) lines.push(t('storyMinusHalf', {half: halfLabel(minusH.period, m.format, m.matchLen), a: minusH.n, n: minusH.total, p: minusH.pct}));
  const late = edgeShare(ev, -1, 'late');
  if(late) lines.push(t('storyLateMinus', {n: late.total, a: late.n, m: late.from}));
  const early = edgeShare(ev, 1, 'early');
  if(early) lines.push(t('storyEarlyPlus', {n: early.total, a: early.n, m: early.earlyTo}));
  const mainP = topKey(ev, 1);
  if(mainP) lines.push(t('storyMainPlus', {what: metricLabel(mainP.key).toLowerCase(), n: mainP.n}));
  const mainM = topKey(ev, -1);
  if(mainM) lines.push(t('storyMainMinus', {what: metricLabel(mainM.key).toLowerCase(), n: mainM.n}));
  if(!plusH && !minusH && !late && !early) lines.push(t('storyEven'));
  return lines;
}
function periodStoryLines(list){
  const timed = list.filter(m => timedEvents(m).length);
  if(timed.length < 4){
    return [t(timed.length ? 'repNeed' : 'repNone', {n: timed.length})];
  }
  let used = 0, tilt = 0, firstM = 0, lastM = 0, firstP = 0, lastP = 0;
  const all = [];
  timed.forEach(m => {
    const ev = timedEvents(m);
    if(ev.length < 3) return;
    used++;
    all.push(...ev);
    const aM = ev.filter(e => e.sign < 0 && e.period === 1).length;
    const bM = ev.filter(e => e.sign < 0 && e.period === e.parts).length;
    const aP = ev.filter(e => e.sign > 0 && e.period === 1).length;
    const bP = ev.filter(e => e.sign > 0 && e.period === e.parts).length;
    firstM += aM; lastM += bM; firstP += aP; lastP += bP;
    if(bM > aM) tilt++;
  });
  const lines = [];
  if(used < 4 || firstM + lastM < 10){
    lines.push(t('repNeed', {n: timed.length}));
  } else if(tilt / used >= 0.6 && lastM >= firstM * 1.25){
    lines.push(t('repMinusLast', {k: tilt, n: used, a: lastM, b: firstM}));
  }
  if(used >= 4 && firstP + lastP >= 10 && firstP >= lastP * 1.25){
    lines.push(t('repPlusFirst', {a: firstP, b: lastP, n: used}));
  }
  const late = edgeShare(all, -1, 'late');
  if(late) lines.push(t('repLate', {p: late.pct, m: late.from, a: late.n, n: late.total}));
  const band = goalBand(timed);
  if(band) lines.push(t('repGoalsBand', {a: band.a, b: band.b, k: band.k, n: band.n}));
  if(!lines.length) lines.push(t('storyEven'));
  return lines;
}
function storyBoxHtml(title, lines){
  if(!lines.length) return '';
  const head = title ? `<h3>${escapeHtml(title)}</h3>` : '';
  return `<div class="story-box">${head}${lines.map(x => `<p>${escapeHtml(x)}</p>`).join('')}</div>`;
}
function matchStoryHtml(m){
  return storyBoxHtml(t('storyTitle'), matchStoryLines(m));
}
function monthMatches(){
  const prefix = todayStr().slice(0, 7);
  return matches.filter(m => String(m.date).slice(0, 7) === prefix);
}
function yearMatches(){
  const y = todayStr().slice(0, 4);
  return matches.filter(m => String(m.date).slice(0, 4) === y);
}
function daysMatches(n){
  return matches.filter(m => m.date >= daysAgoStr(n));
}
function liveSeasonMatches(){
  const s = currentSeason();
  return sortedMatches().filter(m => matchSeason(m) === s);
}
function timingMatches(){
  if(timingRange === '10d') return daysMatches(10);
  if(timingRange === 'month') return monthMatches();
  if(timingRange === 'year') return yearMatches();
  if(timingRange === 'all') return sortedMatches();
  return liveSeasonMatches();
}
let timingOpen = false;
let timingRange = '10d';
function renderTimingBoard(){
  const el = document.getElementById('timingBoard');
  if(!el) return;
  const chips = [
    ['10d', t('period10d')],
    ['month', t('periodMonth')],
    ['year', t('periodYear')],
    ['season', currentSeason()],
    ['all', t('periodAll')]
  ].map(([key, lab]) => `<button type="button" class="chip${timingRange === key ? ' active' : ''}" data-timing="${key}">${escapeHtml(lab)}</button>`).join('');
  el.innerHTML = `<div class="timing-fold">
      <button type="button" class="timing-row" id="timingToggle">
        <span>${escapeHtml(t('repFold'))}</span>
        <span class="timing-chev">${timingOpen ? '▾' : '›'}</span>
      </button>
      <div id="timingMenu" ${timingOpen ? '' : 'hidden'}>
        <div class="period-chips" id="timingChips">${chips}</div>
        ${storyBoxHtml('', periodStoryLines(timingMatches()))}
      </div>
    </div>`;
  document.getElementById('timingToggle').addEventListener('click', () => {
    timingOpen = !timingOpen;
    renderTimingBoard();
  });
  document.getElementById('timingChips')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-timing]');
    if(!chip) return;
    timingRange = chip.dataset.timing || '10d';
    timingOpen = true;
    renderTimingBoard();
  });
}
function reportLines(m){
  const pos = ['fwd','mid','def','gk'].includes(m.position) ? m.position : ratingPosOf(m.position);
  const counts = m.counts || {};
  const lines = [];
  let duelsDone = false;
  metricsFor(pos).forEach(met => {
    if(met.key === 'duelswon' || met.key === 'duelslost'){
      if(duelsDone) return;
      duelsDone = true;
      const w = counts.duelswon || 0, l = counts.duelslost || 0;
      if(w + l > 0) lines.push({icon:'💪', text: `${w}/${w+l} ${t('mn_duels')}`});
      return;
    }
    const n = counts[met.key] || 0;
    if(!n) return;
    let extra = '';
    if(met.key === 'goals'){
      const mins = goalMinutes(m);
      if(mins.length) extra = ' · ' + mins.map(x => t('minLbl', {n:x})).join(', ');
    }
    lines.push({icon: met.icon, text: `${n} ${metricNoun(met.key, n)}${extra}`});
  });
  return lines;
}
function reportPlayerName(m){
  return (player.firstName || String(m.player || '').trim().split(/\s+/)[0] || '—');
}
function renderReportHtml(m, compact){
  const split = actionSplit(m.counts, m.position);
  const lines = reportLines(m);
  const vs = `${escapeHtml(m.opponent || t('unnamed'))}${m.score ? ' · ' + escapeHtml(m.score) : ''}`;
  const kick = m.kickoffClock ? escapeHtml(t('kickoffLine', {clock: m.kickoffClock})) : '';
  const meta = `<div class="report-sub"><span>${vs}</span>${kick ? `<span>${kick}</span>` : ''}</div>`;
  const head = compact ? meta : `<div class="report-kicker">${escapeHtml(t('reportTitle'))}</div>
    <div class="report-title">${escapeHtml(reportPlayerName(m))} — <span class="n">${fmtNum(m.rating, 1)}</span></div>
    ${meta}
    <div class="report-sub"><span>${escapeHtml(t('heroAction'))} ${fmtNum(m.actionRating, 1)}</span><span>${escapeHtml(t('heroEffort'))} ${fmtNum(m.effortRating, 1)}</span></div>`;
  const body = lines.length
    ? lines.map(x => `<div class="report-line"><span class="ic">${x.icon}</span><span>${escapeHtml(x.text)}</span></div>`).join('')
    : `<div class="report-line">${escapeHtml(t('plusEven'))}</div>`;
  return `${head}${body}
    <div class="report-split">
      <div class="report-pill plus">${fmtSigned(Math.max(0, split.plus), 2)}<small>${escapeHtml(t('actPlus'))}</small></div>
      <div class="report-pill minus">${'−' + fmtNum(Math.abs(split.minus), 2)}<small>${escapeHtml(t('actMinus'))}</small></div>
    </div>`;
}

function ratingClass(r){
  if(r < 5.5) return 'low';
  if(r < 7.5) return 'mid';
  return '';
}
function countOf(m, key){ return Math.max(0, Math.floor(Number(m?.counts?.[key]) || 0)); }
function behaviorOf(m, key){ return Number(m?.behaviors?.[key]) || 3; }
function matchIsBlank(m){
  const acted = METRICS.some(x => countOf(m, x.key) > 0);
  const shifted = BEHAVIOR.some(b => b.inRating && behaviorOf(m, b.key) !== 3);
  return !acted && !shifted;
}
function scoreSides(s){
  const m = String(s || '').match(/(\d+)\s*[:\-–]\s*(\d+)/);
  if(!m) return null;
  return {us: Number(m[1]), them: Number(m[2])};
}
let scoreFallback = '';
function clampScorePart(raw){
  if(raw === '' || raw == null) return '';
  const n = parseInt(raw, 10);
  if(!Number.isFinite(n)) return '';
  return String(Math.max(0, Math.min(99, n)));
}
function scoreFromFields(){
  const usEl = document.getElementById('f-score-us');
  const themEl = document.getElementById('f-score-them');
  if(!usEl || !themEl) return scoreFallback;
  const us = clampScorePart(usEl.value);
  const them = clampScorePart(themEl.value);
  if(us === '' && them === '') return scoreFallback;
  return (us === '' ? '0' : us) + ':' + (them === '' ? '0' : them);
}
function fillScoreFields(s){
  const usEl = document.getElementById('f-score-us');
  const themEl = document.getElementById('f-score-them');
  const p = scoreSides(s);
  if(p){
    scoreFallback = '';
    usEl.value = p.us;
    themEl.value = p.them;
    return;
  }
  usEl.value = '';
  themEl.value = '';
  scoreFallback = String(s || '');
}
function emptyCtaHtml(msg){
  return `<div class="empty-card"><p>${escapeHtml(msg)}</p><button type="button" class="save-btn" data-go-view="new">${escapeHtml(t('emptyGoMatch'))}</button></div>`;
}
function teamWon(m){
  const p = scoreSides(m && m.score);
  return !!(p && p.us > p.them);
}
function plusFact(key, n){
  if(key === 'goals' || key === 'assists' || key === 'saves') return t('plus_'+key, {n, what: declined(n, 'mn_'+key)});
  return t('plus_'+key, {n});
}
function buildInsights(m, history){
  m = m || {};
  const pos = ['fwd','mid','def','gk'].includes(m.position) ? m.position : ratingPosOf(m.position);
  const minutes = Math.max(1, Number(m.minutes) || 60);
  const rating = Number(m.rating);
  const hasRating = Number.isFinite(rating);
  const hist = Array.isArray(history) ? history : [];
  const prevLed = hist.slice(0, 4).some(x => countOf(x, 'ledtogoal') > 0);
  if(matchIsBlank(m)) return {plus: t('plusEven'), focus: t('focusDefault')};

  const plusOrder = ['goals','assists','saves','claims','chances','openings','tackles','interceptions','blocks','clearances','duelswon','passes','buildpass','shots','support','dribbles','gkpass'];
  const plusBits = plusOrder.filter(k => countOf(m, k) > 0).map(k => plusFact(k, countOf(m, k)));
  const head = [];
  if(hasRating && rating >= 9.5) head.push(t('plusTop', {r: fmtRating(rating)}));
  else if(hasRating && rating >= 8.5) head.push(t('plusGreat', {r: fmtRating(rating)}));
  if(teamWon(m)) head.push(t('plusWin'));
  const plus = (head.concat(plusBits).slice(0, 4).join(' ')) || (hasRating && rating >= 6.8 ? t('plusSolid') : t('plusEven'));

  const led = countOf(m, 'ledtogoal');
  const loss = countOf(m, 'losses');
  const touch = countOf(m, 'badtouch');
  const pass = countOf(m, 'badpass');
  const won = countOf(m, 'duelswon');
  const lost = countOf(m, 'duelslost');
  const fouls = countOf(m, 'fouls');
  const conc = countOf(m, 'conceded');
  const shots = countOf(m, 'shots') + countOf(m, 'goals');
  const goals = countOf(m, 'goals');
  const assists = countOf(m, 'assists');
  const defWork = countOf(m, 'tackles') + countOf(m, 'interceptions') + countOf(m, 'blocks') + countOf(m, 'clearances') + won;
  const midWork = countOf(m, 'passes') + countOf(m, 'buildpass') + countOf(m, 'chances') + countOf(m, 'tackles') + countOf(m, 'support');
  const lossBar = Math.max(3, Math.round(minutes / 18));
  const great = hasRating && (
    rating >= 8.5 ||
    goals >= 3 ||
    (goals >= 2 && assists >= 1) ||
    (pos === 'gk' && countOf(m, 'saves') >= 5 && conc <= 1)
  );

  let key = 'focusDefault', vars = {};
  const set = (k, v) => { key = k; vars = v || {}; };
  if(countOf(m, 'owngoal')) set('focusOwn');
  else if(led >= 2) set(prevLed ? 'focusRepeatLed' : 'focusLedN', {n: led});
  else if(led === 1) set(prevLed ? 'focusRepeatLed' : 'focusLed');
  else if(great){
    if(loss >= lossBar) set('focusGreatLoss', {n: loss, r: fmtRating(rating)});
    else set('focusGreat', {r: fmtRating(rating)});
  }
  else if(loss >= lossBar) set('focusLoss', {n: loss});
  else if(touch >= 3 || (touch >= 2 && touch >= pass)) set('focusTouch', {n: touch});
  else if(lost >= 3 && lost >= won + 2) set('focusDuels', {w: won, t: won + lost});
  else if(pass >= 3) set('focusPass', {n: pass});
  else if(fouls >= 2) set('focusFouls', {n: fouls});
  else if(behaviorOf(m, 'effort') <= 2) set('focusEffort');
  else if(behaviorOf(m, 'discipline') <= 2) set('focusDisc');
  else if(behaviorOf(m, 'coach') <= 2) set('focusListen');
  else if(behaviorOf(m, 'team') <= 2) set('focusTeam');
  else if(pos === 'gk' && conc >= 3) set('focusGk', {n: conc});
  else if(pos === 'fwd' && minutes >= 25 && shots === 0 && assists === 0 && countOf(m, 'openings') === 0) set('focusFwd');
  else if(pos === 'mid' && minutes >= 25 && midWork <= 1) set('focusMid');
  else if(pos === 'def' && minutes >= 25 && defWork <= 1) set('focusDef');
  else if((m.role === 'sub' || minutes < 25) && minutes < 25) set('focusSub', {n: minutes});
  else if(hasRating && rating < 5.5) set('focusBase', {r: fmtRating(rating)});
  else if(hasRating && rating >= 7) set('focusKeep', {r: fmtRating(rating)});
  else if(goals || assists) set('focusFinish');
  return {plus, focus: t(key, vars)};
}
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysAgoStr(days){
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(iso){
  const [y,m,d] = String(iso||'').split('-');
  if(!y||!m||!d) return iso || '';
  if(langLatin()){
    return new Date(Number(y), Number(m)-1, Number(d)).toLocaleDateString(LANG_LOCALE[settings.lang] || 'en-GB', {day:'numeric', month:'short', year:'numeric'});
  }
  return `${d}.${m}.${y}`;
}
function syncDateShown(){
  [['f-date','f-date-shown'],['p-birth','p-birth-shown']].forEach(([id, shownId]) => {
    const input = document.getElementById(id);
    const el = document.getElementById(shownId);
    if(!input || !el) return;
    const v = input.value;
    if(!v){
      el.textContent = t('phDate');
      el.classList.add('empty');
    } else {
      el.textContent = formatDate(v);
      el.classList.remove('empty');
    }
  });
}
function updatePhotoMeta(){ setCoverPreview(); }
function currentPhoto(){ return photoDraft === undefined ? player.photo : photoDraft; }
function currentCover(){ return coverDraft === undefined ? (player.cover || '') : coverDraft; }
function persistPlayerMedia(kind){
  if(kind === 'cover'){
    player.cover = coverDraft === undefined ? (player.cover || '') : coverDraft;
    coverDraft = undefined;
  } else {
    player.photo = photoDraft === undefined ? (player.photo || '') : photoDraft;
    photoDraft = undefined;
  }
  savePlayer();
  applyHeader();
  renderRoster();
}
function setCoverPreview(){
  const img = document.getElementById('pCoverImg');
  const blur = document.getElementById('pCoverBlur');
  const btn = document.getElementById('pCoverBtn');
  if(!img || !btn) return;
  const cover = currentCover();
  btn.classList.toggle('has-photo', !!cover);
  btn.classList.remove('cover-tall');
  btn.style.backgroundImage = cover ? 'url("' + cover.replace(/"/g, '') + '")' : '';
  if(cover){
    img.hidden = false;
    img.src = cover;
  } else {
    img.hidden = true;
    img.removeAttribute('src');
  }
  if(blur){
    blur.hidden = true;
    blur.removeAttribute('src');
  }
}
function closePhotoSheet(){
  document.getElementById('photoSheet').hidden = true;
  document.getElementById('photoSheetBack').hidden = true;
}
function openPhotoSheet(target){
  photoSheetTarget = target;
  const has = target === 'cover' ? !!currentCover() : !!currentPhoto();
  document.getElementById('photoSheetPick').textContent = t(target === 'cover' ? 'pPickCover' : 'pPickPhoto');
  document.getElementById('photoSheetClear').hidden = !has;
  document.getElementById('photoSheet').hidden = false;
  document.getElementById('photoSheetBack').hidden = false;
}
function pickPhotoFile(){
  const el = document.getElementById(photoSheetTarget === 'cover' ? 'p-cover' : 'p-photo');
  el.value = '';
  el.click();
}
let cropState = null;
function isHeicFile(file){
  const s = ((file && file.type) || '') + ' ' + ((file && file.name) || '');
  return /hei[cf]|image\/heif/i.test(s);
}
async function looksLikeHeic(file){
  if(isHeicFile(file)) return true;
  try{
    const buf = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    if(buf.length < 12) return false;
    const tag = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
    if(tag !== 'ftyp') return false;
    const rest = String.fromCharCode(...buf.slice(8, 24));
    return /heic|heix|hevc|hevx|mif1|msf1|heim|heis/i.test(rest);
  }catch(e){ return false; }
}
function fileToImage(file){
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('img'));
    const fromUrl = (url, revoke) => {
      const img = new Image();
      img.onload = () => {
        if(revoke) URL.revokeObjectURL(url);
        if(!img.width) return fail();
        resolve(img);
      };
      img.onerror = () => {
        if(revoke) URL.revokeObjectURL(url);
        fail();
      };
      img.src = url;
    };
    const fromReader = () => {
      const reader = new FileReader();
      reader.onload = () => fromUrl(reader.result, false);
      reader.onerror = fail;
      reader.readAsDataURL(file);
    };
    const shrink = bmp => {
      const canvas = document.createElement('canvas');
      const max = 2400;
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      canvas.width = Math.max(1, Math.round(bmp.width * k));
      canvas.height = Math.max(1, Math.round(bmp.height * k));
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if(bmp.close) bmp.close();
      fromUrl(canvas.toDataURL('image/jpeg', 0.92), false);
    };
    if(typeof createImageBitmap === 'function'){
      createImageBitmap(file).then(shrink).catch(() => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); if(!img.width) return fail(); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); fromReader(); };
        img.src = url;
      });
    } else {
      fromReader();
    }
  });
}
const COVER_EXPORT_W = 1280;
function coverDisplayAspect(){
  const el = document.getElementById('pCoverBtn');
  let r = 2.7;
  if(el && el.clientWidth > 40 && el.clientHeight > 40) r = el.clientWidth / el.clientHeight;
  return Math.min(3.1, Math.max(2.35, r));
}
function cropWindow(st){
  const {vw, vh, target} = st;
  if(target === 'cover'){
    const pad = 8;
    const ratio = st.coverAspect || coverDisplayAspect();
    let w = Math.max(40, vw - pad * 2);
    let h = w / ratio;
    if(h > vh - pad * 2){
      h = Math.max(40, vh - pad * 2);
      w = h * ratio;
    }
    return {x:(vw-w)/2, y:(vh-h)/2, w, h, round:false};
  }
  const r = Math.min(vw, vh) * 0.42;
  return {x:vw/2-r, y:vh/2-r, w:r*2, h:r*2, round:true};
}
function clampCrop(){
  const st = cropState;
  if(!st) return;
  const win = cropWindow(st);
  const w = st.img.width * st.scale, h = st.img.height * st.scale;
  if(w <= win.w) st.ox = win.x + (win.w - w) / 2;
  else st.ox = Math.min(win.x, Math.max(win.x + win.w - w, st.ox));
  if(h <= win.h) st.oy = win.y + (win.h - h) / 2;
  else st.oy = Math.min(win.y, Math.max(win.y + win.h - h, st.oy));
}
function renderCrop(){
  const st = cropState;
  if(!st) return;
  const canvas = document.getElementById('cropCanvas');
  const stage = document.getElementById('cropStage');
  const vw = stage.clientWidth, vh = stage.clientHeight;
  st.vw = vw; st.vh = vh;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, 0, vw, vh);
  ctx.drawImage(st.img, st.ox, st.oy, st.img.width * st.scale, st.img.height * st.scale);
  const win = cropWindow(st);
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.rect(0, 0, vw, vh);
  if(win.round){
    ctx.arc(vw/2, vh/2, win.w/2, 0, Math.PI * 2);
  } else {
    ctx.rect(win.x, win.y, win.w, win.h);
  }
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(34,211,166,.9)';
  ctx.lineWidth = 2;
  if(win.round){
    ctx.beginPath();
    ctx.arc(vw/2, vh/2, win.w/2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(win.x, win.y, win.w, win.h);
  }
}
function applyCropZoom(keepCenter){
  const st = cropState;
  if(!st) return;
  const win = cropWindow(st);
  const imgCx = keepCenter ? (win.x + win.w/2 - st.ox) / st.scale : st.img.width/2;
  const imgCy = keepCenter ? (win.y + win.h/2 - st.oy) / st.scale : st.img.height/2;
  const z = Number(document.getElementById('cropZoom').value) / 100;
  st.minScale = Math.max(win.w / st.img.width, win.h / st.img.height);
  st.scale = st.minScale * z;
  st.ox = win.x + win.w/2 - imgCx * st.scale;
  st.oy = win.y + win.h/2 - imgCy * st.scale;
  clampCrop();
  renderCrop();
}
function openCrop(img, target){
  const coverAspect = target === 'cover' ? coverDisplayAspect() : 1;
  cropState = {img, target, ox:0, oy:0, scale:1, minScale:1, vw:300, vh:300, drag:null, coverAspect};
  const stage = document.getElementById('cropStage');
  stage.classList.toggle('cover', target === 'cover');
  if(target === 'cover') stage.style.aspectRatio = coverAspect + ' / 1';
  else stage.style.aspectRatio = '';
  const hint = document.querySelector('.crop-hint');
  if(hint) hint.textContent = t(target === 'cover' ? 'cropCoverHint' : 'cropHint');
  document.getElementById('cropZoom').value = '100';
  document.getElementById('cropModal').hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => applyCropZoom(false)));
}
function closeCrop(){
  cropState = null;
  document.getElementById('cropModal').hidden = true;
}
function exportCrop(){
  const st = cropState;
  const win = cropWindow(st);
  let sx = (win.x - st.ox) / st.scale;
  let sy = (win.y - st.oy) / st.scale;
  let sw = win.w / st.scale;
  let sh = win.h / st.scale;
  const iw = st.img.width, ih = st.img.height;
  if(sx < 0){ sw += sx; sx = 0; }
  if(sy < 0){ sh += sy; sy = 0; }
  if(sx + sw > iw) sw = iw - sx;
  if(sy + sh > ih) sh = ih - sy;
  const out = document.createElement('canvas');
  if(st.target === 'cover'){
    const ratio = win.w / Math.max(win.h, 1);
    out.width = COVER_EXPORT_W;
    out.height = Math.max(1, Math.round(COVER_EXPORT_W / ratio));
  } else {
    out.width = 320; out.height = 320;
  }
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, 0, out.width, out.height);
  if(sw > 0 && sh > 0){
    ctx.drawImage(st.img, sx, sy, sw, sh, 0, 0, out.width, out.height);
  }
  return out.toDataURL('image/jpeg', 0.86);
}
function loadScriptOnce(src){
  if(loadScriptOnce.got && loadScriptOnce.got[src]) return loadScriptOnce.got[src];
  loadScriptOnce.got = loadScriptOnce.got || {};
  loadScriptOnce.got[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loadScriptOnce.got[src];
}
async function heicToJpegFile(file){
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js');
  const convert = window.HeicTo;
  if(typeof convert !== 'function') throw new Error('heicto');
  const blob = await convert({blob: file, type: 'image/jpeg', quality: 0.88});
  return new File([blob], 'photo.jpg', {type: 'image/jpeg'});
}
function imageToJpegKeepAspect(img, maxSide){
  const k = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * k));
  canvas.height = Math.max(1, Math.round(img.height * k));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86);
}
async function beginCrop(file, target){
  if(!file) return;
  try{
    let src = file;
    if(await looksLikeHeic(file)){
      showToast(t('toastPhotoWait'));
      src = await heicToJpegFile(file);
    }
    let img;
    try{
      img = await fileToImage(src);
    }catch(first){
      showToast(t('toastPhotoWait'));
      src = await heicToJpegFile(file);
      img = await fileToImage(src);
    }
    openCrop(img, target);
  }catch(err){
    showToast(t('toastPhotoFail'));
  }
}

function currentSeason(){
  const d = new Date();
  const y = d.getFullYear();
  const start = d.getMonth() >= 6 ? y : y - 1;
  return start + '/' + String((start + 1) % 100).padStart(2, '0');
}
function seasonFromDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return currentSeason();
  const y = Number(iso.slice(0,4));
  const mo = Number(iso.slice(5,7));
  const start = mo >= 7 ? y : y - 1;
  return start + '/' + String((start + 1) % 100).padStart(2, '0');
}
function nextSeasonLabel(s){
  const m = String(s || currentSeason()).match(/(\d{2,4})\s*\/\s*(\d{2,4})/);
  const start = m ? Number(m[1].length === 2 ? '20'+m[1] : m[1]) + 1 : new Date().getFullYear();
  return start + '/' + String((start + 1) % 100).padStart(2, '0');
}
function matchSeason(m){
  return String(m?.season || '').trim() || seasonFromDate(m?.date);
}
function seasonIsOpen(){ return player.seasonOpen !== false; }
function parseSeasonYears(s){
  const m = String(s || '').match(/(\d{2,4})\s*\/\s*(\d{2,4})/);
  if(!m) return null;
  const start = Number(m[1].length === 2 ? '20'+m[1] : m[1]);
  let end = Number(m[2].length === 2 ? '20'+m[2] : m[2]);
  if(end < 100) end = Math.floor(start / 100) * 100 + end;
  if(end <= start) end = start + 1;
  return {start, end};
}
function whenLabel(d){
  const loc = LANG_LOCALE[settings.lang] || 'en-GB';
  const month = d.toLocaleDateString(loc, {month:'long'});
  return month.charAt(0).toUpperCase() + month.slice(1) + ' ' + d.getFullYear();
}
function matchCountLabel(n){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  if(langLatin()) return t(n === 1 ? 'matchOne' : 'matchEn', {n});
  const n10 = n % 10, n100 = n % 100;
  const form = (n10 === 1 && n100 !== 11) ? 'matchOne' : (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? 'matchFew' : 'matchMany');
  return t(form, {n});
}
function seasonMatchCount(s){
  return matches.filter(m => matchSeason(m) === s).length;
}
function seasonEndPassed(s, now){
  const y = parseSeasonYears(s);
  if(!y) return false;
  return now >= new Date(y.end, 6, 1);
}
function closeSeasonMessage(s){
  const now = new Date();
  const y = parseSeasonYears(s) || {start: now.getFullYear(), end: now.getFullYear() + 1};
  const when = whenLabel(now);
  const n = seasonMatchCount(s);
  const startAt = new Date(y.start, 6, 1);
  const endAt = new Date(y.end, 6, 1);
  if(now < startAt) return t('closeTooEarly', {s, when, start: y.start});
  if(now < endAt){
    if(!n) return t('closeEarlyNoMatches', {s, when, end: y.end});
    if(n <= 3) return t('closeEarlyFew', {s, when, matches: matchCountLabel(n), end: y.end});
    return t('closeNotOver', {s, when, end: y.end});
  }
  if(!n) return t('closeReadyEmpty', {s, next: nextSeasonLabel(s)});
  return t('closeReady', {s, next: nextSeasonLabel(s), matches: matchCountLabel(n), end: y.end});
}
function syncSeasonUi(){
  const open = seasonIsOpen();
  const s = player.season || currentSeason();
  document.getElementById('pOpenSeasonBtn').hidden = open;
  document.getElementById('pCloseSeasonBtn').hidden = !open;
  document.getElementById('pSeasonHint').textContent = open ? t('pSeasonHintOpen') : t('pSeasonHintClosed', {s});
}
function openSeason(s, silent){
  const name = String(s || '').trim() || currentSeason();
  if(!silent && !confirm(t('confirmOpenSeason', {s: name}))) return false;
  player.season = name;
  player.seasonOpen = true;
  document.getElementById('p-season').value = name;
  savePlayer();
  applyHeader();
  fillSeasonSelects();
  syncSeasonUi();
  if(!silent) showToast(t('toastSeasonOpened', {s: name}));
  return true;
}
function closeSeason(fromPrompt){
  if(!seasonIsOpen()) return false;
  const s = player.season || currentSeason();
  if(!confirm(closeSeasonMessage(s))){
    if(fromPrompt){
      settings.seasonCloseDeclined = s;
      saveSettings();
    }
    return false;
  }
  player.season = s;
  player.seasonOpen = false;
  savePlayer();
  settings.seasonCloseDeclined = s;
  saveSettings();
  applyHeader();
  fillSeasonSelects();
  if(document.getElementById('view-player').classList.contains('active')){
    document.getElementById('p-season').value = nextSeasonLabel(s);
  }
  syncSeasonUi();
  showToast(t('toastSeasonClosed', {s}));
  return true;
}
function maybePromptSeasonClose(){
  if(!seasonIsOpen()) return;
  const s = player.season || currentSeason();
  if(settings.seasonCloseDeclined === s) return;
  if(!seasonEndPassed(s, new Date())) return;
  closeSeason(true);
}
function defaultPlayer(){
  return {
    firstName:'Данило', lastName:'Михайлюк', birthDate:'', photo:'', cover:'',
    team:'', club:'', number:'', primary:'RW', extra:['CM'], season: currentSeason(), seasonOpen: true
  };
}
function displayName(){
  return [player.firstName, player.lastName].filter(Boolean).join(' ').trim() || t('playerUntitled');
}
function playerLabel(p){
  return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || t('playerUntitled');
}
function shirtNo(){
  const n = String(player.number || '').replace(/\D/g,'');
  return n ? String(Math.min(99, Math.max(1, Number(n)))) : '';
}
function posLine(){
  const extra = (player.extra || []).filter(p => isPitchCode(p) && p !== player.primary);
  return [player.primary, ...extra].filter(p => isPitchCode(p)).map(pitchPosLabel).join(' / ');
}
function ageYears(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [y,m,d] = iso.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if((now.getMonth()+1 < m) || (now.getMonth()+1 === m && now.getDate() < d)) age--;
  return age < 0 ? 0 : age;
}
function ageLabel(n){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  if(langLatin()) return t(n === 1 ? 'ageOne' : 'ageEn', {n});
  const n10 = n % 10, n100 = n % 100;
  const form = (n10 === 1 && n100 !== 11) ? 'ageOne' : (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? 'ageFew' : 'ageMany');
  return t(form, {n});
}
function initialsOf(p){
  const a = (p.firstName || '').trim().charAt(0);
  const b = (p.lastName || '').trim().charAt(0);
  return ((a + b) || (p.club || 'FFK').slice(0,2) || 'FF').toUpperCase();
}
function initials(){
  return initialsOf(player);
}
function matchPosFromCode(code){
  if(isRoleCode(code)) return code;
  return POS_GROUP[code] || settings.position || 'fwd';
}
function syncSettingsFromPlayer(){
  settings.player = displayName();
  settings.club = player.club || '';
  settings.position = matchPosFromCode(player.primary);
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
      theme: s.theme === 'light' ? 'light' : 'dark'
    };
    if(s.langManual !== true) saveSettings();
  }catch(e){}
}
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function splitLegacyName(full){
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return {firstName: parts[0] || '', lastName: parts.slice(1).join(' ')};
}
function newPlayerId(){
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function kidPlayerKey(id){ return 'ffk_kid_' + id; }
function kidMatchesKey(id){ return 'ffk_kid_m_' + id; }
function draftStorageKey(id){ return DRAFT_KEY + '_' + (id || roster.currentId || 'x'); }
function saveRoster(){
  try{ localStorage.setItem(ROSTER_KEY, JSON.stringify({currentId: roster.currentId, ids: roster.ids})); }catch(e){}
}
function writePlayerRecord(id, p){
  const row = {...p, id};
  try{
    localStorage.setItem(kidPlayerKey(id), JSON.stringify(row));
  }catch(e){
    try{
      const slim = {...row, photo:'', cover:''};
      localStorage.setItem(kidPlayerKey(id), JSON.stringify(slim));
      if(id === roster.currentId){ player.photo = ''; player.cover = ''; }
      showToast(t('toastSaveFail'));
    }catch(err){ showToast(t('toastSaveFail')); }
  }
}
function readPlayerRecord(id){
  try{
    const raw = localStorage.getItem(kidPlayerKey(id));
    if(!raw) return null;
    return normalizePlayer(JSON.parse(raw), id);
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
    localStorage.setItem(PLAYER_KEY, JSON.stringify({...player, photo: player.photo, cover: player.cover}));
  }catch(e){
    try{
      const slim = {...player, photo:'', cover:''};
      localStorage.setItem(PLAYER_KEY, JSON.stringify(slim));
      player.photo = '';
      player.cover = '';
      showToast(t('toastSaveFail'));
    }catch(err){ showToast(t('toastSaveFail')); }
  }
}
function setBadge(el, photo, fallback){
  el.replaceChildren();
  if(photo){
    const img = document.createElement('img');
    img.alt = '';
    img.src = photo;
    el.appendChild(img);
  } else {
    el.textContent = fallback;
  }
}
const GRADE_TYPICAL = {
  goals:0.6, assists:0.5, shots:1.2, dribbles:2.2, openings:2, chances:1.2,
  passes:1.5, buildpass:6, tackles:2.5, interceptions:2, clearances:2, blocks:1.2,
  duelswon:4, support:2, saves:3, claims:1.5, gkpass:4,
  losses:3.4, ledtogoal:0.35, badpass:2.4, badtouch:1.4, duelslost:3, fouls:1.2,
  owngoal:0.2, conceded:1.4
};
function metricGrade(avg, key, w){
  const typical = GRADE_TYPICAL[key] || 2;
  if(w >= 0) return clamp10(4 + 6 * (1 - Math.exp(-avg / typical)));
  return clamp10(10 - 6 * (1 - Math.exp(-avg / typical)));
}
function feedList(){
  const s = player.season || currentSeason();
  const season = [...matches].filter(m => matchSeason(m) === s).sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id);
  if(season.length) return {list: season, season: true};
  const all = [...matches].sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id);
  return {list: all, season: false};
}
function lastFiveDelta(list){
  if(list.length < 3) return null;
  const n = Math.min(5, list.length);
  const last = list.slice(-n);
  const prev = list.slice(0, -n).slice(-5);
  if(!prev.length) return null;
  return {d: avgRating(last) - avgRating(prev), k: last.length};
}
function ratePerMatch(list, key){
  return list.length ? countSum(list, key) / list.length : 0;
}
function metricRose(now, prev, key, abs){
  const a = ratePerMatch(now, key), b = ratePerMatch(prev, key);
  const floor = abs != null ? abs : (key === 'goals' || key === 'assists' || key === 'ledtogoal' ? 0.18 : 0.35);
  return (a - b) >= floor || (b >= 0.2 && a >= b * 1.22);
}
function metricFlat(now, prev, key, abs){
  return Math.abs(ratePerMatch(now, key) - ratePerMatch(prev, key)) < (abs || 0.28);
}
function coachWindows(list){
  if(list.length < 6) return null;
  const k = Math.min(8, Math.max(4, Math.floor(list.length / 2)));
  const now = list.slice(-k);
  const prev = list.slice(0, -k).slice(-Math.max(k, 4));
  if(prev.length < 3) return null;
  return {n: now.length, now, prev};
}
function firstName(){
  return (player.firstName || '').trim() || displayName();
}
function profileCoachNote(list, strengths, focus){
  const name = firstName();
  const win = coachWindows(list);
  const plusKey = strengths[0]?.m.key;
  const minusKey = focus[0]?.m.key;
  if(win){
    const {n, now, prev} = win;
    const vars = {name, n};
    if(metricRose(now, prev, 'dribbles') && metricRose(now, prev, 'losses')) return t('coachDribbleLoss', vars);
    if(metricRose(now, prev, 'passes') && metricRose(now, prev, 'badpass', 0.28)) return t('coachPassBad', vars);
    if(metricRose(now, prev, 'tackles') && metricRose(now, prev, 'losses')) return t('coachTackleLoss', vars);
    if(metricRose(now, prev, 'duelslost', 0.3) && !metricRose(now, prev, 'duelswon', 0.45)) return t('coachDuels', vars);
    if(metricRose(now, prev, 'shots', 0.28) && !metricRose(now, prev, 'goals', 0.12)) return t('coachFinish', vars);
    if(metricRose(now, prev, 'dribbles') && (metricFlat(now, prev, 'losses') || ratePerMatch(now, 'losses') < ratePerMatch(prev, 'losses'))) return t('coachDribbleGood', vars);
    if(metricRose(now, prev, 'badtouch', 0.25)) return t('coachBadtouch', vars);
    if(metricRose(now, prev, 'losses')) return t('coachLoss', vars);
  }
  if(plusKey === 'dribbles' && (minusKey === 'losses' || minusKey === 'badtouch')) return t('coachNowDribbleLoss', {name});
  if(plusKey && minusKey) return t('coachNowPair', {name, plus: profileMetricLabel(plusKey).toLowerCase(), minus: profileMetricLabel(minusKey).toLowerCase()});
  if(plusKey) return t('coachNowPlus', {name, plus: profileMetricLabel(plusKey).toLowerCase()});
  if(minusKey) return t('coachNowMinus', {name, minus: profileMetricLabel(minusKey).toLowerCase()});
  return '';
}
function pfGamesLabel(n, inSeason){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  let form = 'many';
  if(langLatin()) form = n === 1 ? 'one' : 'many';
  else {
    const n10 = n % 10, n100 = n % 100;
    form = (n10 === 1 && n100 !== 11) ? 'one' : (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? 'few' : 'many');
  }
  return t((inSeason ? 'pfSeason_' : 'pfAll_') + form);
}
function renderPlayerFeed(){
  const el = document.getElementById('playerFeed');
  if(!el) return;
  const {list, season} = feedList();
  if(!list.length){
    el.innerHTML = emptyCtaHtml(t('pfEmpty'));
    return;
  }
  const avg = avgRating(list);
  const last = list[list.length - 1];
  const trend = lastFiveDelta(list);
  const trendHtml = trend
    ? `<div class="pf-trend ${trend.d >= 0.05 ? 'up' : (trend.d <= -0.05 ? 'down' : '')}">${trend.d >= 0 ? '📈 ' : '📉 '}${escapeHtml(t('pfTrend', {n: fmtSigned(trend.d, 2), k: trend.k}))}</div>`
    : '';
  const goals = countSum(list, 'goals');
  const assists = countSum(list, 'assists');
  const posCounts = {};
  list.forEach(m => {
    const p = ['fwd','mid','def','gk'].includes(m.position) ? m.position : ratingPosOf(m.position);
    posCounts[p] = (posCounts[p]||0)+1;
  });
  const mainPos = Object.keys(posCounts).sort((a,b)=> posCounts[b]-posCounts[a])[0] || 'fwd';
  const grades = METRICS.map(m => {
    const w = weightOf(m, mainPos);
    if(!w) return null;
    const total = countSum(list, m.key);
    const minN = w < 0 ? 3 : (m.key === 'goals' || m.key === 'assists' ? 2 : 4);
    if(total < minN) return null;
    return {m, w, total, grade: metricGrade(total / list.length, m.key, w)};
  }).filter(Boolean);
  const strengths = grades.filter(g => g.w > 0).sort((a,b)=> b.grade - a.grade).slice(0, 3);
  const weakNeg = grades.filter(g => g.w < 0).sort((a,b)=> a.grade - b.grade).slice(0, 3);
  const weakPos = grades.filter(g => g.w > 0 && g.grade < 6.6).sort((a,b)=> a.grade - b.grade);
  const focus = (weakNeg.length ? weakNeg : weakPos).slice(0, 3);
  const row = (g, bad) => `<div class="pf-row${bad ? ' bad' : ''}"><span class="pf-lab"><span class="ic">${g.m.icon}</span>${escapeHtml(profileMetricLabel(g.m.key))}</span><span class="g">${fmtNum(g.grade, 1)}</span></div>`;
  const note = profileCoachNote(list, strengths, focus);
  el.innerHTML = `<div class="pf-card">
      <div class="pf-rate">${fmtNum(avg, 2)}<small>${escapeHtml(season ? t('pfSeasonAvg') : t('pfAllAvg'))}</small></div>
      ${trendHtml}
      <div class="pf-grid">
        <div class="pf-kpi"><div class="n">${fmtNum(last.rating, 1)}</div><div class="l">${escapeHtml(t('pfLast'))}</div></div>
        <div class="pf-kpi"><div class="n">${list.length}</div><div class="l">${escapeHtml(pfGamesLabel(list.length, season))}</div></div>
        <div class="pf-kpi"><div class="n">${goals} · ${assists}</div><div class="l">${escapeHtml(t('pfGA'))}</div></div>
      </div>
    </div>
    ${strengths.length ? `<div class="pf-card"><h3>${escapeHtml(t('pfStrengths'))}</h3>${strengths.map(g => row(g, false)).join('')}</div>` : ''}
    ${focus.length ? `<div class="pf-card"><h3>${escapeHtml(t('pfFocus'))}</h3>${focus.map(g => row(g, true)).join('')}</div>` : ''}
    ${note ? `<div class="pf-card pf-coach"><h3>${escapeHtml(t('pfCoach'))}</h3><p>${escapeHtml(note)}</p></div>` : ''}`;
}
function applyHeader(){
  const no = shirtNo();
  const age = ageYears(player.birthDate);
  const meta = [age != null ? ageLabel(age) : '', posLine()].filter(Boolean).join(' · ');
  const clubBits = [...new Set([player.team, player.club, player.season].map(x => String(x||'').trim()).filter(Boolean))].join(' · ');
  document.getElementById('playerNameDisplay').textContent = player.firstName || displayName();
  const avgEl = document.getElementById('playerSeasonAvg');
  const seasonAvg = avgRating(feedList().list);
  if(seasonAvg == null) avgEl.hidden = true;
  else {
    avgEl.hidden = false;
    avgEl.textContent = '⭐ ' + fmtNum(seasonAvg, 1);
  }
  const numEl = document.getElementById('playerNumberDisplay');
  if(no){
    numEl.hidden = false;
    numEl.textContent = (langLatin() ? '#' : '№') + no;
  } else numEl.hidden = true;
  document.getElementById('playerMetaLine').textContent = meta;
  document.getElementById('playerClubLine').textContent = clubBits;
  setBadge(document.getElementById('clubBadge'), player.photo, initials());
  const fbName = document.getElementById('fbName');
  const fbMeta = document.getElementById('fbMeta');
  if(fbName) fbName.textContent = displayName();
  if(fbMeta) fbMeta.textContent = [no ? ((langLatin() ? '#' : '№') + no) : '', posLine(), clubBits].filter(Boolean).join(' · ');
  renderPlayerFeed();
}
function rosterAvatarHtml(p){
  if(p.photo) return `<span class="roster-av"><img alt="" src="${p.photo}"></span>`;
  return `<span class="roster-av">${escapeHtml(initialsOf(p))}</span>`;
}
function renderRoster(){
  const el = document.getElementById('rosterList');
  if(!el) return;
  el.innerHTML = roster.ids.map(id => {
    const p = id === roster.currentId ? player : (readPlayerRecord(id) || {firstName:'', lastName:'', club:'', photo:''});
    const on = id === roster.currentId ? ' on' : '';
    const del = roster.ids.length > 1
      ? `<button class="roster-x" type="button" data-del="${escapeHtml(id)}" aria-label="${escapeHtml(t('deletePlayer'))}">×</button>`
      : '';
    return `<div class="roster-row">
      <button class="roster-item${on}" type="button" data-switch="${escapeHtml(id)}">${rosterAvatarHtml(p)}<span>${escapeHtml(playerLabel(p))}</span></button>
      ${del}
    </div>`;
  }).join('');
}
function persistActivePlayer(){
  if(document.getElementById('view-player').classList.contains('active')){
    try{ player = collectPlayer(); }catch(e){}
  }
  savePlayer();
  saveMatches();
  try{ persistDraft(); }catch(e){}
}
function applyPlayerContext(){
  extraSelected = [...(player.extra || [])];
  photoDraft = undefined;
  coverDraft = undefined;
  syncSettingsFromPlayer();
  saveSettings();
  lastReportMatch = null;
  currentSeasonFilter = 'current';
  saveFilters();
  document.getElementById('app').classList.remove('live-on');
  resetForm(true);
  restoreDraft();
  applyHeader();
  fillPlayerForm();
  fillSeasonSelects();
  renderMetrics();
  renderBehaviors();
  renderLiveGrid();
  renderFocusBanner();
  renderHistory();
  renderStats();
  renderOppList();
  updateHero();
}
function switchPlayer(id, silent){
  if(!id || id === roster.currentId || !roster.ids.includes(id)) return;
  persistActivePlayer();
  roster.currentId = id;
  saveRoster();
  player = readPlayerRecord(id) || normalizePlayer({club: player.club, season: currentSeason()}, id);
  loadMatches();
  applyPlayerContext();
  if(!silent) showToast(t('toastSwitched', {n: displayName()}));
}
function addPlayer(){
  if(roster.ids.length >= MAX_PLAYERS){
    showToast(t('toastTooManyPlayers', {n: MAX_PLAYERS}));
    return;
  }
  persistActivePlayer();
  const id = newPlayerId();
  const next = normalizePlayer({
    firstName: '',
    lastName: '',
    club: player.club || '',
    team: player.team || '',
    primary: isPitchCode(player.primary) ? player.primary : 'RW',
    extra: [],
    season: currentSeason(),
    seasonOpen: true
  }, id);
  writePlayerRecord(id, next);
  try{ localStorage.setItem(kidMatchesKey(id), '[]'); }catch(e){}
  roster.ids.push(id);
  roster.currentId = id;
  saveRoster();
  player = next;
  matches = [];
  savePlayer();
  saveMatches();
  applyPlayerContext();
  showView('player');
  document.querySelector('.card-edit')?.setAttribute('open', '');
  window.scrollTo({top:0, behavior:'instant'});
  showToast(t('toastPlayerAdded'));
}
function removePlayer(id){
  if(roster.ids.length < 2){
    showToast(t('cannotDeleteLast'));
    return;
  }
  const p = id === roster.currentId ? player : readPlayerRecord(id);
  const name = playerLabel(p || {firstName:'', lastName:''});
  if(!confirm(t('confirmDeletePlayer', {n: name}))) return;
  if(id === roster.currentId) persistActivePlayer();
  roster.ids = roster.ids.filter(x => x !== id);
  try{
    localStorage.removeItem(kidPlayerKey(id));
    localStorage.removeItem(kidMatchesKey(id));
    sessionStorage.removeItem(draftStorageKey(id));
  }catch(e){}
  if(roster.currentId === id){
    roster.currentId = roster.ids[0];
    saveRoster();
    player = readPlayerRecord(roster.currentId) || defaultPlayer();
    player.id = roster.currentId;
    loadMatches();
    applyPlayerContext();
  } else {
    saveRoster();
    renderRoster();
  }
  showToast(t('toastPlayerRemoved'));
}
function fillPrimarySelect(){
  const sel = document.getElementById('p-primary');
  const cur = isPitchCode(sel.value) ? sel.value : (isPitchCode(player.primary) ? player.primary : 'fwd');
  fillPitchSelect(sel, cur, false);
}
function posChipHtml(code){
  const on = extraSelected.includes(code) ? 'on' : '';
  return `<button type="button" class="pos-chip ${on}" data-pos="${code}">${escapeHtml(isRoleCode(code) ? posLabel(code) : pitchPosLabelShort(code))}</button>`;
}
function renderExtraChips(){
  const primary = document.getElementById('p-primary')?.value || player.primary;
  extraSelected = extraSelected.filter(x => x !== primary);
  const roles = ROLE_CODES.filter(c => c !== primary).map(posChipHtml).join('');
  const details = POS_CODES.filter(c => c !== primary).map(posChipHtml).join('');
  document.getElementById('pExtraChips').innerHTML =
    `<div class="pos-group-title">${escapeHtml(t('posBasic'))}</div>${roles}` +
    `<div class="pos-group-title">${escapeHtml(t('posExtended'))}</div>${details}`;
}
function fillPlayerForm(){
  fillPrimarySelect();
  extraSelected = [...(player.extra || [])];
  photoDraft = undefined;
  coverDraft = undefined;
  document.getElementById('p-first').value = player.firstName;
  document.getElementById('p-last').value = player.lastName;
  document.getElementById('p-birth').value = player.birthDate;
  document.getElementById('p-number').value = player.number;
  document.getElementById('p-team').value = player.team;
  document.getElementById('p-club').value = player.club;
  document.getElementById('p-season').value = seasonIsOpen() ? (player.season || currentSeason()) : nextSeasonLabel(player.season || currentSeason());
  document.getElementById('p-photo').value = '';
  document.getElementById('p-cover').value = '';
  setBadge(document.getElementById('pPhotoBox'), currentPhoto(), initials());
  setCoverPreview();
  renderExtraChips();
  syncDateShown();
  syncSeasonUi();
  renderRoster();
}
function collectPlayer(){
  const primary = document.getElementById('p-primary').value;
  return normalizePlayer({
    id: player.id,
    firstName: document.getElementById('p-first').value.trim(),
    lastName: document.getElementById('p-last').value.trim(),
    birthDate: document.getElementById('p-birth').value,
    photo: currentPhoto(),
    cover: currentCover(),
    team: document.getElementById('p-team').value.trim(),
    club: document.getElementById('p-club').value.trim(),
    number: document.getElementById('p-number').value,
    primary,
    extra: extraSelected.filter(x => x !== primary),
    season: seasonIsOpen() ? (document.getElementById('p-season').value.trim() || player.season || currentSeason()) : (player.season || currentSeason()),
    seasonOpen: player.seasonOpen !== false
  }, player.id);
}
function compressImage(file, w, h){
  return fileToImage(file).then(img => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    canvas.getContext('2d').drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
    return canvas.toDataURL('image/jpeg', 0.82);
  });
}
function compressPhoto(file){ return compressImage(file, 256, 256); }
function compressCover(file){
  return fileToImage(file).then(img => imageToJpegKeepAspect(img, COVER_EXPORT_W));
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
  const action = actionScore(counts, pos);
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
    kickoffClock: String(m.kickoffClock || '').slice(0, 8),
    actionRating: action,
    effortRating: effort,
    rating: overallScore(counts, behaviors, pos)
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
function guessPos(label){
  const s = String(label||'');
  const code = s.toUpperCase();
  if(POS_GROUP[code]) return POS_GROUP[code];
  if(/вратар|воротар|bramk|goalkeep|\bgk\b/i.test(s)) return 'gk';
  if(/защит|захис|obroń|obron|\bdef\b/i.test(s)) return 'def';
  if(/полузащ|півзахис|pomoc|\bmid\b/i.test(s)) return 'mid';
  return 'fwd';
}

function persistDraft(){
  sessionStorage.setItem(draftStorageKey(), JSON.stringify({
    date: document.getElementById('f-date').value,
    position: currentPitch(),
    opponent: document.getElementById('f-opponent').value,
    score: scoreFromFields(),
    minutes: document.getElementById('f-minutes').value,
    format: document.getElementById('f-format').value,
    matchLen: document.getElementById('f-matchlen').value,
    kind: document.getElementById('f-kind').value,
    tournament: document.getElementById('f-tournament').value,
    venue: document.getElementById('f-venue').value,
    role: document.getElementById('f-role').value,
    comment: document.getElementById('f-comment').value,
    counts: form.counts,
    behaviors: form.behaviors,
    editingId,
    matchClock
  }));
}
function restoreDraft(){
  try{
    const raw = sessionStorage.getItem(draftStorageKey()) || sessionStorage.getItem(DRAFT_KEY);
    const d = JSON.parse(raw || 'null');
    if(!d) return;
    if(d.date) document.getElementById('f-date').value = d.date;
    if(d.position) fillMatchPitchSelects(d.position);
    if(d.opponent) document.getElementById('f-opponent').value = d.opponent;
    if(d.score) fillScoreFields(d.score);
    if(d.minutes) document.getElementById('f-minutes').value = d.minutes;
    if(d.format) document.getElementById('f-format').value = d.format;
    if(d.matchLen) document.getElementById('f-matchlen').value = d.matchLen;
    document.getElementById('customLengthWrap').hidden = document.getElementById('f-format').value !== 'custom';
    if(d.kind) document.getElementById('f-kind').value = d.kind;
    if(d.tournament) document.getElementById('f-tournament').value = d.tournament;
    if(d.venue) document.getElementById('f-venue').value = d.venue;
    if(d.role) document.getElementById('f-role').value = d.role;
    if(d.comment) document.getElementById('f-comment').value = d.comment;
    if(d.counts) form.counts = {...form.counts, ...d.counts};
    if(d.behaviors) form.behaviors = {...form.behaviors, ...d.behaviors};
    if(d.editingId){ editingId = d.editingId; setEditUi(true); }
    if(d.matchClock && typeof d.matchClock === 'object'){
      matchClock = hydrateClock(d.matchClock);
    }
  }catch(e){}
}

function renderMetrics(){
  const pos = currentPos();
  document.getElementById('weightsHint').textContent = t(({gk:'hintGk', fwd:'hintFwd', mid:'hintMid', def:'hintDef'})[pos] || 'hintOut');
  document.getElementById('metricsList').innerHTML = metricsFor(pos).map(m => {
    const w = weightOf(m, pos);
    const shown = (w > 0 ? '+' : '') + (settings.lang === 'en' ? String(w) : String(w).replace('.', ','));
    const keyRow = (m.live || []).includes(pos);
    return `<div class="metric-row${keyRow ? ' key' : ''}">
      <div class="metric-name">
        <div class="metric-icon">${m.icon}</div>
        <div>${escapeHtml(metricLabel(m.key))}<span class="metric-weight">${shown}</span></div>
      </div>
      <div class="stepper">
        <button type="button" onclick="stepMetric('${m.key}',-1)">−</button>
        <div class="val" id="cnt-${m.key}">${form.counts[m.key]||0}</div>
        <button type="button" onclick="stepMetric('${m.key}',1)">+</button>
      </div>
    </div>`;
  }).join('');
}
function renderBehaviors(){
  document.getElementById('behaviorList').innerHTML = BEHAVIOR.map(b => `
    <div class="behavior-row">
      <div class="behavior-top">
        <span>${escapeHtml(behaviorLabel(b.key))}</span>
        <span class="val ${b.inRating?'':'muted'}" id="bval-${b.key}">${form.behaviors[b.key]}</span>
      </div>
      <input type="range" min="1" max="5" step="1" value="${form.behaviors[b.key]}"
             oninput="setBehavior('${b.key}', this.value)">
    </div>`).join('');
}
function renderOppList(){
  const names = [...new Set(matches.map(m => m.opponent).filter(Boolean))].sort();
  document.getElementById('oppList').innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');
  const tours = [...new Set(matches.map(m => m.tournament).filter(Boolean))].sort();
  document.getElementById('tourList').innerHTML = tours.map(n => `<option value="${escapeHtml(n)}">`).join('');
}
function renderFocusBanner(){
  const el = document.getElementById('focusBanner');
  if(editingId || matches.length === 0){ el.hidden = true; return; }
  const last = [...matches].sort((a,b)=> b.date.localeCompare(a.date) || b.id-a.id)[0];
  const rest = matches.filter(x => x.id !== last.id).sort((a,b)=> b.date.localeCompare(a.date) || b.id-a.id);
  const ins = buildInsights(last, rest);
  el.hidden = false;
  el.innerHTML = t('lastFocus', {
    who: escapeHtml(last.opponent || t('unnamed')),
    got: escapeHtml(t('gotLbl')),
    next: escapeHtml(t('insightFocus')),
    plus: escapeHtml(ins.plus),
    focus: escapeHtml(ins.focus)
  });
}

window.stepMetric = function(key, dir){
  const next = Math.max(0, (form.counts[key]||0) + dir);
  form.counts[key] = next;
  const el = document.getElementById('cnt-'+key);
  if(el) el.textContent = next;
  const live = document.getElementById('live-cnt-'+key);
  if(live) live.textContent = next;
  if(dir === 1){
    liveStack.push(key);
    const phase = clockPhase();
    if(phase === 'idle' || phase === 'break') startMatchClock();
    if(matchClock.startedAt){
      const stamp = clockStamp();
      matchClock.events.push({key, at: Date.now(), minute: stamp.matchMin, period: stamp.period, inPeriod: stamp.minute});
    }
  } else {
    const i = liveStack.lastIndexOf(key);
    if(i >= 0) liveStack.splice(i, 1);
    for(let j = matchClock.events.length - 1; j >= 0; j--){
      if(matchClock.events[j].key === key){ matchClock.events.splice(j, 1); break; }
    }
  }
  updateHero();
  persistDraft();
};
window.setBehavior = function(key, val){
  form.behaviors[key] = parseInt(val, 10);
  const el = document.getElementById('bval-'+key);
  if(el) el.textContent = val;
  updateHero();
  persistDraft();
};

function scoresNow(){
  const pos = currentPos();
  const action = actionScore(form.counts, pos);
  const effort = effortScore(form.behaviors);
  return {action, effort, overall: overallScore(form.counts, form.behaviors, pos), pos};
}
function updateHero(){
  const s = scoresNow();
  document.getElementById('heroScore').innerHTML = fmtNum(s.overall, 1) + '<small>/10</small>';
  document.getElementById('heroAction').textContent = fmtNum(s.action, 1);
  document.getElementById('heroEffort').textContent = fmtNum(s.effort, 1);
  const minutes = Number(document.getElementById('f-minutes').value) || 60;
  document.getElementById('heroLabel').textContent = minutes < 25 ? t('heroShort') : t('heroOverall');
  const ins = buildInsights({
    counts: form.counts, behaviors: form.behaviors, position: s.pos,
    minutes, rating: s.overall, role: document.getElementById('f-role').value
  }, matches);
  document.getElementById('insightBox').innerHTML =
    `<b>${escapeHtml(t('insightPlus'))}:</b> ${escapeHtml(ins.plus)}<br><b>${escapeHtml(t('insightFocus'))}:</b> ${escapeHtml(ins.focus)}`;
  document.getElementById('liveScore').textContent = fmtNum(s.action, 1);
}

function setEditUi(on){
  document.getElementById('saveBtn').textContent = on ? t('saveChanges') : t('saveMatch');
  document.getElementById('cancelEditBtn').hidden = !on;
}

function resetForm(keepDraft){
  editingId = null;
  form = emptyForm();
  liveStack = [];
  matchClock = emptyClock();
  stopClockTick();
  renderLiveClock();
  setEditUi(false);
  document.getElementById('f-opponent').value = '';
  fillScoreFields('');
  document.getElementById('f-comment').value = '';
  document.getElementById('f-kind').value = 'league';
  document.getElementById('f-tournament').value = '';
  document.getElementById('f-venue').value = 'home';
  document.getElementById('f-role').value = 'start';
  fillMatchPitchSelects(defaultPitch());
  document.getElementById('f-format').value = settings.format || '2x30';
  document.getElementById('f-matchlen').value = settings.minutes;
  syncPlayedDefault(true);
  syncCompetitionField();
  document.getElementById('f-date').value = todayStr();
  renderMetrics();
  renderBehaviors();
  renderFocusBanner();
  updateHero();
  syncDateShown();
  if(!keepDraft){
    sessionStorage.removeItem(draftStorageKey());
    sessionStorage.removeItem(DRAFT_KEY);
  }
}

function fillForm(m){
  editingId = m.id;
  form.counts = {...emptyForm().counts, ...m.counts};
  form.behaviors = {...emptyForm().behaviors, ...m.behaviors};
  document.getElementById('f-date').value = m.date;
  fillMatchPitchSelects(m.pitchPos || m.position);
  document.getElementById('f-opponent').value = m.opponent;
  fillScoreFields(m.score);
  document.getElementById('f-minutes').value = m.minutes;
  document.getElementById('f-format').value = m.format || '2x30';
  document.getElementById('f-matchlen').value = m.matchLen || m.minutes;
  document.getElementById('customLengthWrap').hidden = document.getElementById('f-format').value !== 'custom';
  document.getElementById('f-kind').value = m.kind || 'league';
  document.getElementById('f-tournament').value = m.tournament || '';
  document.getElementById('f-venue').value = m.venue === 'away' ? 'away' : 'home';
  document.getElementById('f-role').value = m.role === 'sub' ? 'sub' : 'start';
  document.getElementById('f-comment').value = m.comment;
  matchClock = hydrateClock({
    startedAt: m.kickoffAt || null,
    events: Array.isArray(m.timeline) ? m.timeline.slice() : [],
    phase: m.kickoffAt ? 'done' : 'idle',
    period: periodShape(m.format, m.matchLen).parts
  });
  syncCompetitionField();
  setEditUi(true);
  renderMetrics();
  renderBehaviors();
  renderFocusBanner();
  updateHero();
  syncDateShown();
  persistDraft();
  renderLiveClock();
  if(clockPhase() === 'run') startClockTick();
}

function collectMatch(){
  const pos = currentPos();
  const counts = {...form.counts};
  const behaviors = {...form.behaviors};
  const action = actionScore(counts, pos);
  const effort = effortScore(behaviors);
  return {
    id: editingId || Date.now(),
    player: displayName(),
    date: document.getElementById('f-date').value || todayStr(),
    opponent: document.getElementById('f-opponent').value.trim(),
    score: scoreFromFields(),
    pitchPos: currentPitch(),
    position: pos,
    tournament: document.getElementById('f-kind').value === 'friendly' ? '' : document.getElementById('f-tournament').value.trim().slice(0,48),
    venue: document.getElementById('f-venue').value === 'away' ? 'away' : 'home',
    role: document.getElementById('f-role').value === 'sub' ? 'sub' : 'start',
    comment: document.getElementById('f-comment').value.trim(),
    minutes: Math.min(120, Math.max(1, Number(document.getElementById('f-minutes').value) || formatLength(document.getElementById('f-format').value, document.getElementById('f-matchlen').value))),
    format: document.getElementById('f-format').value,
    matchLen: formatLength(document.getElementById('f-format').value, document.getElementById('f-matchlen').value),
    kind: document.getElementById('f-kind').value,
    season: (editingId && matches.find(x => x.id === editingId)?.season) || (seasonIsOpen() ? (player.season || seasonFromDate(document.getElementById('f-date').value)) : seasonFromDate(document.getElementById('f-date').value)),
    team: (editingId && matches.find(x => x.id === editingId)?.team) || player.team || player.club || '',
    counts, behaviors,
    timeline: matchClock.events.slice(),
    kickoffAt: matchClock.startedAt || 0,
    kickoffClock: matchClock.startedAt ? warsawClock(matchClock.startedAt) : '',
    actionRating: action,
    effortRating: effort,
    rating: overallScore(counts, behaviors, pos)
  };
}

document.getElementById('saveBtn').addEventListener('click', () => {
  const row = collectMatch();
  if(!row.opponent && !confirm(t('confirmNoOpp'))) return;
  const dup = matches.some(m => m.id !== row.id && m.date === row.date && m.opponent === row.opponent && row.opponent);
  if(dup && !editingId && !confirm(t('confirmDup'))) return;
  if(!editingId && !seasonIsOpen()){
    const s = row.season || seasonFromDate(row.date);
    if(!confirm(t('confirmOpenForMatch', {s}))) return;
    openSeason(s, true);
    row.season = s;
  }
  if(editingId) matches = matches.map(m => m.id === editingId ? row : m);
  else matches.push(row);
  if(!editingId) historyPage = 1;
  saveMatches();
  fillSeasonSelects();
  lastReportMatch = row;
  document.getElementById('reportCard').innerHTML = renderReportHtml(row);
  showToast(editingId ? t('toastUpdated') : t('toastSaved'));
  resetForm();
  renderHistory();
  renderStats();
  renderOppList();
  showView('report');
});

document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

['f-date','f-position','f-opponent','f-score-us','f-score-them','f-minutes','f-format','f-matchlen','f-kind','f-tournament','f-venue','f-role','f-comment'].forEach(id => {
  const el = document.getElementById(id);
  const onChange = () => {
    if(id === 'f-position'){
      document.getElementById('live-position').value = currentPitch();
      renderMetrics(); renderLiveGrid();
    }
    if(id === 'f-kind') syncCompetitionField();
    if(id === 'f-date') syncDateShown();
    if(id === 'f-score-us' || id === 'f-score-them') scoreFallback = '';
    if(id === 'f-format'){ syncPlayedDefault(true); renderLiveClock(); }
    if(id === 'f-matchlen' && document.getElementById('f-format').value === 'custom'){
      document.getElementById('f-minutes').value = document.getElementById('f-matchlen').value;
      renderLiveClock();
    }
    updateHero(); persistDraft();
  };
  el.addEventListener('input', onChange);
  el.addEventListener('change', onChange);
});

let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 1800);
}

function refreshBackupBanner(){
  const el = document.getElementById('backupBanner');
  if(el) el.hidden = !(matches.length > 0 && !localStorage.getItem(EXPORT_KEY));
}
function renderHistory(){
  refreshBackupBanner();
  const el = document.getElementById('historyList');
  const pager = document.getElementById('historyPager');
  const hidePager = () => { if(pager){ pager.hidden = true; pager.innerHTML = ''; } };
  const toolbar = document.getElementById('historyToolbar');
  if(matches.length === 0){
    if(toolbar) toolbar.hidden = true;
    el.innerHTML = emptyCtaHtml(t('noMatches'));
    hidePager();
    return;
  }
  if(toolbar) toolbar.hidden = false;
  const list = [...seasonPool()].reverse();
  if(!list.length){
    el.innerHTML = emptyCtaHtml(t('noPeriod'));
    hidePager();
    return;
  }
  const pages = Math.max(1, Math.ceil(list.length / HISTORY_PAGE));
  if(historyPage > pages) historyPage = pages;
  if(historyPage < 1) historyPage = 1;
  const start = (historyPage - 1) * HISTORY_PAGE;
  const slice = list.slice(start, start + HISTORY_PAGE);
  const showSeason = currentSeasonFilter === 'all';
  el.innerHTML = slice.map(m => {
    return `<div class="match-card">
      <div class="match-card-top" onclick="toggleDetails(${m.id})">
        <div class="match-meta">
          <span class="match-date">${escapeHtml(formatDate(m.date))}${showSeason ? ' · ' + escapeHtml(matchSeason(m)) : ''} · ${escapeHtml(matchPosDisplay(m))} · ${escapeHtml(venueLabel(m.venue))} · ${escapeHtml(roleLabel(m.role))} · ${escapeHtml(kindLabel(m.kind))}${m.tournament ? ' · ' + escapeHtml(m.tournament) : ''} · ${escapeHtml((m.format||'').replace('x','×') || t('fmtCustom'))} · ${escapeHtml(t('minLbl', {n:m.minutes}))}</span>
          <span class="match-opp">${escapeHtml(m.opponent || t('unnamed'))}</span>
          <span class="match-score">${m.score ? escapeHtml(t('scoreLbl', {s:m.score})) : ''} · ${escapeHtml(t('heroAction'))} ${fmtNum(m.actionRating, 1)} · ${escapeHtml(t('heroEffort'))} ${fmtNum(m.effortRating, 1)}</span>
        </div>
        <div class="match-rating ${ratingClass(m.rating)}">${fmtNum(m.rating, 1)}</div>
      </div>
      <div class="match-details" id="details-${m.id}">
        ${renderReportHtml(m, true)}
        ${m.comment ? `<div>${escapeHtml(m.comment)}</div>` : ''}
        <div class="card-actions">
          <button class="share-btn" type="button" onclick="shareMatch(${m.id})">${escapeHtml(t('cardBtn'))}</button>
          <button class="share-btn" type="button" onclick="toggleStory(${m.id})">${escapeHtml(t('storyTitle'))}</button>
          <button class="edit-btn" type="button" onclick="editMatch(${m.id})">${escapeHtml(t('editBtn'))}</button>
          <button class="del-btn" type="button" onclick="deleteMatch(${m.id})">${escapeHtml(t('delBtn'))}</button>
        </div>
        <div class="match-story" id="story-${m.id}" hidden>${matchStoryHtml(m)}</div>
      </div>
    </div>`;
  }).join('');
  if(!pager) return;
  if(pages <= 1){ hidePager(); return; }
  const from = start + 1;
  const to = start + slice.length;
  const nums = [];
  const span = 5;
  let a = Math.max(1, historyPage - 2);
  let b = Math.min(pages, a + span - 1);
  a = Math.max(1, b - span + 1);
  for(let i = a; i <= b; i++) nums.push(i);
  pager.hidden = false;
  pager.innerHTML =
    `<div class="hist-meta">${escapeHtml(t('histRange', {from, to, total: list.length}))} · ${escapeHtml(t('histPage', {n: historyPage, total: pages}))}</div>` +
    `<button type="button" ${historyPage <= 1 ? 'disabled' : ''} onclick="historyGo(${historyPage - 1})">${escapeHtml(t('histPrev'))}</button>` +
    nums.map(n => `<button type="button" class="${n === historyPage ? 'on' : ''}" onclick="historyGo(${n})">${n}</button>`).join('') +
    `<button type="button" ${historyPage >= pages ? 'disabled' : ''} onclick="historyGo(${historyPage + 1})">${escapeHtml(t('histNext'))}</button>`;
}
window.historyGo = function(p){
  historyPage = p;
  renderHistory();
  document.getElementById('view-history')?.scrollIntoView({block:'start'});
};

window.toggleDetails = function(id){ document.getElementById('details-'+id)?.classList.toggle('open'); };
window.toggleStory = function(id){
  const el = document.getElementById('story-'+id);
  if(el) el.hidden = !el.hidden;
};
window.editMatch = function(id){
  const m = matches.find(x => x.id === id);
  if(!m) return;
  fillForm(m);
  showView('new');
};
window.deleteMatch = function(id){
  if(!confirm(t('confirmDel'))) return;
  matches = matches.filter(m => m.id !== id);
  saveMatches();
  if(editingId === id) resetForm();
  fillSeasonSelects();
  renderHistory(); renderStats(); renderOppList(); renderFocusBanner();
  showToast(t('toastDeleted'));
};
window.shareMatch = function(id){
  const m = matches.find(x => x.id === id);
  if(m) shareCard(m);
};

function showView(name){
  const views = ['player','new','history','stats','settings','report'];
  if(!views.includes(name)) name = 'new';
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-'+name));
  document.getElementById('heroBlock').style.display = (name === 'new') ? 'grid' : 'none';
  document.querySelector('.topbar').classList.toggle('compact', name !== 'new');
  if(name === 'player') fillPlayerForm();
  if(name === 'report' && lastReportMatch){
    document.getElementById('reportCard').innerHTML = renderReportHtml(lastReportMatch);
    document.getElementById('reportStory').innerHTML = matchStoryHtml(lastReportMatch);
  }
  if(name === 'history') renderHistory();
  if(name === 'stats') renderStats();
  renderLiveClock();
  if(clockPhase() === 'run') startClockTick();
  try{ sessionStorage.setItem(VIEW_KEY, name === 'report' ? 'history' : name); }catch(e){}
}
function restoreView(){
  let name = 'new';
  try{ name = sessionStorage.getItem(VIEW_KEY) || 'new'; }catch(e){}
  if(name === 'report') name = 'history';
  if(!['player','new','history','stats','settings'].includes(name)) name = 'new';
  showView(name);
}

function exportPayload(){
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    player,
    settings: {lang: settings.lang, format: settings.format, minutes: settings.minutes, position: settings.position, theme: settings.theme},
    matches
  };
}
function downloadMatches(){
  if(!matches.length && !player.firstName){ showToast(t('toastNothingExport')); return; }
  const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], {type:'application/json'});
  const filename = `ffk_${todayStr()}.json`;
  const file = new File([blob], filename, {type:'application/json'});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file], title:'FFK'}).then(() => {
      localStorage.setItem(EXPORT_KEY, todayStr());
      renderHistory();
    }).catch(() => triggerDownload(blob, filename));
    return;
  }
  triggerDownload(blob, filename);
}
function triggerDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem(EXPORT_KEY, todayStr());
  renderHistory();
  showToast(t('toastFileSaved'));
}

document.getElementById('exportBtn').addEventListener('click', downloadMatches);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('copyBtn').addEventListener('click', async () => {
  try{
    await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
    localStorage.setItem(EXPORT_KEY, todayStr());
    renderHistory();
    showToast(t('toastCopied'));
  }catch(e){ showToast(t('toastCopyFail')); }
});
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const imported = JSON.parse(await file.text());
    const bundle = Array.isArray(imported) ? {matches: imported} : imported;
    if(bundle.player && typeof bundle.player === 'object'){
      player = normalizePlayer({...player, ...bundle.player}, player.id);
      extraSelected = [...(player.extra || [])];
      savePlayer();
      syncSettingsFromPlayer();
      if(bundle.settings && typeof bundle.settings === 'object'){
        if(LANGS.includes(bundle.settings.lang)){
          settings.lang = bundle.settings.lang;
          settings.langManual = true;
        }
        if(bundle.settings.format) settings.format = bundle.settings.format;
        if(bundle.settings.minutes) settings.minutes = String(bundle.settings.minutes);
        if(bundle.settings.theme === 'light' || bundle.settings.theme === 'dark') settings.theme = bundle.settings.theme;
      }
      saveSettings();
      applyHeader();
      applyI18n();
      applyTheme();
    }
    const incoming = Array.isArray(bundle.matches) ? bundle.matches : (Array.isArray(imported) ? imported : []);
    if(!incoming.length && !bundle.player) throw new Error('bad');
    const ids = new Set(matches.map(m => m.id));
    let added = 0;
    incoming.forEach(raw => {
      const m = normalizeMatch(raw);
      if(!m || ids.has(m.id)) return;
      matches.push(m); ids.add(m.id); added++;
    });
    saveMatches(); fillSeasonSelects(); renderHistory(); renderStats(); renderOppList();
    showToast(added ? t('toastAdded', {n: added}) : (bundle.player ? t('toastPlayer') : t('toastNoNew')));
  }catch(err){ showToast(t('toastReadFail')); }
  e.target.value = '';
});

let currentRange = '10';
let chartRange = '10';
let cardPeriod = '10';
let currentSeasonFilter = 'current';
let historyPage = 1;
const HISTORY_PAGE = 10;
function loadFilters(){
  try{
    const f = JSON.parse(localStorage.getItem(FILTER_KEY) || '{}');
    if(f.season === 'all' || f.season === 'current' || /^\d{4}\/\d{2}$/.test(String(f.season || ''))) currentSeasonFilter = f.season;
    if(['10','100','all'].includes(f.range)) currentRange = f.range;
    if(['10','100','all'].includes(f.chart)) chartRange = f.chart;
    if(['10','7d','30d','year','all'].includes(f.cardPeriod)) cardPeriod = f.cardPeriod;
  }catch(e){}
}
function saveFilters(){
  try{
    localStorage.setItem(FILTER_KEY, JSON.stringify({
      season: currentSeasonFilter,
      range: currentRange,
      chart: chartRange,
      cardPeriod
    }));
  }catch(e){}
}
function syncFilterChips(){
  document.querySelectorAll('#periodChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.range === currentRange);
  });
  document.querySelectorAll('#chartChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.chart === chartRange);
  });
  document.querySelectorAll('#cardPeriodChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cardPeriod === cardPeriod);
  });
}
function knownSeasons(){
  const set = new Set();
  matches.forEach(m => { const s = matchSeason(m); if(s) set.add(s); });
  if(player.season) set.add(player.season);
  return [...set].sort().reverse();
}
function fillSeasonSelects(){
  const current = player.season || currentSeason();
  const extra = knownSeasons().filter(s => s !== current);
  const html = `<option value="current">${escapeHtml(seasonIsOpen() ? t('seasonCurrent', {s: current}) : t('seasonClosed', {s: current}))}</option>` +
    `<option value="all">${escapeHtml(t('seasonAll'))}</option>` +
    extra.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  ['statsSeason','historySeason'].forEach(id => {
    const sel = document.getElementById(id);
    if(!sel) return;
    sel.innerHTML = html;
    if(![...sel.options].some(o => o.value === currentSeasonFilter)){
      currentSeasonFilter = 'current';
      saveFilters();
    }
    sel.value = currentSeasonFilter;
  });
}
function seasonPool(){
  const sorted = [...matches].sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id);
  if(currentSeasonFilter === 'all') return sorted;
  const s = currentSeasonFilter === 'current' ? (player.season || currentSeason()) : currentSeasonFilter;
  return sorted.filter(m => matchSeason(m) === s);
}
['statsSeason','historySeason'].forEach(id => {
  document.getElementById(id).addEventListener('change', e => {
    currentSeasonFilter = e.target.value;
    historyPage = 1;
    saveFilters();
    fillSeasonSelects();
    renderHistory();
    renderStats();
  });
});
document.getElementById('periodChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip) return;
  document.querySelectorAll('#periodChips .chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  currentRange = chip.dataset.range || '10';
  saveFilters();
  renderStats();
});
document.getElementById('chartChips').addEventListener('click', e => {
  const chip = e.target.closest('[data-chart]');
  if(!chip) return;
  document.querySelectorAll('#chartChips .chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  chartRange = chip.dataset.chart || '10';
  saveFilters();
  renderStats();
});
document.getElementById('cardPeriodChips').addEventListener('click', e => {
  const chip = e.target.closest('[data-card-period]');
  if(!chip) return;
  document.querySelectorAll('#cardPeriodChips .chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  cardPeriod = chip.dataset.cardPeriod || '10';
  saveFilters();
});
function cardPeriodMatches(){
  const sorted = seasonPool();
  if(cardPeriod === '10') return sorted.slice(-10);
  if(cardPeriod === 'all') return sorted;
  if(cardPeriod === 'year'){
    const y = String(new Date().getFullYear());
    return sorted.filter(m => String(m.date).startsWith(y));
  }
  const days = cardPeriod === '7d' ? 7 : 30;
  return sorted.filter(m => m.date >= daysAgoStr(days));
}
function cardPeriodLabel(){
  const range = ({
    '10': t('periodLast10'),
    '7d': t('periodWeek'),
    '30d': t('periodMonth'),
    'year': t('periodYear'),
    'all': t('periodAll')
  })[cardPeriod] || t('periodLast10');
  if(currentSeasonFilter === 'all'){
    if(cardPeriod === 'all') return t('seasonAll');
    return t('seasonAll') + ' · ' + range;
  }
  if(cardPeriod === 'all') return seasonNameLabel();
  return seasonNameLabel() + ' · ' + range;
}
function chartMatches(){
  const all = sortedMatches();
  if(chartRange === '10') return all.slice(-10);
  if(chartRange === '100') return all.slice(-100);
  return all;
}
function statsMatches(){
  const sorted = seasonPool();
  if(currentRange === '10') return sorted.slice(-10);
  if(currentRange === '100') return sorted.slice(-100);
  return sorted;
}
function ratingTrend(list){
  if(list.length < 2) return 0;
  if(list.length < 4) return list[list.length-1].rating - list[0].rating;
  const mid = Math.floor(list.length / 2);
  const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  return avg(list.slice(mid).map(m=>m.rating)) - avg(list.slice(0, mid).map(m=>m.rating));
}
function fmtInt(n){
  const s = String(Math.round(Number(n) || 0));
  const sep = settings.lang === 'en' ? ',' : '\u00a0';
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
function declined(n, key){
  const parts = String(t(key) || '').split('|').filter(Boolean);
  if(!parts.length) return '';
  if(langLatin()) return n === 1 ? parts[0] : (parts[1] || parts[0]);
  return parts[slavicForm(n)] || parts[0];
}
function countPhrase(n, key){
  return fmtInt(n) + ' ' + declined(n, key);
}
function seasonNameLabel(){
  if(currentSeasonFilter === 'all') return t('periodAll');
  if(currentSeasonFilter === 'current') return player.season || currentSeason();
  return currentSeasonFilter;
}
function statsPeriodLabel(){
  const range = ({
    '10': t('chart10'),
    '100': t('chart100'),
    'all': t('periodAll')
  })[currentRange] || t('chart10');
  if(currentSeasonFilter === 'all'){
    if(currentRange === 'all') return t('seasonAll');
    return t('seasonAll') + ' · ' + range;
  }
  if(currentRange === 'all') return seasonNameLabel();
  return seasonNameLabel() + ' · ' + range;
}
function sortedMatches(){
  return [...matches].sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id);
}
function countSum(list, key){
  return list.reduce((a,m)=> a + ((m.counts || {})[key] || 0), 0);
}
function avgPerMatch(list, key){
  if(!list.length) return 0;
  return countSum(list, key) / list.length;
}
function duelPct(list){
  const w = countSum(list, 'duelswon');
  const l = countSum(list, 'duelslost');
  if(w + l === 0) return null;
  return 100 * w / (w + l);
}
function seasonWindows(list){
  const n = list.length;
  if(n < 4) return null;
  const w = n >= 10 ? 5 : (n >= 6 ? Math.floor(n / 2) : 2);
  return {start: list.slice(0, w), now: list.slice(-w), w};
}
function dynCls(now, start, invert){
  const d = now - start;
  if(Math.abs(d) < 0.05) return '';
  const better = invert ? d < 0 : d > 0;
  return better ? 'up' : 'down';
}
function renderSeasonBoard(){
  const el = document.getElementById('seasonBoard');
  const list = seasonPool();
  const name = seasonNameLabel();
  if(!list.length){
    el.innerHTML = `<article class="season-board"><div class="season-head">
      <div class="season-kicker">${escapeHtml(t('stSeasonTitle'))}</div>
      <div class="season-name">${escapeHtml(name)}</div>
    </div><div style="padding:8px 12px 16px;">${emptyCtaHtml(t(matches.length ? 'noPeriod' : 'noMatches'))}</div></article>`;
    return;
  }
  const avg = list.reduce((a,m)=>a+m.rating,0)/list.length;
  const starts = list.filter(m => m.role !== 'sub').length;
  const subs = list.length - starts;
  const minutes = list.reduce((a,m)=>a+(m.minutes||0),0);
  const kpis = [
    [list.length, 'mn_matches'],
    [starts, 'mn_starts'],
    [subs, 'mn_subs'],
    [minutes, 'mn_mins'],
    [countSum(list,'goals'), 'mn_goals'],
    [countSum(list,'assists'), 'mn_assists']
  ].map(([n,key]) => `<div class="kpi-cell"><div class="n">${fmtInt(n)}</div><div class="l">${escapeHtml(declined(n, key))}</div></div>`).join('');
  const acts = [
    ['dribbles', 'act_dribbles', false],
    ['tackles', 'mn_tackles', false],
    ['duelswon', 'act_duelswon', false],
    ['passes', 'mn_passes', false],
    ['losses', 'mn_losses', true]
  ].map(([key, noun, bad]) => {
    const n = countSum(list, key);
    return `<div class="act-row${bad ? ' bad' : ''}"><span class="n">${fmtInt(n)}</span><span>${escapeHtml(declined(n, noun))}</span></div>`;
  }).join('');
  const win = seasonWindows(list);
  let dyn = '';
  if(win){
    const mean = arr => arr.reduce((a,m)=>a+m.rating,0)/arr.length;
    const r0 = mean(win.start), r1 = mean(win.now);
    const d0 = avgPerMatch(win.start,'dribbles'), d1 = avgPerMatch(win.now,'dribbles');
    const t0 = avgPerMatch(win.start,'tackles'), t1 = avgPerMatch(win.now,'tackles');
    const l0 = avgPerMatch(win.start,'losses'), l1 = avgPerMatch(win.now,'losses');
    const p0 = duelPct(win.start), p1 = duelPct(win.now);
    const pct = (v, digits) => v == null ? '—' : fmtNum(v, digits) + '%';
    const rows = [
      [t('dyn_rating'), fmtNum(r0,1), fmtNum(r1,1), dynCls(r1,r0,false)],
      [t('dyn_dribbles'), fmtNum(d0,1), fmtNum(d1,1), dynCls(d1,d0,false)],
      [t('dyn_tackles'), fmtNum(t0,1), fmtNum(t1,1), dynCls(t1,t0,false)],
      [t('dyn_losses'), fmtNum(l0,1), fmtNum(l1,1), dynCls(l1,l0,true)],
      [t('dyn_duels'), pct(p0,0), pct(p1,0), (p0 == null || p1 == null) ? '' : dynCls(p1,p0,false)]
    ].map(r => `<tr><td>${escapeHtml(r[0])}</td><td>${r[1]}</td><td class="${r[3]}">${r[2]}</td></tr>`).join('');
    dyn = `<div class="board-block">
      <h3>${escapeHtml(t('stDynamics'))}</h3>
      <table class="dyn-table">
        <thead><tr><th>${escapeHtml(t('stDynMetric'))}</th><th>${escapeHtml(t('stDynStart'))}</th><th>${escapeHtml(t('stDynNow'))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="dyn-hint">${escapeHtml(t('stDynHint', {n: win.w}))}</p>`;
  }
  el.innerHTML = `<article class="season-board">
    <div class="season-head">
      <div class="season-kicker">${escapeHtml(t('stSeasonTitle'))}</div>
      <div class="season-name">${escapeHtml(name)}</div>
      <div class="season-avg">${escapeHtml(fmtNum(avg, 2))}<small>${escapeHtml(t('stSeasonAvg'))}</small></div>
    </div>
    <div class="kpi-grid">${kpis}</div>
    <div class="board-block">
      <h3>${escapeHtml(t('stActions'))}</h3>
      ${acts}
    </div>
    ${dyn}
  </article>`;
}
function avgRating(list){
  if(!list.length) return null;
  return list.reduce((a,m)=>a+m.rating,0)/list.length;
}
function groupedAvgs(list, keyFn){
  const map = new Map();
  list.forEach(m => {
    const k = keyFn(m);
    if(!k) return;
    if(!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  });
  return [...map.entries()]
    .map(([key, arr]) => ({key, n: arr.length, avg: avgRating(arr), list: arr}))
    .sort((a,b) => b.n - a.n || b.avg - a.avg);
}
function matchPosKey(m){
  if(isPitchCode(m.pitchPos)) return m.pitchPos;
  if(isPitchCode(m.position)) return m.position;
  return ratingPosOf(m.position) || '';
}
function cmpRow(label, list, vs){
  const avg = avgRating(list);
  if(avg == null) return '';
  const cls = vs == null || list.length < 2 ? '' : dynCls(avg, vs, false);
  return `<tr><td><span class="cmp-name">${escapeHtml(label)}</span><span class="cmp-n">${escapeHtml(matchCountLabel(list.length))}</span></td><td class="${cls}">${fmtNum(avg, 2)}</td></tr>`;
}
function cmpSection(title, rows){
  if(!rows) return '';
  return `<div class="board-block"><h3>${escapeHtml(title)}</h3><table class="cmp-table"><tbody>${rows}</tbody></table></div>`;
}
function renderCompare(){
  const el = document.getElementById('compareBoard');
  const all = [...matches].sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id);
  if(!all.length){
    el.innerHTML = '';
    return;
  }
  const career = avgRating(all);
  const last = all.slice(-Math.min(10, all.length));
  const seasonName = player.season || currentSeason();
  const seasonList = all.filter(m => matchSeason(m) === seasonName);
  const who = (player.firstName || displayName() || '—').trim();
  const lastLbl = last.length === 10 ? t('cmpLast10') : t('cmpLastN', {n: last.length});
  let main = cmpRow(lastLbl, last, career);
  if(seasonList.length) main += cmpRow(`${t('cmpSeason')} ${seasonName}`, seasonList, career);
  const posGroups = groupedAvgs(all, matchPosKey).filter(g => g.key);
  const posRows = posGroups.length > 1
    ? posGroups.map(g => cmpRow(isPitchCode(g.key) ? pitchPosLabel(g.key) : posLabel(g.key), g.list, career)).join('')
    : '';
  const seasonGroups = groupedAvgs(all, m => matchSeason(m)).filter(g => g.key);
  const seasonRows = seasonGroups.length > 1
    ? seasonGroups.map(g => cmpRow(g.key, g.list, career)).join('')
    : '';
  const teamGroups = groupedAvgs(all, m => String(m.team || '').trim()).filter(g => g.key);
  const teamRows = teamGroups.length > 1
    ? teamGroups.map(g => cmpRow(g.key, g.list, career)).join('')
    : '';
  el.innerHTML = `<article class="season-board compare-board">
    <div class="season-head">
      <div class="season-kicker">${escapeHtml(t('cmpTitle'))}</div>
      <div class="season-name">${escapeHtml(who)}</div>
      <div class="season-avg">${fmtNum(career, 2)}<small>${escapeHtml(t('cmpAll'))}</small></div>
    </div>
    <table class="cmp-table"><tbody>${main}</tbody></table>
    ${cmpSection(t('cmpPos'), posRows)}
    ${cmpSection(t('cmpSeasons'), seasonRows)}
    ${cmpSection(t('cmpTeams'), teamRows)}
  </article>`;
}
function renderStats(){
  renderSeasonBoard();
  renderCompare();
  renderPlayerFeed();
  const list = statsMatches();
  renderTimingBoard();
  const grid = document.getElementById('statGrid');
  document.getElementById('periodHead').textContent = statsPeriodLabel();
  const chartList = chartMatches();
  if(!list.length){
    grid.innerHTML = matches.length
      ? `<div style="grid-column:1/-1;">${emptyCtaHtml(t('noPeriod'))}</div>`
      : '';
    drawChart(chartList);
    return;
  }
  const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  const sum = key => list.reduce((a,m)=>a+(m.counts[key]||0),0);
  const minutes = list.reduce((a,m)=>a+(m.minutes||0),0);
  const ratings = list.map(m=>m.rating);
  const trend = ratingTrend(list);
  const trendCls = trend > 0.05 ? 'up' : (trend < -0.05 ? 'down' : '');
  const trendMark = trend > 0.05 ? '↗ ' : (trend < -0.05 ? '↘ ' : '→ ');
  grid.innerHTML = [
    {num:fmtNum(avg(ratings), 2), lbl:t('stAvg')},
    {num:trendMark + fmtSigned(trend, 2), lbl:t('stTrend'), cls:trendCls},
    {num:fmtNum(Math.max(...ratings), 1), lbl:t('stBest')},
    {num:fmtNum(Math.min(...ratings), 1), lbl:t('stWorst')},
    {num:list.length, lbl:t('stMatches')},
    {num:minutes, lbl:t('stMins')},
    {num:sum('goals'), lbl:t('stGoals')},
    {num:minutes?fmtNum(sum('goals')*90/minutes, 1):fmtNum(0, 1), lbl:t('stG90')},
  ].map(c=>`<div class="stat-card"><div class="num ${c.cls||''}">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');
  drawChart(chartList);
}
function drawChart(list){
  const svg = document.getElementById('chartSvg');
  if(list.length < 1){
    svg.innerHTML = `<text x="160" y="100" text-anchor="middle" font-size="12" fill="${cssVar('--text-soft','#8D9AB5')}">${escapeHtml(t('chartEmpty'))}</text>`;
    return;
  }
  const w=320,h=200,padL=36,padR=14,padT=14,padB=30;
  const ratings = list.map(m=>m.rating);
  let yMin = Math.min(...ratings);
  let yMax = Math.max(...ratings);
  if(yMax - yMin < 0.6){
    const mid = (yMax + yMin) / 2;
    yMin = mid - 0.4;
    yMax = mid + 0.4;
  } else {
    yMin -= 0.2;
    yMax += 0.2;
  }
  yMin = Math.max(0, yMin);
  yMax = Math.min(10, yMax);
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xAt = i => padL + (list.length === 1 ? innerW/2 : i * innerW / (list.length-1));
  const yAt = r => padT + (1 - (r - yMin)/(yMax - yMin)) * innerH;
  const ticks = 4;
  let grid = '';
  for(let i=0;i<=ticks;i++){
    const val = yMin + (yMax-yMin)*(i/ticks);
    const y = yAt(val);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w-padR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/>
      <text x="${padL-6}" y="${y+3}" font-size="9" fill="${cssVar('--text-soft','#8D9AB5')}" text-anchor="end">${escapeHtml(fmtNum(val, 1))}</text>`;
  }
  const xs = list.map((_,i)=> xAt(i));
  const ys = ratings.map(r => yAt(r));
  const path = list.length === 1 ? '' : `<path d="${xs.map((x,i)=> `${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')}" fill="none" stroke="${cssVar('--accent','#22D3A6')}" stroke-width="2.5"/>`;
  const step = list.length > 10 ? Math.ceil(list.length / 8) : 1;
  const dotStep = list.length > 40 ? Math.ceil(list.length / 40) : 1;
  const dots = xs.map((x,i)=> {
    const last = i === xs.length-1;
    if(!last && i % dotStep) return '';
    return `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${last?5:3.5}" fill="${last?cssVar('--gold','#F5B942'):cssVar('--accent','#22D3A6')}"/>`;
  }).join('');
  const labels = xs.map((x,i)=> {
    if(i !== 0 && i !== xs.length-1 && i % step) return '';
    return `<text x="${x.toFixed(1)}" y="${h-8}" font-size="9" fill="${cssVar('--text-soft','#8D9AB5')}" text-anchor="middle">${i+1}</text>`;
  }).join('');
  svg.innerHTML = `${grid}${path}${dots}${labels}`;
}

function renderLiveGrid(){
  const pos = ratingPosOf(document.getElementById('live-position').value || currentPitch());
  document.getElementById('liveGrid').innerHTML = metricsFor(pos).map(m => {
    const neg = weightOf(m, pos) < 0;
    return `<div class="live-cell ${neg?'neg':''}">
      <button class="live-plus" type="button" onclick="stepMetric('${m.key}',1)">
        ${escapeHtml(metricLabel(m.key))}<span class="n" id="live-cnt-${m.key}">${form.counts[m.key]||0}</span>
      </button>
      <button class="live-minus" type="button" onclick="stepMetric('${m.key}',-1)">−</button>
    </div>`;
  }).join('');
}
function stopClockTick(){
  if(liveClockTimer){ clearInterval(liveClockTimer); liveClockTimer = 0; }
}
function startClockTick(){
  stopClockTick();
  liveClockTimer = setInterval(renderLiveClock, 1000);
}
function renderLiveClock(){
  const now = Date.now();
  const phase = clockPhase();
  const stamp = matchClock.startedAt ? clockStamp(now) : null;
  const fmt = formatTag();
  const {parts} = periodShape();
  let text = t('liveClockWait', {clock: warsawClock(now), fmt});
  let btnText = t('liveKick');
  let running = false;
  if(phase === 'done'){
    text = t('liveClockDone', {fmt});
    btnText = t('liveMatchOver');
  } else if(phase === 'break'){
    const next = halfLabel((Number(matchClock.period) || 1) + 1);
    text = t('liveClockBreak', {half: next, fmt});
    btnText = t('clockNextPeriod', {half: next});
  } else if(phase === 'run' && stamp){
    const half = halfLabel(stamp.period);
    text = t('liveClockRun', {clock: stamp.clock, m: stamp.minute, len: stamp.each, half, fmt});
    if(stamp.period >= parts) btnText = t('liveEndMatch');
    else btnText = t('clockEndPeriod', {half});
    running = true;
  }
  ['liveClock','formClock'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = text;
    el.classList.toggle('on', running);
  });
  document.querySelectorAll('.js-match-clock-btn').forEach(btn => {
    btn.textContent = btnText;
    btn.disabled = phase === 'done';
    btn.classList.toggle('go', phase === 'idle' || phase === 'break');
  });
}
function startMatchClock(){
  const now = Date.now();
  const phase = clockPhase();
  if(phase === 'done') return;
  if(phase === 'break'){
    matchClock.period = (Number(matchClock.period) || 1) + 1;
    matchClock.periodPlayMs = 0;
    matchClock.playMs = Number(matchClock.playMs) || 0;
  } else if(phase !== 'run'){
    matchClock.startedAt = matchClock.startedAt || now;
    matchClock.period = 1;
    matchClock.periodPlayMs = 0;
    matchClock.playMs = 0;
  }
  matchClock.phase = 'run';
  matchClock.periodRunAt = now;
  matchClock.pausedAt = null;
  startClockTick();
  renderLiveClock();
  persistDraft();
}
function endCurrentPeriod(){
  const now = Date.now();
  const played = periodPlayNow(now);
  matchClock.playMs = (Number(matchClock.playMs) || 0) + played;
  matchClock.periodPlayMs = played;
  matchClock.periodRunAt = null;
  matchClock.pausedAt = now;
  const {parts} = periodShape();
  const period = Number(matchClock.period) || 1;
  matchClock.phase = period < parts ? 'break' : 'done';
  if(matchClock.phase === 'done') stopClockTick();
  renderLiveClock();
  persistDraft();
}
function toggleMatchClock(){
  const phase = clockPhase();
  if(phase === 'done') return;
  if(phase === 'idle' || phase === 'break') startMatchClock();
  else if(phase === 'run') endCurrentPeriod();
}
function openLive(){
  fillPitchSelect(document.getElementById('live-position'), currentPitch());
  renderLiveGrid();
  document.getElementById('app').classList.add('live-on');
  updateHero();
  renderLiveClock();
  if(clockPhase() === 'run') startClockTick();
}
function closeLive(){
  document.getElementById('app').classList.remove('live-on');
  document.getElementById('f-position').value = document.getElementById('live-position').value;
  renderMetrics();
  updateHero();
  renderLiveClock();
  if(clockPhase() === 'run') startClockTick();
  persistDraft();
}
document.getElementById('liveStartBtn').addEventListener('click', openLive);
document.querySelectorAll('.js-match-clock-btn').forEach(btn => {
  btn.addEventListener('click', toggleMatchClock);
});
document.getElementById('liveDoneBtn').addEventListener('click', closeLive);
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go-view]');
  if(go) showView(go.dataset.goView);
});
document.getElementById('live-position').addEventListener('change', () => {
  document.getElementById('f-position').value = document.getElementById('live-position').value;
  renderLiveGrid();
  renderMetrics();
  updateHero();
});

document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', toggleTheme));
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('s-lang').value = settings.lang;
  refreshBackupBanner();
  showView('settings');
});
document.getElementById('s-lang').addEventListener('change', () => {
  settings.lang = document.getElementById('s-lang').value;
  settings.langManual = true;
  saveSettings();
  applyI18n();
});
document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  settings.lang = document.getElementById('s-lang').value;
  settings.langManual = true;
  saveSettings();
  applyHeader();
  applyI18n();
  showToast(t('toastSettings'));
  showView('new');
  updateHero();
});

document.querySelectorAll('.tabbtn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});
document.getElementById('reportDoneBtn').addEventListener('click', () => {
  showView('new');
  window.scrollTo({top:0, behavior:'instant'});
});
document.getElementById('reportShareBtn').addEventListener('click', () => {
  if(lastReportMatch) shareCard(lastReportMatch);
});
document.getElementById('reportStoryBtn').addEventListener('click', () => {
  const el = document.getElementById('reportStory');
  el.hidden = !el.hidden;
});
document.getElementById('pOpenSeasonBtn').addEventListener('click', () => {
  const s = document.getElementById('p-season').value.trim() || nextSeasonLabel(player.season || currentSeason());
  if(openSeason(s)){ currentSeasonFilter = 'current'; saveFilters(); }
});
document.getElementById('pCloseSeasonBtn').addEventListener('click', () => closeSeason(false));
document.getElementById('playerHeadBtn').addEventListener('click', () => showView('player'));
document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);
document.getElementById('statsCardBtn').addEventListener('click', shareStatsCard);
document.getElementById('historyCardBtn').addEventListener('click', shareHistoryCard);
document.getElementById('rosterList').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if(del){ e.preventDefault(); e.stopPropagation(); removePlayer(del.dataset.del); return; }
  const sw = e.target.closest('[data-switch]');
  if(sw) switchPlayer(sw.dataset.switch);
});
document.getElementById('p-primary').addEventListener('change', renderExtraChips);
document.getElementById('pExtraChips').addEventListener('click', e => {
  const chip = e.target.closest('.pos-chip');
  if(!chip) return;
  const code = chip.dataset.pos;
  extraSelected = extraSelected.includes(code) ? extraSelected.filter(x => x !== code) : extraSelected.concat(code);
  renderExtraChips();
});
document.getElementById('pPhotoWrap').addEventListener('click', () => {
  if(currentPhoto()) openPhotoSheet('photo');
  else { photoSheetTarget = 'photo'; pickPhotoFile(); }
});
document.getElementById('pCoverBtn').addEventListener('click', () => {
  if(currentCover()) openPhotoSheet('cover');
  else { photoSheetTarget = 'cover'; pickPhotoFile(); }
});
document.getElementById('photoSheetPick').addEventListener('click', () => { closePhotoSheet(); pickPhotoFile(); });
document.getElementById('photoSheetClear').addEventListener('click', () => {
  if(photoSheetTarget === 'cover'){
    coverDraft = '';
    document.getElementById('p-cover').value = '';
    setCoverPreview();
    persistPlayerMedia('cover');
  } else {
    photoDraft = '';
    document.getElementById('p-photo').value = '';
    setBadge(document.getElementById('pPhotoBox'), '', initials());
    persistPlayerMedia('photo');
  }
  closePhotoSheet();
});
document.getElementById('photoSheetCancel').addEventListener('click', closePhotoSheet);
document.getElementById('photoSheetBack').addEventListener('click', closePhotoSheet);
document.getElementById('p-birth').addEventListener('change', syncDateShown);
document.getElementById('p-photo').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  beginCrop(file, 'photo');
});
document.getElementById('p-cover').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  beginCrop(file, 'cover');
});
document.getElementById('cropCancelBtn').addEventListener('click', closeCrop);
document.getElementById('cropOkBtn').addEventListener('click', () => {
  if(!cropState) return;
  const data = exportCrop();
  if(cropState.target === 'cover'){
    coverDraft = data;
    setCoverPreview();
    persistPlayerMedia('cover');
  } else {
    photoDraft = data;
    setBadge(document.getElementById('pPhotoBox'), photoDraft, initials());
    persistPlayerMedia('photo');
  }
  closeCrop();
});
document.getElementById('cropZoom').addEventListener('input', () => applyCropZoom(true));
(function bindCropDrag(){
  const stage = document.getElementById('cropStage');
  const pos = e => {
    const t = e.touches ? e.touches[0] : e;
    return {x:t.clientX, y:t.clientY};
  };
  stage.addEventListener('pointerdown', e => {
    if(!cropState) return;
    stage.setPointerCapture(e.pointerId);
    cropState.drag = {x:e.clientX, y:e.clientY, ox:cropState.ox, oy:cropState.oy};
  });
  stage.addEventListener('pointermove', e => {
    if(!cropState || !cropState.drag) return;
    cropState.ox = cropState.drag.ox + (e.clientX - cropState.drag.x);
    cropState.oy = cropState.drag.oy + (e.clientY - cropState.drag.y);
    clampCrop();
    renderCrop();
  });
  const end = () => { if(cropState) cropState.drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', e => {
    if(!cropState) return;
    e.preventDefault();
    const z = document.getElementById('cropZoom');
    z.value = String(Math.min(280, Math.max(100, Number(z.value) + (e.deltaY < 0 ? 8 : -8))));
    applyCropZoom(true);
  }, {passive:false});
})();
document.getElementById('savePlayerBtn').addEventListener('click', () => {
  player = collectPlayer();
  extraSelected = [...player.extra];
  photoDraft = undefined;
  coverDraft = undefined;
  savePlayer();
  syncSettingsFromPlayer();
  saveSettings();
  applyHeader();
  if(!editingId){
    fillMatchPitchSelects(player.primary);
    renderMetrics();
    renderLiveGrid();
  }
  showToast(t('toastPlayer'));
  fillSeasonSelects();
  fillPlayerForm();
  showView('player');
  updateHero();
});

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  words.forEach((word, i) => {
    const test = line ? line + ' ' + word : word;
    if(ctx.measureText(test).width > maxWidth && line){
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else line = test;
    if(i === words.length-1) ctx.fillText(line, x, yy);
  });
  return yy;
}

function pathRoundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function loadCanvasImage(src){
  return new Promise(resolve => {
    if(!src){ resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function drawCovered(ctx, img, x, y, w, h, focusY){
  if(!img || !img.width) return;
  const ir = img.width / img.height, r = w / h;
  const fy = focusY == null ? 0.35 : focusY;
  let dw, dh, dx, dy;
  if(ir > r){ dh = h; dw = h * ir; dx = x - (dw - w) / 2; dy = y; }
  else { dw = w; dh = w / ir; dx = x; dy = y - (dh - h) * fy; }
  ctx.drawImage(img, dx, dy, dw, dh);
}
function makeHiCanvas(w, h){
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return {canvas, ctx, w, h};
}
function fifaOvr(list){
  const a = avgRating(list);
  if(a == null) return 60;
  return Math.round(Math.min(99, Math.max(45, a * 10)));
}
function cardPosCode(){
  const p = player.primary;
  if(isPosCode(p)) return p;
  return ({gk:'GK', def:'CB', mid:'CM', fwd:'ST'})[ratingPosOf(p)] || 'ST';
}
function blendCardGrade(list, pos, keys){
  if(!list.length) return 6.2;
  let s = 0, n = 0;
  keys.forEach(key => {
    const met = METRICS.find(x => x.key === key);
    if(!met) return;
    const w = weightOf(met, pos);
    if(!w) return;
    const avg = list.length ? countSum(list, key) / list.length : 0;
    s += metricGrade(avg, key, w);
    n++;
  });
  return n ? s / n : 6.2;
}
function to99(grade){
  return Math.round(Math.min(99, Math.max(40, grade * 10)));
}
function futTheme(ovr){
  if(ovr >= 85) return {
    foil:'#F5D76E', foil2:'#C9A227', ink:'#140C28', paper:['#2A1658', '#0E1A36', '#12382E'],
    glow:'rgba(34,211,166,.45)', plate:'#F5D76E', muted:'#D9C27A'
  };
  if(ovr >= 75) return {
    foil:'#F3D27A', foil2:'#B8860B', ink:'#2A1A06', paper:['#5A3E12', '#2C1C08', '#7A5418'],
    glow:'rgba(245,185,66,.35)', plate:'#F6DE9A', muted:'#E8D5A0'
  };
  if(ovr >= 65) return {
    foil:'#D9E2EC', foil2:'#7C8A99', ink:'#1A2430', paper:['#3D4A5C', '#1B2430', '#5C6B7A'],
    glow:'rgba(180,198,214,.3)', plate:'#E8EEF4', muted:'#C5D0DA'
  };
  return {
    foil:'#E0B089', foil2:'#8A5A32', ink:'#2A160C', paper:['#5A3518', '#24140A', '#7A4A22'],
    glow:'rgba(196,122,62,.3)', plate:'#E8C4A0', muted:'#D7B08A'
  };
}
function futStatRows(list, pos){
  if(pos === 'gk'){
    return [
      ['DIV', to99(blendCardGrade(list, pos, ['saves']))],
      ['HAN', to99(blendCardGrade(list, pos, ['claims']))],
      ['KIC', to99(blendCardGrade(list, pos, ['gkpass']))],
      ['REF', to99(blendCardGrade(list, pos, ['interceptions']))],
      ['POS', to99(blendCardGrade(list, pos, ['conceded']))],
      ['PAS', to99(blendCardGrade(list, pos, ['buildpass', 'gkpass']))]
    ];
  }
  return [
    ['PAC', to99(blendCardGrade(list, pos, ['openings', 'dribbles', 'support']))],
    ['SHO', to99(blendCardGrade(list, pos, ['goals', 'shots']))],
    ['PAS', to99(blendCardGrade(list, pos, ['passes', 'assists', 'chances', 'buildpass']))],
    ['DRI', to99(blendCardGrade(list, pos, ['dribbles']))],
    ['DEF', to99(blendCardGrade(list, pos, ['tackles', 'interceptions', 'blocks', 'clearances']))],
    ['PHY', to99(blendCardGrade(list, pos, ['duelswon', 'support']))]
  ];
}
async function exportPngFile(canvas, filename){
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], filename, {type:'image/png'});
  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:'FFK'});
      return true;
    }
  }catch(e){
    if(e && e.name === 'AbortError') return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.click();
  URL.revokeObjectURL(url);
  showToast(t('toastCard'));
  return false;
}

let shareBusy = false;
async function shareFutCard(list, period, tag){
  if(shareBusy) return;
  if(!list || !list.length){
    showToast(t('noPeriod'));
    return;
  }
  shareBusy = true;
  try{
    const pos = ratingPosOf(player.primary);
    const ovr = fifaOvr(list);
    const theme = futTheme(ovr);
    const photo = await loadCanvasImage(currentPhoto() || player.photo);
    const cover = await loadCanvasImage(currentCover() || player.cover);
    const {canvas, ctx, w, h} = makeHiCanvas(780, 1120);
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, theme.paper[0]);
    g.addColorStop(0.55, theme.paper[1]);
    g.addColorStop(1, theme.paper[2]);
    pathRoundRect(ctx, 36, 36, w - 72, h - 72, 36);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    pathRoundRect(ctx, 36, 36, w - 72, h - 72, 36);
    ctx.clip();
    if(cover){
      ctx.globalAlpha = 0.28;
      drawCovered(ctx, cover, 36, 36, w - 72, 420);
      ctx.globalAlpha = 1;
    }
    const glow = ctx.createRadialGradient(w * 0.55, 280, 20, w * 0.5, 340, 420);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(36, 36, w - 72, 520);
    const photoBox = {x: 210, y: 168, w: 430, h: 520};
    if(photo){
      ctx.save();
      pathRoundRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 24);
      ctx.clip();
      drawCovered(ctx, photo, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      pathRoundRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 24);
      ctx.fill();
      ctx.fillStyle = theme.plate;
      ctx.font = canvasFont('900', 92);
      ctx.textAlign = 'center';
      ctx.fillText(initials(), photoBox.x + photoBox.w / 2, photoBox.y + 300);
      ctx.textAlign = 'left';
    }
    const fade = ctx.createLinearGradient(0, 620, 0, 760);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, theme.paper[1]);
    ctx.fillStyle = fade;
    ctx.fillRect(36, 600, w - 72, 180);
    ctx.restore();

    pathRoundRect(ctx, 36, 36, w - 72, h - 72, 36);
    ctx.strokeStyle = theme.foil;
    ctx.lineWidth = 10;
    ctx.stroke();
    pathRoundRect(ctx, 52, 52, w - 104, h - 104, 28);
    ctx.strokeStyle = theme.foil2;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.plate;
    ctx.font = canvasFont('900', 118);
    ctx.fillText(String(ovr), 78, 200);
    ctx.font = canvasFont('800', 36);
    ctx.fillStyle = theme.muted;
    ctx.fillText(cardPosCode(), 86, 248);
    const no = shirtNo();
    if(no){
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.plate;
      ctx.font = canvasFont('800', 42);
      ctx.fillText((langLatin() ? '#' : '№') + no, w - 78, 118);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = theme.muted;
    ctx.font = canvasFont('700', 20);
    ctx.fillText('FFK', 86, 282);
    ctx.font = canvasFont('700', 16);
    const periodLine = String(period || '').slice(0, 28);
    ctx.fillText(periodLine, 86, 308);

    const name = (displayName() || '').toUpperCase();
    pathRoundRect(ctx, 70, 700, w - 140, 78, 16);
    ctx.fillStyle = theme.plate;
    ctx.fill();
    ctx.fillStyle = theme.ink;
    ctx.font = canvasFont('900', name.length > 18 ? 28 : 34);
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 28), w / 2, 750);
    ctx.textAlign = 'left';

    const stats = futStatRows(list, pos);
    const colW = 280;
    const left = 110;
    stats.forEach((row, i) => {
      const col = i % 2;
      const line = Math.floor(i / 2);
      const x = left + col * colW;
      const y = 830 + line * 64;
      ctx.fillStyle = theme.plate;
      ctx.font = canvasFont('900', 40);
      ctx.fillText(String(row[1]), x, y);
      ctx.fillStyle = theme.muted;
      ctx.font = canvasFont('800', 18);
      ctx.fillText(row[0], x + 86, y - 6);
    });

    ctx.fillStyle = theme.muted;
    ctx.font = canvasFont('600', 17);
    ctx.textAlign = 'center';
    const foot = [player.team || player.club, matchCountLabel(list.length)].filter(Boolean).join('  ·  ');
    ctx.fillText(foot.slice(0, 44), w / 2, h - 86);
    ctx.textAlign = 'left';

    const slug = String(player.firstName || 'player').trim().replace(/\s+/g, '_').slice(0, 18) || 'player';
    const stamp = String(tag || 'card').replace(/\s+/g, '_').slice(0, 24);
    await exportPngFile(canvas, `ffk_card_${slug}_${stamp}.png`);
  } finally {
    shareBusy = false;
  }
}
function playerCardList(kind){
  if(kind === 'month') return sortedMatches().filter(m => m.date >= daysAgoStr(30));
  if(kind === '10') return sortedMatches().slice(-10);
  if(kind === 'all') return sortedMatches();
  return feedList().list;
}
function playerCardPeriod(kind){
  if(kind === 'month') return t('periodMonth');
  if(kind === '10') return t('periodLast10');
  if(kind === 'all') return t('periodAll');
  const {season} = feedList();
  return season ? (player.season || currentSeason()) : t('periodAll');
}
function sharePlayerCard(kind){
  return shareFutCard(playerCardList(kind || 'season'), playerCardPeriod(kind || 'season'), kind || 'season');
}
function shareStatsCard(){
  return shareFutCard(cardPeriodMatches(), cardPeriodLabel(), cardPeriod);
}
function shareHistoryCard(){
  return shareFutCard(seasonPool(), seasonNameLabel(), 'season');
}
async function shareCard(m){
  if(shareBusy) return;
  shareBusy = true;
  try{
  const lines = reportLines(m);
  const split = actionSplit(m.counts, m.position);
  const photo = await loadCanvasImage(currentPhoto() || player.photo);
  const ovr = Math.round(Math.min(99, Math.max(45, Number(m.rating) * 10)));
  const theme = futTheme(ovr);
  const rows = Math.max(1, Math.ceil((lines.length || 1) / 2));
  const w = 1280, h = Math.max(840, 460 + rows * 50 + 130);
  const {canvas, ctx} = makeHiCanvas(w, h);
  ctx.fillStyle = '#070B14';
  ctx.fillRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, theme.paper[0]);
  bg.addColorStop(1, theme.paper[1]);
  pathRoundRect(ctx, 18, 18, w - 36, h - 36, 10);
  ctx.fillStyle = bg;
  ctx.fill();
  pathRoundRect(ctx, 18, 18, w - 36, h - 36, 10);
  ctx.strokeStyle = theme.foil;
  ctx.lineWidth = 6;
  ctx.stroke();

  const left = 52, top = 52;
  if(photo){
    pathRoundRect(ctx, left, top, 168, 210, 8);
    ctx.save();
    ctx.clip();
    drawCovered(ctx, photo, left, top, 168, 210);
    ctx.restore();
    pathRoundRect(ctx, left, top, 168, 210, 8);
    ctx.strokeStyle = theme.foil;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const tx = photo ? 248 : left;
  ctx.fillStyle = theme.muted;
  ctx.font = canvasFont('800', 22);
  ctx.fillText('FFK  ·  ' + t('reportTitle').toUpperCase(), tx, 82);
  ctx.fillStyle = theme.plate;
  ctx.font = canvasFont('900', 52);
  ctx.fillText(String(reportPlayerName(m)).slice(0, 22), tx, 148);
  ctx.font = canvasFont('900', 84);
  ctx.fillText(fmtNum(m.rating, 1), tx, 242);
  ctx.fillStyle = theme.muted;
  ctx.font = canvasFont('700', 26);
  ctx.fillText(`${formatDate(m.date)}  ·  ${m.opponent || t('shareVs')}  ·  ${m.score || '—'}`, tx, 292);
  if(m.kickoffClock){
    ctx.fillText(t('kickoffLine', {clock: m.kickoffClock}), tx, 330);
  }
  ctx.fillText(`${t('heroAction')} ${fmtNum(m.actionRating, 1)}    ${t('heroEffort')} ${fmtNum(m.effortRating, 1)}`, tx, m.kickoffClock ? 368 : 330);

  const col1 = 52;
  const col2 = 660;
  let y1 = 430, y2 = 430;
  ctx.font = canvasFont('700', 32);
  if(!lines.length){
    ctx.fillStyle = theme.plate;
    ctx.fillText(t('plusEven'), col1, y1);
    y1 += 48;
  } else {
    lines.forEach((line, i) => {
      const x = i % 2 === 0 ? col1 : col2;
      let y = i % 2 === 0 ? y1 : y2;
      ctx.fillStyle = theme.plate;
      ctx.fillText(`${line.icon}   ${line.text}`.slice(0, 42), x, y);
      if(i % 2 === 0) y1 += 48;
      else y2 += 48;
    });
  }
  let y = Math.max(y1, y2) + 28;
  ctx.fillStyle = '#22D3A6';
  ctx.font = canvasFont('800', 44);
  ctx.fillText(fmtSigned(split.plus, 2), col1, y);
  ctx.fillStyle = theme.muted;
  ctx.font = canvasFont('700', 22);
  ctx.fillText(t('actPlus'), col1, y + 36);
  ctx.fillStyle = '#FB6767';
  ctx.font = canvasFont('800', 44);
  ctx.fillText('−' + fmtNum(Math.abs(split.minus), 2), col2, y);
  ctx.fillStyle = theme.muted;
  ctx.font = canvasFont('700', 22);
  ctx.fillText(t('actMinus'), col2, y + 36);

  await exportPngFile(canvas, `ffk_${m.date}.png`);
  } finally {
    shareBusy = false;
  }
}

(function init(){
  loadSettings();
  loadFilters();
  applyFont();
  applyTheme();
  loadPlayer();
  fillPrimarySelect();
  applyHeader();
  document.getElementById('f-date').value = todayStr();
  fillMatchPitchSelects(defaultPitch());
  document.getElementById('f-format').value = settings.format || '2x30';
  document.getElementById('f-matchlen').value = settings.minutes;
  syncPlayedDefault(true);
  loadMatches();
  syncFilterChips();
  applyHeader();
  restoreDraft();
  applyI18n();
  applyTheme();
  renderOppList();
  maybePromptSeasonClose();
  restoreView();
})();
