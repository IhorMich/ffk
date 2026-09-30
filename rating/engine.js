/* Matchcard Rating — engine: calculateRating(match) → JSON */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.BASE_RATING = 6.0;

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
    var overall = R.overallScore(n.counts, n.behaviors, n.position, n.minutes, n.matchLen);
    var action = R.actionScore(n.counts, n.position, n.minutes, n.matchLen);
    var effort = R.effortScore(n.behaviors);
    var split = R.actionSplit(n.counts, n.position, n.minutes, n.matchLen);
    var factor = R.outingFactor(n.minutes, n.matchLen);
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
      shortOuting: R.isShortOuting(n.minutes, n.matchLen),
      blank: R.matchIsBlank({ counts: n.counts, behaviors: n.behaviors }),
      split: split,
      contributions: R.explainContributions(n.counts, n.position, n.minutes, n.matchLen),
      behaviors: R.explainBehaviors(n.behaviors),
      counts: n.counts,
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
    { name: 'shortGoal', pos: 'fwd', counts: { goals: 1 }, behaviors: {}, minutes: 15, matchLen: 60, overall: 6.6, action: 6.6, effort: 6 }
  ];

  R.ratingFixtureFail = function () {
    for (var i = 0; i < R.RATING_FIXTURES.length; i++) {
      var f = R.RATING_FIXTURES[i];
      var got = R.calculateRating({
        counts: f.counts,
        behaviors: f.behaviors,
        position: f.pos,
        minutes: f.minutes,
        matchLen: f.matchLen
      });
      if (got.overallDisplay !== f.overall || got.actionDisplay !== f.action || got.effortDisplay !== f.effort) {
        return f.name + ' got ' + got.overallDisplay + '/' + got.actionDisplay + '/' + got.effortDisplay;
      }
    }
    var n0 = Math.round(R.nextStackedWeight(0, 0.2) * 100) / 100;
    var n1 = Math.round(R.nextStackedWeight(1, 0.2) * 100) / 100;
    if (n0 !== 0.2 || n1 !== 0.18) return 'nextDecay ' + n0 + '/' + n1;
    return '';
  };

  // Public alias expected by callers.
  root.calculateRating = R.calculateRating;

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
