const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { publishReport } = require('../src/publish');

function tempFile(content) {
  const filePath = path.join(os.tmpdir(), `publish-test-${Date.now()}-${Math.random()}.html`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function tempDir() {
  const dirPath = path.join(os.tmpdir(), `publish-test-dir-${Date.now()}-${Math.random()}`);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

test('publishReport copies the report to index.html in the publish dir', () => {
  const reportPath = tempFile('<html>content</html>');
  const publishDir = tempDir();
  const calls = [];
  const fakeExec = (cmd) => {
    calls.push(cmd);
    if (cmd.includes('git status --porcelain')) return 'M index.html\n';
    return '';
  };

  publishReport(reportPath, publishDir, fakeExec);

  const copied = fs.readFileSync(path.join(publishDir, 'index.html'), 'utf8');
  assert.equal(copied, '<html>content</html>');
});

test('publishReport commits and pushes when there are changes', () => {
  const reportPath = tempFile('<html>v2</html>');
  const publishDir = tempDir();
  const calls = [];
  const fakeExec = (cmd) => {
    calls.push(cmd);
    if (cmd.includes('git status --porcelain')) return 'M index.html\n';
    return '';
  };

  const result = publishReport(reportPath, publishDir, fakeExec);

  assert.equal(result.published, true);
  assert.ok(calls.some((c) => c.startsWith('git add')));
  assert.ok(calls.some((c) => c.startsWith('git commit')));
  assert.ok(calls.some((c) => c.startsWith('git push')));
});

test('publishReport skips commit/push when nothing changed', () => {
  const reportPath = tempFile('<html>same</html>');
  const publishDir = tempDir();
  const calls = [];
  const fakeExec = (cmd) => {
    calls.push(cmd);
    if (cmd.includes('git status --porcelain')) return '';
    return '';
  };

  const result = publishReport(reportPath, publishDir, fakeExec);

  assert.equal(result.published, false);
  assert.ok(!calls.some((c) => c.startsWith('git commit')));
  assert.ok(!calls.some((c) => c.startsWith('git push')));
});
