const fs = require('node:fs');
const path = require('node:path');

function loadStore(filePath) {
  if (!fs.existsSync(filePath)) {
    return { processedIds: [], matches: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveStore(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

function isProcessed(store, jobId) {
  return store.processedIds.includes(jobId);
}

function markProcessed(store, jobId) {
  if (!isProcessed(store, jobId)) {
    store.processedIds.push(jobId);
  }
}

function addMatch(store, matchRecord) {
  store.matches.push(matchRecord);
}

function isCreditsExhausted(store) {
  return store.creditsExhausted === true;
}

function setCreditsExhausted(store, value) {
  store.creditsExhausted = value;
}

module.exports = { loadStore, saveStore, isProcessed, markProcessed, addMatch, isCreditsExhausted, setCreditsExhausted };
