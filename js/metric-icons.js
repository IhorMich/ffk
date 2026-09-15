/* Metric icon packs for Matchcard. Switch via settings.iconSet. */

const METRIC_ICON_LINE = {
  goals: '<circle cx="12" cy="12" r="7.2"/><path d="M12 4.8v14.4M4.8 12h14.4M7.2 7.2c2.2 1.6 7.4 1.6 9.6 0M7.2 16.8c2.2-1.6 7.4-1.6 9.6 0"/>',
  shots: '<path d="M5 19V8.5M19 19V8.5M5 8.5h14"/><circle cx="12" cy="14.5" r="2.2"/>',
  assists: '<circle cx="6.5" cy="12" r="2.2"/><path d="M9.2 12h7.2"/><path d="M14.2 8.6 18.8 12l-4.6 3.4"/>',
  dribbles: '<path d="M5 16.5c2.2-4.5 4-4.5 6.2 0s4 4.5 6.3 0"/><circle cx="18.2" cy="8.2" r="2"/>',
  openings: '<path d="M6 16.5 11.2 7.5 14 12.2 18.5 6.8"/><path d="M15.6 6.8h2.9v2.9"/>',
  chances: '<path d="M12 4.5 13.6 9.4 18.8 9.6 14.8 12.9 16.2 18 12 15.2 7.8 18 9.2 12.9 5.2 9.6 10.4 9.4Z"/>',
  passes: '<circle cx="6.2" cy="12" r="2.1"/><path d="M9 12h8.2"/><path d="M14.8 8.4 19.2 12l-4.4 3.6"/>',
  buildpass: '<path d="M4.5 12h12.8"/><path d="M14.2 7.8 19.5 12l-5.3 4.2"/><circle cx="4.5" cy="12" r="1.6"/>',
  tackles: '<path d="M12 4.8 18.2 7.4v4.6c0 3.7-2.5 6.4-6.2 7.6-3.7-1.2-6.2-3.9-6.2-7.6V7.4Z"/>',
  interceptions: '<path d="M6.2 7.5c3.4-2.8 8.2-2.8 11.6 0"/><path d="M12 9.2v7.6"/><path d="M9.2 14.2 12 17l2.8-2.8"/>',
  clearances: '<circle cx="8.2" cy="14.8" r="2.1"/><path d="M10.2 13.4 17.8 6.6"/><path d="M14.4 6.5h3.4v3.4"/>',
  blocks: '<path d="M5 8.2h14v3.2H5zM5 13.2h14v3.2H5z"/><path d="M12 8.2v8.2"/>',
  duelswon: '<circle cx="5.5" cy="7.8" r="1.5"/><circle cx="18.5" cy="7.8" r="1.5"/><circle cx="12" cy="12" r="2"/><path d="M8.2 11.2h1.4M14.4 11.2h1.4"/>',
  support: '<circle cx="6.5" cy="12" r="2.2"/><path d="M9.4 12c2.4-3 5.4-4.2 8.2-3.6"/><path d="M15.2 7h2.8v2.8"/>',
  saves: '<path d="M7.2 10.2c0-2.2 1.8-3.8 4.8-3.8s4.8 1.6 4.8 3.8v5.4c0 1.4-1.1 2.6-2.5 2.6H9.7c-1.4 0-2.5-1.2-2.5-2.6z"/><path d="M9.2 12.2h5.6"/>',
  claims: '<path d="M12 5.2v5.4"/><path d="M8.4 8.2 12 10.6l3.6-2.4"/><path d="M6.2 14.2c1.6 3.2 10 3.2 11.6 0"/>',
  gkpass: '<circle cx="7" cy="13.2" r="2"/><path d="M9.4 12.2 17.8 7.4"/><path d="M14.6 7.2h3.3v3.2"/>',
  conceded: '<path d="M5 7.5h14"/><path d="M6.5 7.5 12 17.2 17.5 7.5"/><circle cx="12" cy="11.2" r="1.7"/>',
  losses: '<circle cx="8.2" cy="13.2" r="2.4"/><path d="M10.6 11.6c1.8-2 4-3.2 6.6-3.4"/><path d="M15 6.8h3v3"/>',
  ledtogoal: '<path d="M5 19V8.2h14V19"/><path d="M5 8.2h14"/><circle cx="14.5" cy="14" r="2"/><path d="M6.5 12.2c2.2.8 4.4 1.5 6 1.8"/>',
  badpass: '<circle cx="5.5" cy="12" r="2"/><circle cx="18.5" cy="7.5" r="2"/><path d="M8 12.5c2.6.4 4.4 2.4 6 5"/>',
  badtouch: '<path d="M4.8 17h6"/><path d="M6.2 17c.2-3 1.6-5 4-5.8"/><circle cx="15.5" cy="8.2" r="2.2"/><path d="M17.5 9.8c.8 2.4 1.5 4.8 1.5 6.8"/>',
  duelslost: '<circle cx="5.5" cy="7.8" r="1.5"/><circle cx="18.5" cy="7.8" r="1.5"/><circle cx="12" cy="16.2" r="1.8"/><path d="M12 11.5v2.4"/>',
  fouls: '<rect x="7.2" y="5.5" width="9.6" height="13" rx="1.4"/><path d="M9.4 9.2h5.2M9.4 12.2h5.2M9.4 15.2h3.4"/>',
  owngoal: '<circle cx="12" cy="12" r="7"/><path d="M12 8.2v5.2"/><circle cx="12" cy="16.2" r="1.1"/>'
};

