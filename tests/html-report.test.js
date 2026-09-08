const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { renderHtml, writeReport, TIER_ORDER } = require('../src/html-report');

const NOW = new Date('2026-09-08T12:00:00.000Z');

const SAMPLE_MATCHES = [
  {
    id: '1', title: 'Backend Developer', company: 'Acme', tier: 'strong_match',
    reason: 'Great Node.js fit', applyLink: 'https://example.com/1', foundAt: '2026-09-08T09:00:00.000Z',
    postedAt: '2026-09-05', postedRelative: '3 days ago', postedTimestamp: '2026-09-05T12:00:00.000Z',
    location: 'Tel Aviv, Israel',
  },
  {
    id: '2', title: 'Python Engineer', company: 'Beta', tier: 'long_shot',
    reason: 'Different stack', applyLink: 'https://example.com/2', foundAt: '2026-09-08T10:00:00.000Z',
  },
];

test('renderHtml includes each match\'s title, company, location, reason, link, and a live-computed posted time', () => {
  const html = renderHtml(SAMPLE_MATCHES, NOW);
  assert.match(html, /Backend Developer/);
  assert.match(html, /Acme/);
  assert.match(html, /Tel Aviv, Israel/);
  assert.match(html, /Great Node\.js fit/);
  assert.match(html, /https:\/\/example\.com\/1/);
  assert.match(html, /Python Engineer/);
  assert.match(html, /Posted: 3 days ago/);
  assert.match(html, /data-posted-timestamp="2026-09-05T12:00:00\.000Z"/);
});

test('renderHtml omits the location when a job has none (e.g. no location captured)', () => {
  const html = renderHtml([{ ...SAMPLE_MATCHES[1], postedAt: null, postedRelative: null, postedTimestamp: null }], NOW);
  assert.doesNotMatch(html, /class="job-location"/);
});

test('renderHtml falls back to the posted date in Israeli day/month/year order when there is no computed timestamp', () => {
  const html = renderHtml([{ ...SAMPLE_MATCHES[0], postedRelative: null, postedTimestamp: null }], NOW);
  assert.match(html, /Posted: 05\/09\/2026/);
  assert.doesNotMatch(html, /Posted: 2026-09-05/);
});

test('renderHtml omits a posted mention when no posted data is available at all', () => {
  // Checks for a rendered job-meta element specifically, not the substring "Posted:"
  // anywhere in the document - the embedded script's live-refresh code always
  // contains that literal string regardless of any individual job's data.
  const html = renderHtml([{ ...SAMPLE_MATCHES[1], postedAt: null, postedRelative: null, postedTimestamp: null }], NOW);
  assert.doesNotMatch(html, /class="job-meta"/);
});

test('renderHtml sorts by actual posted time (most recent first), not by when we found it', () => {
  // Deliberately reversed: the OLDER post (by postedTimestamp) was found LATER
  // (higher foundAt), and the NEWER post was found EARLIER. If sorting still used
  // foundAt, "Recently Posted" would appear after "Old Post" - it must not.
  const oldPost = {
    id: 'a', title: 'Old Post', company: 'X', tier: 'strong_match', reason: 'r',
    applyLink: 'https://example.com/a', foundAt: '2026-09-08T20:00:00.000Z',
    postedTimestamp: '2026-09-01T00:00:00.000Z',
  };
  const newPost = {
    id: 'b', title: 'Recently Posted', company: 'Y', tier: 'strong_match', reason: 'r',
    applyLink: 'https://example.com/b', foundAt: '2026-09-08T08:00:00.000Z',
    postedTimestamp: '2026-09-08T06:00:00.000Z',
  };
  const html = renderHtml([oldPost, newPost], NOW);
  assert.ok(html.indexOf('Recently Posted') < html.indexOf('Old Post'));
});

test('renderHtml groups matches under their tier heading', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  const strongIndex = html.indexOf('Strong Match');
  const backendIndex = html.indexOf('Backend Developer');
  const longShotIndex = html.indexOf('Long Shot');
  const pythonIndex = html.indexOf('Python Engineer');
  assert.ok(strongIndex < backendIndex);
  assert.ok(longShotIndex < pythonIndex);
});

test('renderHtml gives each job card a data-job-id attribute for client-side scripting', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  assert.match(html, /data-job-id="1"/);
  assert.match(html, /data-job-id="2"/);
});

test('renderHtml includes a "sent CV" checkbox and a remove button per job', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  const checkboxCount = (html.match(/class="sent-cv-checkbox"/g) || []).length;
  const deleteCount = (html.match(/class="delete-btn"/g) || []).length;
  assert.equal(checkboxCount, SAMPLE_MATCHES.length);
  assert.equal(deleteCount, SAMPLE_MATCHES.length);
});

test('renderHtml includes one sticky pagination bar per tier section, positioned above the cards', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  const paginationCount = (html.match(/class="pagination"/g) || []).length;
  assert.equal(paginationCount, TIER_ORDER.length);
  assert.match(html, /class="prev-page"/);
  assert.match(html, /class="next-page"/);
  assert.match(html, /class="page-indicator"/);
  assert.ok(html.indexOf('class="pagination"') < html.indexOf('class="job-card"'));
});

test('renderHtml embeds a script that persists dismissed and sent-CV state in localStorage', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  assert.match(html, /<script>/);
  assert.match(html, /jobMatcherDismissed/);
  assert.match(html, /jobMatcherSentCv/);
  assert.match(html, /localStorage/);
});

test('renderHtml embeds a script that scrolls to top and resets every tab to page 1 on tab switch', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  assert.match(html, /window\.scrollTo/);
  assert.match(html, /s\.setAttribute\('data-page', '1'\)/);
});

test('renderHtml renders a tab bar with one button per tier, showing counts', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  assert.match(html, /class="tab-btn[^"]*" data-tab="strong_match"/);
  assert.match(html, /class="tab-btn[^"]*" data-tab="worth_a_look"/);
  assert.match(html, /class="tab-btn[^"]*" data-tab="long_shot"/);
  assert.match(html, /Strong Match[\s\S]*?\(1\)/);
  assert.match(html, /Long Shot[\s\S]*?\(1\)/);
});

test('renderHtml only marks the first tier with matches as the active tab/section by default', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  assert.match(html, /class="tab-btn active" data-tab="strong_match"/);
  assert.match(html, /class="tier-section active" data-tier="strong_match"/);
  assert.doesNotMatch(html, /class="tab-btn active" data-tab="long_shot"/);
  assert.doesNotMatch(html, /class="tier-section active" data-tier="long_shot"/);
});

test('renderHtml renders real CSS styling, not bare unstyled markup', () => {
  const html = renderHtml(SAMPLE_MATCHES);
  assert.match(html, /<style>/);
  assert.match(html, /\.job-card/);
});

test('writeReport writes the rendered HTML to disk', () => {
  const filePath = path.join(os.tmpdir(), `job-matcher-report-test-${Date.now()}.html`);
  writeReport(SAMPLE_MATCHES, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(content, /Backend Developer/);
  fs.unlinkSync(filePath);
});
