const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRelativeToMs, estimatePostedTimestamp, formatElapsed } = require('../src/relative-time');

test('parseRelativeToMs parses minutes, hours, days, weeks, months, years (singular and plural)', () => {
  assert.equal(parseRelativeToMs('4 minutes ago'), 4 * 60 * 1000);
  assert.equal(parseRelativeToMs('1 minute ago'), 1 * 60 * 1000);
  assert.equal(parseRelativeToMs('20 hours ago'), 20 * 60 * 60 * 1000);
  assert.equal(parseRelativeToMs('3 days ago'), 3 * 24 * 60 * 60 * 1000);
  assert.equal(parseRelativeToMs('1 week ago'), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseRelativeToMs('1 month ago'), 30 * 24 * 60 * 60 * 1000);
  assert.equal(parseRelativeToMs('2 years ago'), 2 * 365 * 24 * 60 * 60 * 1000);
});

test('parseRelativeToMs returns null for unparseable or missing text', () => {
  assert.equal(parseRelativeToMs(null), null);
  assert.equal(parseRelativeToMs(''), null);
  assert.equal(parseRelativeToMs('sometime recently'), null);
});

test('estimatePostedTimestamp anchors the elapsed time to the scrape time', () => {
  const scrapedAt = new Date('2026-09-08T15:00:00.000Z');
  const result = estimatePostedTimestamp('20 hours ago', scrapedAt);
  assert.equal(result, '2026-09-07T19:00:00.000Z');
});

test('estimatePostedTimestamp returns null when the relative text cannot be parsed', () => {
  const scrapedAt = new Date('2026-09-08T15:00:00.000Z');
  assert.equal(estimatePostedTimestamp(null, scrapedAt), null);
});

test('formatElapsed shows minutes for anything under an hour', () => {
  const now = new Date('2026-09-08T15:00:00.000Z');
  const then = new Date('2026-09-08T14:55:00.000Z').toISOString();
  assert.equal(formatElapsed(then, now), '5 minutes ago');
});

test('formatElapsed uses singular wording for exactly 1 unit', () => {
  const now = new Date('2026-09-08T15:00:00.000Z');
  assert.equal(formatElapsed(new Date('2026-09-08T14:59:00.000Z').toISOString(), now), '1 minute ago');
  assert.equal(formatElapsed(new Date('2026-09-08T14:00:00.000Z').toISOString(), now), '1 hour ago');
  assert.equal(formatElapsed(new Date('2026-09-07T15:00:00.000Z').toISOString(), now), '1 day ago');
});

test('formatElapsed shows hours for anything under a day', () => {
  const now = new Date('2026-09-08T15:00:00.000Z');
  const then = new Date('2026-09-08T09:00:00.000Z').toISOString();
  assert.equal(formatElapsed(then, now), '6 hours ago');
});

test('formatElapsed shows days for anything under a week', () => {
  const now = new Date('2026-09-08T15:00:00.000Z');
  const then = new Date('2026-09-05T15:00:00.000Z').toISOString();
  assert.equal(formatElapsed(then, now), '3 days ago');
});

test('formatElapsed falls back to a DD/MM/YYYY date once a week or more has passed', () => {
  const now = new Date('2026-09-08T15:00:00.000Z');
  const then = new Date('2026-08-01T15:00:00.000Z').toISOString();
  assert.equal(formatElapsed(then, now), '01/08/2026');
});

test('formatElapsed treats a negative gap (clock skew) as "just now" rather than erroring', () => {
  const now = new Date('2026-09-08T15:00:00.000Z');
  const then = new Date('2026-09-08T15:05:00.000Z').toISOString();
  assert.equal(formatElapsed(then, now), '1 minute ago');
});
