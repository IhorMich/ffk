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
  duelswon: '<path d="M7.2 16.5 12 8.2l4.8 8.3"/><path d="M9.4 13.2h5.2"/>',
  support: '<circle cx="7" cy="12" r="2.3"/><circle cx="17" cy="12" r="2.3"/><path d="M9.4 12h5.2"/>',
  saves: '<path d="M7.2 10.2c0-2.2 1.8-3.8 4.8-3.8s4.8 1.6 4.8 3.8v5.4c0 1.4-1.1 2.6-2.5 2.6H9.7c-1.4 0-2.5-1.2-2.5-2.6z"/><path d="M9.2 12.2h5.6"/>',
  claims: '<path d="M12 5.2v5.4"/><path d="M8.4 8.2 12 10.6l3.6-2.4"/><path d="M6.2 14.2c1.6 3.2 10 3.2 11.6 0"/>',
  gkpass: '<circle cx="7" cy="13.2" r="2"/><path d="M9.4 12.2 17.8 7.4"/><path d="M14.6 7.2h3.3v3.2"/>',
  conceded: '<path d="M5 7.5h14"/><path d="M6.5 7.5 12 17.2 17.5 7.5"/><circle cx="12" cy="11.2" r="1.7"/>',
  losses: '<path d="M7.2 7.2 16.8 16.8M16.8 7.2 7.2 16.8"/>',
  ledtogoal: '<circle cx="12" cy="12" r="7.2"/><path d="M7.4 7.4 16.6 16.6"/>',
  badpass: '<path d="M5 12h8.5"/><path d="M11.2 8.5 15 12l-3.8 3.5"/><path d="M17.2 8.2 17.2 15.8M15.2 10.2 19.2 8.2 15.2 6.4"/>',
  badtouch: '<circle cx="12" cy="12" r="6.4"/><path d="M9 9.2 15 14.8M15 9.2 9 14.8"/>',
  duelslost: '<path d="M7.2 8.2 12 16.5l4.8-8.3"/><path d="M9.4 11.5h5.2"/>',
  fouls: '<rect x="7.2" y="5.5" width="9.6" height="13" rx="1.4"/><path d="M9.4 9.2h5.2M9.4 12.2h5.2M9.4 15.2h3.4"/>',
  owngoal: '<circle cx="12" cy="12" r="7"/><path d="M12 8.2v5.2"/><circle cx="12" cy="16.2" r="1.1"/>'
};

