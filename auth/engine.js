/* Matchcard Auth — public engine surface */
(function (root) {
  'use strict';
  var A = root.MatchcardAuth = root.MatchcardAuth || {};

  root.getAuthSnapshot = function () {
    return A.snapshot();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
