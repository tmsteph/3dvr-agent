const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const workerDaemon = path.join(__dirname, '..', 'thomas-agent', 'scripts', 'ask-agent-worker-daemon');
const queueWrapper = path.join(__dirname, '..', 'thomas-agent', 'scripts', 'ask-agent-queue');

test('managed agent worker routes each poll through the queue wrapper exactly once', async () => {
  const script = await readFile(workerDaemon, 'utf8');
  const loopStart = script.indexOf('worker_loop=');
  const loopEnd = script.indexOf('if command -v tmux', loopStart);
  assert.notEqual(loopStart, -1, 'worker loop definition should exist');
  assert.notEqual(loopEnd, -1, 'worker loop should end before tmux launch');
  const loop = script.slice(loopStart, loopEnd);
  assert.ok(loop.includes('ask-agent-queue\\" run-once'));
  assert.equal((loop.match(/ask-agent-queue/g) || []).length, 1);
});

test('queue wrapper reloads runtime config and dispatches Operator Forge edits on run-once', async () => {
  const script = await readFile(queueWrapper, 'utf8');
  assert.ok(script.includes('CONFIG_FILE="${THREEDVR_CONFIG_FILE:-$HOME/.3dvr/config/env}"'));
  assert.ok(script.includes('. "$CONFIG_FILE"'));
  assert.ok(script.includes('node "$ROOT/node/agent-task-queue.js" "$@"'));
  assert.ok(script.includes('if [ "${1:-}" = "run-once" ]; then'));
  assert.ok(script.includes('node "$ROOT/node/operator-forge-worker.js" run-once'));
});
