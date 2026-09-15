/* Metric icon packs for Matchcard. Switch via settings.iconSet. */
const ICON_SET_ORDER = ['line', 'solid', 'mark'];

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

/* Filled pictograms — denser, poster-like. */
const METRIC_ICON_SOLID = {
  goals: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  shots: '<path d="M4.5 19.5V7.8h15V19.5h-2.4V10.2H6.9V19.5z"/><circle cx="12" cy="14.8" r="2.4"/>',
  assists: '<circle cx="6.2" cy="12" r="2.6"/><path d="M9.4 10.4h6.2l-.1-2.6L20 12l-4.5 4.2.1-2.6H9.4z"/>',
  dribbles: '<path d="M4.2 17c2.6-5.2 4.8-5.2 7.4 0 2.5 5 4.8 5 7.4 0l1.7 1c-3.2 6.2-7 6.2-10.5 0-2.1-3.8-3.6-3.8-5.7 0z"/><circle cx="18.4" cy="7.6" r="2.4"/>',
  openings: '<path d="M5.2 17.4 11 6.8l2.8 4.8L19.2 5.6l1.5 1.2-6.4 7.6-2.7-4.6-4.8 8.8z"/>',
  chances: '<path d="M12 3.8 14.1 9.4l6 .2-4.7 3.8 1.6 5.8L12 16.2 7 19.2l1.6-5.8L3.9 9.6l6-.2z"/>',
  passes: '<circle cx="5.8" cy="12" r="2.5"/><path d="M9 10.3h7l-.1-2.5L20.4 12 15.9 16.2l.1-2.5H9z"/>',
  buildpass: '<path d="M3.6 10.3h11.2l-.1-2.8L21 12l-6.3 4.5.1-2.8H3.6z"/>',
  tackles: '<path d="M12 3.9 19 6.8v4.8c0 4.2-2.9 7.3-7 8.6-4.1-1.3-7-4.4-7-8.6V6.8z"/>',
  interceptions: '<path d="M4.8 8.2c4-3.6 10.4-3.6 14.4 0l-1.5 1.5c-3.2-2.7-8.2-2.7-11.4 0z"/><path d="M10.8 10.2h2.4V15l2.2-2.1 1.5 1.6L12 19.2 7.1 14.5l1.5-1.6 2.2 2.1z"/>',
  clearances: '<circle cx="7.8" cy="15" r="2.6"/><path d="M10.2 13.2 18.4 5.4l2 2-8.2 7.8z"/>',
  blocks: '<path d="M4.2 7.4h15.6v4H4.2zm0 5.4h15.6v4H4.2z"/>',
  duelswon: '<path d="M6.2 17.2 12 6.6l5.8 10.6H6.2zm3.4-3.2h4.8v1.8H9.6z"/>',
  support: '<circle cx="6.6" cy="12" r="2.8"/><circle cx="17.4" cy="12" r="2.8"/><path d="M9.4 10.8h5.2v2.4H9.4z"/>',
  saves: '<path d="M6.4 10c0-2.6 2.2-4.5 5.6-4.5S17.6 7.4 17.6 10v5.6c0 1.7-1.3 3.1-3 3.1H9.4c-1.7 0-3-1.4-3-3.1z"/>',
  claims: '<path d="M10.8 4.8h2.4v5.2l3.2-2.1 1.2 1.8L12 13.2 6.4 9.7l1.2-1.8 3.2 2.1z"/><path d="M5.4 15.2c2 3.6 11.2 3.6 13.2 0l1.7 1c-2.7 4.8-13.9 4.8-16.6 0z"/>',
  gkpass: '<circle cx="6.6" cy="13.4" r="2.5"/><path d="M9.4 11.6 18.2 6.4l1.5 1.3-8.8 5.2z"/>',
  conceded: '<path d="M4.2 6.8h15.6v2.2L12 18.4 4.2 9z"/>',
  losses: '<path d="M6.2 5.8 18.2 17.8l-1.8 1.8L4.4 7.6zm12 0 1.8 1.8L8 19.6 6.2 17.8z"/>',
  ledtogoal: '<path fill-rule="evenodd" d="M12 3.6A8.4 8.4 0 1 1 3.6 12 8.4 8.4 0 0 1 12 3.6zm3.7 3.1L8.7 15.7l-1.6-1.6 7-7z"/>',
  badpass: '<path d="M4.2 10.4h7.6l-.1-2.4L16 12l-4.3 4 .1-2.4H4.2zm12.2-3.2 4.2-2.2v9.2l-4.2-2.2z"/>',
  badtouch: '<path fill-rule="evenodd" d="M12 3.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4zm3.2 4.2L8.8 14.4l-1.4-1.4 6.4-6.4z"/>',
  duelslost: '<path d="M6.2 6.8h11.6L12 17.4 6.2 6.8zm3.4 2.4h4.8v1.8H9.6z"/>',
  fouls: '<rect x="6.6" y="4.6" width="10.8" height="14.8" rx="1.6"/>',
  owngoal: '<circle cx="12" cy="12" r="8"/><rect x="11" y="7.2" width="2" height="6.2" rx="1" fill="var(--bg, #0B1220)"/><circle cx="12" cy="16.2" r="1.3" fill="var(--bg, #0B1220)"/>'
};

