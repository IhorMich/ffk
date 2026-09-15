/* Monoline metric icons — one stroke language for Matchcard actions. */
const METRIC_ICON_PATHS = {
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
  owngoal: '<circle cx="12" cy="12" r="7"/><path d="M12 8.2v5.2"/><circle cx="12" cy="16.2" r="1.1" fill="currentColor" stroke="none"/>'
};

function metricIconSvg(key, cls){
  const body = METRIC_ICON_PATHS[key] || METRIC_ICON_PATHS.losses;
  const klass = cls ? ` class="${cls}"` : '';
  return `<svg${klass} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
