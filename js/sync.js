/**
 * Wire MatchcardSync adapters for personal Pro backup.
 * Loaded after sync/*.js and before/along parent-cloud usage.
 */
(function (global) {
  'use strict';
  // parent-cloud owns the concrete Supabase calls; this file is a thin re-export hook if needed.
  global.MatchcardSync = global.MatchcardSync || null;
})(typeof window !== 'undefined' ? window : globalThis);
