const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadStore, saveStore, isProcessed, markProcessed, addMatch, isCreditsExhausted, setCreditsExhausted } = require('../src/store');

function tempFilePath() {
  return path.join(os.tmpdir(), `job-matcher-store-test-${Date.now()}-${Math.random()}.json`);
}

test('loadStore returns an empty store when the file does not exist', () => {
  const store = loadStore(tempFilePath());
  assert.deepEqual(store, { processedIds: [], matches: [] });
});

test('markProcessed adds a job id only once', () => {
  const store = { processedIds: [], matches: [] };
  markProcessed(store, 'job-1');
  markProcessed(store, 'job-1');
  assert.deepEqual(store.processedIds, ['job-1']);
});

test('isProcessed reflects markProcessed calls', () => {
  const store = { processedIds: [], matches: [] };
  assert.equal(isProcessed(store, 'job-1'), false);
  markProcessed(store, 'job-1');
  assert.equal(isProcessed(store, 'job-1'), true);
});

test('addMatch appends a match record', () => {
  const store = { processedIds: [], matches: [] };
  addMatch(store, { id: 'job-1', title: 'Backend Developer' });
  assert.equal(store.matches.length, 1);
  assert.equal(store.matches[0].title, 'Backend Developer');
});

test('isCreditsExhausted defaults to false on a fresh store', () => {
  const store = { processedIds: [], matches: [] };
  assert.equal(isCreditsExhausted(store), false);
});

test('setCreditsExhausted toggles the flag that isCreditsExhausted reads', () => {
  const store = { processedIds: [], matches: [] };
  setCreditsExhausted(store, true);
  assert.equal(isCreditsExhausted(store), true);
  setCreditsExhausted(store, false);
  assert.equal(isCreditsExhausted(store), false);
});

test('saveStore then loadStore round-trips the data', () => {
  const filePath = tempFilePath();
  const store = { processedIds: ['job-1'], matches: [{ id: 'job-1', title: 'X' }] };
  saveStore(filePath, store);
  const loaded = loadStore(filePath);
  assert.deepEqual(loaded, store);
  fs.unlinkSync(filePath);
});
