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
function isNativeApp(){
  try{
    const C = window.Capacitor;
    if(C){
      if(typeof C.isNativePlatform === 'function' && C.isNativePlatform()) return true;
      if(C.isNative === true) return true;
      if(typeof C.getPlatform === 'function'){
        const p = C.getPlatform();
        if(p === 'android' || p === 'ios') return true;
      }
    }
  }catch(e){}
  const proto = location.protocol;
  return proto === 'capacitor:' || proto === 'ionic:';
}
function capPlugin(name){
  try{
    const C = window.Capacitor;
    if(!C) return null;
    // Native bridge exposes plugins on Capacitor.Plugins; registerPlugin only exists in the web runtime.
    if(C.Plugins && C.Plugins[name]) return C.Plugins[name];
    if(typeof C.registerPlugin === 'function') return C.registerPlugin(name);
  }catch(e){}
  return null;
}
function camLog(){
  if(!isNativeApp()) return;
  try{
    if(!localStorage.getItem('ffk_debug_cam')) return;
  }catch(e){ return; }
  try{ console.error('[ffk-cam]', Array.prototype.map.call(arguments, v => typeof v === 'string' ? v : JSON.stringify(v)).join(' ')); }catch(e){}
}
function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
async function nativeShareBlob(blob, filename, title){
  const Share = capPlugin('Share');
  const Filesystem = capPlugin('Filesystem');
  if(!isNativeApp() || !Share || !Filesystem || !blob) return false;
  const data = await blobToBase64(blob);
  const directory = 'CACHE';
  await Filesystem.writeFile({path: filename, data, directory});
  const got = await Filesystem.getUri({path: filename, directory});
  await Share.share({title: title || 'Matchcard', files: [got.uri], dialogTitle: title || 'Matchcard'});
  return true;
}
async function nativeSaveDocument(blob, filename){
  if(!isNativeApp() || !blob) return null;
  const data = await blobToBase64(blob);
  const Gallery = capPlugin('GalleryPicker');
  if(Gallery && typeof Gallery.saveDocument === 'function'){
    try{
      const ret = await Gallery.saveDocument({data, filename, mimeType:'application/json'});
      return {folder: (ret && ret.folder) || 'Download/Matchcard'};
    }catch(e){}
  }
  const Filesystem = capPlugin('Filesystem');
  if(!Filesystem) return null;
  try{
    await Filesystem.writeFile({
      path: 'Matchcard/' + filename,
      data,
      directory: 'DOCUMENTS',
      recursive: true
    });
    return {folder: 'Files / Matchcard'};
  }catch(e){
    return null;
  }
}
function applyNativeChrome(){
  const Bar = capPlugin('StatusBar');
  if(!isNativeApp() || !Bar) return;
  if(document.documentElement.classList.contains('intro-on')) return;
  const theme = themeName();
  const color = theme === 'day' ? '#FFF8D6' : '#05060c';
  const style = theme === 'dark' ? 'LIGHT' : 'DARK';
  Promise.resolve(Bar.setOverlaysWebView({overlay: true})).catch(() => {});
  Promise.resolve(Bar.setBackgroundColor({color})).catch(() => {});
  Promise.resolve(Bar.setStyle({style})).catch(() => {});
}
const THEME_ORDER = ['dark','day'];
function themeName(){
  if(settings.theme === 'light') return 'day';
  return THEME_ORDER.includes(settings.theme) ? settings.theme : 'dark';
}
function isLightTheme(){ return themeName() !== 'dark'; }
function applyTheme(){
  if(settings.theme === 'light'){
    settings.theme = 'day';
    saveSettings();
  }
  const theme = themeName();
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = theme === 'day' ? '#FFF8D6' : '#05060c';
  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if(apple) apple.content = theme === 'dark' ? 'black-translucent' : 'default';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.setAttribute('aria-label', t('themeAria') + ' · ' + t('theme_' + theme));
  });
  document.querySelectorAll('#themeChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.theme === theme);
  });
  syncIconSetChips();
  applyNativeChrome();
}
function syncIconSetChips(){
  const set = iconSetName();
  document.documentElement.dataset.icons = set;
  document.querySelectorAll('#iconSetChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.icons === set);
  });
}
function applyIconSet(){
  document.documentElement.dataset.icons = iconSetName();
  syncIconSetChips();
  if(typeof renderMetrics === 'function') renderMetrics();
  if(typeof renderPlayerFeed === 'function') renderPlayerFeed();
}
function toggleTheme(){
  const i = THEME_ORDER.indexOf(themeName());
  settings.theme = THEME_ORDER[(i + 1) % THEME_ORDER.length];
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
  const ver = document.getElementById('appVersionHint');
  if(ver) ver.textContent = t('sVersion', {v: window.FFK_VERSION || '—'});
  document.querySelectorAll('.tabbtn').forEach(b => {
    const lab = b.querySelector('.tab-lab');
    if(lab) b.setAttribute('aria-label', lab.textContent);
  });
  document.querySelectorAll('input[type=date]').forEach(el => { el.lang = LANG_HTML[lang] || lang; });
  renderMetrics();
  renderBehaviors();
  renderLiveGrid();
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
  const tzEl = document.getElementById('tzHint');
  if(tzEl) tzEl.textContent = t('sTzHint', {tz: clockTimeZone().replace(/_/g, ' ')});
  syncSeasonChipLabels();
}