/* Stroke fallbacks for keys missing from the silhouette sheet (GK + sharp pass). */
const METRIC_ICON_FALLBACK = {
  passes: '<circle cx="5.8" cy="7.8" r="1.6"/><path d="M5.8 9.7v3.8l-2 3.4M5.8 13.5l2 3.4"/><circle cx="18.2" cy="7.8" r="1.6"/><path d="M18.2 9.7v3.8l-2 3.4M18.2 13.5l2 3.4"/><path d="M8.2 12h5.6"/><path d="M12 9.8 14.6 12 12 14.2"/>',
  saves: '<path d="M5.8 10.5c0-2.2 1.6-3.8 4-3.8h1.2c.6 0 1.2.2 1.6.6L14 9l1.4-1.7c.4-.4 1-.6 1.6-.6h.2c2.2 0 3.8 1.6 3.8 3.8V16c0 1.3-1 2.4-2.3 2.4h-2.2c-.7 0-1.3-.3-1.7-.8L14 15.4l-1.2 1.4c-.4.5-1 .8-1.7.8H8.1C6.8 17.6 5.8 16.5 5.8 15.2z"/><circle cx="12" cy="12.6" r="1.7"/>',
  claims: '<circle cx="12" cy="6.4" r="2"/><path d="M8.2 11.2c1.1-1.4 2.4-2.2 3.8-2.2s2.7.8 3.8 2.2"/><path d="M7.4 14.5c1.4 3 7.8 3 9.2 0"/><path d="M12 9.2v3.4"/>',
  gkpass: '<path d="M5.2 9.5h5v8.2h-5z"/><circle cx="7.7" cy="12" r="1.4"/><circle cx="16.8" cy="8.2" r="2"/><path d="M10.4 12.4 14.6 9.2"/>',
  conceded: '<path d="M4.6 7.5h14.8v2.2"/><path d="M4.6 9.7 12 18.2 19.4 9.7"/><path d="M7.2 9.7 12 15.2 16.8 9.7"/><circle cx="12" cy="11.6" r="1.5"/>'
};

/* Silhouette pack cut from the action sheet (white glyph → CSS mask). */
const METRIC_ICON_SIL_KEYS = [
  'goals','shots','assists','dribbles','buildpass',
  'openings','chances','tackles','interceptions','duelswon',
  'support','clearances','losses','ledtogoal','badpass',
  'badtouch','duelslost','fouls','blocks','owngoal'
];

const METRIC_ICON_SIL = Object.fromEntries(
  METRIC_ICON_SIL_KEYS.map(k => [k, `icons/metrics/${k}.png`])
);
/* Sharp pass is not on the sheet — reuse buildpass silhouette. */
METRIC_ICON_SIL.passes = 'icons/metrics/buildpass.png';

const METRIC_ICON_TINT = {
  goals:'var(--gold)', shots:'var(--gold)', assists:'var(--accent)', dribbles:'var(--accent)',
  openings:'var(--accent)', chances:'var(--violet)', passes:'var(--accent)', buildpass:'var(--accent)',
  tackles:'#5B8CFF', interceptions:'#5B8CFF', clearances:'#5B8CFF', blocks:'#5B8CFF',
  duelswon:'var(--accent)', support:'var(--violet)',
  saves:'#3EC6FF', claims:'#3EC6FF', gkpass:'#3EC6FF', conceded:'var(--danger)',
  losses:'var(--danger)', ledtogoal:'var(--danger)', badpass:'var(--danger)', badtouch:'var(--danger)',
  duelslost:'var(--danger)', fouls:'var(--gold)', owngoal:'var(--danger)'
};

const ICON_SET_ORDER = ['clear', 'bright', 'line'];

const METRIC_ICON_PACKS = {
  clear: {kind: 'mask', images: METRIC_ICON_SIL, fallback: METRIC_ICON_FALLBACK, width: '1.85', tint: false},
  bright: {kind: 'mask', images: METRIC_ICON_SIL, fallback: METRIC_ICON_FALLBACK, width: '1.85', tint: true},
  line: {kind: 'stroke', paths: METRIC_ICON_LINE, width: '1.75', tint: false}
};

function iconSetName(){
  try{
    if(typeof settings !== 'undefined'){
      if(settings.iconSet === 'mark' || settings.iconSet === 'solid') return 'clear';
      if(ICON_SET_ORDER.includes(settings.iconSet)) return settings.iconSet;
    }
  }catch(e){}
  return 'clear';
}

function metricIconUrl(rel){
  try{
    return new URL(rel, document.baseURI || location.href).href;
  }catch(e){
    return rel;
  }
}

function metricIconStroke(body, width, tint, cls){
  const klass = cls ? ` class="${cls}"` : '';
  return `<svg${klass} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" style="color:${tint}" aria-hidden="true" focusable="false">${body}</svg>`;
}

function metricIconSvg(key, cls){
  const pack = METRIC_ICON_PACKS[iconSetName()] || METRIC_ICON_PACKS.clear;
  const tint = pack.tint ? (METRIC_ICON_TINT[key] || 'currentColor') : 'currentColor';

  if(pack.kind === 'mask'){
    const rel = pack.images[key];
    if(rel){
      const src = metricIconUrl(rel);
      const klass = cls ? ` ${cls}` : '';
      /* mask-image must be inline — urls inside CSS vars resolve against css/app.css */
      return `<span class="metric-glyph${klass}" style="color:${tint};-webkit-mask-image:url('${src}');mask-image:url('${src}')" aria-hidden="true"></span>`;
    }
    const body = (pack.fallback && pack.fallback[key]) || METRIC_ICON_LINE.losses;
    return metricIconStroke(body, pack.width, tint, cls);
  }

  const body = pack.paths[key] || pack.paths.losses;
  return metricIconStroke(body, pack.width, tint, cls);
}
