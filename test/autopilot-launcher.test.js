const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const launcher = path.join(__dirname, '..', 'thomas-agent', 'scripts', 'ask-autopilot');

function runLauncher(windowExit, args = ['--dry-run']) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '3dvr-autopilot-launcher-'));
  const log = path.join(temp, 'node.log');
  const fakeNode = path.join(temp, 'node');
  fs.writeFileSync(fakeNode, [
    '#!/usr/bin/env bash',
    'printf \'%s\\n\' "$*" >> "$NODE_LOG"',
    'if [ "$1" = "-e" ]; then exit "$WINDOW_EXIT"; fi',
    'exit 0',
    '',
  ].join('\n'));
  fs.chmodSync(fakeNode, 0o755);

  const result = spawnSync('bash', [launcher, ...args], {
    env: { ...process.env, PATH: `${temp}:${process.env.PATH}`, NODE_LOG: log, WINDOW_EXIT: String(windowExit) },
    encoding: 'utf8',
  });
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  fs.rmSync(temp, { recursive: true, force: true });
  return { result, calls };
}

test('launcher adds --no-email when outreach window is closed', () => {
  const { result, calls } = runLauncher(1);
  assert.equal(result.status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /autopilot\.js --dry-run --no-email$/);
});

test('launcher keeps normal email behavior during outreach hours', () => {
  const { result, calls } = runLauncher(0);
  assert.equal(result.status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /autopilot\.js --dry-run$/);
  assert.doesNotMatch(calls[1], /--no-email/);
});

test('explicit --no-email skips the time-window probe', () => {
  const { result, calls } = runLauncher(1, ['--dry-run', '--no-email']);
  assert.equal(result.status, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /autopilot\.js --dry-run --no-email$/);
});
