const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchDeveloperJobs, normalizeJob } = require('../src/jsearch-client');

test('normalizeJob maps raw JSearch fields to the internal job shape', () => {
  const raw = {
    job_id: 'abc123',
    job_title: 'Backend Developer',
    employer_name: 'Acme',
    job_country: 'IL',
    job_is_remote: false,
    job_description: 'Node.js role',
    job_apply_link: 'https://example.com/job/abc123',
    job_posted_at_datetime_utc: '2026-09-08T10:00:00.000Z',
  };
  assert.deepEqual(normalizeJob(raw), {
    id: 'abc123',
    title: 'Backend Developer',
    company: 'Acme',
    country: 'IL',
    isRemote: false,
    description: 'Node.js role',
    applyLink: 'https://example.com/job/abc123',
    postedAt: '2026-09-08T10:00:00.000Z',
  });
});

test('fetchDeveloperJobs returns normalized jobs from a successful response', async () => {
  const fakeFetch = async (url, options) => {
    assert.equal(options.headers['x-rapidapi-key'], 'fake-key');
    assert.equal(options.headers['x-rapidapi-host'], 'jsearch.p.rapidapi.com');
    return {
      ok: true,
      json: async () => ({
        status: 'OK',
        data: [
          {
            job_id: 'abc123',
            job_title: 'Backend Developer',
            employer_name: 'Acme',
            job_country: 'IL',
            job_is_remote: false,
            job_description: 'Node.js role',
            job_apply_link: 'https://example.com/job/abc123',
            job_posted_at_datetime_utc: '2026-09-08T10:00:00.000Z',
          },
        ],
      }),
    };
  };
  const jobs = await fetchDeveloperJobs('fake-key', fakeFetch);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'abc123');
});

test('fetchDeveloperJobs throws a clear error when the response is not ok', async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' });
  await assert.rejects(
    () => fetchDeveloperJobs('fake-key', fakeFetch),
    /JSearch API request failed: 429 Too Many Requests/
  );
});
