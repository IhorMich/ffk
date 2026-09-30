/* Matchcard Errors — reportError → classify + log + optional toast */
(function (root) {
  'use strict';
  var E = root.MatchcardErrors = root.MatchcardErrors || {};

  /**
   * @param {*} err
   * @param {{scope?:string, toast?:boolean|string, silent?:boolean, data?:object}} options
   */
  E.reportError = function (err, options) {
    var opts = options || {};
    var classified = E.classifyError(err, opts.scope || 'app');
    if (root.MatchcardLog && typeof MatchcardLog.error === 'function') {
      MatchcardLog.error(classified.scope + '.' + classified.code, {
        message: classified.message,
        retryable: classified.retryable,
        data: opts.data || {}
      });
    } else {
      try {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[ffk]', classified.scope, classified.code, classified.message);
        }
      } catch (e) {}
    }

    if (!opts.silent && opts.toast !== false) {
      var text = typeof opts.toast === 'string' ? opts.toast : '';
      if (!text && typeof t === 'function') {
        var map = {
          auth: 'accountErrAuth',
          network: 'proCloudErr',
          no_cloud: 'accountCloudMissing',
          no_session: 'proCloudNeedAccount',
          not_pro: 'proNeed',
          conflict: 'proCloudErr',
          quota: 'toastSaveFail',
          validation: 'toastSaveFail',
          generic: 'proCloudErr'
        };
        var key = map[classified.code];
        if (key) {
          try {
            var translated = t(key);
            if (translated && translated !== key) text = translated;
          } catch (e) {}
        }
      }
      if (!text) text = classified.message || classified.code;
      try {
        if (typeof showToast === 'function') showToast(text);
      } catch (e) {}
    }

    return classified;
  };

  root.reportError = E.reportError;
  root.classifyError = E.classifyError;

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof globalThis !== 'undefined' ? globalThis : this);
