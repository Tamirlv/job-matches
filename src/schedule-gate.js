function isWithinActiveWindow(date = new Date()) {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date);
  const hour = Number(hourStr);
  return hour >= 8 && hour <= 23;
}

module.exports = { isWithinActiveWindow };