let settings = {club:'', player:'', position:'fwd', format:'2x30', minutes:'60', lang:'ru', seasonCloseDeclined:'', theme:'dark', iconSet:'clear', onboarded:false, pwaTransferSeen:false, introMark:''};
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
function deviceTimeZone(){
  try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch(e){ return ''; }
}
function clockTimeZone(){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  if(lang === 'pl') return 'Europe/Warsaw';
  return deviceTimeZone() || 'Europe/Warsaw';
}
function clockLocale(){
  const lang = LANGS.includes(settings.lang) ? settings.lang : detectLang();
  return LANG_LOCALE[lang] || 'en-GB';
}
function tzShort(){
  return clockTimeZone().split('/').pop().replace(/_/g, ' ');
}
function localClock(ms){
  try{
    return new Intl.DateTimeFormat(clockLocale(), {timeZone: clockTimeZone(), hour:'2-digit', minute:'2-digit', hour12:false}).format(new Date(ms));
  }catch(e){
    const d = new Date(ms);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
}
function emptyClock(){
  return {startedAt:null, pausedAt:null, pauseMs:0, events:[], period:1, phase:'idle', periodPlayMs:0, periodRunAt:null, playMs:0};
}

function currentPitch(){
  const v = document.getElementById('f-position').value;
  return isPitchCode(v) ? v : defaultPitch();
}
function currentPos(){ return ratingPosOf(document.getElementById('f-position').value || defaultPitch()); }

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
  return {clock: localClock(now) + ' · ' + tzShort(), period, minute, matchMin, playMin, each, parts};
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
// Ratings are kept with all their decimals, so 6.55 must show as 6.6. Plain
// toFixed would give 6.5 because the binary value is 6.5499…, hence the
// exponent shift before rounding.
function roundTo(n, digits){
  const v = Number(n);
  if(!isFinite(v)) return 0;
  const shifted = Math.round(Number(Math.abs(v).toExponential(12).replace(/e([+-]\d+)/, (s, e) => 'e' + (Number(e) + digits))));
  const out = Number(shifted + 'e-' + digits);
  if(!isFinite(out)) return v;
  return v < 0 ? -out : out;
}
function fmtNum(n, digits){
  const s = roundTo(n, digits).toFixed(digits);
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
function fmtWeight(w){
  const n = Math.round(Number(w) * 100) / 100;
  if(!n) return fmtNum(0, 2);
  return (n > 0 ? '+' : '−') + fmtNum(Math.abs(n), 2);
}
function nextWeightLabel(key, pos){
  const met = METRICS.find(x => x.key === key);
  if(!met) return fmtNum(0, 2);
  return fmtWeight(nextStackedWeight(form.counts[key] || 0, weightOf(met, pos)));
}
function paintWeight(key){
  const pos = currentPos();
  const shown = nextWeightLabel(key, pos);
  const a = document.getElementById('wgt-'+key);
  if(a) a.textContent = shown;
  const b = document.getElementById('live-wgt-'+key);
  if(b) b.textContent = shown;
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
function goalMinutes(m){
  return (Array.isArray(m.timeline) ? m.timeline : [])
    .filter(ev => ev && ev.key === 'goals')
    .map(ev => Math.max(1, Number(ev.minute) || 1));
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
      if(w + l > 0) lines.push({key:'duelswon', text: `${w}/${w+l} ${t('mn_duels')}`});
      return;
    }
    const n = counts[met.key] || 0;
    if(!n) return;
    let extra = '';
    if(met.key === 'goals'){
      const mins = goalMinutes(m);
      if(mins.length) extra = ' · ' + mins.map(x => t('minLbl', {n:x})).join(', ');
    }
    lines.push({key: met.key, text: `${n} ${metricNoun(met.key, n)}${extra}`});
  });
  return lines;
}
function reportPlayerName(m){
  return (player.firstName || String(m.player || '').trim().split(/\s+/)[0] || '—');
}
function matchMinsLabel(m){
  const n = Math.max(1, Number(m.minutes) || Number(m.matchLen) || 0);
  return n ? t('minLbl', {n}) : '';
}
function outingCaption(m){
  if(isShortOuting(m.minutes, m.matchLen)) return t('ratingForMins', {n: Math.max(1, Number(m.minutes) || 1)});
  return t('heroOverall');
}
function renderReportHtml(m, compact){
  const split = actionSplit(m.counts, m.position, m.minutes, m.matchLen);
  const lines = reportLines(m);
  const mins = matchMinsLabel(m);
  const vs = `${escapeHtml(m.opponent || t('unnamed'))}${m.score ? ' · ' + scoreLineHtml(m) : ''}${mins ? ' · ' + escapeHtml(mins) : ''}`;
  const kick = m.kickoffClock ? escapeHtml(t('kickoffLine', {clock: m.kickoffClock})) : '';
  const meta = `<div class="report-sub"><span>${vs}</span>${kick ? `<span>${kick}</span>` : ''}</div>`;
  const scale = isShortOuting(m.minutes, m.matchLen)
    ? `<p class="hero-scale">${escapeHtml(outingCaption(m))}</p>`
    : '';
  const head = compact ? meta : `<div class="report-kicker">${escapeHtml(t('reportTitle'))}</div>
    <div class="report-title">${escapeHtml(reportPlayerName(m))} — <span class="n">${fmtNum(m.rating, 2)}</span></div>
    ${meta}${scale}
    <div class="report-sub"><span>${escapeHtml(t('heroAction'))} ${fmtNum(m.actionRating, 2)}</span><span>${escapeHtml(t('heroEffort'))} ${fmtNum(m.effortRating, 2)}</span></div>`;
  const body = lines.length
    ? lines.map(x => `<div class="report-line"><span class="ic">${metricIconSvg(x.key)}</span><span>${escapeHtml(x.text)}</span></div>`).join('')
    : `<div class="report-line">${escapeHtml(t('plusEven'))}</div>`;
  return `${head}${body}${matchInsightHtml(m)}
    <div class="report-split">
      <div class="report-pill plus">${fmtSigned(Math.max(0, split.plus), 2)}<small>${escapeHtml(t('actPlus'))}</small></div>
      <div class="report-pill minus">${split.minus ? '−' + fmtNum(Math.abs(split.minus), 2) : fmtNum(0, 2)}<small>${escapeHtml(t('actMinus'))}</small></div>
    </div>`;
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
    syncScoreResultHint();
    return;
  }
  usEl.value = '';
  themEl.value = '';
  scoreFallback = String(s || '');
  syncScoreResultHint();
}
function brandFanHtml(){
  return '<div class="brand-fan" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
}
function emptyCtaHtml(msg, withCta){
  const btn = withCta === false ? '' : `<button type="button" class="save-btn" data-go-view="new">${escapeHtml(t('emptyGoMatch'))}</button>`;
  return `<div class="empty-card empty-brand">${brandFanHtml()}<p>${escapeHtml(msg)}</p>${btn}</div>`;
}
function matchResult(m){
  const p = scoreSides(m && m.score);
  if(!p) return '';
  if(p.us > p.them) return 'win';
  if(p.us < p.them) return 'loss';
  return 'draw';
}
function teamWon(m){ return matchResult(m) === 'win'; }
function resultLabel(m){
  const r = matchResult(m);
  if(r === 'win') return t('resultWin');
  if(r === 'loss') return t('resultLoss');
  if(r === 'draw') return t('resultDraw');
  return '';
}
function scoreLine(m){
  if(!m || !m.score) return '—';
  const res = resultLabel(m);
  const base = t('scoreLbl', {s: m.score});
  return res ? base + ' · ' + res : base;
}
function scoreLineHtml(m){
  if(!m || !m.score) return '—';
  const r = matchResult(m);
  const res = resultLabel(m);
  const main = escapeHtml(t('scoreLbl', {s: m.score}));
  if(!res) return main;
  return `${main} <span class="match-result ${r}">${escapeHtml(res)}</span>`;
}
function syncScoreResultHint(){
  const el = document.getElementById('scoreResultHint');
  if(!el) return;
  const us = document.getElementById('f-score-us');
  const them = document.getElementById('f-score-them');
  if(!us || !them || (us.value === '' && them.value === '' && !scoreFallback)){
    el.hidden = true;
    el.textContent = '';
    return;
  }
  const fake = {score: scoreFromFields()};
  const res = resultLabel(fake);
  if(!res){ el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = res;
  el.className = 'hint match-result ' + matchResult(fake);
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
  const ended = matchResult(m);
  if(ended === 'win') head.push(t('plusWin'));
  else if(ended === 'loss') head.push(t('plusLoss'));
  else if(ended === 'draw') head.push(t('plusDraw'));
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
function matchInsightHtml(m){
  if(!m || matchIsBlank(m)) return '';
  const rest = matches.filter(x => x.id !== m.id).sort((a,b)=> b.date.localeCompare(a.date) || b.id-a.id);
  const ins = buildInsights(m, rest);
  return `<div class="insight"><b>${escapeHtml(t('insightPlus'))}:</b> ${escapeHtml(ins.plus)}<br><b>${escapeHtml(t('insightFocus'))}:</b> ${escapeHtml(ins.focus)}</div>`;
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
function chartDateLabel(iso){
  const [y,m,d] = String(iso||'').split('-');
  if(!y||!m||!d) return '';
  return d + '.' + m;
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
function cameraCaptureAvailable(){
  return isNativeApp();
}
function openPhotoSheet(target){
  photoSheetTarget = target;
  const has = target === 'cover' ? !!currentCover() : !!currentPhoto();
  const cam = document.getElementById('photoSheetCamera');
  cam.hidden = !cameraCaptureAvailable();
  cam.textContent = t(target === 'cover' ? 'pTakeCover' : 'pTakePhoto');
  document.getElementById('photoSheetPick').textContent = t('pFromGallery');
  document.getElementById('photoSheetClear').hidden = !has;
  document.getElementById('photoSheet').hidden = false;
  document.getElementById('photoSheetBack').hidden = false;
  pushAppState('layer');
}
function pickPhotoFile(useCamera){
  const el = document.getElementById(photoSheetTarget === 'cover' ? 'p-cover' : 'p-photo');
  el.value = '';
  if(useCamera) el.setAttribute('capture', 'environment');
  else el.removeAttribute('capture');
  el.click();
}
function cameraUserStopped(err){
  const s = String((err && (err.message || err.errorMessage || err)) || '').toLowerCase();
  const code = String((err && err.code) || '');
  return /cancel|cancell|user denied|no image|no photo|no media/i.test(s) || /0003|0005|0006/.test(code);
}
function b64Src(raw){
  const s = String(raw || '').trim();
  if(!s) return '';
  if(/^data:image\//i.test(s)) return s;
  return 'data:image/jpeg;base64,' + s;
}
function nativeFilePath(result){
  if(!result || typeof result !== 'object') return '';
  return result.path || result.uri || '';
}
function nativeSrc(result){
  if(!result || typeof result !== 'object') return '';
  if(result.dataUrl) return result.dataUrl;
  if(result.webPath) return result.webPath;
  const file = nativeFilePath(result);
  const C = window.Capacitor;
  if(file && C && typeof C.convertFileSrc === 'function') return C.convertFileSrc(file);
  return file;
}
function loadImageFromSrc(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.width ? resolve(img) : reject(new Error('img'));
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
}
function b64ToJpegFile(b64){
  const raw = String(b64 || '').replace(/^data:image\/[^;]+;base64,/, '');
  const bin = atob(raw);
  const arr = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], 'photo.jpg', {type:'image/jpeg'});
}
async function photoToDataUrl(result){
  if(!result || typeof result !== 'object') return '';
  if(result.dataUrl && /^data:image\//i.test(result.dataUrl)) return result.dataUrl;
  if(result.base64String) return b64Src(result.base64String);
  if(result.thumbnail) return b64Src(result.thumbnail);
  const Http = capPlugin('CapacitorHttp');
  const url = nativeSrc(result);
  if(Http && url && !/^data:/i.test(url) && typeof Http.get === 'function'){
    try{
      const res = await Http.get({url, responseType: 'blob'});
      if(res && res.data){
        if(typeof res.data === 'string' && /^data:image\//i.test(res.data)) return res.data;
        if(typeof res.data === 'string') return b64Src(res.data);
      }
    }catch(e){}
  }
  const Filesystem = capPlugin('Filesystem');
  const disk = nativeFilePath(result);
  if(Filesystem && disk && typeof Filesystem.readFile === 'function'){
    try{
      const got = await Filesystem.readFile({path: disk});
      if(got && got.data) return b64Src(got.data);
    }catch(e){}
  }
  return url && /^data:image\//i.test(url) ? url : '';
}
async function beginCropFromNative(result){
  camLog('result keys', Object.keys(result || {}));
  try{
    const dataUrl = await photoToDataUrl(result);
    camLog('dataUrl len', String((dataUrl || '').length));
    if(dataUrl){
      openCrop(await loadImageFromSrc(dataUrl), photoSheetTarget);
      return;
    }
  }catch(e){
    camLog('crop error', String((e && e.message) || e));
  }
  showToast(t('toastPhotoFail'));
}
async function nativeGetPhoto(source){
  const Camera = capPlugin('Camera');
  camLog('plugin', Camera ? Object.keys(Camera).join(',') : 'null');
  if(!Camera) throw new Error('nocam');
  const fromCamera = source === 'CAMERA';
  return Camera.getPhoto({
    quality: 70,
    allowEditing: false,
    resultType: 'dataUrl',
    source: fromCamera ? 'CAMERA' : 'PHOTOS',
    saveToGallery: false,
    correctOrientation: true,
    width: 1280,
    height: 1280
  });
}
async function pickFromCamera(){
  closePhotoSheet();
  if(!isNativeApp()){
    pickPhotoFile(true);
    return;
  }
  try{
    const result = await nativeGetPhoto('CAMERA');
    if(result) await beginCropFromNative(result);
  }catch(err){
    camLog('camera fail', String((err && (err.message || err.errorMessage)) || err), String((err && err.code) || ''));
    if(cameraUserStopped(err)) return;
    showToast(t('toastPhotoFail'));
  }
}
async function pickFromGallery(){
  closePhotoSheet();
  if(!isNativeApp()){
    pickPhotoFile(false);
    return;
  }
  // The system picker on Android is served by Google Photos, which hides the
  // albums of the phone itself, so ask the installed gallery apps first.
  const Gallery = capPlugin('GalleryPicker');
  if(Gallery && typeof Gallery.pickImage === 'function'){
    try{
      const picked = await Gallery.pickImage();
      if(picked && picked.dataUrl){
        await beginCropFromNative(picked);
        return;
      }
    }catch(err){
      camLog('device gallery fail', String((err && (err.message || err.errorMessage)) || err), String((err && err.code) || ''));
      if(cameraUserStopped(err)) return;
    }
  }
  try{
    const result = await nativeGetPhoto('PHOTOS');
    if(result) await beginCropFromNative(result);
  }catch(err){
    camLog('gallery fail', String((err && (err.message || err.errorMessage)) || err), String((err && err.code) || ''));
    if(cameraUserStopped(err)) return;
    showToast(t('toastPhotoFail'));
  }
}
function bindCameraRestore(){
  const App = capPlugin('App');
  if(!isNativeApp() || !App || typeof App.addListener !== 'function' || window.__ffkCamRestore) return;
  window.__ffkCamRestore = true;
  App.addListener('appRestoredResult', ev => {
    if(!ev || ev.success === false) return;
    const data = ev.data || {};
    // Picking from the phone gallery can push the app out of memory, so the
    // photo comes back through the restored result instead of the promise.
    if(ev.pluginId === 'GalleryPicker'){
      if(data.dataUrl) beginCropFromNative(data).catch(() => {});
      return;
    }
    if(ev.pluginId !== 'Camera') return;
    const media = data.webPath || data.uri ? data : (data.results && data.results[0]);
    if(media) beginCropFromNative(media).catch(() => {});
  });
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
const COVER_EXPORT_W = 720;
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
  ctx.strokeStyle = 'rgba(245,185,66,.9)';
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
  pushAppState('layer');
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
      if(isNativeApp()){
        showToast(t('toastHeic'));
        return;
      }
      showToast(t('toastPhotoWait'));
      src = await heicToJpegFile(file);
    }
    const img = await fileToImage(src);
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
function sameSeason(a, b){
  const x = parseSeasonYears(a);
  const y = parseSeasonYears(b);
  if(x && y) return x.start === y.start;
  return String(a || '').trim() === String(b || '').trim();
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
  const list = matches.filter(m => sameSeason(matchSeason(m), s)).sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id);
  if(list.length){
    window.setTimeout(() => { shareFutCard(list, s, 'season'); }, 280);
  }
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
  return ((a + b) || (p.club || 'Matchcard').slice(0,2) || 'MC').toUpperCase();
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

function splitLegacyName(full){
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return {firstName: parts[0] || '', lastName: parts.slice(1).join(' ')};
}
function newPlayerId(){
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
    const row = (g, bad) => `<div class="pf-row${bad ? ' bad' : ''}"><span class="pf-lab"><span class="ic">${metricIconSvg(g.m.key)}</span>${escapeHtml(profileMetricLabel(g.m.key))}</span><span class="g">${fmtNum(g.grade, 1)}</span></div>`;
  const note = profileCoachNote(list, strengths, focus);
  el.innerHTML = `<div class="pf-card">
      <div class="pf-rate">${fmtNum(avg, 2)}<small>${escapeHtml(season ? t('pfSeasonAvg') : t('pfAllAvg'))}</small></div>
      ${trendHtml}
      <div class="pf-grid">
        <div class="pf-kpi"><div class="n">${fmtNum(last.rating, 2)}</div><div class="l">${escapeHtml(isShortOuting(last.minutes, last.matchLen) ? t('ratingForMins', {n: last.minutes}) : t('pfLast'))}</div></div>
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
    avgEl.textContent = '⭐ ' + fmtNum(seasonAvg, 2);
  }
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
  const add = document.getElementById('addPlayerBtn');
  if(add) add.hidden = roster.ids.length >= MAX_PLAYERS;
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
  openPlayerEdit();
  scrollMainToTop();
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
    idbDeleteMedia(id);
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
function openPlayerEdit(){
  fillPlayerForm();
  const el = document.getElementById('playerEdit');
  if(el) el.hidden = false;
  openSheet(document.getElementById('playerEditCard'));
  pushAppState('layer');
}
function closePlayerEdit(revert){
  const el = document.getElementById('playerEdit');
  if(el) el.hidden = true;
  resetSheet(document.getElementById('playerEditCard'));
  if(revert !== false) fillPlayerForm();
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
    if(Array.isArray(matchClock.events) && matchClock.events.length){
      liveStack = matchClock.events.map(e => e.key);
    }
  }catch(e){}
  syncMatchContextFold();
}

function metricGroupTitle(id){
  return t(id === 'attack' ? 'grpAttack' : (id === 'defense' ? 'grpDefense' : 'grpDiscipline'));
}
function metricTileHtml(m, pos){
  const shown = nextWeightLabel(m.key, pos);
  const keyRow = (m.live || []).includes(pos);
  return `<div class="metric-tile${keyRow ? ' key' : ''}">
      <div class="metric-icon">${metricIconSvg(m.key)}</div>
      <div class="metric-name">
        <div>${escapeHtml(metricLabel(m.key))}<span class="metric-weight" id="wgt-${m.key}">${shown}</span></div>
      </div>
      <div class="stepper">
        <button type="button" onclick="stepMetric('${m.key}',-1)">−</button>
        <div class="val" id="cnt-${m.key}">${form.counts[m.key]||0}</div>
        <button type="button" onclick="stepMetric('${m.key}',1)">+</button>
      </div>
    </div>`;
}
function renderMetrics(){
  const pos = currentPos();
  document.getElementById('weightsHint').textContent = t(({gk:'hintGk', fwd:'hintFwd', mid:'hintMid', def:'hintDef'})[pos] || 'hintOut');
  const byKey = {};
  metricsFor(pos).forEach(m => { byKey[m.key] = m; });
  document.getElementById('metricsList').innerHTML = METRIC_GROUPS.map(g => {
    const rows = g.keys.map(k => byKey[k]).filter(Boolean);
    if(!rows.length) return '';
    return `<section class="metric-group">
      <div class="metric-group-title">${escapeHtml(metricGroupTitle(g.id))}</div>
      <div class="metric-grid">${rows.map(m => metricTileHtml(m, pos)).join('')}</div>
    </section>`;
  }).join('');
}
function behaviorPct(n){
  return ((Number(n) || 3) - 1) / 4 * 100;
}
function syncBehaviorSlider(key, val){
  document.querySelectorAll('.behavior-slider[data-behavior="'+key+'"]').forEach(wrap => {
    wrap.dataset.val = val;
    const pct = behaviorPct(val) + '%';
    const fill = wrap.querySelector('.behavior-fill');
    const thumb = wrap.querySelector('.behavior-thumb');
    if(fill) fill.style.width = pct;
    if(thumb){
      thumb.style.left = pct;
      thumb.setAttribute('aria-valuenow', val);
    }
  });
}
function renderBehaviors(){
  document.getElementById('behaviorList').innerHTML = BEHAVIOR.map(b => {
    const now = form.behaviors[b.key];
    const pct = behaviorPct(now);
    return `<div class="behavior-row">
      <div class="behavior-top">
        <span>${escapeHtml(behaviorLabel(b.key))}</span>
        <span class="val" id="bval-${b.key}">${now}</span>
      </div>
      <div class="behavior-slider" data-behavior="${b.key}" data-val="${now}">
        <div class="behavior-track">
          <div class="behavior-marks" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="behavior-fill" style="width:${pct}%"></div>
          <button type="button" class="behavior-thumb" style="left:${pct}%"
            aria-valuemin="1" aria-valuemax="5" aria-valuenow="${now}"></button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function renderOppList(){
  const names = [...new Set(matches.map(m => m.opponent).filter(Boolean))].sort();
  document.getElementById('oppList').innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');
  const tours = [...new Set(matches.map(m => m.tournament).filter(Boolean))].sort();
  document.getElementById('tourList').innerHTML = tours.map(n => `<option value="${escapeHtml(n)}">`).join('');
}
function haptic(style){
  const Haptics = capPlugin('Haptics');
  if(Haptics && typeof Haptics.impact === 'function'){
    Promise.resolve(Haptics.impact({style: style === 'MEDIUM' ? 'MEDIUM' : 'LIGHT'})).catch(() => {});
    return;
  }
  try{
    if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(style === 'MEDIUM' ? 24 : 14);
  }catch(e){}
}
// Haptics stay inside the live pad and on the action steppers, nowhere else.
const HAPTIC_TAPS = '#livePad button,.stepper button';
function bindTapHaptics(){
  if(window.__ffkTapHaptics) return;
  window.__ffkTapHaptics = true;
  document.addEventListener('click', e => {
    const tap = e.target.closest(HAPTIC_TAPS);
    if(!tap || tap.disabled) return;
    haptic(tap.matches('#liveKickBtn,#liveDoneBtn') ? 'MEDIUM' : 'LIGHT');
  }, true);
}
function syncLiveUndo(){
  const btn = document.getElementById('liveUndoBtn');
  if(btn) btn.disabled = liveStack.length === 0;
}
function syncMatchContextFold(){
  const el = document.getElementById('matchContext');
  if(!el) return;
  if(editingId){ el.open = true; return; }
  if(clockPhase() !== 'idle') el.open = false;
}
window.undoLastLive = function(){
  if(!liveStack.length){
    showToast(t('toastNoUndo'));
    return;
  }
  stepMetric(liveStack[liveStack.length - 1], -1);
};
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
  paintWeight(key);
};
window.setBehavior = function(key, val){
  form.behaviors[key] = parseInt(val, 10);
  const el = document.getElementById('bval-'+key);
  if(el) el.textContent = val;
  syncBehaviorSlider(key, form.behaviors[key]);
  updateHero();
  persistDraft();
};
function bindBehaviorSlider(){
  if(window.__ffkBehaviorSlider) return;
  window.__ffkBehaviorSlider = true;
  let drag = null;
  const valueAt = (wrap, clientX) => {
    const track = wrap.querySelector('.behavior-track');
    if(!track) return 3;
    const rect = track.getBoundingClientRect();
    const t = rect.width <= 0 ? 0.5 : (clientX - rect.left) / rect.width;
    return Math.round(Math.min(1, Math.max(0, t)) * 4) + 1;
  };
  document.addEventListener('pointerdown', e => {
    const thumb = e.target.closest('.behavior-thumb');
    if(!thumb) return;
    const wrap = thumb.closest('.behavior-slider');
    if(!wrap) return;
    drag = {wrap, thumb, key: wrap.dataset.behavior, x: e.clientX, y: e.clientY, armed: false, last: Number(wrap.dataset.val) || 3};
    try{ thumb.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if(!drag) return;
    const dx = Math.abs(e.clientX - drag.x);
    const dy = Math.abs(e.clientY - drag.y);
    if(!drag.armed){
      if(dy > 14 && dy > dx){
        try{ drag.thumb.releasePointerCapture(e.pointerId); }catch(err){}
        drag = null;
        return;
      }
      if(dx < 8) return;
      drag.armed = true;
    }
    e.preventDefault();
    const n = valueAt(drag.wrap, e.clientX);
    if(n !== drag.last){
      drag.last = n;
      haptic('LIGHT');
      setBehavior(drag.key, n);
    }
  });
  const stop = () => { drag = null; };
  document.addEventListener('pointerup', stop);
  document.addEventListener('pointercancel', stop);
}

function scoresNow(){
  const pos = currentPos();
  const minutes = Number(document.getElementById('f-minutes').value) || 60;
  const matchLen = formatLength(document.getElementById('f-format').value, document.getElementById('f-matchlen').value);
  const action = actionScore(form.counts, pos, minutes, matchLen);
  const effort = effortScore(form.behaviors);
  return {action, effort, overall: overallScore(form.counts, form.behaviors, pos, minutes, matchLen), pos, minutes, matchLen};
}
function updateHero(){
  const s = scoresNow();
  const overall = fmtNum(s.overall, 2) + '<small>/10</small>';
  const heroScore = document.getElementById('heroScore');
  if(heroScore) heroScore.innerHTML = overall;
  const liveScore = document.getElementById('liveScore');
  if(liveScore) liveScore.innerHTML = overall;
  const setNum = (id, n) => {
    const el = document.getElementById(id);
    if(el) el.textContent = fmtNum(n, 2);
  };
  setNum('heroAction', s.action);
  setNum('heroEffort', s.effort);
  setNum('liveAction', s.action);
  setNum('liveEffort', s.effort);
  const setBar = (id, n) => {
    const el = document.getElementById(id);
    if(el) el.style.setProperty('--p', String(Math.max(0, Math.min(1, Number(n) / 10))));
  };
  setBar('heroActionBar', s.action);
  setBar('heroEffortBar', s.effort);
  setBar('liveActionBar', s.action);
  setBar('liveEffortBar', s.effort);
  const label = document.getElementById('heroLabel');
  if(label){
    label.textContent = isShortOuting(s.minutes, s.matchLen)
      ? t('ratingForMins', {n: s.minutes})
      : t('heroOverall');
  }
  const pitch = String(currentPitch() || 'ST').toUpperCase();
  ['heroPosTag','livePosTag'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = pitch;
  });
  const meta = document.getElementById('heroMeta');
  if(meta){
    const opp = (document.getElementById('f-opponent')?.value || '').trim();
    const score = scoreFromFields();
    const bits = [];
    if(opp) bits.push(opp);
    if(score) bits.push(score);
    meta.textContent = bits.join('  ·  ');
    meta.hidden = !bits.length;
  }
  syncLiveUndo();
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
  updateHero();
  syncDateShown();
  const ctx = document.getElementById('matchContext');
  if(ctx && !keepDraft) ctx.open = false;
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
  updateHero();
  syncDateShown();
  persistDraft();
  renderLiveClock();
  if(clockPhase() === 'run') startClockTick();
  syncMatchContextFold();
}

function collectMatch(){
  const pos = currentPos();
  const counts = {...form.counts};
  const behaviors = {...form.behaviors};
  const minutes = Math.min(120, Math.max(1, Number(document.getElementById('f-minutes').value) || formatLength(document.getElementById('f-format').value, document.getElementById('f-matchlen').value)));
  const format = document.getElementById('f-format').value;
  const matchLen = formatLength(format, document.getElementById('f-matchlen').value);
  const action = actionScore(counts, pos, minutes, matchLen);
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
    minutes,
    format,
    matchLen,
    kind: document.getElementById('f-kind').value,
    season: (editingId && matches.find(x => x.id === editingId)?.season) || (seasonIsOpen() ? (player.season || seasonFromDate(document.getElementById('f-date').value)) : seasonFromDate(document.getElementById('f-date').value)),
    team: (editingId && matches.find(x => x.id === editingId)?.team) || player.team || player.club || '',
    counts, behaviors,
    timeline: matchClock.events.slice(),
    kickoffAt: matchClock.startedAt || 0,
    kickoffClock: matchClock.startedAt ? [localClock(matchClock.startedAt), tzShort()].filter(Boolean).join(' · ') : '',
    actionRating: action,
    effortRating: effort,
    rating: overallScore(counts, behaviors, pos, minutes, matchLen)
  };
}

function saveCurrentMatch(){
  const row = collectMatch();
  if(!row.opponent && !confirm(t('confirmNoOpp'))) return false;
  const dup = matches.some(m => m.id !== row.id && m.date === row.date && m.opponent === row.opponent && row.opponent);
  if(dup && !editingId && !confirm(t('confirmDup'))) return false;
  if(!editingId && !seasonIsOpen()){
    const s = row.season || seasonFromDate(row.date);
    if(!confirm(t('confirmOpenForMatch', {s}))) return false;
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
  return true;
}
document.getElementById('saveBtn').addEventListener('click', saveCurrentMatch);

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
    if(id === 'f-score-us' || id === 'f-score-them'){
      scoreFallback = '';
      syncScoreResultHint();
    }
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
  const stale = matches.length > 0 && !localStorage.getItem(EXPORT_KEY);
  const settingsEl = document.getElementById('backupBanner');
  if(settingsEl) settingsEl.hidden = !stale;
  const hist = document.getElementById('historyBackup');
  if(hist){
    hist.hidden = !stale;
    if(stale) hist.textContent = t('backupRemind', {n: matches.length});
  }
}
function renderHistory(){
  refreshBackupBanner();
  const el = document.getElementById('historyList');
  const pager = document.getElementById('historyPager');
  const hidePager = () => { if(pager){ pager.hidden = true; pager.innerHTML = ''; } };
  const toolbar = document.getElementById('historyToolbar');
  const search = document.getElementById('historySearch');
  if(search && document.activeElement !== search) search.value = historyQuery;
  document.querySelectorAll('#historyKind .chip').forEach(c => {
    c.classList.toggle('active', (c.dataset.kind || 'all') === historyKind);
  });
  if(matches.length === 0){
    if(toolbar) toolbar.hidden = true;
    el.innerHTML = emptyCtaHtml(t('noMatches'));
    hidePager();
    return;
  }
  if(toolbar) toolbar.hidden = false;
  const list = historyPool();
  if(!list.length){
    const filtered = !!(historyQuery.trim() || (historyKind && historyKind !== 'all'));
    el.innerHTML = filtered
      ? emptyCtaHtml(t('histEmpty'), false)
      : emptyCtaHtml(t('noPeriod'));
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
          <span class="match-date">${escapeHtml(formatDate(m.date))}${showSeason ? ' · ' + escapeHtml(matchSeason(m)) : ''} · ${escapeHtml(matchMinsLabel(m))} · ${escapeHtml(matchPosDisplay(m))}</span>
          <span class="match-opp">${escapeHtml(m.opponent || t('unnamed'))}</span>
          <span class="match-score">${scoreLineHtml(m)}</span>
        </div>
        <div class="match-rating ${ratingClass(m.rating)}${isShortOuting(m.minutes, m.matchLen) ? ' short' : ''}">${fmtNum(m.rating, 2)}${isShortOuting(m.minutes, m.matchLen) ? `<small>${escapeHtml(matchMinsLabel(m))}</small>` : ''}</div>
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

window.toggleDetails = function(id){
  const el = document.getElementById('details-'+id);
  if(!el) return;
  const willOpen = !el.classList.contains('open');
  el.classList.toggle('open');
  if(willOpen) pushAppState('layer');
};
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
  renderHistory(); renderStats(); renderOppList();
  showToast(t('toastDeleted'));
};
window.shareMatch = function(id){
  const m = matches.find(x => x.id === id);
  if(m) shareCard(m);
};

function scrollMainToTop(){
  const main = document.querySelector('.content');
  if(main) main.scrollTop = 0;
  window.scrollTo({top:0, behavior:'instant'});
}
function showView(name){
  const views = ['player','new','history','stats','settings','report'];
  if(!views.includes(name)) name = 'new';
  if(name !== 'player') closePlayerEdit();
  document.getElementById('app').classList.toggle('player-on', name === 'player');
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-'+name));
  document.querySelector('.topbar').classList.add('compact');
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
  if(!popping && name !== 'player') pushAppState('tab');
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
function applyImportBundle(imported){
  const bundle = Array.isArray(imported) ? {matches: imported} : imported;
  if(!bundle || typeof bundle !== 'object') throw new Error('bad');
  let playerTouched = false;
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
      if(bundle.settings.theme){
        const th = bundle.settings.theme === 'light' ? 'day' : bundle.settings.theme;
        if(THEME_ORDER.includes(th)) settings.theme = th;
      }
    }
    saveSettings();
    playerTouched = true;
  }
  const incoming = Array.isArray(bundle.matches) ? bundle.matches : (Array.isArray(imported) ? imported : []);
  if(!incoming.length && !playerTouched) throw new Error('bad');
  const ids = new Set(matches.map(m => m.id));
  let added = 0;
  incoming.forEach(raw => {
    const m = normalizeMatch(raw);
    if(!m || ids.has(m.id)) return;
    matches.push(m); ids.add(m.id); added++;
  });
  saveMatches();
  applyI18n();
  applyTheme();
  applyPlayerContext();
  return {added, playerTouched};
}
function exportBlob(){
  return {
    blob: new Blob([JSON.stringify(exportPayload(), null, 2)], {type:'application/json'}),
    filename: `matchcard_${todayStr()}.json`
  };
}
function downloadMatches(){
  if(!matches.length && !player.firstName){ showToast(t('toastNothingExport')); return; }
  const {blob, filename} = exportBlob();
  nativeSaveDocument(blob, filename).then(saved => {
    if(saved){
      markExportDone();
      showToast(t('toastCopyOnPhone', {folder: saved.folder}));
      return;
    }
    triggerDownload(blob, filename);
  }).catch(() => triggerDownload(blob, filename));
}
function sendCopy(){
  if(!matches.length && !player.firstName){ showToast(t('toastNothingExport')); return; }
  const {blob, filename} = exportBlob();
  nativeShareBlob(blob, filename, 'Matchcard').then(ok => {
    if(ok){
      markExportDone();
      showToast(t('toastCopySent'));
      return;
    }
    const file = new File([blob], filename, {type:'application/json'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      navigator.share({files:[file], title:'Matchcard'}).then(() => {
        markExportDone();
        showToast(t('toastCopySent'));
      }).catch(() => triggerDownload(blob, filename));
      return;
    }
    triggerDownload(blob, filename);
  }).catch(() => triggerDownload(blob, filename));
}
function markExportDone(){
  localStorage.setItem(EXPORT_KEY, todayStr());
  refreshBackupBanner();
  renderHistory();
}
function triggerDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  markExportDone();
  showToast(t('toastCopySaved'));
}

document.getElementById('exportBtn').addEventListener('click', downloadMatches);
document.getElementById('sendBtn')?.addEventListener('click', sendCopy);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('copyBtn').addEventListener('click', async () => {
  try{
    await navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
    markExportDone();
    showToast(t('toastCopied'));
  }catch(e){ showToast(t('toastCopyFail')); }
});
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const result = applyImportBundle(JSON.parse(await file.text()));
    showToast(result.added ? t('toastAdded', {n: result.added}) : (result.playerTouched ? t('toastPlayer') : t('toastNoNew')));
  }catch(err){ showToast(t('toastReadFail')); }
  e.target.value = '';
});

let currentRange = '10';
let currentSeasonFilter = 'current';
let historyPage = 1;
let historyQuery = '';
let historyKind = 'all';
const HISTORY_PAGE = 10;
const RANGE_KEYS = ['10','100','7d','30d','year','all','season'];
const KIND_KEYS = ['all','league','friendly','cup','tournament'];
function loadFilters(){
  try{
    const f = JSON.parse(localStorage.getItem(FILTER_KEY) || '{}');
    if(f.season === 'all' || f.season === 'current' || /^\d{4}\/\d{2}$/.test(String(f.season || ''))) currentSeasonFilter = f.season;
    if(RANGE_KEYS.includes(f.range)) currentRange = f.range;
    else if(RANGE_KEYS.includes(f.chart)) currentRange = f.chart;
    else if(RANGE_KEYS.includes(f.cardPeriod)) currentRange = f.cardPeriod;
    historyQuery = String(f.historyQuery || '').slice(0, 80);
    if(KIND_KEYS.includes(f.historyKind)) historyKind = f.historyKind;
  }catch(e){}
}
function saveFilters(){
  try{
    localStorage.setItem(FILTER_KEY, JSON.stringify({
      season: currentSeasonFilter,
      range: currentRange,
      chart: currentRange,
      cardPeriod: currentRange,
      historyQuery,
      historyKind
    }));
  }catch(e){}
}
function syncSeasonChipLabels(){
  const label = currentSeason();
  document.querySelectorAll('[data-season-chip]').forEach(el => { el.textContent = label; });
}
function syncFilterChips(){
  syncSeasonChipLabels();
  document.querySelectorAll('#periodChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.range === currentRange);
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
function historyPool(){
  const q = historyQuery.trim().toLowerCase();
  return [...seasonPool()].reverse().filter(m => {
    if(historyKind && historyKind !== 'all' && (m.kind || 'league') !== historyKind) return false;
    if(!q) return true;
    const opp = String(m.opponent || '').toLowerCase();
    const tour = String(m.tournament || '').toLowerCase();
    const kind = kindLabel(m.kind).toLowerCase();
    return opp.includes(q) || tour.includes(q) || kind.includes(q);
  });
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
  syncFilterChips();
  renderStats();
});
document.getElementById('historyKind').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip) return;
  historyKind = KIND_KEYS.includes(chip.dataset.kind) ? chip.dataset.kind : 'all';
  historyPage = 1;
  saveFilters();
  renderHistory();
});
document.getElementById('historySearch').addEventListener('input', e => {
  historyQuery = String(e.target.value || '').slice(0, 80);
  historyPage = 1;
  saveFilters();
  renderHistory();
});
function periodSlice(sorted, key){
  if(key === 'season'){
    const s = currentSeason();
    return [...matches].sort((a,b)=> a.date.localeCompare(b.date) || a.id - b.id)
      .filter(m => sameSeason(matchSeason(m), s));
  }
  if(key === '10') return sorted.slice(-10);
  if(key === '100') return sorted.slice(-100);
  if(key === 'all') return sorted;
  if(key === 'year'){
    const y = String(new Date().getFullYear());
    return sorted.filter(m => String(m.date).startsWith(y));
  }
  const days = key === '7d' ? 7 : 30;
  return sorted.filter(m => m.date >= daysAgoStr(days));
}
function rangeLabel(key){
  if(key === 'season') return currentSeason();
  return ({
    '10': t('chart10'),
    '100': t('chart100'),
    '7d': t('periodWeek'),
    '30d': t('periodMonth'),
    'year': t('periodYear'),
    'all': t('periodAll')
  })[key] || t('chart10');
}
function cardPeriodMatches(range){
  return periodSlice(seasonPool(), range || currentRange);
}
function cardLocale(){
  return LANG_LOCALE[settings.lang] || LANG_LOCALE.en;
}
function upperFirst(s){
  const str = String(s || '');
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
function dateFromStr(s){
  const d = new Date(String(s || '') + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}
// A card outlives the season, so "Month" says nothing later; write the days it
// really covers, and the month name when every match fits into one month.
function cardSpanLabel(list, monthly){
  const dates = (list || []).map(m => m && m.date).filter(Boolean).sort();
  if(!dates.length) return '';
  const first = dates[0], last = dates[dates.length - 1];
  const from = dateFromStr(first), to = dateFromStr(last);
  if(!from || !to) return '';
  const locale = cardLocale();
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();
  try{
    if(monthly && sameMonth) return upperFirst(from.toLocaleDateString(locale, {month: 'long'})) + ' ' + from.getFullYear();
    if(first === last) return upperFirst(from.toLocaleDateString(locale, {day: 'numeric', month: 'long'})) + ' ' + from.getFullYear();
    if(sameYear){
      const fmt = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'long'});
      const span = typeof fmt.formatRange === 'function'
        ? fmt.formatRange(from, to)
        : fmt.format(from) + ' – ' + fmt.format(to);
      return upperFirst(span) + ' ' + to.getFullYear();
    }
  }catch(e){}
  return formatDate(first) + ' – ' + formatDate(last);
}
function cardPeriodLabel(range){
  const key = range || currentRange;
  if(key === 'season') return currentSeason();
  if(key !== 'all'){
    const span = cardSpanLabel(cardPeriodMatches(key), key === '30d');
    if(span) return span;
  }
  const label = rangeLabel(key);
  if(currentSeasonFilter === 'all'){
    if(key === 'all') return t('seasonAll');
    return t('seasonAll') + ' · ' + label;
  }
  if(key === 'all') return seasonNameLabel();
  return seasonNameLabel() + ' · ' + label;
}
function chartMatches(){
  return periodSlice(seasonPool(), currentRange);
}
function statsMatches(){
  return periodSlice(seasonPool(), currentRange);
}
function ratingTrend(list){
  if(list.length < 2) return 0;
  if(list.length < 4) return list[list.length-1].rating - list[0].rating;
  const mid = Math.floor(list.length / 2);
  return (avgRating(list.slice(mid)) || 0) - (avgRating(list.slice(0, mid)) || 0);
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
  const range = rangeLabel(currentRange);
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
    el.innerHTML = emptyCtaHtml(t(matches.length ? 'noPeriod' : 'noMatches'));
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
      [t('dyn_rating'), fmtNum(r0,2), fmtNum(r1,2), dynCls(r1,r0,false)],
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
  let sum = 0, w = 0;
  list.forEach(m => {
    const ww = Math.max(8, Number(m.minutes) || Number(m.matchLen) || 30);
    sum += Number(m.rating) * ww;
    w += ww;
  });
  return w ? sum / w : null;
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
  document.getElementById('view-stats').classList.toggle('stats-empty', !matches.length);
  renderSeasonBoard();
  renderCompare();
  renderPlayerFeed();
  const list = statsMatches();
  renderTimingBoard();
  const grid = document.getElementById('statGrid');
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
    {num:fmtNum(Math.max(...ratings), 2), lbl:t('stBest')},
    {num:fmtNum(Math.min(...ratings), 2), lbl:t('stWorst')},
    {num:list.length, lbl:t('stMatches')},
    {num:minutes, lbl:t('stMins')},
    {num:sum('goals'), lbl:t('stGoals')},
    {num:minutes?fmtNum(sum('goals')*90/minutes, 1):fmtNum(0, 1), lbl:t('stG90')},
  ].map(c=>`<div class="stat-card"><div class="num ${c.cls||''}">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');
  drawChart(chartList);
}
function drawChart(list){
  const svg = document.getElementById('chartSvg');
  if(list.length < 2){
    const msg = matches.length ? t('chartNeed', {n: 2}) : t('chartEmpty');
    svg.innerHTML = `<text x="160" y="100" text-anchor="middle" font-size="12" fill="${cssVar('--text-soft','#8D9AB5')}">${escapeHtml(msg)}</text>`;
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
  const path = list.length === 1 ? '' : `<path d="${xs.map((x,i)=> `${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')}" fill="none" stroke="${cssVar('--accent','#E8C56A')}" stroke-width="2.5"/>`;
  const step = list.length > 10 ? Math.ceil(list.length / 8) : 1;
  const dots = xs.map((x,i)=> {
    return `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${i === xs.length-1?5:3.2}" fill="${i === xs.length-1?cssVar('--gold','#F5B942'):cssVar('--accent','#E8C56A')}"/>`;
  }).join('');
  const labels = xs.map((x,i)=> {
    if(i !== 0 && i !== xs.length-1 && i % step) return '';
    return `<text x="${x.toFixed(1)}" y="${h-8}" font-size="9" fill="${cssVar('--text-soft','#8D9AB5')}" text-anchor="middle">${escapeHtml(chartDateLabel(list[i].date))}</text>`;
  }).join('');
  svg.innerHTML = `${grid}${path}${dots}${labels}`;
}

