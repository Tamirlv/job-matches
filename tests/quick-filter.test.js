const test = require('node:test');
const assert = require('node:assert/strict');
const { passesQuickFilter } = require('../src/quick-filter');

test('passes a developer role based in Israel', () => {
  const job = { title: 'Backend Developer', country: 'IL', isRemote: false };
  assert.equal(passesQuickFilter(job), true);
});

test('passes a developer role that is fully remote, regardless of country', () => {
  const job = { title: 'Full Stack Engineer', country: 'US', isRemote: true };
  assert.equal(passesQuickFilter(job), true);
});

test('rejects a developer role that is onsite outside Israel', () => {
  const job = { title: 'Software Engineer', country: 'DE', isRemote: false };
  assert.equal(passesQuickFilter(job), false);
});

test('rejects a non-developer role even if based in Israel', () => {
  const job = { title: 'Marketing Manager', country: 'IL', isRemote: false };
  assert.equal(passesQuickFilter(job), false);
});

test('accepts common developer title variants', () => {
  assert.equal(passesQuickFilter({ title: 'Full-Stack Programmer', country: 'IL', isRemote: false }), true);
  assert.equal(passesQuickFilter({ title: 'Senior Software Engineer', country: 'IL', isRemote: false }), true);
});
