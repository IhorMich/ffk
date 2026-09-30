/* Matchcard Rating — positions (no DOM / storage / settings) */
(function (root) {
  'use strict';
  var R = root.MatchcardRating = root.MatchcardRating || {};

  R.ROLE_CODES = ['gk', 'def', 'mid', 'fwd'];
  R.POS_CODES = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'];
  R.POS_GROUP = {
    GK: 'gk', CB: 'def', LB: 'def', RB: 'def', LWB: 'def', RWB: 'def',
    CDM: 'mid', CM: 'mid', CAM: 'mid', LM: 'mid', RM: 'mid',
    LW: 'fwd', RW: 'fwd', ST: 'fwd', CF: 'fwd'
  };
  R.GROUP_TO_POS = { gk: 'GK', def: 'CB', mid: 'CM', fwd: 'RW' };

  R.isRoleCode = function (code) { return R.ROLE_CODES.indexOf(code) !== -1; };
  R.isPosCode = function (code) { return R.POS_CODES.indexOf(code) !== -1; };
  R.isPitchCode = function (code) { return R.isRoleCode(code) || R.isPosCode(code); };

  R.guessPos = function (label) {
    var s = String(label || '');
    var code = s.toUpperCase();
    if (R.POS_GROUP[code]) return R.POS_GROUP[code];
    if (/вратар|воротар|bramk|goalkeep|\bgk\b/i.test(s)) return 'gk';
    if (/защит|захис|obroń|obron|\bdef\b/i.test(s)) return 'def';
    if (/полузащ|півзахис|pomoc|\bmid\b/i.test(s)) return 'mid';
    return 'fwd';
  };

  R.ratingPosOf = function (code) {
    if (R.POS_GROUP[code]) return R.POS_GROUP[code];
    if (R.isRoleCode(code)) return code;
    return R.guessPos(code);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
