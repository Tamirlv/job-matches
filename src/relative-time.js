const UNIT_MS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function parseRelativeToMs(text) {
  if (!text) return null;
  const match = String(text).trim().match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return amount * UNIT_MS[unit];
}

function estimatePostedTimestamp(postedRelative, scrapedAt) {
  const elapsedMs = parseRelativeToMs(postedRelative);
  if (elapsedMs == null) return null;
  return new Date(scrapedAt.getTime() - elapsedMs).toISOString();
}

function toIsraeliDate(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatElapsed(timestampIso, now) {
  const then = new Date(timestampIso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);

  if (diffMs < UNIT_MS.hour) {
    const minutes = Math.max(1, Math.floor(diffMs / UNIT_MS.minute));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diffMs < UNIT_MS.day) {
    const hours = Math.floor(diffMs / UNIT_MS.hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffMs < UNIT_MS.week) {
    const days = Math.floor(diffMs / UNIT_MS.day);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return toIsraeliDate(new Date(timestampIso));
}

module.exports = { parseRelativeToMs, estimatePostedTimestamp, formatElapsed };
