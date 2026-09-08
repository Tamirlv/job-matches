const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stripHtml,
  decodeEntities,
  parseSearchCards,
  parseDescription,
  parseJobDetailsMeta,
  fetchLinkedInJobs,
} = require('../src/linkedin-client');

test('decodeEntities converts common HTML entities', () => {
  assert.equal(decodeEntities('Node &amp; Angular &#39;dev&#39;'), "Node & Angular 'dev'");
});

test('stripHtml removes tags and converts breaks/paragraphs to newlines', () => {
  const html = '<p>Line one</p><p>Line two<br>still line two</p>';
  assert.equal(stripHtml(html), 'Line one\nLine two\nstill line two');
});

test('parseSearchCards extracts job id, title, company, location, and posted date from a search results page', () => {
  const html = `
    <ul>
      <li>
        <div class="base-card" data-entity-urn="urn:li:jobPosting:1234567890">
          <h3 class="base-search-card__title">  Backend Developer  </h3>
          <h4 class="base-search-card__subtitle">Acme Corp</h4>
          <span class="job-search-card__location">Tel Aviv, Israel</span>
          <time class="job-search-card__listdate" datetime="2026-07-27">1 month ago</time>
        </div>
      </li>
    </ul>`;
  const cards = parseSearchCards(html);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, '1234567890');
  assert.equal(cards[0].title, 'Backend Developer');
  assert.equal(cards[0].company, 'Acme Corp');
  assert.equal(cards[0].location, 'Tel Aviv, Israel');
  assert.equal(cards[0].applyLink, 'https://www.linkedin.com/jobs/view/1234567890/');
  assert.equal(cards[0].postedAt, '2026-07-27');
  assert.equal(cards[0].postedRelative, '1 month ago');
});

test('parseSearchCards extracts the posted date and relative text from the "--new" listdate class variant used for very recent postings', () => {
  const html = `<li><div class="base-card" data-entity-urn="urn:li:jobPosting:5555">
    <h3 class="base-search-card__title">Backend Developer</h3>
    <time class="job-search-card__listdate--new" datetime="2026-09-07">
      20 hours ago
    </time></div></li>`;
  const cards = parseSearchCards(html);
  assert.equal(cards[0].postedAt, '2026-09-07');
  assert.equal(cards[0].postedRelative, '20 hours ago');
});

test('parseSearchCards leaves postedAt and postedRelative null when no date element is present', () => {
  const html = `<li><div class="base-card" data-entity-urn="urn:li:jobPosting:999">
    <h3 class="base-search-card__title">Backend Developer</h3></div></li>`;
  const cards = parseSearchCards(html);
  assert.equal(cards[0].postedAt, null);
  assert.equal(cards[0].postedRelative, null);
});

test('parseSearchCards skips cards with no discoverable job id', () => {
  const html = '<ul><li><div class="base-card"><h3 class="base-search-card__title">No Id Here</h3></div></li></ul>';
  assert.equal(parseSearchCards(html).length, 0);
});

test('parseJobDetailsMeta extracts location and posted-relative text from a job details page', () => {
  const html = `
    <span class="topcard__flavor topcard__flavor--bullet">
      Tel Aviv-Yafo, Tel Aviv District, Israel
    </span>
    <span class="posted-time-ago__text topcard__flavor--metadata">
      6 days ago
    </span>`;
  const meta = parseJobDetailsMeta(html);
  assert.equal(meta.location, 'Tel Aviv-Yafo, Tel Aviv District, Israel');
  assert.equal(meta.postedRelative, '6 days ago');
});

test('parseJobDetailsMeta returns nulls when the markup is missing', () => {
  const meta = parseJobDetailsMeta('<div>nothing useful here</div>');
  assert.equal(meta.location, null);
  assert.equal(meta.postedRelative, null);
});

test('parseDescription extracts and cleans the job description block', () => {
  const html = '<div class="show-more-less-html__markup"><p>Build APIs with Node.js.</p></div>';
  assert.equal(parseDescription(html), 'Build APIs with Node.js.');
});

