const nodemailer = require('nodemailer');
const { TIER_LABELS, TIER_ORDER, formatPosted, postedSortKey } = require('./html-report');

function formatMatch(m, now) {
  const postedText = formatPosted(m, now);
  const posted = postedText ? `${postedText}\n` : '';
  const location = m.location ? `${m.location}\n` : '';
  return `${TIER_LABELS[m.tier]} — ${m.title} @ ${m.company}\n${location}${posted}${m.reason}\n${m.applyLink}\n`;
}

function buildEmailBody(newMatches, now = new Date()) {
  return TIER_ORDER
    .map((tier) =>
      newMatches
        .filter((m) => m.tier === tier)
        .sort((a, b) => postedSortKey(b) - postedSortKey(a))
        .map((m) => formatMatch(m, now))
        .join('\n')
    )
    .filter((section) => section.length > 0)
    .join('\n');
}

async function sendMatchEmail(newMatches, config, transporter) {
  const subject =
    newMatches.length === 0
      ? 'No new job matches this hour'
      : `${newMatches.length} new job match${newMatches.length === 1 ? '' : 'es'}`;
  const text =
    newMatches.length === 0
      ? 'No new roles matched in this run. Everything is working normally - just nothing new to report this time.'
      : buildEmailBody(newMatches);

  await transporter.sendMail({
    from: config.gmailAddress,
    to: config.emailTo,
    subject,
    text,
  });
  return { sent: true };
}

async function sendCreditsExhaustedEmail(config, transporter) {
  await transporter.sendMail({
    from: config.gmailAddress,
    to: config.emailTo,
    subject: 'Job Matcher: out of Anthropic credits',
    text:
      'Job classification stopped because your Anthropic API credit balance is too low.\n\n' +
      'No new roles will be found or sent until you add more credits at console.anthropic.com.\n\n' +
      'Nothing has been lost - the unclassified roles are not marked as seen, so the next scheduled ' +
      'run after you top up will pick up right where this one left off.',
  });
}

function createTransporter(config) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.gmailAddress, pass: config.gmailAppPassword },
  });
}

module.exports = { sendMatchEmail, buildEmailBody, sendCreditsExhaustedEmail, createTransporter };
