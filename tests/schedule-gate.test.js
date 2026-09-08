const test = require('node:test');
const assert = require('node:assert/strict');
const { isWithinActiveWindow } = require('../src/schedule-gate');

// Israel is UTC+3 during daylight saving time (roughly late March to late
// October). These UTC instants are chosen to fall in that period so the
// offset is unambiguous, and are written as explicit UTC ISO strings so the
// test's outcome does not depend on the machine's own local timezone - it
// must pass identically on the Israel-set PC and on a UTC cloud runner.

test('returns true at the start of the active window (08:00 Israel = 05:00 UTC)', () => {
  assert.equal(isWithinActiveWindow(new Date('2026-09-01T05:00:00.000Z')), true);
});

test('returns true at the end of the active window (23:00 Israel = 20:00 UTC)', () => {
  assert.equal(isWithinActiveWindow(new Date('2026-09-01T20:00:00.000Z')), true);
});

test('returns false in the early morning (02:00 Israel = 23:00 UTC previous day)', () => {
  assert.equal(isWithinActiveWindow(new Date('2026-08-31T23:00:00.000Z')), false);
});

test('returns false just before the window opens (07:59 Israel = 04:59 UTC)', () => {
  assert.equal(isWithinActiveWindow(new Date('2026-09-01T04:59:00.000Z')), false);
});

test('returns false just after midnight (00:30 Israel = 21:30 UTC previous day)', () => {
  assert.equal(isWithinActiveWindow(new Date('2026-08-31T21:30:00.000Z')), false);
});

test('uses Israel time even when the runner\'s own clock is UTC (e.g. a GitHub Actions runner)', () => {
  // 21:00 UTC = 00:00 Israel (next day) - outside the window. A naive
  // implementation using the machine's raw local hour (21, since Actions
  // runners are UTC) would wrongly return true here; only a genuinely
  // Israel-timezone-aware check gets this right regardless of the runner's
  // own timezone.
  assert.equal(isWithinActiveWindow(new Date('2026-09-01T21:00:00.000Z')), false);
});
