#!/usr/bin/env node
/** Load rating/*.js in Node and run fixtures. */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
const files = [
  'positions.js',
  'metrics.js',
  'behaviors.js',
  'normalization.js',
  'explanations.js',
  'engine.js'
];
for (const f of files) require(path.join(root, 'rating', f));
const fail = global.MatchcardRating.ratingFixtureFail();
if (fail) {
  console.error('FAIL', fail);
  process.exit(1);
}
const sample = global.calculateRating({
  position: 'fwd',
  counts: { goals: 1, assists: 1 },
  behaviors: { effort: 4, team: 3, coach: 3, discipline: 3 },
  minutes: 60,
  matchLen: 60
});
if (typeof sample.overall !== 'number' || !sample.contributions) {
  console.error('FAIL bad calculateRating shape', sample);
  process.exit(1);
}
console.log('OK fixtures + calculateRating', sample.overallDisplay, sample.actionDisplay, sample.effortDisplay);
