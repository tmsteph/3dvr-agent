const test = require('node:test');
const assert = require('node:assert/strict');
const { runForgeRequest } = require('../thomas-agent/node/operator-forge-worker');

function record() {
  return {
    id: 'operator-worker-test',
    task: 'Operator code request: Add a harmless comment.',
    repo: 'portal',
    requestedBy: 'portal-operator',
    authPub: 'pub-test',
    authProof: 'proof-test',
  };
}

function proof() {
  return {
    scope: 'operator-forge-task',
    action: 'queue-code-change',
    alias: 'tester@3dvr',
    pub: 'pub-test',
    iat: 1_000_000,
    taskId: 'operator-worker-test',
    repo: 'portal',
    task: 'Operator code request: Add a harmless comment.',
  };
}

function sink() {
  const writes = [];
  return {
    writes,
    get() {
      return {
        put(payload, callback) {
          writes.push(payload);
          callback?.({ ok: 1 });
        },
      };
    },
  };
}

function baseOptions(rootNode, snapshots) {
  return {
    rootNode,
    now: 1_001_000,
    env: {
      THREEDVR_OPERATOR_DEVELOPER_PUBS: 'pub-test',
      THREEDVR_OPERATOR_PORTAL_REPO: '/tmp/portal',
    },
    verifyImpl: async () => proof(),
    snapshotRepoImpl: async () => snapshots.shift(),
  };
}

test('successful executor with no repo change is marked failed', async () => {
  const rootNode = sink();
  const result = await runForgeRequest(record(), {
    ...baseOptions(rootNode, ['same', 'same']),
    runAgentTaskImpl: async () => ({ ok: true, result: { stdout: 'done' } }),
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /repository did not change/i);
  assert.equal(rootNode.writes.at(-1).status, 'failed');
  assert.match(rootNode.writes.at(-1).resultSummary, /repository did not change/i);
});

test('successful executor with a repo change is marked completed', async () => {
  const rootNode = sink();
  const result = await runForgeRequest(record(), {
    ...baseOptions(rootNode, ['before', 'after']),
    runAgentTaskImpl: async () => ({ ok: true, result: { stdout: 'changed file' } }),
  });

  assert.equal(result.ok, true);
  assert.equal(rootNode.writes.at(-1).status, 'completed');
  assert.equal(rootNode.writes.at(-1).error, '');
});
