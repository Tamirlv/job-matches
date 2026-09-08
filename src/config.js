const REQUIRED_KEYS = [
  'RAPIDAPI_JSEARCH_KEY',
  'ANTHROPIC_API_KEY',
  'GMAIL_ADDRESS',
  'GMAIL_APP_PASSWORD',
  'EMAIL_TO',
];

function loadConfig(env = process.env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return {
    rapidApiKey: env.RAPIDAPI_JSEARCH_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    gmailAddress: env.GMAIL_ADDRESS,
    gmailAppPassword: env.GMAIL_APP_PASSWORD,
    emailTo: env.EMAIL_TO,
  };
}

module.exports = { loadConfig };
