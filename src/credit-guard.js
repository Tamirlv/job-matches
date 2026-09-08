function isOutOfCreditsError(error) {
  return typeof error?.message === 'string' && /credit balance is too low/i.test(error.message);
}

module.exports = { isOutOfCreditsError };
