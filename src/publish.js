const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function publishReport(reportPath, publishDir, execImpl = (cmd, opts) => execSync(cmd, opts).toString()) {
  fs.copyFileSync(reportPath, path.join(publishDir, 'index.html'));

  execImpl('git add index.html', { cwd: publishDir, stdio: 'pipe' });
  const status = execImpl('git status --porcelain', { cwd: publishDir, stdio: 'pipe' });
  if (!status.trim()) {
    return { published: false, reason: 'no changes' };
  }

  execImpl(`git commit -m "Update job matches - ${new Date().toISOString()}"`, { cwd: publishDir, stdio: 'pipe' });
  execImpl('git push origin main', { cwd: publishDir, stdio: 'pipe' });
  return { published: true };
}

module.exports = { publishReport };
