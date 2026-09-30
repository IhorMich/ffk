/* Matchcard Rating — score breakdown / blank detection (no i18n, no DOM) */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.matchIsBlank = function (m) {
    var acted = R.METRICS.some(function (x) { return R.countOf(m, x.key) > 0; });
    var shifted = R.BEHAVIOR.some(function (b) {
      return b.inRating && R.behaviorOf(m, b.key) !== 3;
    });
    return !acted && !shifted;
  };

  R.actionSplit = function (counts, pos, minutes, matchLen) {
    var f = R.outingFactor(minutes, matchLen);
    var plus = 0;
    var minus = 0;
    R.metricsFor(pos).forEach(function (m) {
      var v = R.stackedWeight(counts[m.key], R.weightOf(m, pos)) * f;
      if (v > 0) plus += v;
      else if (v < 0) minus += v;
    });
    return { plus: Math.round(plus * 100) / 100, minus: Math.round(minus * 100) / 100 };
  };

  /** Per-metric contribution after outing factor (JSON-friendly). */
  R.explainContributions = function (counts, pos, minutes, matchLen) {
    var f = R.outingFactor(minutes, matchLen);
    var rows = [];
    R.metricsFor(pos).forEach(function (m) {
      var n = Math.max(0, Math.floor(Number(counts && counts[m.key]) || 0));
      if (!n) return;
      var raw = R.stackedWeight(n, R.weightOf(m, pos));
      var delta = raw * f;
      if (!delta) return;
      rows.push({
        key: m.key,
        count: n,
        weight: R.weightOf(m, pos),
        delta: Math.round(delta * 1000) / 1000,
        sign: delta > 0 ? 1 : -1
      });
    });
    rows.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
    return rows;
  };

  R.explainBehaviors = function (behaviors) {
    return R.BEHAVIOR.map(function (b) {
      var value = Number(behaviors && behaviors[b.key]) || 3;
      return {
        key: b.key,
        value: value,
        inRating: !!b.inRating,
        deltaFromNeutral: b.inRating ? (value - 3) : 0
      };
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
