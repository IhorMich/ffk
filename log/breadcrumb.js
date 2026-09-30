/* Matchcard Log — breadcrumb trail + sinks (no PII) */
(function (root) {
  'use strict';
  var L = root.MatchcardLog = root.MatchcardLog || {};
  var MAX = 80;
  var trail = [];
  var sinks = [];
  var seq = 0;

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function scrubData(data) {
    if (!data || typeof data !== 'object') return {};
    var out = {};
    Object.keys(data).slice(0, 12).forEach(function (k) {
      var v = data[k];
      if (v == null) return;
      if (typeof v === 'string') {
        out[k] = (root.MatchcardErrors && MatchcardErrors.scrub)
          ? MatchcardErrors.scrub(v)
          : String(v).slice(0, 120);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else {
        out[k] = typeof v;
      }
    });
    return out;
  }

  L.addSink = function (fn) {
    if (typeof fn === 'function') sinks.push(fn);
    return function () {
      sinks = sinks.filter(function (x) { return x !== fn; });
    };
  };

  L.breadcrumb = function (event, data) {
    var row = {
      id: ++seq,
      at: nowIso(),
      level: 'info',
      event: String(event || 'event').slice(0, 64),
      data: scrubData(data || {})
    };
    trail.push(row);
    if (trail.length > MAX) trail = trail.slice(-MAX);
    sinks.forEach(function (fn) {
      try { fn(row); } catch (e) {}
    });
    return row;
  };

  L.error = function (event, data) {
    var row = L.breadcrumb(event, data);
    row.level = 'error';
    try {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ffk]', row.event, row.data);
      }
    } catch (e) {}
    return row;
  };

  L.warn = function (event, data) {
    var row = L.breadcrumb(event, data);
    row.level = 'warn';
    try {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[ffk]', row.event, row.data);
      }
    } catch (e) {}
    return row;
  };

  L.getTrail = function () {
    return trail.slice();
  };

  L.clear = function () {
    trail = [];
    seq = 0;
  };

  // Default sink: keep console quiet for info breadcrumbs.
  L.addSink(function (row) {
    if (row.level === 'info') return;
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