/* Literal football outlines — stroke only, no filled arrow blobs. */
const METRIC_ICON_CLEAR = {
  goals: '<circle cx="12" cy="12" r="7.6"/><path d="M12 5.8 14.8 8.6 12 10.2 9.2 8.6Z"/><path d="M9.2 8.6 6.6 11.2 8.4 14.4 12 10.2"/><path d="M14.8 8.6 17.4 11.2 15.6 14.4 12 10.2"/><path d="M8.4 14.4 12 18.2 15.6 14.4"/>',
  shots: '<path d="M5 19V8h14v11"/><path d="M5 8h14"/><circle cx="12" cy="14.2" r="2.4"/>',
  assists: '<circle cx="5.5" cy="8.2" r="1.7"/><path d="M5.5 10.2v4.2l-2.2 3.4M5.5 14.4l2.2 3.4"/><circle cx="16.8" cy="8.2" r="1.7"/><path d="M16.8 10.2v4.2l-2.2 3.4M16.8 14.4l2.2 3.4"/><circle cx="11.2" cy="11.5" r="1.6"/><path d="M13 11.5h2.2"/>',
  dribbles: '<path d="M6 17.2V12.5"/><path d="M4.6 12.5h2.8"/><circle cx="10.2" cy="14.8" r="2"/><circle cx="15.6" cy="9.4" r="2"/><path d="M11.8 13.4c1.2-1.6 2.4-2.4 3.2-2.8"/>',
  openings: '<circle cx="6.4" cy="7.6" r="1.7"/><path d="M6.4 9.6v3.6l-2.1 4M6.4 13.2l2.1 4"/><path d="M9.6 11.5h5.4"/><path d="M12.8 9 16.2 11.5 12.8 14"/>',
  chances: '<path d="M4.8 19V9.2h14.4V19"/><path d="M4.8 9.2h14.4"/><circle cx="9.2" cy="14.5" r="2"/><path d="M11.4 14.5h4.2"/><path d="M13.8 12.4 16.4 14.5 13.8 16.6"/>',
  passes: '<circle cx="5.8" cy="7.8" r="1.6"/><path d="M5.8 9.7v3.8l-2 3.4M5.8 13.5l2 3.4"/><circle cx="18.2" cy="7.8" r="1.6"/><path d="M18.2 9.7v3.8l-2 3.4M18.2 13.5l2 3.4"/><path d="M8.2 12h5.6"/><path d="M12 9.8 14.6 12 12 14.2"/>',
  buildpass: '<path d="M4.5 17.5h15"/><circle cx="6.2" cy="12.2" r="2"/><path d="M8.4 12.2h7"/><path d="M13.4 9.6 17.2 12.2 13.4 14.8"/>',
  tackles: '<circle cx="16.2" cy="9.2" r="2.3"/><path d="M4.8 16.2c2.2-1 4.6-2.2 7.2-4.2l2.2 2.2c-2.4 1.6-4.8 3-7.4 4.2z"/><path d="M11.6 13.2 14.4 10.6"/>',
  interceptions: '<circle cx="5.2" cy="8.5" r="1.5"/><circle cx="18.8" cy="8.5" r="1.5"/><path d="M6.8 9.2 10.2 12"/><path d="M17.2 9.2 13.8 12"/><circle cx="12" cy="14.8" r="2.4"/><path d="M12 10.8v1.6"/>',
  clearances: '<path d="M4.8 18h14.4"/><path d="M7.2 18c0-3.2 1.4-5.6 3.6-7.2"/><circle cx="14.8" cy="7.6" r="2.2"/><path d="M11.2 10.4 13.2 8.6"/>',
  blocks: '<path d="M5 7.2h14v3.6H5z"/><path d="M5 13.2h14v3.6H5z"/><circle cx="18.2" cy="5.6" r="1.5"/><path d="M17 6.8 14.8 9"/>',
  duelswon: '<circle cx="6.2" cy="7.5" r="1.6"/><path d="M6.2 9.4v3.4l-2 3.6M6.2 12.8l2 3.6"/><circle cx="17.8" cy="7.5" r="1.6"/><path d="M17.8 9.4v3.4l-2 3.6M17.8 12.8l2 3.6"/><path d="M9.2 11.2 11.2 13.2 15.2 9"/>',
  support: '<circle cx="6.4" cy="7.6" r="1.6"/><path d="M6.4 9.5v3.2l-2 3.6M6.4 12.7l2 3.6"/><circle cx="17.6" cy="7.6" r="1.6"/><path d="M17.6 9.5v3.2l-2 3.6M17.6 12.7l2 3.6"/><path d="M8.8 12.2h6.4"/>',
  saves: '<path d="M5.8 10.5c0-2.2 1.6-3.8 4-3.8h1.2c.6 0 1.2.2 1.6.6L14 9l1.4-1.7c.4-.4 1-.6 1.6-.6h.2c2.2 0 3.8 1.6 3.8 3.8V16c0 1.3-1 2.4-2.3 2.4h-2.2c-.7 0-1.3-.3-1.7-.8L14 15.4l-1.2 1.4c-.4.5-1 .8-1.7.8H8.1C6.8 17.6 5.8 16.5 5.8 15.2z"/><circle cx="12" cy="12.6" r="1.7"/>',
  claims: '<circle cx="12" cy="6.4" r="2"/><path d="M8.2 11.2c1.1-1.4 2.4-2.2 3.8-2.2s2.7.8 3.8 2.2"/><path d="M7.4 14.5c1.4 3 7.8 3 9.2 0"/><path d="M12 9.2v3.4"/>',
  gkpass: '<path d="M5.2 9.5h5v8.2h-5z"/><circle cx="7.7" cy="12" r="1.4"/><circle cx="16.8" cy="8.2" r="2"/><path d="M10.4 12.4 14.6 9.2"/>',
  conceded: '<path d="M4.6 7.5h14.8v2.2"/><path d="M4.6 9.7 12 18.2 19.4 9.7"/><path d="M7.2 9.7 12 15.2 16.8 9.7"/><circle cx="12" cy="11.6" r="1.5"/>',
  losses: '<circle cx="9.2" cy="12" r="3.2"/><path d="M13.2 10.2 19 6.8M13.6 13.8 19 17.2"/><path d="M16.4 8.2 19 6.8 17.4 4.8"/>',
  ledtogoal: '<path d="M5 19V8.2h14V19"/><path d="M5 8.2h14"/><circle cx="8.5" cy="14" r="2"/><path d="M10.8 14H16"/><path d="M7.2 7.2 10.2 10.2"/>',
  badpass: '<circle cx="5.6" cy="8" r="1.5"/><path d="M5.6 9.8v3.6l-2 3.4M5.6 13.4l2 3.4"/><path d="M8.2 11.5c2.4.2 4.2 1.8 5.4 4"/><path d="M12.2 13.8 14.8 16.8M14.2 17.4h2.2v-2"/>',
  badtouch: '<circle cx="7.2" cy="7.8" r="1.5"/><path d="M7.2 9.6v3.2l-2 3.8M7.2 12.8l2 3.8"/><circle cx="16.4" cy="9.2" r="2.4"/><path d="M9.6 13.2 13.8 10.4"/><path d="M14.8 11.2 17.8 13.8"/>',
  duelslost: '<circle cx="6.2" cy="7.5" r="1.6"/><path d="M6.2 9.4v3.4l-2 3.6M6.2 12.8l2 3.6"/><circle cx="17.8" cy="7.5" r="1.6"/><path d="M17.8 9.4v3.4l-2 3.6M17.8 12.8l2 3.6"/><path d="M9.4 11.5 14.6 14.8"/>',
  fouls: '<rect x="7.2" y="4.6" width="9.6" height="14.8" rx="1.2"/><path d="M9.4 9.2h5.2M9.4 12.4h5.2"/>',
  owngoal: '<path d="M5 19V8h14v11"/><path d="M5 8h14"/><circle cx="12" cy="13.8" r="2.3"/><path d="M12 6.2v2.4"/>'
};

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
  clear: {paths: METRIC_ICON_CLEAR, width: '1.85', tint: false},
  bright: {paths: METRIC_ICON_CLEAR, width: '1.85', tint: true},
  line: {paths: METRIC_ICON_LINE, width: '1.75', tint: false}
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

function metricIconSvg(key, cls){
  const pack = METRIC_ICON_PACKS[iconSetName()] || METRIC_ICON_PACKS.clear;
  const body = pack.paths[key] || pack.paths.losses;
  const klass = cls ? ` class="${cls}"` : '';
  const tint = pack.tint ? (METRIC_ICON_TINT[key] || 'currentColor') : 'currentColor';
  return `<svg${klass} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${pack.width}" stroke-linecap="round" stroke-linejoin="round" style="color:${tint}" aria-hidden="true" focusable="false">${body}</svg>`;
}
