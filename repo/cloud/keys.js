/* Matchcard CloudRepo — table + meta key names */
(function (root) {
  'use strict';
  var R = root.MatchcardCloudRepo = root.MatchcardCloudRepo || {};
  R.KEYS = {
    SYNC_AT: 'ffk_personal_backup_sync_at',
    DIRTY: 'ffk_personal_backup_dirty'
  };
  R.TABLES = {
    PERSONAL_BACKUPS: 'personal_backups'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
