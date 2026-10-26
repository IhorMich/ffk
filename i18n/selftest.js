#!/usr/bin/env node
/** Fail if Settings UI strings leak Cyrillic into Latin locales, or stay English. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of [
  'js/i18n-coach-pl.js',
  'js/i18n-coach-es.js',
  'js/i18n-coach-de.js',
  'js/i18n-coach-it.js',
  'js/i18n-coach-fr.js',
  'js/i18n-coach-pt.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
}
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8') + '\nthis.I18N=I18N;this.LANGS=LANGS;',
  ctx
);
const { I18N, LANGS } = ctx;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('id="view-settings"');
const end = html.indexOf('id="view-coach"', start);
const chunk = html.slice(start, end);
const keys = [
  ...new Set(
    [...chunk.matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)].map((m) => m[1])
  ),
  'proBodyOff',
  'accountHint',
  'proSubscribe',
  'proManage',
  'proCloudSyncNow',
  'settingsDeleteAccountConfirm',
  'settingsDeleteLocalConfirm',
  'settingsDeleteWipeConfirm',
  'settingsDeleteDone'
];
const cyr = /[А-Яа-яЁё]/;
// Same spelling is valid in several locales (loanwords / product names).
const brandOk =
  /TEMPO|Pro|Coach|Free|JSON|Email|E-mail|E-Mail|Google|Apple|Personal|^MC-|^or$|^ou$|^oder$|^o$|Password|Privacy|Account|Silhouettes|Notifications|^Mode$/i;
let failed = 0;

for (const lang of LANGS) {
  if (lang === 'ru' || lang === 'uk') continue;
  for (const k of keys) {
    const v = I18N[lang] && I18N[lang][k];
    if (v == null || v === '') {
      console.error('MISS', lang, k);
      failed += 1;
      continue;
    }
    if (cyr.test(String(v))) {
      console.error('CYR', lang, k, String(v).slice(0, 80));
      failed += 1;
    }
    if (lang !== 'en' && I18N.en[k] === v && !brandOk.test(String(v))) {
      console.error('EN_LEAK', lang, k, String(v).slice(0, 80));
      failed += 1;
    }
  }
}

if (failed) {
  console.error('i18n settings selftest failed:', failed);
  process.exit(1);
}
console.log('OK i18n settings selftest', keys.length, 'keys ×', LANGS.length, 'langs');
