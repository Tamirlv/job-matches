const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

test('loadConfig returns a config object when all required vars are present', () => {
  const env = {
    RAPIDAPI_JSEARCH_KEY: 'rk',
    ANTHROPIC_API_KEY: 'ak',
    GMAIL_ADDRESS: 'me@gmail.com',
    GMAIL_APP_PASSWORD: 'pw',
    EMAIL_TO: 'me@gmail.com',
  };
  const config = loadConfig(env);
  assert.equal(config.rapidApiKey, 'rk');
  assert.equal(config.anthropicApiKey, 'ak');
  assert.equal(config.gmailAddress, 'me@gmail.com');
  assert.equal(config.gmailAppPassword, 'pw');
  assert.equal(config.emailTo, 'me@gmail.com');
});

test('loadConfig throws a clear error when required vars are missing', () => {
  const env = { RAPIDAPI_JSEARCH_KEY: 'rk' };
  assert.throws(
    () => loadConfig(env),
    /Missing required environment variables: ANTHROPIC_API_KEY, GMAIL_ADDRESS, GMAIL_APP_PASSWORD, EMAIL_TO/
  );
});
