/* Matchcard Errors — classify raw failures into JSON (no PII) */
(function (root) {
  'use strict';
  var E = root.MatchcardErrors = root.MatchcardErrors || {};
  var C = E.CODES || {};

  function scrub(text) {
    return String(text || '')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[jwt]')
      .replace(/sb_secret_[^\s]+/gi, '[secret]')
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [token]')
      .slice(0, 240);
  }

  function rawMessage(err) {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    if (typeof err.message === 'string') return err.message;
    if (typeof err.reason === 'string') return err.reason;
    if (typeof err.code === 'string') return err.code;
    try { return String(err); } catch (e) { return 'error'; }
  }

  E.scrub = scrub;

  /**
   * @returns {{code, message, cause, scope, retryable}}
   */
  E.classifyError = function (err, scope) {
    var msg = rawMessage(err);
    var lower = msg.toLowerCase();
    var code = C.GENERIC || 'generic';
    var retryable = false;

    if (/not_pro|not pro/.test(lower)) code = C.NOT_PRO || 'not_pro';
    else if (/bad_password|bad_email|confirm_email|invalid.?login|invalid.?credentials|wrong.?password|credentials/.test(lower)) {
      code = C.AUTH || 'auth';
    }
    else if (/^auth$|auth error|unauthorized|403/.test(lower)) code = C.AUTH || 'auth';
    else if (/no_cloud|not configured/.test(lower)) code = C.NO_CLOUD || 'no_cloud';
    else if (/failed to fetch|network|offline|timeout|econn|load failed/.test(lower)) {
      code = C.NETWORK || 'network';
      retryable = true;
    }
    else if (/no_session|need_account|jwt expired|not authenticated|sign.?in required/.test(lower)) {
      code = C.NO_SESSION || 'no_session';
    }
    else if (/conflict|local_dirty_and_remote|version.?conflict/.test(lower)) code = C.CONFLICT || 'conflict';
    else if (/quota|storage|exceeded|payload.?too.?large|22P02/.test(lower)) code = C.QUOTA || 'quota';
    else if (/bad|validat|migrate|no_data|no_export|no_import/.test(lower)) code = C.VALIDATION || 'validation';
    else if (/abort|cancel/.test(lower)) code = C.CANCELLED || 'cancelled';
    else if (/\bauth\b/.test(lower)) code = C.AUTH || 'auth';

    // Known short reason codes from our own engines
    var known = {
      no_cloud: C.NO_CLOUD,
      no_session: C.NO_SESSION,
      not_pro: C.NOT_PRO,
      bad: C.VALIDATION,
      no_export: C.VALIDATION,
      bad_remote_payload: C.VALIDATION,
      auth: C.AUTH
    };
    if (known[msg]) code = known[msg];

    return {
      code: code,
      message: scrub(msg) || code,
      cause: scrub(msg),
      scope: String(scope || 'app'),
      retryable: !!retryable
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof globalThis !== 'undefined' ? globalThis : this);
