/**
 * Compatibility shim: loads MatchcardRating into legacy globals.
 * Source of truth lives in /rating/*.js (pure JSON engine, no DOM/storage/settings).
 * Prefer: calculateRating(match) → JSON
 */
(function () {
  'use strict';
  var R = typeof MatchcardRating !== 'undefined' ? MatchcardRating : null;
  if (!R || typeof R.calculateRating !== 'function') {
    console.error('MatchcardRating engine missing — load rating/*.js before js/rating.js');
    return;
  }

  var keys = [
    'ROLE_CODES', 'POS_CODES', 'POS_GROUP', 'GROUP_TO_POS',
    'BASE_RATING', 'METRICS', 'BEHAVIOR', 'METRIC_GROUPS', 'GRADE_TYPICAL',
    'isRoleCode', 'isPosCode', 'isPitchCode', 'guessPos', 'ratingPosOf',
    'emptyForm', 'metricsFor', 'weightOf', 'clamp10', 'clampScore',
    'behaviorAvg', 'stackedDecay', 'nextStackedWeight', 'stackedWeight',
    'playedMinutes', 'isShortOuting', 'outingFactor', 'withOuting',
    'actionSum', 'actionScore', 'effortScore', 'overallScore', 'actionSplit',
    'eventSign', 'metricGrade', 'countOf', 'behaviorOf', 'matchIsBlank',
    'RATING_FIXTURES', 'ratingFixtureFail', 'calculateRating',
    'normalizeMatchInput', 'explainContributions'
  ];

  keys.forEach(function (k) {
    if (typeof R[k] !== 'undefined') {
      (typeof globalThis !== 'undefined' ? globalThis : window)[k] = R[k];
    }
  });

  // Display helper used by history / cards (UI concern, kept for callers).
  if (typeof ratingClass !== 'function') {
    (typeof globalThis !== 'undefined' ? globalThis : window).ratingClass = function (r) {
      if (r < 5.5) return 'low';
      if (r < 7.5) return 'mid';
      return '';
    };
  }
})();