test('fetchLinkedInJobs merges results across keywords, dedupes by id, and fetches descriptions', async () => {
  const searchHtmlA = `<li><div class="base-card" data-entity-urn="urn:li:jobPosting:111">
    <h3 class="base-search-card__title">Full Stack Developer</h3>
    <h4 class="base-search-card__subtitle">Acme</h4>
    <span class="job-search-card__location">Tel Aviv, Israel</span>
    <time class="job-search-card__listdate" datetime="2026-09-01">1 week ago</time></div></li>`;
  const searchHtmlB = `<li><div class="base-card" data-entity-urn="urn:li:jobPosting:111">
    <h3 class="base-search-card__title">Full Stack Developer</h3>
    <h4 class="base-search-card__subtitle">Acme</h4>
    <span class="job-search-card__location">Tel Aviv, Israel</span>
    <time class="job-search-card__listdate" datetime="2026-09-01">1 week ago</time></div></li>
  <li><div class="base-card" data-entity-urn="urn:li:jobPosting:222">
    <h3 class="base-search-card__title">Backend Developer</h3>
    <h4 class="base-search-card__subtitle">Beta</h4>
    <span class="job-search-card__location">Haifa, Israel</span>
    <time class="job-search-card__listdate" datetime="2026-09-05">3 days ago</time></div></li>`;

  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/jobPosting/')) {
      return { ok: true, text: async () => '<div class="show-more-less-html__markup"><p>Great role.</p></div>' };
    }
    if (String(url).includes('keywords=full')) {
      return { ok: true, text: async () => searchHtmlA };
    }
    return { ok: true, text: async () => searchHtmlB };
  };

  const now = new Date('2026-09-08T15:00:00.000Z');
  const jobs = await fetchLinkedInJobs({
    keywords: ['full stack developer', 'backend developer'],
    location: 'Israel',
    fetchImpl: fakeFetch,
    sleep: async () => {},
    now,
  });

  assert.equal(jobs.length, 2);
  const ids = jobs.map((j) => j.id).sort();
  assert.deepEqual(ids, ['111', '222']);
  for (const job of jobs) {
    assert.equal(job.description, 'Great role.');
    assert.equal(job.country, 'IL');
    assert.equal(job.isRemote, false);
  }
  assert.equal(jobs.find((j) => j.id === '111').location, 'Tel Aviv, Israel');
  assert.equal(jobs.find((j) => j.id === '222').location, 'Haifa, Israel');
  assert.equal(jobs.find((j) => j.id === '111').postedAt, '2026-09-01');
  assert.equal(jobs.find((j) => j.id === '222').postedAt, '2026-09-05');
  assert.equal(jobs.find((j) => j.id === '111').postedRelative, '1 week ago');
  assert.equal(jobs.find((j) => j.id === '222').postedRelative, '3 days ago');
  // "1 week ago" anchored to `now` -> exactly 7 days earlier.
  assert.equal(jobs.find((j) => j.id === '111').postedTimestamp, '2026-09-01T15:00:00.000Z');
  // "3 days ago" anchored to `now` -> exactly 3 days earlier.
  assert.equal(jobs.find((j) => j.id === '222').postedTimestamp, '2026-09-05T15:00:00.000Z');
});

test('fetchLinkedInJobs restricts the search to recently-posted jobs via f_TPR, defaulting to 24 hours', async () => {
  const searchUrls = [];
  const fakeFetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/jobPosting/')) {
      return { ok: true, text: async () => '<div class="show-more-less-html__markup"><p>Role.</p></div>' };
    }
    searchUrls.push(urlStr);
    return { ok: true, text: async () => '' };
  };

  await fetchLinkedInJobs({ keywords: ['developer'], location: 'Israel', fetchImpl: fakeFetch, sleep: async () => {} });
  assert.match(searchUrls[0], /f_TPR=r86400/);

  await fetchLinkedInJobs({
    keywords: ['developer'],
    location: 'Israel',
    postedWithinSeconds: 3600,
    fetchImpl: fakeFetch,
    sleep: async () => {},
  });
  assert.match(searchUrls[1], /f_TPR=r3600/);
});
