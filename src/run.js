require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const Anthropic = require('@anthropic-ai/sdk');
const { loadConfig } = require('./config');
const { isWithinActiveWindow } = require('./schedule-gate');
const { loadStore, saveStore, isProcessed, markProcessed, addMatch, isCreditsExhausted, setCreditsExhausted } = require('./store');
const { passesQuickFilter } = require('./quick-filter');
const { fetchDeveloperJobs } = require('./jsearch-client');
const { fetchLinkedInJobs } = require('./linkedin-client');
const { classifyJob } = require('./classifier');
const { isOutOfCreditsError } = require('./credit-guard');
const { writeReport } = require('./html-report');
const { sendMatchEmail, sendCreditsExhaustedEmail, createTransporter } = require('./mailer');
const { publishReport } = require('./publish');

const STORE_PATH = path.join(__dirname, '..', 'data', 'jobs-store.json');
const REPORT_PATH = path.join(__dirname, '..', 'output', 'matches.html');
const PUBLISH_DIR = path.join(__dirname, '..', 'publish');

const LINKEDIN_KEYWORDS = [
  'full stack developer',
  'fullstack developer',
  'backend developer',
  'back end developer',
  'frontend developer',
  'front end developer',
  'software developer',
  'developer',
  'software engineer',
];
const LINKEDIN_LOCATION = 'Israel';

async function run() {
  if (!isWithinActiveWindow()) {
    console.log('Outside active window (08:00-23:00 Israel time). Skipping run.');
    return;
  }

  const config = loadConfig();
  const store = loadStore(STORE_PATH);
  const anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey });

  // JSearch has no real Israel coverage (confirmed by direct testing) and is
  // disabled for now. It still works for remote-anywhere roles, so it may be
  // worth re-enabling alongside the LinkedIn/Drushim sources later.
  // let jsearchJobs;
  // try {
  //   jsearchJobs = await fetchDeveloperJobs(config.rapidApiKey);
  // } catch (error) {
  //   console.error('JSearch fetch failed, skipping this source:', error.message);
  //   jsearchJobs = [];
  // }
  const jsearchJobs = [];

  let linkedInJobs;
  try {
    linkedInJobs = await fetchLinkedInJobs({ keywords: LINKEDIN_KEYWORDS, location: LINKEDIN_LOCATION });
  } catch (error) {
    console.error('LinkedIn fetch failed, skipping this source:', error.message);
    linkedInJobs = [];
  }

  const rawJobs = [...jsearchJobs, ...linkedInJobs];

  const candidates = rawJobs
    .filter(passesQuickFilter)
    .filter((job) => !isProcessed(store, job.id));

  console.log(`Fetched ${rawJobs.length} jobs, ${candidates.length} new candidate(s) after filtering.`);

  const newMatches = [];
  let hitCreditsExhausted = false;
  for (const job of candidates) {
    let classification;
    try {
      classification = await classifyJob(job, anthropicClient);
    } catch (error) {
      if (isOutOfCreditsError(error)) {
        hitCreditsExhausted = true;
        console.error('Anthropic credit balance is too low - stopping classification for this run.');
        break;
      }
      console.error(`Skipping job ${job.id} due to a classification error (will retry next run):`, error.message);
      continue;
    }
    markProcessed(store, job.id);
    if (classification.tier === 'no_match') {
      continue;
    }
    const matchRecord = {
      ...job,
      tier: classification.tier,
      reason: classification.reason,
      foundAt: new Date().toISOString(),
    };
    addMatch(store, matchRecord);
    newMatches.push(matchRecord);
  }

  const transporter = createTransporter(config);

  if (hitCreditsExhausted) {
    if (!isCreditsExhausted(store)) {
      setCreditsExhausted(store, true);
      await sendCreditsExhaustedEmail(config, transporter);
      console.log('Sent one-time out-of-credits alert email.');
    } else {
      console.log('Still out of credits - already alerted, not sending a repeat email.');
    }
  } else if (isCreditsExhausted(store)) {
    setCreditsExhausted(store, false);
    console.log('Anthropic credits appear restored - resuming normal classification.');
  }

  saveStore(STORE_PATH, store);
  writeReport(store.matches, REPORT_PATH);

  if (fs.existsSync(PUBLISH_DIR)) {
    // Only relevant to the local Windows setup, which keeps a separate clone of
    // the Pages repo to push into. When running as a GitHub Actions workflow,
    // this checkout IS the Pages repo, and the workflow's own steps commit the
    // report directly - there is no local publish/ clone to find.
    try {
      const publishResult = publishReport(REPORT_PATH, PUBLISH_DIR);
      console.log(publishResult.published ? 'Published updated report to GitHub Pages.' : 'No report changes to publish.');
    } catch (error) {
      console.error('Publishing to GitHub Pages failed (report still updated locally):', error.message);
    }
  }

  if (hitCreditsExhausted) {
    // The credits-exhausted email above already explains why nothing new was found
    // this run - sending a second "no new roles" email here would just be confusing.
    console.log('Run complete. Skipped the match email since the credits alert already covers this run.');
  } else {
    const emailResult = await sendMatchEmail(newMatches, config, transporter);
    console.log(`Run complete. ${newMatches.length} new match(es). Email sent: ${emailResult.sent}.`);
  }
}

run().catch((error) => {
  console.error('Job matcher run failed:', error);
  process.exitCode = 1;
});

module.exports = { run };
