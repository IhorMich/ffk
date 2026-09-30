/* Matchcard Rating — clamps, stacking, minutes */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.clamp10 = function (n) {
    return Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;
  };

  // Keep every decimal the weights produce; round on display via clamp10.
  R.clampScore = function (n) {
    return Math.max(0, Math.min(10, Math.round(n * 1000) / 1000));
  };

  R.stackedDecay = function (w) {
    return w < 0 ? 0.75 : 0.88;
  };

  R.nextStackedWeight = function (n, w) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!w) return 0;
    return w * Math.pow(R.stackedDecay(w), n);
  };

  R.stackedWeight = function (n, w) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    if (!n || !w) return 0;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += R.nextStackedWeight(i, w);
    return sum;
  };

  R.playedMinutes = function (minutes, matchLen) {
    var full = Math.max(1, Number(matchLen) || 60);
    var played = Math.max(1, Number(minutes) || full);
    return { played: played, full: full };
  };

  R.isShortOuting = function (minutes, matchLen) {
    var pm = R.playedMinutes(minutes, matchLen);
    return pm.played < 25 || pm.played < pm.full * 0.45;
  };

  R.outingFactor = function (minutes, matchLen) {
    if (minutes == null && matchLen == null) return 1;
    var pm = R.playedMinutes(minutes, matchLen);
    var half = Math.min(25, pm.full * 0.5);
    if (pm.played >= half) return 1;
    return 0.65 + 0.35 * (pm.played / half);
  };

  R.withOuting = function (delta, minutes, matchLen) {
    return delta * R.outingFactor(minutes, matchLen);
  };

  R.countOf = function (m, key) {
    return Math.max(0, Math.floor(Number(m && m.counts && m.counts[key]) || 0));
  };

  R.behaviorOf = function (m, key) {
    return Number(m && m.behaviors && m.behaviors[key]) || 3;
  };

  R.normalizeCounts = function (raw) {
    var counts = R.emptyCounts();
    var src = raw && typeof raw === 'object' ? raw : {};
    R.METRICS.forEach(function (m) {
      counts[m.key] = Math.max(0, Math.floor(Number(src[m.key]) || 0));
    });
    return counts;
  };

  R.normalizeBehaviors = function (raw) {
    var behaviors = R.emptyBehaviors();
    var src = raw && typeof raw === 'object' ? raw : {};
    R.BEHAVIOR.forEach(function (b) {
      var v = Number(src[b.key]);
      behaviors[b.key] = (v >= 1 && v <= 5) ? v : 3;
    });
    return behaviors;
  };

  /** Pure match slice used by the engine (JSON in → normalized fields). */
  R.normalizeMatchInput = function (match) {
    var m = match && typeof match === 'object' ? match : {};
    var pitchRaw = m.pitchPos != null ? m.pitchPos : m.position;
    var pitchPos = R.isPitchCode(pitchRaw)
      ? pitchRaw
      : (R.isPitchCode(m.position) ? m.position : (R.ratingPosOf(m.position) || 'fwd'));
    var position = R.ratingPosOf(m.pitchPos || m.position || pitchPos);
    var matchLen = Math.max(1, Number(m.matchLen) || 60);
    var minutes = Math.min(120, Math.max(1, Number(m.minutes) || matchLen));
    return {
      counts: R.normalizeCounts(m.counts),
      behaviors: R.normalizeBehaviors(m.behaviors),
      position: position,
      pitchPos: pitchPos,
      minutes: minutes,
      matchLen: matchLen
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
