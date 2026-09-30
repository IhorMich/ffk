/* Matchcard Sync — public engine */
(function (root) {
  'use strict';
  var S = root.MatchcardSync = root.MatchcardSync || {};
  root.planPersonalSync = S.planPersonalSync;
  root.mergeMatchLists = S.mergeMatchLists;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
