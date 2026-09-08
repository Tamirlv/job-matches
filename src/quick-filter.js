const DEV_ROLE_PATTERN = /developer|engineer|programmer|full[\s-]?stack/i;

function isDevRole(job) {
  return DEV_ROLE_PATTERN.test(job.title);
}

function isIsraelOrRemote(job) {
  return job.country === 'IL' || job.isRemote === true;
}

function passesQuickFilter(job) {
  return isDevRole(job) && isIsraelOrRemote(job);
}

module.exports = { passesQuickFilter, isDevRole, isIsraelOrRemote };
