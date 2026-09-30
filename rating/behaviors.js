/* Matchcard Rating — behavior scales */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.BEHAVIOR = [
    { key: 'effort', inRating: true },
    { key: 'team', inRating: true },
    { key: 'coach', inRating: true },
    { key: 'discipline', inRating: true },
    { key: 'mood', inRating: false }
  ];

  R.emptyBehaviors = function () {
    var behaviors = {};
    R.BEHAVIOR.forEach(function (b) { behaviors[b.key] = 3; });
    return behaviors;
  };

  R.behaviorAvg = function (behaviors) {
    var rated = R.BEHAVIOR.filter(function (b) { return b.inRating; })
      .map(function (b) { return Number(behaviors && behaviors[b.key]) || 3; });
    if (!rated.length) return 3;
    return rated.reduce(function (a, b) { return a + b; }, 0) / rated.length;
  };

  R.behaviorDelta = function (behaviors) {
    return (R.behaviorAvg(behaviors) - 3) * 0.5;
  };

  R.effortDelta = function (behaviors) {
    return (R.behaviorAvg(behaviors) - 3) * 2;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
