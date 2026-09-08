const test = require('node:test');
const assert = require('node:assert/strict');
const { isOutOfCreditsError } = require('../src/credit-guard');

test('isOutOfCreditsError recognizes Anthropic\'s low-balance error message', () => {
  const error = new Error('Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.');
  assert.equal(isOutOfCreditsError(error), true);
});

test('isOutOfCreditsError matches regardless of case', () => {
  const error = new Error('YOUR CREDIT BALANCE IS TOO LOW to access the API.');
  assert.equal(isOutOfCreditsError(error), true);
});

test('isOutOfCreditsError returns false for an unrelated error', () => {
  const error = new Error('Unexpected token in JSON');
  assert.equal(isOutOfCreditsError(error), false);
});

test('isOutOfCreditsError returns false for a network error', () => {
  const error = new Error('fetch failed');
  assert.equal(isOutOfCreditsError(error), false);
});
