const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyJob, parseClassification } = require('../src/classifier');

test('parseClassification accepts a valid tier and reason', () => {
  const result = parseClassification('{"tier": "strong_match", "reason": "Matches Node.js and Angular stack"}');
  assert.equal(result.tier, 'strong_match');
  assert.equal(result.reason, 'Matches Node.js and Angular stack');
});

test('parseClassification throws on an invalid tier value', () => {
  assert.throws(() => parseClassification('{"tier": "amazing", "reason": "x"}'));
});

test('parseClassification throws on malformed JSON', () => {
  assert.throws(() => parseClassification('not json'));
});

test('parseClassification strips markdown code fences before parsing', () => {
  const fenced = '```json\n{"tier": "long_shot", "reason": "Different stack"}\n```';
  const result = parseClassification(fenced);
  assert.equal(result.tier, 'long_shot');
  assert.equal(result.reason, 'Different stack');
});

test('parseClassification strips a bare code fence with no language tag', () => {
  const fenced = '```\n{"tier": "strong_match", "reason": "Great fit"}\n```';
  const result = parseClassification(fenced);
  assert.equal(result.tier, 'strong_match');
});

test('classifyJob sends the job to the Anthropic client and returns the parsed result', async () => {
  let receivedPrompt = '';
  const fakeClient = {
    messages: {
      create: async (params) => {
        receivedPrompt = params.messages[0].content;
        return { content: [{ type: 'text', text: '{"tier": "worth_a_look", "reason": "Partial stack overlap"}' }] };
      },
    },
  };
  const job = { title: 'Backend Developer', description: 'Python and Django role' };
  const result = await classifyJob(job, fakeClient);
  assert.equal(result.tier, 'worth_a_look');
  assert.equal(result.reason, 'Partial stack overlap');
  assert.match(receivedPrompt, /Python and Django role/);
  assert.match(receivedPrompt, /Angular/);
});