function renderLiveGrid(){
  const pos = ratingPosOf(document.getElementById('live-position').value || currentPitch());
  const byKey = {};
  metricsFor(pos).forEach(m => { byKey[m.key] = m; });
  document.getElementById('liveGrid').innerHTML = METRIC_GROUPS.map(g => {
    const rows = g.keys.map(k => byKey[k]).filter(Boolean);
    if(!rows.length) return '';
    return `<section class="live-group">
      <div class="metric-group-title">${escapeHtml(metricGroupTitle(g.id))}</div>
      <div class="live-grid-inner">${rows.map(m => {
        const neg = weightOf(m, pos) < 0;
        return `<div class="live-cell ${neg?'neg':''}">
          <button class="live-plus" type="button" onclick="stepMetric('${m.key}',1)">
            ${escapeHtml(metricLabel(m.key))}<span class="live-w" id="live-wgt-${m.key}">${nextWeightLabel(m.key, pos)}</span><span class="n" id="live-cnt-${m.key}">${form.counts[m.key]||0}</span>
          </button>
          <button class="live-minus" type="button" onclick="stepMetric('${m.key}',-1)">−</button>
        </div>`;
      }).join('')}</div>
    </section>`;
  }).join('');
  syncLiveUndo();
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
  let text = t('liveClockWait', {clock: localClock(now) + ' · ' + tzShort(), fmt});
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
  const startBtn = document.getElementById('liveStartBtn');
  if(startBtn) startBtn.disabled = phase === 'done';
}
let cueCtx = null;
function audioCtx(){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    if(!cueCtx) cueCtx = new AC();
    if(cueCtx.state === 'suspended') cueCtx.resume().catch(() => {});
    return cueCtx;
  }catch(e){ return null; }
}
function softTone(ctx, at, freq, dur){
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 1800;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(0.16, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(soft);
  soft.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}
// Short, quiet marker for clock events: a soft tone plus a buzz, no whistle.
function matchCue(kind){
  haptic('MEDIUM');
  if(kind === 'end') window.setTimeout(() => haptic('MEDIUM'), 150);
  const ctx = audioCtx();
  if(!ctx) return;
  const at = ctx.currentTime + 0.03;
  if(kind === 'end'){
    softTone(ctx, at, 620, 0.2);
    softTone(ctx, at + 0.16, 440, 0.3);
  } else if(kind === 'break'){
    softTone(ctx, at, 560, 0.26);
  } else {
    softTone(ctx, at, 760, 0.24);
  }
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
  matchCue('start');
  startClockTick();
  renderLiveClock();
  persistDraft();
  syncMatchContextFold();
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
  matchCue(matchClock.phase === 'done' ? 'end' : 'break');
  if(matchClock.phase === 'done'){
    stopClockTick();
    suggestMinutesFromClock();
  }
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
  pushAppState('layer');
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
document.getElementById('liveUndoBtn').addEventListener('click', () => undoLastLive());
document.querySelectorAll('.js-match-clock-btn').forEach(btn => {
  btn.addEventListener('click', toggleMatchClock);
});
document.getElementById('liveDoneBtn').addEventListener('click', () => {
  closeLive();
  syncMatchContextFold();
});
function suggestMinutesFromClock(){
  if(!matchClock.startedAt) return;
  const played = Math.max(1, Math.min(120, Math.round(playingMs() / 60000) || 1));
  const el = document.getElementById('f-minutes');
  if(!el) return;
  const cur = Number(el.value);
  const def = formatLength(document.getElementById('f-format').value, document.getElementById('f-matchlen').value);
  if(!cur || cur === def) el.value = String(played);
}
document.getElementById('historyBackup')?.addEventListener('click', downloadMatches);
function isElShown(id){
  const el = document.getElementById(id);
  if(!el || el.hidden) return false;
  const cs = window.getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
}
function activeViewName(){
  const view = document.querySelector('.view.active');
  return view && view.id ? view.id.replace('view-', '') : '';
}
let popping = false;
let lastAppBack = 0;
function pushAppState(kind){
  // In the native shell the WebView swallows the back gesture whenever it has
  // history of its own, so there MainActivity drives the back handling instead.
  if(popping || isNativeApp()) return;
  try{
    const has = !!(history.state && history.state.ffk);
    if(kind === 'layer' || !has) history.pushState({ffk: kind || 'tab'}, '');
    else history.replaceState({ffk: kind || 'tab'}, '');
  }catch(e){}
}
function requestAppBack(){
  const now = Date.now();
  if(now - lastAppBack < 600) return true;
  lastAppBack = now;
  popping = true;
  try{ return handleAppBack(); } finally { popping = false; }
}
function handleAppBack(){
  if(isElShown('intro')){
    finishIntro();
    return true;
  }
  if(isElShown('transfer')){
    finishTransfer();
    return true;
  }
  if(isElShown('onboard')){
    if(onboardStep > 0){
      onboardStep -= 1;
      renderOnboard();
    }
    return true;
  }
  if(isElShown('cropModal')){ closeCrop(); return true; }
  if(isElShown('photoSheet')){ closePhotoSheet(); return true; }
  if(isElShown('previewModal')){ closeCardPreview(); return true; }
  if(isElShown('playerEdit')){ closePlayerEdit(true); return true; }
  if(document.getElementById('app')?.classList.contains('live-on')){ closeLive(); return true; }
  const name = activeViewName();
  if(name === 'history'){
    const openDetails = document.querySelector('#historyList .match-details.open');
    if(openDetails){ openDetails.classList.remove('open'); return true; }
  }
  if(name === 'report'){ showView('history'); return true; }
  if(name !== 'player'){ showView('player'); return true; }
  return false;
}
// Called from MainActivity on the back key and the edge gesture. Keep the name
// distinct from the functions above: assigning to window would shadow them.
window.ffkBack = function(){
  try{ return requestAppBack(); }catch(e){ return true; }
};
function bindAppBack(){
  if(window.__ffkPopBound || isNativeApp()) return;
  window.__ffkPopBound = true;
  window.addEventListener('popstate', () => { requestAppBack(); });
}
const SHEET_ANIM_MS = 280;
const SHEET_EASE = 'cubic-bezier(.22,.61,.36,1)';
function resetSheet(card){
  if(!card) return;
  if(card.__sheetAnim){
    try{ card.__sheetAnim.cancel(); }catch(e){}
    card.__sheetAnim = null;
  }
  card.classList.remove('sheet-full', 'sheet-dragging');
  card.style.transform = '';
  if(card.parentElement) card.parentElement.classList.remove('sheet-hiding');
}
function openSheet(card){
  if(!card) return;
  resetSheet(card);
  try{
    card.__sheetAnim = card.animate(
      [{transform: 'translateY(100%)'}, {transform: 'translateY(0px)'}],
      {duration: SHEET_ANIM_MS, easing: SHEET_EASE}
    );
  }catch(e){}
}
// Glides the sheet from where the finger left it either back into place or out
// of the screen; CSS transitions are unreliable right after a drag.
function settleSheet(card, from, toClose, onClose){
  const done = () => {
    card.__sheetAnim = null;
    if(toClose) onClose();
    // A finished fill-forwards animation would outrank the inline transform of
    // the next drag, so drop it once the sheet reached its place.
    if(anim) try{ anim.cancel(); }catch(e){}
  };
  card.style.transform = '';
  if(toClose && card.parentElement) card.parentElement.classList.add('sheet-hiding');
  let anim = null;
  try{
    anim = card.animate(
      [{transform: 'translateY(' + Math.max(0, from) + 'px)'}, {transform: toClose ? 'translateY(100%)' : 'translateY(0px)'}],
      {duration: SHEET_ANIM_MS, easing: SHEET_EASE, fill: 'forwards'}
    );
  }catch(e){}
  card.__sheetAnim = anim;
  if(!anim){ done(); return; }
  anim.onfinish = done;
}
function bindSheetDrag(cardId, grabId, onClose){
  const card = document.getElementById(cardId);
  const grab = document.getElementById(grabId);
  if(!card || !grab) return;
  let startY = 0, shift = 0, startedAt = 0, dragging = false;
  const finish = () => {
    if(!dragging) return;
    dragging = false;
    card.classList.remove('sheet-dragging');
    const elapsed = Math.max(1, Date.now() - startedAt);
    const far = shift > Math.min(180, card.offsetHeight * 0.28);
    const flick = shift > 90 && shift / elapsed > 0.9;
    if(shift > 0 && card.classList.contains('sheet-full')){
      card.classList.remove('sheet-full');
      settleSheet(card, shift, false, onClose);
    } else {
      settleSheet(card, shift, far || flick, onClose);
    }
  };
  grab.addEventListener('pointerdown', e => {
    dragging = true;
    startY = e.clientY;
    shift = 0;
    startedAt = Date.now();
    if(card.__sheetAnim){
      try{ card.__sheetAnim.cancel(); }catch(err){}
      card.__sheetAnim = null;
    }
    card.classList.add('sheet-dragging');
    try{ grab.setPointerCapture(e.pointerId); }catch(err){}
  });
  grab.addEventListener('pointermove', e => {
    if(!dragging) return;
    shift = e.clientY - startY;
    if(shift < -24) card.classList.add('sheet-full');
    card.style.transform = shift > 0 ? 'translateY(' + shift + 'px)' : '';
  });
  grab.addEventListener('pointerup', finish);
  grab.addEventListener('pointercancel', finish);
}
function bindSheets(){
  bindSheetDrag('playerEditCard', 'playerEditGrab', () => closePlayerEdit(true));
  bindSheetDrag('previewCard', 'previewGrab', () => closeCardPreview());
}
// Android back (key and edge gesture) is routed through MainActivity, which calls
// window.ffkBack and minimizes the app when nothing was left to close.
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
document.getElementById('themeChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip || !THEME_ORDER.includes(chip.dataset.theme)) return;
  settings.theme = chip.dataset.theme;
  saveSettings();
  applyTheme();
  if(typeof chartMatches === 'function') drawChart(chartMatches());
});
document.getElementById('iconSetChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip || !ICON_SET_ORDER.includes(chip.dataset.icons)) return;
  settings.iconSet = chip.dataset.icons;
  saveSettings();
  applyIconSet();
});
document.getElementById('previewPeriod').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip || !previewState || previewState.kind !== 'period') return;
  const range = chip.dataset.range || '10';
  if(!cardPeriodMatches(range).length){
    showToast(t('noPeriod'));
    return;
  }
  previewState.range = range;
  currentRange = range;
  saveFilters();
  syncFilterChips();
  renderStats();
  refreshCardPreview().catch(() => {});
});
document.getElementById('previewTheme').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip || !previewState) return;
  previewState.mode = chip.dataset.card === 'light' ? 'light' : 'dark';
  refreshCardPreview().catch(() => {});
});
document.getElementById('previewShare').addEventListener('click', async () => {
  if(!previewState || !previewState.canvas) return;
  const ok = await exportPngFile(previewState.canvas, previewState.filename);
  if(ok) closeCardPreview();
});
document.getElementById('previewSave').addEventListener('click', async () => {
  const btn = document.getElementById('previewSave');
  if(!previewState || !previewState.canvas || btn.disabled) return;
  // Writing the file is silent, so the button itself reports the result; a
  // parent kept tapping it and collected ten copies of the same card.
  btn.disabled = true;
  btn.textContent = t('previewSaving');
  let done = false;
  try{
    await savePngFile(previewState.canvas, previewState.filename);
    done = true;
  }catch(e){}
  btn.textContent = done ? t('previewSaved') : t('previewSave');
  window.setTimeout(() => {
    btn.disabled = false;
    btn.textContent = t('previewSave');
  }, 2400);
});
document.getElementById('previewCancel').addEventListener('click', closeCardPreview);

