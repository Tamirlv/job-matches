const SEARCH_URL = 'https://jsearch.p.rapidapi.com/search-v2';

function normalizeJob(raw) {
  return {
    id: raw.job_id,
    title: raw.job_title,
    company: raw.employer_name,
    country: raw.job_country,
    isRemote: raw.job_is_remote === true,
    description: raw.job_description,
    applyLink: raw.job_apply_link,
    postedAt: raw.job_posted_at_datetime_utc,
  };
}

async function fetchDeveloperJobs(apiKey, fetchImpl = fetch) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('query', 'software developer jobs in Israel or remote');
  url.searchParams.set('country', 'il');
  url.searchParams.set('page', '1');
  url.searchParams.set('num_pages', '1');

  const response = await fetchImpl(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      'x-rapidapi-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`JSearch API request failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  return (body.data || []).map(normalizeJob);
}

module.exports = { fetchDeveloperJobs, normalizeJob };
