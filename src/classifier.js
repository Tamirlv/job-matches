const PRIMARY_SKILLS = [
  'Angular', 'TypeScript', 'Node.js', 'Express', 'MongoDB', 'RxJS',
  'Angular Material', 'Angular CDK', 'Anthropic API', 'OpenAI API',
  'Google Gemini/Vertex AI', 'Redis', 'Bull', 'Socket.IO', 'FFmpeg', 'AWS',
];

const EXPOSURE_SKILLS = [
  'React', 'React Native', 'Java', 'C', 'Azure', 'JWT', 'bcrypt',
  'Cloudinary', 'Bright Data', 'Lottie', 'ASS subtitle rendering',
  'Slack API', 'Brevo', 'Mixpanel', 'LogRocket', 'WebRTC', 'Stripe',
  'n8n', 'Kafka', 'Elasticsearch', 'ElevenLabs', 'AssemblyAI', 'Soniox',
];

const MODEL = 'claude-haiku-4-5-20251001';
const VALID_TIERS = ['strong_match', 'worth_a_look', 'long_shot', 'no_match'];

function buildPrompt(job) {
  return `You are screening a job posting for a candidate with this skill profile.

Primary skills (daily-driver stack, weigh these highest): ${PRIMARY_SKILLS.join(', ')}

Exposure skills (real experience, but not the core daily stack, weigh lower): ${EXPOSURE_SKILLS.join(', ')}

Rules:
- Classify based ONLY on skill/technology overlap with the job description below. Ignore company size, seniority wording, and compensation entirely.
- Roles requiring a stack outside both lists above (e.g. Python, C++, a Java-primary backend) are NOT automatically excluded - they can still be "worth_a_look" or "long_shot" if the role type transfers, but should never outrank an equivalent role that matches the primary stack.
- If the role is not a software development role at all, or is a totally implausible fit, use tier "no_match".

Job title: ${job.title}
Job description: ${job.description}

Respond with ONLY a JSON object, no other text, in exactly this shape:
{"tier": "strong_match" | "worth_a_look" | "long_shot" | "no_match", "reason": "one sentence explaining why"}`;
}

function stripCodeFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function parseClassification(responseText) {
  const parsed = JSON.parse(stripCodeFence(responseText));
  if (!VALID_TIERS.includes(parsed.tier) || typeof parsed.reason !== 'string') {
    throw new Error(`Unexpected classification shape: ${responseText}`);
  }
  return parsed;
}

async function classifyJob(job, anthropicClient) {
  const message = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{ role: 'user', content: buildPrompt(job) }],
  });
  return parseClassification(message.content[0].text);
}

module.exports = { classifyJob, buildPrompt, parseClassification, PRIMARY_SKILLS, EXPOSURE_SKILLS, MODEL };