let onboardStep = 0;
function onboardPages(){
  return [
    {title: t('onboard1Title'), body: t('onboard1Body')},
    {title: t('onboard2Title'), body: t('onboard2Body')},
    {title: t('onboard3Title'), body: t('onboard3Body')}
  ];
}
let introBusy = false;
function skipIntroNow(){
  const el = document.getElementById('intro');
  if(el){
    el.hidden = true;
    el.classList.remove('out', 'play');
  }
  document.documentElement.classList.remove('intro-on');
  hideNativeSplash();
  applyNativeChrome();
}
function afterIntro(){
  if(!maybeTransfer()) maybeOnboard();
}
function finishIntro(){
  const el = document.getElementById('intro');
  if(!el || el.hidden || introBusy) return;
  introBusy = true;
  el.classList.add('out');
  window.setTimeout(() => {
    el.hidden = true;
    el.classList.remove('out', 'play');
    document.documentElement.classList.remove('intro-on');
    introBusy = false;
    applyNativeChrome();
    afterIntro();
  }, 420);
}
function hideNativeSplash(){
  try{
    if(window.FfkSplash && typeof window.FfkSplash.ready === 'function') window.FfkSplash.ready();
  }catch(e){}
}
function playIntro(){
  const el = document.getElementById('intro');
  if(!el){
    skipIntroNow();
    return false;
  }
  introBusy = false;
  document.documentElement.classList.add('intro-on');
  el.hidden = false;
  el.classList.remove('out', 'play');
  void el.offsetWidth;
  el.classList.add('play');
  requestAnimationFrame(() => requestAnimationFrame(hideNativeSplash));
  el.addEventListener('click', finishIntro, {once:true});
  window.setTimeout(finishIntro, 8200);
  return true;
}
function finishOnboard(){
  settings.onboarded = true;
  saveSettings();
  document.getElementById('onboard').hidden = true;
}
function renderOnboard(){
  const pages = onboardPages();
  const step = Math.min(pages.length - 1, Math.max(0, onboardStep));
  document.getElementById('onboardTitle').textContent = pages[step].title;
  document.getElementById('onboardBody').textContent = pages[step].body;
  document.getElementById('onboardNext').textContent = step === pages.length - 1 ? t('onboardDone') : t('onboardNext');
  document.getElementById('onboardSkip').textContent = t('onboardSkip');
  document.querySelectorAll('#onboardDots span').forEach((el, i) => el.classList.toggle('on', i === step));
}
function maybeOnboard(){
  if(settings.onboarded) return;
  if(matches.length || (player && (player.firstName || player.lastName))){
    settings.onboarded = true;
    saveSettings();
    return;
  }
  onboardStep = 0;
  document.getElementById('onboard').hidden = false;
  renderOnboard();
  pushAppState('layer');
}
function finishTransfer(){
  settings.pwaTransferSeen = true;
  saveSettings();
  const el = document.getElementById('transfer');
  if(el) el.hidden = true;
  maybeOnboard();
}
function maybeTransfer(){
  if(settings.pwaTransferSeen) return false;
  if(!isNativeApp() && !/[?&]ffktransfer=1(?:&|$)/.test(location.search)) return false;
  if(matches.length){
    settings.pwaTransferSeen = true;
    saveSettings();
    return false;
  }
  document.getElementById('transfer').hidden = false;
  pushAppState('layer');
  return true;
}
document.getElementById('onboardNext').addEventListener('click', () => {
  if(onboardStep >= 2){ finishOnboard(); return; }
  onboardStep += 1;
  renderOnboard();
});
document.getElementById('onboardSkip').addEventListener('click', finishOnboard);
document.getElementById('transferPick').addEventListener('click', () => document.getElementById('transferFile').click());
document.getElementById('transferSkip').addEventListener('click', finishTransfer);
document.getElementById('transferFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const result = applyImportBundle(JSON.parse(await file.text()));
    showToast(result.added ? t('toastAdded', {n: result.added}) : (result.playerTouched ? t('toastPlayer') : t('toastNoNew')));
    finishTransfer();
  }catch(err){ showToast(t('toastReadFail')); }
  e.target.value = '';
});
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
  scrollMainToTop();
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
document.getElementById('pPhotoWrap').addEventListener('click', () => openPhotoSheet('photo'));
document.getElementById('pCoverBtn').addEventListener('click', () => openPhotoSheet('cover'));
document.getElementById('photoSheetCamera').addEventListener('click', () => pickFromCamera());
document.getElementById('photoSheetPick').addEventListener('click', () => pickFromGallery());
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
  closePlayerEdit(false);
  showView('player');
  updateHero();
});
document.getElementById('editPlayerBtn').addEventListener('click', openPlayerEdit);
document.getElementById('editPlayerClose').addEventListener('click', () => closePlayerEdit(true));

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
// Keeps canvas text inside its box: shrinks the size first, then clips with an
// ellipsis. Honours the current textAlign, so x is the anchor point.
function fitText(ctx, text, x, y, maxWidth, weight, size, minSize){
  const str = String(text == null ? '' : text).trim();
  if(!str) return size;
  let px = size;
  const min = Math.max(10, minSize || Math.round(size * 0.62));
  ctx.font = canvasFont(weight, px);
  while(px > min && ctx.measureText(str).width > maxWidth){
    px -= 1;
    ctx.font = canvasFont(weight, px);
  }
  let out = str;
  if(ctx.measureText(out).width > maxWidth){
    while(out.length > 1 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1);
    out = out.replace(/[\s·]+$/, '') + '…';
  }
  ctx.fillText(out, x, y);
  return px;
}
// The photo on its own layer so the bottom can fade to nothing and the player
// looks cut out of the card instead of pasted on it.
function photoLayer(img, w, h, fade, focusY, radius){
  const layer = makeHiCanvas(w, h);
  if(radius){
    layer.ctx.save();
    pathRoundRect(layer.ctx, 0, 0, w, h + radius, radius);
    layer.ctx.clip();
  }
  if(img) drawCovered(layer.ctx, img, 0, 0, w, h, focusY);
  if(radius) layer.ctx.restore();
  const cut = layer.ctx.createLinearGradient(0, h - fade, 0, h);
  cut.addColorStop(0, 'rgba(0,0,0,0)');
  cut.addColorStop(1, 'rgba(0,0,0,1)');
  layer.ctx.globalCompositeOperation = 'destination-out';
  layer.ctx.fillStyle = cut;
  layer.ctx.fillRect(0, h - fade, w, fade);
  layer.ctx.globalCompositeOperation = 'source-over';
  return layer.canvas;
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
function futTheme(ovr, mode){
  const dark = ovr >= 85 ? {
    foil:'#F5D76E', foil2:'#C9A227', ink:'#140C28', paper:['#2A1658', '#0E1A36', '#12382E'],
    glow:'rgba(245,185,66,.45)', plate:'#F5D76E', muted:'#D9C27A'
  } : ovr >= 75 ? {
    foil:'#F3D27A', foil2:'#B8860B', ink:'#2A1A06', paper:['#5A3E12', '#2C1C08', '#7A5418'],
    glow:'rgba(245,185,66,.35)', plate:'#F6DE9A', muted:'#E8D5A0'
  } : ovr >= 65 ? {
    foil:'#D9E2EC', foil2:'#7C8A99', ink:'#1A2430', paper:['#3D4A5C', '#1B2430', '#5C6B7A'],
    glow:'rgba(180,198,214,.3)', plate:'#E8EEF4', muted:'#C5D0DA'
  } : {
    foil:'#E0B089', foil2:'#8A5A32', ink:'#2A160C', paper:['#5A3518', '#24140A', '#7A4A22'],
    glow:'rgba(196,122,62,.3)', plate:'#E8C4A0', muted:'#D7B08A'
  };
  if(mode !== 'light') return dark;
  return {
    foil: dark.foil, foil2: dark.foil2, ink:'#0B1220',
    paper:['#F7F1E3', '#EFE6D4', '#E7D8B8'],
    glow:'rgba(245,185,66,.18)', plate:'#0B1220', muted:'#4A5568'
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
  try{
    if(await nativeShareBlob(blob, filename, 'Matchcard')) return true;
  }catch(e){}
  const file = new File([blob], filename, {type:'image/png'});
  try{
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:'Matchcard'});
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

async function savePngFile(canvas, filename){
  // A download link is dead inside the web view, so the card goes into the
  // gallery; sharing is the last resort if even that is refused.
  if(isNativeApp()){
    const Gallery = capPlugin('GalleryPicker');
    if(Gallery && typeof Gallery.saveImage === 'function'){
      try{
        await Gallery.saveImage({dataUrl: canvas.toDataURL('image/png'), filename});
        showToast(t('toastCardGallery'));
        return;
      }catch(err){
        camLog('save card fail', String((err && (err.message || err.errorMessage)) || err));
      }
    }
    await exportPngFile(canvas, filename);
    return;
  }
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(t('toastCard'));
}

let shareBusy = false;
let previewState = null;
function defaultCardMode(){
  return themeName() === 'dark' ? 'dark' : 'light';
}
function syncPreviewPeriodChips(range){
  const wrap = document.getElementById('previewPeriod');
  if(!wrap) return;
  wrap.hidden = !previewState || previewState.kind !== 'period';
  syncSeasonChipLabels();
  wrap.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.range === range);
  });
}
// The card speaks FIFA shorthand, so the sheet spells it out while the picture
// itself stays clean.
function syncPreviewLegend(){
  const el = document.getElementById('previewLegend');
  if(!el) return;
  if(!previewState || !previewState.legend){
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const rows = ratingPosOf(player.primary) === 'gk'
    ? [['DIV','legDiv'], ['HAN','legHan'], ['KIC','legKic'], ['REF','legRef'], ['POS','legGkPos'], ['PAS','legPas']]
    : [['PAC','legPac'], ['SHO','legSho'], ['PAS','legPas'], ['DRI','legDri'], ['DEF','legDef'], ['PHY','legPhy']];
  el.innerHTML = `<h4>${escapeHtml(t('legTitle'))}</h4>
    <div class="legend-grid">${rows.map(r => `<span><b>${r[0]}</b> ${escapeHtml(t(r[1]))}</span>`).join('')}</div>
    <p>${escapeHtml(t('legOvr'))}</p>
    <p>${escapeHtml(t('legPos', {pos: pitchPosLabel(cardPosCode())}))}</p>`;
  el.hidden = false;
}
async function refreshCardPreview(){
  if(!previewState) return;
  syncPreviewLegend();
  if(previewState.kind === 'period'){
    const range = RANGE_KEYS.includes(previewState.range) ? previewState.range : currentRange;
    previewState.range = range;
    const list = cardPeriodMatches(range);
    const label = cardPeriodLabel(range);
    const slug = String(player.firstName || 'player').trim().replace(/\s+/g, '_').slice(0, 18) || 'player';
    previewState.filename = `matchcard_${slug}_${range}.png`;
    previewState.build = mode => drawFutCardCanvas(list, label, mode);
    syncPreviewPeriodChips(range);
  } else {
    syncPreviewPeriodChips('');
  }
  const canvas = await previewState.build(previewState.mode);
  previewState.canvas = canvas;
  const img = document.getElementById('previewImg');
  img.src = canvas.toDataURL('image/png');
  img.alt = t('previewTitle');
  document.querySelectorAll('#previewTheme .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.card === previewState.mode);
  });
}
async function openCardPreview(state){
  if(shareBusy) return;
  shareBusy = true;
  previewState = {mode: defaultCardMode(), ...state};
  try{
    await refreshCardPreview();
    document.getElementById('previewModal').hidden = false;
    openSheet(document.getElementById('previewCard'));
    pushAppState('layer');
  }catch(e){
    shareBusy = false;
    previewState = null;
    throw e;
  }
}
function closeCardPreview(){
  document.getElementById('previewModal').hidden = true;
  resetSheet(document.getElementById('previewCard'));
  const period = document.getElementById('previewPeriod');
  if(period) period.hidden = true;
  const img = document.getElementById('previewImg');
  img.removeAttribute('src');
  previewState = null;
  shareBusy = false;
}
async function drawFutCardCanvas(list, period, mode){
  const pos = ratingPosOf(player.primary);
  const ovr = fifaOvr(list);
  const theme = futTheme(ovr, mode);
  const photo = await loadCanvasImage(currentPhoto() || player.photo);
  const cover = await loadCanvasImage(currentCover() || player.cover);
  const {canvas, ctx, w, h} = makeHiCanvas(780, 1120);
  ctx.fillStyle = mode === 'light' ? '#FFF8D6' : '#070B14';
  ctx.fillRect(0, 0, w, h);
  const paper = ctx.createLinearGradient(0, 0, w, h);
  paper.addColorStop(0, theme.paper[0]);
  paper.addColorStop(0.55, theme.paper[1]);
  paper.addColorStop(1, theme.paper[2]);
  pathRoundRect(ctx, 36, 36, w - 72, h - 72, 36);
  ctx.fillStyle = paper;
  ctx.fill();

  ctx.save();
  pathRoundRect(ctx, 36, 36, w - 72, h - 72, 36);
  ctx.clip();
  if(cover){
    ctx.globalAlpha = mode === 'light' ? 0.16 : 0.26;
    drawCovered(ctx, cover, 36, 36, w - 72, 460);
    ctx.globalAlpha = 1;
  }
  const glow = ctx.createRadialGradient(w * 0.55, 300, 20, w * 0.52, 360, 440);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(36, 36, w - 72, 600);

  const box = {x: 212, y: 126, w: 436, h: 588};
  if(photo){
    ctx.drawImage(photoLayer(photo, box.w, box.h, 210, 0.18, 26), box.x, box.y, box.w, box.h);
  } else {
    ctx.fillStyle = theme.plate;
    ctx.textAlign = 'center';
    fitText(ctx, initials(), box.x + box.w / 2, box.y + 392, box.w - 150, '900', 170, 80);
    ctx.textAlign = 'left';
  }
  const shine = ctx.createLinearGradient(36, 36, w - 36, 620);
  shine.addColorStop(0, 'rgba(255,255,255,.10)');
  shine.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(36, 36, w - 72, 600);
  ctx.restore();

  pathRoundRect(ctx, 36, 36, w - 72, h - 72, 36);
  ctx.strokeStyle = theme.foil;
  ctx.lineWidth = 10;
  ctx.stroke();
  pathRoundRect(ctx, 52, 52, w - 104, h - 104, 28);
  ctx.strokeStyle = theme.foil2;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Left rail: rating, position and the brand, each clamped to its own width.
  const rail = 120;
  ctx.fillStyle = theme.plate;
  fitText(ctx, String(ovr), 76, 206, rail, '900', 116, 70);
  ctx.fillStyle = theme.muted;
  fitText(ctx, cardPosCode(), 84, 256, rail, '800', 36, 22);
  ctx.strokeStyle = theme.foil2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, 276);
  ctx.lineTo(84 + 96, 276);
  ctx.stroke();
  ctx.fillStyle = theme.muted;
  fitText(ctx, 'MATCHCARD', 84, 308, rail, '800', 18, 12);
  const no = shirtNo();
  if(no){
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.plate;
    fitText(ctx, (langLatin() ? '#' : '№') + no, w - 78, 120, 150, '800', 42, 26);
    ctx.textAlign = 'left';
  }

  const plate = {x: 70, y: 700, w: w - 140, h: 80};
  pathRoundRect(ctx, plate.x, plate.y, plate.w, plate.h, 16);
  ctx.fillStyle = mode === 'light' ? theme.foil : theme.plate;
  ctx.fill();
  ctx.fillStyle = theme.ink;
  ctx.textAlign = 'center';
  fitText(ctx, (displayName() || '').toUpperCase(), w / 2, plate.y + 54, plate.w - 56, '900', 36, 20);
  ctx.textAlign = 'left';

  const stats = futStatRows(list, pos);
  const colX = [118, 400];
  stats.forEach((row, i) => {
    const x = colX[i % 2];
    const y = 838 + Math.floor(i / 2) * 64;
    ctx.fillStyle = theme.plate;
    fitText(ctx, String(row[1]), x, y, 80, '900', 42, 28);
    ctx.fillStyle = theme.muted;
    fitText(ctx, row[0], x + 88, y - 6, 150, '800', 20, 14);
  });

  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'center';
  const foot = [period, player.team || player.club, matchCountLabel(list.length)]
    .map(x => String(x || '').trim()).filter(Boolean).join('  ·  ');
  fitText(ctx, foot, w / 2, h - 84, w - 200, '600', 20, 13);
  ctx.textAlign = 'left';
  return canvas;
}
async function shareFutCard(list, period, tag){
  if(!list || !list.length){
    showToast(t('noPeriod'));
    return;
  }
  const slug = String(player.firstName || 'player').trim().replace(/\s+/g, '_').slice(0, 18) || 'player';
  const stamp = String(tag || 'card').replace(/\s+/g, '_').slice(0, 24);
  await openCardPreview({
    legend: true,
    filename: `matchcard_${slug}_${stamp}.png`,
    build: mode => drawFutCardCanvas(list, period, mode)
  });
}
function playerCardList(kind){
  if(kind === 'month') return sortedMatches().filter(m => m.date >= daysAgoStr(30));
  if(kind === '10') return sortedMatches().slice(-10);
  if(kind === 'all') return sortedMatches();
  return feedList().list;
}
function playerCardPeriod(kind){
  if(kind === 'month') return cardSpanLabel(playerCardList('month'), true) || t('periodMonth');
  if(kind === '10') return cardSpanLabel(playerCardList('10'), false) || t('periodLast10');
  if(kind === 'all') return t('periodAll');
  const {season} = feedList();
  return season ? (player.season || currentSeason()) : t('periodAll');
}
function sharePlayerCard(kind){
  return shareFutCard(playerCardList(kind || 'season'), playerCardPeriod(kind || 'season'), kind || 'season');
}
function shareStatsCard(){
  const range = RANGE_KEYS.includes(currentRange) ? currentRange : '10';
  const list = cardPeriodMatches(range);
  if(!list.length){
    showToast(t('noPeriod'));
    return;
  }
  const slug = String(player.firstName || 'player').trim().replace(/\s+/g, '_').slice(0, 18) || 'player';
  return openCardPreview({
    kind: 'period',
    legend: true,
    range,
    filename: `matchcard_${slug}_${range}.png`,
    build: mode => drawFutCardCanvas(list, cardPeriodLabel(range), mode)
  });
}
function shareHistoryCard(){
  return shareFutCard(seasonPool(), seasonNameLabel(), 'season');
}
async function drawMatchCardCanvas(m, mode){
  const lines = reportLines(m);
  const split = actionSplit(m.counts, m.position, m.minutes, m.matchLen);
  const photo = await loadCanvasImage(currentPhoto() || player.photo);
  const ovr = Math.round(Math.min(99, Math.max(45, Number(m.rating) * 10)));
  const theme = futTheme(ovr, mode);
  const w = 1280;
  const left = 52, right = w - 52, textX = 248;
  const headX = right - 330;
  const headW = headX - textX - 32;
  const kickoff = m.kickoffClock ? t('kickoffLine', {clock: m.kickoffClock}) : '';
  const metaBase = kickoff ? 268 : 232;
  const headBottom = Math.max(262, metaBase + 22);
  const listTop = headBottom + 86;
  const rows = Math.max(1, Math.ceil(lines.length / 2));
  const sumY = listTop + (rows - 1) * 50 + 96;
  const h = Math.round(sumY + 104);
  const {canvas, ctx} = makeHiCanvas(w, h);

  ctx.fillStyle = mode === 'light' ? '#FFF8D6' : '#070B14';
  ctx.fillRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, theme.paper[0]);
  bg.addColorStop(1, theme.paper[1]);
  pathRoundRect(ctx, 18, 18, w - 36, h - 36, 28);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  pathRoundRect(ctx, 18, 18, w - 36, h - 36, 28);
  ctx.clip();
  const glow = ctx.createRadialGradient(w - 260, 140, 20, w - 260, 180, 520);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(18, 18, w - 36, h - 36);
  ctx.restore();
  pathRoundRect(ctx, 18, 18, w - 36, h - 36, 28);
  ctx.strokeStyle = theme.foil;
  ctx.lineWidth = 6;
  ctx.stroke();

  if(photo){
    ctx.save();
    pathRoundRect(ctx, left, 52, 168, 210, 14);
    ctx.clip();
    drawCovered(ctx, photo, left, 52, 168, 210, 0.2);
    ctx.restore();
    pathRoundRect(ctx, left, 52, 168, 210, 14);
    ctx.strokeStyle = theme.foil;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const tx = photo ? textX : left;
  const tw = photo ? headW : headX - left - 32;
  ctx.fillStyle = theme.muted;
  fitText(ctx, 'MATCHCARD  ·  ' + t('reportTitle').toUpperCase(), tx, 84, tw, '800', 22, 16);
  ctx.fillStyle = theme.plate;
  fitText(ctx, reportPlayerName(m), tx, 150, tw, '900', 54, 30);
  ctx.fillStyle = theme.muted;
  const vs = `${formatDate(m.date)}  ·  ${m.opponent || t('shareVs')}  ·  ${m.score ? scoreLine(m) : '—'}  ·  ${matchMinsLabel(m)}`;
  fitText(ctx, vs, tx, 200, tw, '700', 26, 17);
  if(kickoff) fitText(ctx, kickoff, tx, 236, tw, '700', 24, 16);
  fitText(ctx, `${t('heroAction')} ${fmtNum(m.actionRating, 1)}    ${t('heroEffort')} ${fmtNum(m.effortRating, 1)}`, tx, metaBase, tw, '700', 24, 16);

  ctx.textAlign = 'right';
  ctx.fillStyle = theme.plate;
  fitText(ctx, fmtNum(m.rating, 1), right, 178, 300, '900', 110, 60);
  ctx.fillStyle = theme.muted;
  fitText(ctx, outingCaption(m), right, 218, 320, '700', 24, 15);
  ctx.textAlign = 'left';

  ctx.strokeStyle = theme.foil2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, headBottom + 28);
  ctx.lineTo(right, headBottom + 28);
  ctx.stroke();

  const col2 = 664;
  const colW = 520;
  if(!lines.length){
    ctx.fillStyle = theme.plate;
    fitText(ctx, t('plusEven'), left, listTop, right - left, '700', 32, 20);
  } else {
    lines.forEach((line, i) => {
      const x = i % 2 === 0 ? left : col2;
      const y = listTop + Math.floor(i / 2) * 50;
      ctx.fillStyle = theme.foil;
      ctx.beginPath();
      ctx.arc(x + 12, y - 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.plate;
      fitText(ctx, line.text, x + 36, y, colW - 36, '700', 32, 20);
    });
  }

  ctx.fillStyle = theme.foil;
  fitText(ctx, fmtSigned(split.plus, 2), left, sumY, colW, '800', 46, 30);
  ctx.fillStyle = theme.muted;
  fitText(ctx, t('actPlus'), left, sumY + 36, colW, '700', 22, 15);
  ctx.fillStyle = '#FB6767';
  fitText(ctx, split.minus ? '−' + fmtNum(Math.abs(split.minus), 2) : fmtNum(0, 2), col2, sumY, colW, '800', 46, 30);
  ctx.fillStyle = theme.muted;
  fitText(ctx, t('actMinus'), col2, sumY + 36, colW, '700', 22, 15);
  return canvas;
}
async function shareCard(m){
  await openCardPreview({
    filename: `matchcard_${m.date}.png`,
    build: mode => drawMatchCardCanvas(m, mode)
  });
}

