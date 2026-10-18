/* Matchcard Rating — engine: calculateRating(match) → JSON */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.BASE_RATING = 6.0;
  R.ROLE_BUCKETS = ['fwd', 'mid', 'def', 'gk'];

  R.normalizePosCounts = function (raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    R.ROLE_BUCKETS.forEach(function (pos) {
      if (!raw[pos]) return;
      var counts = R.normalizeCounts(raw[pos]);
      var any = R.METRICS.some(function (m) { return counts[m.key] > 0; });
      if (any) out[pos] = counts;
    });
    return out;
  };

  R.posCountsActive = function (posCounts) {
    return !!posCounts && Object.keys(posCounts).length > 0;
  };

  R.actionSumAll = function (posCounts) {
    var sum = 0;
    R.ROLE_BUCKETS.forEach(function (pos) {
      if (posCounts && posCounts[pos]) sum += R.actionSum(posCounts[pos], pos);
    });
    return sum;
  };

  R.mergedCounts = function (posCounts) {
    var counts = R.emptyCounts();
    R.ROLE_BUCKETS.forEach(function (pos) {
      var bucket = posCounts && posCounts[pos];
      if (!bucket) return;
      R.METRICS.forEach(function (m) {
        counts[m.key] += bucket[m.key] || 0;
      });
    });
    return counts;
  };

  R.emptyForm = function () {
    return { counts: R.emptyCounts(), behaviors: R.emptyBehaviors() };
  };

  R.actionSum = function (counts, pos) {
    var sum = 0;
    R.metricsFor(pos).forEach(function (m) {
      sum += R.stackedWeight(counts[m.key], R.weightOf(m, pos));
    });
    return sum;
  };

  R.actionScore = function (counts, pos, minutes, matchLen) {
    return R.clampScore(R.BASE_RATING + R.withOuting(R.actionSum(counts, pos), minutes, matchLen));
  };

  R.effortScore = function (behaviors) {
    return R.clampScore(R.BASE_RATING + R.effortDelta(behaviors));
  };

  R.overallScore = function (counts, behaviors, pos, minutes, matchLen) {
    var delta = R.actionSum(counts, pos) + R.behaviorDelta(behaviors);
    return R.clampScore(R.BASE_RATING + R.withOuting(delta, minutes, matchLen));
  };

  /**
   * Pure rating API.
   * @param {object} match JSON: { counts, behaviors, position|pitchPos, minutes?, matchLen? }
   * @returns {object} JSON scores + breakdown (no DOM / storage / settings)
   */
  R.calculateRating = function (match) {
    var n = R.normalizeMatchInput(match);
    var buckets = R.normalizePosCounts(match && match.posCounts);
    var multi = R.posCountsActive(buckets);
    var counts = multi ? R.mergedCounts(buckets) : n.counts;
    var actionDelta = multi ? R.actionSumAll(buckets) : R.actionSum(n.counts, n.position);
    var behaviorDelta = R.behaviorDelta(n.behaviors);
    var scale = R.actionScale(n.minutes, n.matchLen, n.kind);
    var outing = R.outingFactor(n.minutes, n.matchLen);
    var overall = R.clampScore(R.BASE_RATING + actionDelta * scale + behaviorDelta * outing);
    var action = R.clampScore(R.BASE_RATING + actionDelta * scale);
    var effort = R.effortScore(n.behaviors);
    var split = multi
      ? R.actionSplitAll(buckets, n.minutes, n.matchLen, n.kind)
      : R.actionSplit(n.counts, n.position, n.minutes, n.matchLen, n.kind);
    var factor = outing;
    return {
      overall: overall,
      action: action,
      effort: effort,
      overallDisplay: R.clamp10(overall),
      actionDisplay: R.clamp10(action),
      effortDisplay: R.clamp10(effort),
      position: n.position,
      pitchPos: n.pitchPos,
      minutes: n.minutes,
      matchLen: n.matchLen,
      base: R.BASE_RATING,
      outingFactor: Math.round(factor * 1000) / 1000,
      lengthFactor: Math.round(R.lengthFactor(n.matchLen, n.kind) * 1000) / 1000,
      kind: n.kind,
      shortOuting: R.isShortOuting(n.minutes, n.matchLen),
      blank: R.matchIsBlank({ counts: counts, behaviors: n.behaviors }),
      split: split,
      contributions: multi
        ? R.explainContributionsAll(buckets, n.minutes, n.matchLen, n.kind)
        : R.explainContributions(n.counts, n.position, n.minutes, n.matchLen, n.kind),
      behaviors: R.explainBehaviors(n.behaviors),
      counts: counts,
      posCounts: multi ? buckets : null,
      behaviorValues: n.behaviors
    };
  };

  R.RATING_FIXTURES = [
    { name: 'base', pos: 'fwd', counts: {}, behaviors: {}, overall: 6, action: 6, effort: 6 },
    { name: 'oneGoal', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, overall: 6.7, action: 6.7, effort: 6 },
    { name: 'threeGoals', pos: 'fwd', counts: { goals: 3 }, behaviors: {}, overall: 7.9, action: 7.9, effort: 6 },
    { name: 'gkSaves', pos: 'gk', counts: { saves: 4, claims: 1 }, behaviors: {}, overall: 7.6, action: 7.6, effort: 6 },
    { name: 'maxEffort', pos: 'fwd', counts: {}, behaviors: { effort: 5, team: 5, coach: 5, discipline: 5 }, overall: 7, action: 6, effort: 10 },
    { name: 'minEffort', pos: 'fwd', counts: {}, behaviors: { effort: 1, team: 1, coach: 1, discipline: 1 }, overall: 5, action: 6, effort: 2 },
    { name: 'shortGoal', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 15, matchLen: 60, overall: 6.6, action: 6.6, effort: 6 },
    { name: 'tour60', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 60, matchLen: 60, kind: 'tournament', overall: 6.7, action: 6.7, effort: 6 },
    { name: 'tour15', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 15, matchLen: 15, kind: 'tournament', overall: 6.4, action: 6.4, effort: 6 },
    { name: 'tour10', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 10, matchLen: 10, kind: 'tournament', overall: 6.3, action: 6.3, effort: 6 },
    { name: 'cup15', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 15, matchLen: 15, kind: 'cup', overall: 6.4, action: 6.4, effort: 6 },
    { name: 'cup10', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 10, matchLen: 10, kind: 'cup', overall: 6.3, action: 6.3, effort: 6 },
    { name: 'cup60', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 60, matchLen: 60, kind: 'cup', overall: 6.7, action: 6.7, effort: 6 },
    { name: 'tourBurst', pos: 'fwd', counts: { goals: 20, assists: 10, shots: 10 }, behaviors: {}, minutes: 10, matchLen: 10, kind: 'tournament', overall: 10, action: 10, effort: 6 },
    { name: 'cupBurst', pos: 'fwd', counts: { goals: 20, assists: 10, shots: 10 }, behaviors: {}, minutes: 10, matchLen: 10, kind: 'cup', overall: 10, action: 10, effort: 6 }
  ];

  R.ratingFixtureFail = function () {
    for (var i = 0; i < R.RATING_FIXTURES.length; i++) {
      var f = R.RATING_FIXTURES[i];
      var got = R.calculateRating({
        counts: f.counts,
        behaviors: f.behaviors,
        position: f.pos,
        minutes: f.minutes,
        matchLen: f.matchLen,
        kind: f.kind
      });
      if (got.overallDisplay !== f.overall || got.actionDisplay !== f.action || got.effortDisplay !== f.effort) {
        return f.name + ' got ' + got.overallDisplay + '/' + got.actionDisplay + '/' + got.effortDisplay;
      }
    }
    var n0 = Math.round(R.nextStackedWeight(0, 0.2) * 100) / 100;
    var n1 = Math.round(R.nextStackedWeight(1, 0.2) * 100) / 100;
    if (n0 !== 0.2 || n1 !== 0.18) return 'nextDecay ' + n0 + '/' + n1;
    var kept = R.calculateRating({
      position: 'gk',
      pitchPos: 'GK',
      counts: { goals: 1, saves: 1 },
      posCounts: { fwd: { goals: 1 }, gk: { saves: 1 } },
      behaviors: {}
    });
    if (kept.overallDisplay !== 7.1) return 'multiPos ' + kept.overallDisplay;
    var oneRole = R.calculateRating({
      position: 'fwd',
      counts: { goals: 1 },
      posCounts: { fwd: { goals: 1 } },
      behaviors: {}
    });
    if (oneRole.overallDisplay !== 6.7) return 'bucketOne ' + oneRole.overallDisplay;
    return '';
  };

  // Public alias expected by callers.
  root.calculateRating = R.calculateRating;

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
