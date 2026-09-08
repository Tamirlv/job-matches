const { estimatePostedTimestamp } = require('./relative-time');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SEARCH_DELAY_MS = 800;
const DESC_DELAY_MS = 600;

const NAMED_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (m) => NAMED_ENTITIES[m])
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function stripHtml(html) {
  const withBreaks = String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');
  const decoded = decodeEntities(withBreaks);
  return decoded
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function parseSearchCards(html) {
  const chunks = String(html).split(/<li>/i).slice(1);
  const cards = [];
  const seenIds = new Set();
  for (const chunk of chunks) {
    const idMatch = chunk.match(/urn:li:jobPosting:(\d+)/) || chunk.match(/\/jobs\/view\/[^"]*?-(\d+)\?/);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seenIds.has(id)) continue;
    const titleMatch = chunk.match(/base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i);
    const subtitleMatch = chunk.match(/base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i);
    const locationMatch = chunk.match(/job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i);
    const dateMatch = chunk.match(/job-search-card__listdate(?:--new)?"[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : '';
    if (!title) continue;
    seenIds.add(id);
    cards.push({
      id,
      title,
      company: subtitleMatch ? stripHtml(subtitleMatch[1]) : '',
      location: locationMatch ? stripHtml(locationMatch[1]) : '',
      applyLink: `https://www.linkedin.com/jobs/view/${id}/`,
      postedAt: dateMatch ? dateMatch[1] : null,
      postedRelative: dateMatch ? stripHtml(dateMatch[2]) : null,
    });
  }
  return cards;
}

function parseDescription(html) {
  const match = String(html).match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i);
  return match ? stripHtml(match[1]) : '';
}

// Extracts location and relative posted-time from a job DETAILS page (as opposed
// to a search-results card) - used for backfilling entries stored before those
// fields were captured, since only the applyLink/id survives for old entries.
function parseJobDetailsMeta(html) {
  const locationMatch = String(html).match(/topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i);
  const postedMatch = String(html).match(/posted-time-ago__text[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  return {
    location: locationMatch ? stripHtml(locationMatch[1]) : null,
    postedRelative: postedMatch ? stripHtml(postedMatch[1]) : null,
  };
}

const DEFAULT_POSTED_WITHIN_SECONDS = 86400; // 24 hours - covers the longest gap between runs (overnight) with margin

async function fetchLinkedInJobs(opts) {
  const {
    keywords,
    location,
    postedWithinSeconds = DEFAULT_POSTED_WITHIN_SECONDS,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    userAgent = UA,
    now = new Date(),
  } = opts;

  const byId = new Map();
  for (const keyword of keywords) {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&f_TPR=r${postedWithinSeconds}&start=0`;
    let html = '';
    try {
      const response = await fetchImpl(url, { headers: { 'User-Agent': userAgent } });
      if (!response.ok) {
        await sleep(SEARCH_DELAY_MS);
        continue;
      }
      html = await response.text();
    } catch {
      await sleep(SEARCH_DELAY_MS);
      continue;
    }
    for (const card of parseSearchCards(html)) {
      if (!byId.has(card.id)) byId.set(card.id, card);
    }
    await sleep(SEARCH_DELAY_MS);
  }

  const jobs = [];
  for (const card of byId.values()) {
    let description = '';
    try {
      const response = await fetchImpl(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${card.id}`, {
        headers: { 'User-Agent': userAgent },
      });
      if (response.ok) description = parseDescription(await response.text());
    } catch {
      // leave description empty; classifier will just see less context for this job
    }
    jobs.push({
      id: card.id,
      title: card.title,
      company: card.company,
      location: card.location,
      country: 'IL',
      isRemote: false,
      description,
      applyLink: card.applyLink,
      postedAt: card.postedAt,
      postedRelative: card.postedRelative,
      postedTimestamp: estimatePostedTimestamp(card.postedRelative, now),
    });
    await sleep(DESC_DELAY_MS);
  }
  return jobs;
}

module.exports = { fetchLinkedInJobs, parseSearchCards, parseDescription, parseJobDetailsMeta, stripHtml, decodeEntities };
