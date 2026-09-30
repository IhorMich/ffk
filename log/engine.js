/* Matchcard Log — engine + global hooks */
(function (root) {
  'use strict';
  var L = root.MatchcardLog = root.MatchcardLog || {};

  L.installGlobalHandlers = function () {
    if (L._installed) return;
    L._installed = true;
    try {
      if (typeof root.addEventListener === 'function') {
        root.addEventListener('error', function (ev) {
          try {
            L.error('window.error', {
              message: (ev && ev.message) || 'error',
              source: (ev && ev.filename) ? String(ev.filename).split('/').pop() : ''
            });
          } catch (e) {}
        });
        root.addEventListener('unhandledrejection', function (ev) {
          try {
            var reason = ev && ev.reason;
            var msg = (reason && reason.message) || String(reason || 'rejection');
            L.error('unhandledrejection', { message: msg });
          } catch (e) {}
        });
      }
    } catch (e) {}
  };

  root.FFK_LOG_TRAIL = function () {
    return L.getTrail ? L.getTrail() : [];
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