/* Stamp marks — simple glyphs in a soft tile. */
const METRIC_ICON_MARK = {
  goals: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  shots: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7.2 16.2V9.2h9.6v7" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/><circle cx="12" cy="13.4" r="1.5" fill="var(--bg, #0B1220)" stroke="none"/>',
  assists: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7 12h7.2l-2.2-2.2M14.2 14.2 16.4 12" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  dribbles: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M6.4 14.8c1.6-3 3.2-3 4.8 0s3.2 3 4.8 0" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  openings: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M8 15.2 12 8.4l2 3.2 3.4-4" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  chances: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M12 7.2 13.2 10.4h3.2l-2.5 2 1 3.2L12 13.8 9.1 15.6l1-3.2-2.5-2h3.2z" fill="var(--bg, #0B1220)" stroke="none"/>',
  passes: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7.2 12h7.4M12.4 9.2 16.2 12l-3.8 2.8" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  buildpass: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M6.4 12h8.4M12.4 8.8 17 12l-4.6 3.2" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  tackles: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M12 7.2 16.2 9v3.2c0 2.4-1.6 4.1-4.2 4.9-2.6-.8-4.2-2.5-4.2-4.9V9z" fill="var(--bg, #0B1220)" stroke="none"/>',
  interceptions: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7.2 9.2c2.6-1.8 7-1.8 9.6 0M12 10.4v5.2M10 13.6 12 15.6l2-2" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  clearances: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M8.2 14.8 15.4 8M13.2 8h2.8v2.8" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/><circle cx="8.2" cy="14.8" r="1.5" fill="var(--bg, #0B1220)" stroke="none"/>',
  blocks: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7 9.2h10v2.2H7zm0 3.8h10v2.2H7z" fill="var(--bg, #0B1220)" stroke="none"/>',
  duelswon: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M8 15.4 12 8.6l4 6.8" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  support: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="8.4" cy="12" r="1.8" fill="var(--bg, #0B1220)" stroke="none"/><circle cx="15.6" cy="12" r="1.8" fill="var(--bg, #0B1220)" stroke="none"/><path d="M10.2 12h3.6" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  saves: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M8.2 10.4c0-1.6 1.4-2.8 3.8-2.8s3.8 1.2 3.8 2.8v4c0 1-.8 1.8-1.8 1.8h-4c-1 0-1.8-.8-1.8-1.8z" fill="var(--bg, #0B1220)" stroke="none"/>',
  claims: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M12 7.2v4.2M9.4 9.2 12 11l2.6-1.8M8 14.4c1.4 2.2 6.6 2.2 8 0" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  gkpass: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="8.2" cy="13" r="1.7" fill="var(--bg, #0B1220)" stroke="none"/><path d="M10 12.2 16.2 8.4" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  conceded: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7.2 8.4h9.6L12 16z" fill="var(--bg, #0B1220)" stroke="none"/>',
  losses: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M8.4 8.4 15.6 15.6M15.6 8.4 8.4 15.6" stroke="var(--bg, #0B1220)" stroke-width="2.2"/>',
  ledtogoal: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/><path d="M9.2 9.2 14.8 14.8" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  badpass: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M7 12h6.2M11 9.6 13.8 12 11 14.4M15.2 8.8v6.4" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  badtouch: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/><path d="M9.6 9.6 14.4 14.4M14.4 9.6 9.6 14.4" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  duelslost: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><path d="M8 8.8 12 15.6 16 8.8" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/>',
  fouls: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><rect x="8.4" y="7" width="7.2" height="10" rx="1" fill="var(--bg, #0B1220)" stroke="none"/>',
  owngoal: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="var(--bg, #0B1220)" stroke-width="2"/><path d="M12 9.2v3.6" stroke="var(--bg, #0B1220)" stroke-width="2"/><circle cx="12" cy="15" r="1" fill="var(--bg, #0B1220)" stroke="none"/>'
};

const METRIC_ICON_PACKS = {
  line: {paths: METRIC_ICON_LINE, fill: 'none', stroke: 'currentColor', width: '1.75'},
  solid: {paths: METRIC_ICON_SOLID, fill: 'currentColor', stroke: 'none', width: '0'},
  mark: {paths: METRIC_ICON_MARK, fill: 'currentColor', stroke: 'none', width: '0'}
};

function iconSetName(){
  try{
    if(typeof settings !== 'undefined' && ICON_SET_ORDER.includes(settings.iconSet)) return settings.iconSet;
  }catch(e){}
  return 'line';
}

function metricIconSvg(key, cls){
  const pack = METRIC_ICON_PACKS[iconSetName()] || METRIC_ICON_PACKS.line;
  const body = pack.paths[key] || pack.paths.losses;
  const klass = cls ? ` class="${cls}"` : '';
  return `<svg${klass} viewBox="0 0 24 24" fill="${pack.fill}" stroke="${pack.stroke}" stroke-width="${pack.width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
