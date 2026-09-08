const test = require('node:test');
const assert = require('node:assert/strict');
const { sendMatchEmail, buildEmailBody, sendCreditsExhaustedEmail } = require('../src/mailer');

const NOW = new Date('2026-09-08T12:00:00.000Z');

const SAMPLE_MATCH = {
  tier: 'strong_match', title: 'Backend Developer', company: 'Acme',
  reason: 'Great fit', applyLink: 'https://example.com/1',
  postedAt: '2026-09-05', postedRelative: '3 days ago', postedTimestamp: '2026-09-05T12:00:00.000Z',
  foundAt: '2026-09-08T10:00:00.000Z', location: 'Tel Aviv, Israel',
};

test('buildEmailBody includes title, company, location, reason, link, and a live-computed posted time', () => {
  const body = buildEmailBody([SAMPLE_MATCH], NOW);
  assert.match(body, /Backend Developer/);
  assert.match(body, /Acme/);
  assert.match(body, /Tel Aviv, Israel/);
  assert.match(body, /Great fit/);
  assert.match(body, /https:\/\/example\.com\/1/);
  assert.match(body, /Posted: 3 days ago/);
});

test('buildEmailBody falls back to the posted date in Israeli day/month/year order when there is no computed timestamp', () => {
  const { postedRelative, postedTimestamp, ...withoutTimestamp } = SAMPLE_MATCH;
  const body = buildEmailBody([withoutTimestamp], NOW);
  assert.match(body, /Posted: 05\/09\/2026/);
  assert.doesNotMatch(body, /Posted: 2026-09-05/);
});

test('buildEmailBody omits the posted line when no posted data is available at all', () => {
  const { postedAt, postedRelative, postedTimestamp, ...withoutDate } = SAMPLE_MATCH;
  const body = buildEmailBody([withoutDate], NOW);
  assert.doesNotMatch(body, /Posted:/);
});

test('buildEmailBody groups matches by tier, Strong Match first, then Worth a Look, then Long Shot', () => {
  const longShot = { ...SAMPLE_MATCH, tier: 'long_shot', title: 'Long Shot Role', foundAt: '2026-09-08T12:00:00.000Z' };
  const worthLook = { ...SAMPLE_MATCH, tier: 'worth_a_look', title: 'Worth A Look Role', foundAt: '2026-09-08T11:00:00.000Z' };
  const strong = { ...SAMPLE_MATCH, tier: 'strong_match', title: 'Strong Role', foundAt: '2026-09-08T09:00:00.000Z' };
  // Deliberately passed out of tier order to prove the function re-groups them.
  const body = buildEmailBody([longShot, worthLook, strong]);
  const strongIndex = body.indexOf('Strong Role');
  const worthIndex = body.indexOf('Worth A Look Role');
  const longShotIndex = body.indexOf('Long Shot Role');
  assert.ok(strongIndex < worthIndex);
  assert.ok(worthIndex < longShotIndex);
});

test('sendMatchEmail sends a "no new roles" email when there are no new matches, so silence never means something broke', async () => {
  let sentArgs = null;
  const fakeTransporter = { sendMail: async (args) => { sentArgs = args; } };
  const config = { gmailAddress: 'me@gmail.com', emailTo: 'me@gmail.com' };
  const result = await sendMatchEmail([], config, fakeTransporter);
  assert.equal(result.sent, true);
  assert.equal(sentArgs.to, 'me@gmail.com');
  assert.match(sentArgs.subject, /no new/i);
  assert.match(sentArgs.text, /no new/i);
});

test('sendMatchEmail calls the transporter with the right recipient and body when there are new matches', async () => {
  let sentArgs = null;
  const fakeTransporter = { sendMail: async (args) => { sentArgs = args; } };
  const config = { gmailAddress: 'me@gmail.com', emailTo: 'me@gmail.com' };
  const result = await sendMatchEmail([SAMPLE_MATCH], config, fakeTransporter);
  assert.equal(result.sent, true);
  assert.equal(sentArgs.to, 'me@gmail.com');
  assert.equal(sentArgs.from, 'me@gmail.com');
  assert.match(sentArgs.text, /Backend Developer/);
});

test('sendCreditsExhaustedEmail sends a clear alert explaining nothing is lost', async () => {
  let sentArgs = null;
  const fakeTransporter = { sendMail: async (args) => { sentArgs = args; } };
  const config = { gmailAddress: 'me@gmail.com', emailTo: 'me@gmail.com' };
  await sendCreditsExhaustedEmail(config, fakeTransporter);
  assert.equal(sentArgs.to, 'me@gmail.com');
  assert.equal(sentArgs.from, 'me@gmail.com');
  assert.match(sentArgs.subject, /out of|credits/i);
  assert.match(sentArgs.text, /credit balance/i);
  assert.match(sentArgs.text, /nothing.*lost|next.*run/i);
});
