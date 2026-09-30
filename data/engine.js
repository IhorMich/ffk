/* Matchcard Data — engine surface */
(function (root) {
  'use strict';
  var D = root.MatchcardData = root.MatchcardData || {};
  root.validateBackupPayload = D.validateBackupPayload;
  root.migrateBackupPayload = D.migrateBackupPayload;
  root.repairRoster = D.repairRoster;
  root.repairMatchList = D.repairMatchList;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof globalThis !== 'undefined' ? globalThis : this);
