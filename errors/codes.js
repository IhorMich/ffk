/* Matchcard Errors — stable codes (no DOM) */
(function (root) {
  'use strict';
  var E = root.MatchcardErrors = root.MatchcardErrors || {};

  E.CODES = {
    AUTH: 'auth',
    NETWORK: 'network',
    CONFLICT: 'conflict',
    QUOTA: 'quota',
    VALIDATION: 'validation',
    NO_CLOUD: 'no_cloud',
    NO_SESSION: 'no_session',
    NOT_PRO: 'not_pro',
    CANCELLED: 'cancelled',
    GENERIC: 'generic'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof globalThis !== 'undefined' ? globalThis : this);
