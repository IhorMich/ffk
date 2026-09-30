/* Matchcard Rating — action metrics & weights */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.METRICS = [
    { key: 'goals', positions: ['fwd', 'mid', 'def'], live: ['fwd', 'mid'], w: { fwd: 0.7, mid: 0.55, def: 0.45, gk: 0 } },
    { key: 'shots', positions: ['fwd', 'mid'], live: ['fwd'], w: { fwd: 0.2, mid: 0.15, def: 0, gk: 0 } },
    { key: 'assists', positions: ['fwd', 'mid', 'def'], live: ['fwd', 'mid'], w: { fwd: 0.5, mid: 0.5, def: 0.35, gk: 0 } },
    { key: 'dribbles', positions: ['fwd', 'mid'], live: ['fwd'], w: { fwd: 0.15, mid: 0.1, def: 0, gk: 0 } },
    { key: 'openings', positions: ['fwd'], live: ['fwd'], w: { fwd: 0.2, mid: 0, def: 0, gk: 0 } },
    { key: 'chances', positions: ['mid'], live: ['mid'], w: { fwd: 0, mid: 0.32, def: 0, gk: 0 } },
    { key: 'passes', positions: ['fwd', 'mid', 'def'], live: ['fwd', 'mid'], w: { fwd: 0.15, mid: 0.25, def: 0.15, gk: 0 } },
    { key: 'buildpass', positions: ['mid', 'def', 'gk'], live: ['mid', 'def', 'gk'], w: { fwd: 0, mid: 0.07, def: 0.1, gk: 0.12 } },
    { key: 'tackles', positions: ['fwd', 'mid', 'def'], live: ['mid', 'def'], w: { fwd: 0.1, mid: 0.25, def: 0.4, gk: 0 } },
    { key: 'interceptions', positions: ['mid', 'def', 'gk'], live: ['def', 'gk'], w: { fwd: 0, mid: 0.18, def: 0.35, gk: 0.28 } },
    { key: 'clearances', positions: ['def'], live: ['def'], w: { fwd: 0, mid: 0, def: 0.22, gk: 0 } },
    { key: 'blocks', positions: ['def'], live: ['def'], w: { fwd: 0, mid: 0, def: 0.28, gk: 0 } },
    { key: 'duelswon', positions: ['fwd', 'mid', 'def'], live: ['mid', 'def'], w: { fwd: 0.1, mid: 0.2, def: 0.3, gk: 0 } },
    { key: 'support', positions: ['fwd', 'mid', 'def'], live: [], w: { fwd: 0.15, mid: 0.2, def: 0.25, gk: 0 } },
    { key: 'saves', positions: ['gk'], live: ['gk'], w: { fwd: 0, mid: 0, def: 0, gk: 0.4 } },
    { key: 'claims', positions: ['gk'], live: ['gk'], w: { fwd: 0, mid: 0, def: 0, gk: 0.3 } },
    { key: 'gkpass', positions: ['gk'], live: ['gk'], w: { fwd: 0, mid: 0, def: 0, gk: 0.15 } },
    { key: 'conceded', positions: ['gk'], live: ['gk'], w: { fwd: 0, mid: 0, def: 0, gk: -0.18 } },
    { key: 'losses', positions: ['fwd', 'mid', 'def'], live: ['fwd', 'mid', 'def'], w: { fwd: -0.2, mid: -0.15, def: -0.1, gk: 0 } },
    { key: 'ledtogoal', positions: ['fwd', 'mid', 'def', 'gk'], live: ['def', 'gk'], w: { fwd: -0.8, mid: -0.8, def: -0.85, gk: -0.55 } },
    { key: 'badpass', positions: ['fwd', 'mid', 'def', 'gk'], live: [], w: { fwd: -0.1, mid: -0.15, def: -0.1, gk: -0.15 } },
    { key: 'badtouch', positions: ['fwd', 'mid', 'def'], live: [], w: { fwd: -0.1, mid: -0.1, def: -0.1, gk: 0 } },
    { key: 'duelslost', positions: ['fwd', 'mid', 'def'], live: [], w: { fwd: -0.1, mid: -0.15, def: -0.25, gk: 0 } },
    { key: 'fouls', positions: ['fwd', 'mid', 'def', 'gk'], live: [], w: { fwd: -0.25, mid: -0.25, def: -0.2, gk: -0.2 } },
    { key: 'owngoal', positions: ['fwd', 'mid', 'def', 'gk'], live: [], w: { fwd: -1, mid: -1, def: -1, gk: -1 } }
  ];

  R.METRIC_GROUPS = [
    { id: 'attack', keys: ['goals', 'shots', 'assists', 'dribbles', 'openings', 'chances', 'passes', 'buildpass', 'support', 'gkpass'] },
    { id: 'defense', keys: ['tackles', 'interceptions', 'clearances', 'blocks', 'duelswon', 'saves', 'claims'] },
    { id: 'discipline', keys: ['losses', 'ledtogoal', 'badpass', 'badtouch', 'duelslost', 'fouls', 'owngoal', 'conceded'] }
  ];

  R.GRADE_TYPICAL = {
    goals: 0.6, assists: 0.5, shots: 1.2, dribbles: 2.2, openings: 2, chances: 1.2,
    passes: 1.5, buildpass: 6, tackles: 2.5, interceptions: 2, clearances: 2, blocks: 1.2,
    duelswon: 4, support: 2, saves: 3, claims: 1.5, gkpass: 4,
    losses: 3.4, ledtogoal: 0.35, badpass: 2.4, badtouch: 1.4, duelslost: 3, fouls: 1.2,
    owngoal: 0.2, conceded: 1.4
  };

  R.metricsFor = function (pos) {
    return R.METRICS.filter(function (m) { return m.positions.indexOf(pos) !== -1; });
  };

  R.weightOf = function (m, pos) {
    return (m.w && m.w[pos] != null) ? m.w[pos] : 0;
  };

  R.metricByKey = function (key) {
    for (var i = 0; i < R.METRICS.length; i++) {
      if (R.METRICS[i].key === key) return R.METRICS[i];
    }
    return null;
  };

  R.eventSign = function (key, pos) {
    var met = R.metricByKey(key);
    if (!met) return 0;
    var w = R.weightOf(met, pos);
    if (w > 0) return 1;
    if (w < 0) return -1;
    return 0;
  };

  R.metricGrade = function (avg, key, w) {
    var typical = R.GRADE_TYPICAL[key] || 2;
    if (w >= 0) return R.clamp10(4 + 6 * (1 - Math.exp(-avg / typical)));
    return R.clamp10(10 - 6 * (1 - Math.exp(-avg / typical)));
  };

  R.emptyCounts = function () {
    var counts = {};
    R.METRICS.forEach(function (m) { counts[m.key] = 0; });
    return counts;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
