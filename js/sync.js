/**
 * MatchcardSync + CloudRepo hook.
 * Concrete Supabase wiring lives in ParentCloud via MatchcardCloudRepo.configure.
 */
(function (global) {
  'use strict';
  global.MatchcardSync = global.MatchcardSync || null;
  global.MatchcardCloudRepo = global.MatchcardCloudRepo || null;
})(typeof window !== 'undefined' ? window : globalThis);