(function init(){
  try{
    if('serviceWorker' in navigator && !isNativeApp()){
      const swUrl = new URL('sw.js', document.querySelector('base')?.href || location.href);
      navigator.serviceWorker.register(swUrl.href).catch(() => {});
    } else if('serviceWorker' in navigator && isNativeApp()){
      // The APK ships its own assets; a worker left over from the PWA build
      // would keep serving stale files after an update.
      navigator.serviceWorker.getRegistrations().then(list => list.forEach(reg => reg.unregister())).catch(() => {});
      if(window.caches && caches.keys) caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
    }
    loadSettings();
    const ratingFail = ratingFixtureFail();
    if(ratingFail) console.error('Matchcard rating', ratingFail);
    loadFilters();
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
    if(!playIntro()) if(!maybeTransfer()) maybeOnboard();
    bindAppBack();
    bindTapHaptics();
    bindBehaviorSlider();
    bindSheets();
    bindCameraRestore();
    syncScoreResultHint();
    hydrateAllMedia().then(() => {
      applyHeader();
      if(document.getElementById('view-player')?.classList.contains('active')) fillPlayerForm();
      else {
        setBadge(document.getElementById('pPhotoBox'), currentPhoto(), initials());
        setCoverPreview();
        renderRoster();
      }
    }).catch(() => {});
  }catch(err){
    console.error(err);
    showToast(String(err && err.message || err));
  }
})();
