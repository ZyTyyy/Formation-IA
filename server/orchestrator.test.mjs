import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, renameSync, rmdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';
import { createOrchestrator } from './orchestrator.mjs';
import { createApp } from './app.mjs';
import { createBridge } from './bridge.mjs';
import { CHECKS, validateEnvelope } from './orchestration-contracts.mjs';

const brief = 'Un gestionnaire de dépenses personnel en euros, conservé sur cet appareil.';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const expectCode = (fn, code) => assert.throws(fn, (error) => error.code === code);

function harness(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'factory-orchestrator-'));
  const starts = [];
  const engines = [];
  let stopped = false;
  let cancelCount = 0;
  const adapter = {
    mode: 'example',
    confirmStopped: () => stopped,
    start(input) {
      starts.push(input);
      if (!options.noSession) input.onSession(`session-${input.executionId}`);
      return { cancel() { cancelCount++; if (options.closeOnCancel) input.onClose(1); } };
    },
  };
  const create = (extra = {}) => {
    const engine = createOrchestrator({ directory, adapter, checkRunner: ({ commandId }) => ({ status: 'passed', log: `Contrôle factice ${commandId}, aucune commande exécutée.` }), ...options, ...extra });
    engines.push(engine);
    return engine;
  };
  const engine = create();
  t.after(() => {
    for (const entry of engines) entry.close();
    assert.ok(basename(directory).startsWith('factory-orchestrator-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { engine, starts, directory, create, adapter, get cancelCount() { return cancelCount; }, confirmStop: () => { stopped = true; } };
}

function resultFor(input, { omit = [], check = true } = {}) {
  const { mission, tools } = input;
  const paths = mission.expectedArtifacts.filter((path) => !omit.includes(path)).map((path) => path.endsWith('/') ? `${path}example.ts` : path);
  for (const path of paths) tools.writeArtifact(path, `Exemple fictif pour ${mission.role}, fichier ${path}.`);
  const artifacts = tools.captureArtifacts(paths);
  const checks = check && mission.role === 'qa_engineer' ? CHECKS.map((criterionId) => {
    const outcome = tools.runCheck(criterionId, [criterionId]);
    return { criterionId, status: outcome.status, evidenceId: outcome.evidenceId, note: 'Contrôleur injecté de test, sans processus ni modèle.' };
  }) : [];
  return { contractVersion: 1, mode: mission.mode, missionId: mission.missionId, attempt: mission.attempt, role: mission.role, inputRevision: mission.inputRevision, status: 'ready', summary: 'Livrable factice pour vérifier le moteur, aucune application générée.', artifacts, checks, findings: [], blockers: [], nextAction: 'Le serveur vérifie la dépendance suivante.' };
}

async function finish(h, options = {}, exitCode = 0) {
  const input = h.starts.at(-1);
  const result = resultFor(input, options);
  input.onResult(result);
  input.onClose(exitCode);
  await tick();
  return result;
}

async function reachQA(h, run) {
  h.engine.start(run.id);
  for (let index = 0; index < 4; index++) await finish(h);
  assert.equal(h.starts.at(-1).mission.role, 'qa_engineer');
}

test('default engine persists drafts but cannot launch a model or a test adapter implicitly', (t) => {
  const h = harness(t, { adapter: null });
  const run = h.engine.create({ brief });
  assert.equal(run.mode, 'example');
  assert.equal(run.deliveryVerified, false);
  assert.equal(h.engine.health().available, false);
  assert.equal(h.engine.health().liveGeneration, false);
  expectCode(() => h.engine.start(run.id), 'ORCHESTRATOR_UNAVAILABLE');
  expectCode(() => h.engine.create({ brief, command: 'shell' }), 'INVALID_BRIEF');
  expectCode(() => h.engine.create({ brief: 'court' }), 'INVALID_BRIEF');
});

test('six roles run in order with pinned instructions, accepted dependencies and test-only evidence', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  for (let index = 0; index < 6; index++) await finish(h);
  const final = h.engine.find(run.id);
  assert.equal(final.state, 'completed');
  assert.equal(final.deliveryVerified, false);
  assert.equal(final.budget.usedAttempts, 6);
  assert.equal(h.engine.health().reservation, null);
  assert.ok(final.missions.every((mission) => mission.state === 'accepted'));
  for (const [index, input] of h.starts.entries()) {
    assert.equal(input.mission.dependencies.length, index);
    assert.ok(input.instructions.global.includes('AI Software Factory'));
    assert.ok(input.instructions.contract.includes('Contrats des six'));
    assert.ok(input.instructions.role.includes('coordinateur'));
    assert.equal(input.instructions.hash.length, 64);
  }
  assert.equal(final.evidence.length, 4);
  assert.ok(final.evidence.every((item) => item.provenance === 'test-adapter'));
  assert.equal(h.starts[5].mission.mustDifferFromExecutionIds.length, 2);
  const snapshot = h.engine.find(run.id);
  snapshot.state = 'failed';
  assert.equal(h.engine.find(run.id).state, 'completed');
});

test('pause waits for a recorded checkpoint, prevents new roles and resumes explicitly', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  assert.equal(h.engine.pause(run.id).state, 'pause_requested');
  assert.equal(h.cancelCount, 0);
  await finish(h);
  assert.equal(h.engine.find(run.id).state, 'paused');
  assert.equal(h.starts.length, 1);
  expectCode(() => h.engine.start(run.id), 'INVALID_TRANSITION');
  h.engine.resume(run.id);
  assert.equal(h.starts.length, 2);
  assert.equal(h.starts[1].mission.role, 'ux_designer');
});

test('a global reservation rejects another run and survives unconfirmed cancellation', async (t) => {
  const h = harness(t);
  const first = h.engine.create({ brief });
  const second = h.engine.create({ brief });
  h.engine.start(first.id);
  expectCode(() => h.engine.start(second.id), 'ORCHESTRATOR_BUSY');
  assert.equal(h.engine.cancel(first.id).state, 'cancel_requested');
  assert.equal(h.cancelCount, 1);
  expectCode(() => h.engine.start(second.id), 'ORCHESTRATOR_BUSY');
  h.starts[0].onClose(1);
  await tick();
  assert.equal(h.engine.find(first.id).state, 'cancelled');
  h.engine.start(second.id);
  assert.equal(h.starts.length, 2);
});

test('invalid JSON and missing artifacts block dependencies without invented results', async (t) => {
  const h = harness(t, { closeOnCancel: true });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  h.starts[0].onResult('{invalid');
  await tick();
  let final = h.engine.find(run.id);
  assert.equal(final.state, 'blocked');
  assert.equal(final.missions[0].attempts[0].result, null);
  assert.equal(h.starts.length, 1);
  h.engine.retry(run.id);
  const second = h.starts.at(-1);
  const missing = resultFor(second, { omit: ['docs/PRODUCT.md'] });
  missing.artifacts = [{ path: 'docs/PRODUCT.md', revision: 'uncaptured-file' }];
  second.onResult(missing); second.onClose(0); await tick();
  final = h.engine.find(run.id);
  assert.equal(final.missions[0].attempts[1].errorCode, 'MISSING_ARTIFACT');
  assert.equal(h.starts.length, 2);
  expectCode(() => h.engine.retry(run.id), 'ATTEMPTS_EXHAUSTED');
});

test('result identity mismatch and nonzero exit cannot produce acceptance', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  const result = resultFor(h.starts[0]);
  h.starts[0].onResult({ ...result, inputRevision: 'different-revision' });
  h.starts[0].onClose(0);
  assert.equal(h.engine.find(run.id).missions[0].attempts[0].errorCode, 'RESULT_MISMATCH');
  h.engine.retry(run.id);
  await finish(h, {}, 1);
  assert.equal(h.engine.find(run.id).missions[0].attempts[1].errorCode, 'ADAPTER_FAILED');
});

test('workspace operations reject traversal, foreign reads and arbitrary commands', (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  const { tools } = h.starts[0];
  for (const path of ['../AGENTS.md', 'docs/../PRODUCT.md', '/tmp/file', 'docs/PRODUCT.md\n', 'docs/REVIEW.md']) expectCode(() => tools.writeArtifact(path, 'content'), 'WRITE_FORBIDDEN');
  expectCode(() => tools.readArtifact('docs/PRODUCT.md'), 'READ_FORBIDDEN');
  expectCode(() => tools.runCheck('shell', ['shell']), 'COMMAND_FORBIDDEN');
  expectCode(() => tools.readEvidence('foreign'), 'EVIDENCE_FORBIDDEN');
});

test('QA requires all four controls and rejects forged proof references', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  await reachQA(h, run);
  await finish(h, { check: false });
  assert.equal(h.engine.find(run.id).missions[4].attempts[0].errorCode, 'VERIFICATION_REQUIRED');
  h.engine.retry(run.id);
  const input = h.starts.at(-1);
  const result = resultFor(input);
  result.checks[0].evidenceId = 'invented-proof';
  input.onResult(result); input.onClose(0);
  assert.equal(h.engine.find(run.id).missions[4].attempts[1].errorCode, 'INVALID_EVIDENCE');
});

test('changing a test after checks invalidates their source fingerprint', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  await reachQA(h, run);
  const input = h.starts.at(-1);
  const result = resultFor(input);
  input.tools.writeArtifact('tests/new.test.ts', 'Test modifié après les contrôles factices.');
  input.onResult(result); input.onClose(0);
  assert.equal(h.engine.find(run.id).missions[4].attempts[0].errorCode, 'INVALID_EVIDENCE');
});

test('a valid QA failure can reach reviewer but never marks the project completed', async (t) => {
  const h = harness(t, { checkRunner: ({ commandId }) => ({ status: commandId === 'test' ? 'failed' : 'passed', log: 'Exemple de défaut injecté.' }) });
  const run = h.engine.create({ brief });
  await reachQA(h, run);
  const input = h.starts.at(-1);
  const result = resultFor(input);
  result.status = 'needs_changes';
  result.findings = [{ id: 'F1', priority: 'P1', path: 'src/example.ts', line: 1, description: 'Défaut injecté.', reproduction: 'Le contrôleur factice renvoie failed.' }];
  input.onResult(result); input.onClose(0); await tick();
  assert.equal(h.starts.at(-1).mission.role, 'code_reviewer');
  await finish(h);
  assert.equal(h.engine.find(run.id).state, 'needs_changes');
  assert.equal(h.engine.find(run.id).deliveryVerified, false);
});

test('required capabilities missing remain blocked instead of succeeding', async (t) => {
  const h = harness(t, { checkRunner: null });
  const run = h.engine.create({ brief });
  await reachQA(h, run);
  await finish(h);
  assert.equal(h.engine.find(run.id).missions[4].attempts[0].errorCode, 'VERIFICATION_REQUIRED');
  assert.equal(h.starts.length, 5);
});

test('sessions are required and a reused author session cannot become the reviewer', async (t) => {
  const h = harness(t, { noSession: true });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  expectCode(() => h.starts[0].tools.writeArtifact('docs/PRODUCT.md', 'content'), 'SESSION_REQUIRED');
  h.starts[0].onSession('author-session');
  await finish(h);
  h.starts[1].onSession('author-session');
  h.starts[1].onClose(0);
  assert.equal(h.engine.find(run.id).missions[1].attempts[0].errorCode, 'INDEPENDENCE_VIOLATION');
});

test('timeout keeps the reservation until a real close and counts time for the global budget', async (t) => {
  const h = harness(t, { limits: { timeoutMs: 10 } });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(h.cancelCount, 1);
  assert.equal(h.engine.find(run.id).state, 'blocked');
  assert.equal(h.engine.health().blocked, true);
  assert.ok(h.engine.find(run.id).budget.elapsedMs >= 10);
  expectCode(() => h.engine.retry(run.id), 'ORCHESTRATOR_BUSY');
  h.starts[0].onClose(0);
  assert.equal(h.engine.health().reservation, null);
  assert.equal(h.engine.find(run.id).missions[0].attempts[0].state, 'failed');
});

test('global attempt budget cannot be reset by retrying a different role', async (t) => {
  const h = harness(t, { limits: { maxTotalAttempts: 1 } });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await finish(h);
  assert.equal(h.engine.find(run.id).state, 'blocked');
  assert.equal(h.starts.length, 1);
  expectCode(() => h.engine.retry(run.id), 'BUDGET_EXHAUSTED');
});

test('output limit requests cancellation and preserves the failed attempt', async (t) => {
  const h = harness(t, { limits: { maxOutputBytes: 64 }, closeOnCancel: true });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  expectCode(() => h.starts[0].tools.writeArtifact('docs/PRODUCT.md', 'x'.repeat(65)), 'OUTPUT_LIMIT');
  assert.equal(h.engine.find(run.id).missions[0].attempts[0].errorCode, 'OUTPUT_LIMIT');
  assert.equal(h.cancelCount, 1);
});

test('restart keeps drafts and artifacts and never automatically replays unknown work', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await finish(h);
  const before = h.engine.find(run.id);
  assert.equal(h.starts.length, 2);
  h.engine.close();
  const recovered = h.create();
  assert.equal(recovered.find(run.id).state, 'interrupted');
  assert.equal(recovered.find(run.id).missions[1].attempts[0].state, 'unknown');
  assert.deepEqual(recovered.find(run.id).files, before.files);
  assert.equal(h.starts.length, 2);
  expectCode(() => recovered.retry(run.id), 'ORCHESTRATOR_BUSY');
  expectCode(() => recovered.reconcile(run.id), 'SHUTDOWN_UNCONFIRMED');
  h.confirmStop();
  recovered.reconcile(run.id);
  recovered.retry(run.id);
  assert.equal(h.starts.length, 3);
  const attempts = recovered.find(run.id).missions[1].attempts;
  assert.equal(attempts[0].state, 'unknown');
  assert.equal(attempts[1].number, 2);
  h.starts[1].onClose(0); // Stale callback from the old instance must have no effect.
  assert.equal(recovered.find(run.id).missions[1].attempts[1].state, 'running');
});

test('journal is exclusively owned and corruption fails closed without erasing data', (t) => {
  const h = harness(t);
  expectCode(() => h.create(), 'STORE_LOCKED');
  h.engine.create({ brief });
  h.engine.close();
  const path = join(h.directory, 'journal.json');
  writeFileSync(path, '{broken');
  expectCode(() => h.create(), 'STORE_CORRUPT');
  assert.equal(readFileSync(path, 'utf8'), '{broken');
});

test('persisted values are structurally and semantically validated before use', (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.close();
  const path = join(h.directory, 'journal.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  data.runs[0].budget.usedAttempts = 1;
  writeFileSync(path, JSON.stringify(data));
  expectCode(() => h.create(), 'STORE_CORRUPT');
  assert.ok(readFileSync(path, 'utf8').includes(run.id));
});

test('a forged completed state and forged accepted results are rejected on reopen', (t) => {
  const h = harness(t);
  h.engine.create({ brief }); h.engine.close();
  const path = join(h.directory, 'journal.json');
  const original = JSON.parse(readFileSync(path, 'utf8'));
  const forged = structuredClone(original);
  forged.runs[0].state = 'completed';
  writeFileSync(path, JSON.stringify(forged));
  expectCode(() => h.create(), 'STORE_CORRUPT');
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).runs[0].state, 'completed');
  writeFileSync(path, JSON.stringify(original));
  const restored = h.create();
  restored.start(original.runs[0].id);
  restored.close();
  const active = JSON.parse(readFileSync(path, 'utf8'));
  active.runs[0].missions[0].state = 'accepted';
  active.runs[0].missions[0].attempts[0].state = 'accepted';
  writeFileSync(path, JSON.stringify(active));
  expectCode(() => h.create(), 'STORE_CORRUPT');
});

test('partial virtual files and malformed output remain archived across retry and restart', (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief }); h.engine.start(run.id);
  h.starts[0].tools.writeArtifact('docs/PRODUCT.md', 'PARTIAL_FIRST_ATTEMPT');
  h.starts[0].onResult('{malformed output'); h.starts[0].onClose(1);
  h.engine.retry(run.id);
  h.starts[1].tools.writeArtifact('docs/PRODUCT.md', 'SECOND_ATTEMPT');
  const first = h.engine.find(run.id).missions[0].attempts[0];
  assert.equal(first.partialArtifacts[0].content, 'PARTIAL_FIRST_ATTEMPT');
  assert.equal(first.partialOutput, '{malformed output');
  h.engine.close();
  const recovered = h.create();
  assert.equal(recovered.find(run.id).missions[0].attempts[0].partialArtifacts[0].content, 'PARTIAL_FIRST_ATTEMPT');
});

test('persisted mission cannot be accepted without an attempt or requeued after acceptance', async (t) => {
  const h = harness(t); const run = h.engine.create({ brief }); h.engine.close();
  const path = join(h.directory, 'journal.json');
  const original = JSON.parse(readFileSync(path, 'utf8'));
  const forged = structuredClone(original);
  forged.runs[0].state = 'paused';
  forged.runs[0].missions[0].state = 'accepted';
  writeFileSync(path, JSON.stringify(forged));
  expectCode(() => h.create(), 'STORE_CORRUPT');
  writeFileSync(path, JSON.stringify(original));
  const active = h.create(); active.start(run.id); active.pause(run.id);
  await finish(h); active.close();
  const accepted = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(accepted.runs[0].missions[0].state, 'accepted');
  accepted.runs[0].missions[0].state = 'queued';
  writeFileSync(path, JSON.stringify(accepted));
  expectCode(() => h.create(), 'STORE_CORRUPT');
});

test('control logs share the cumulative output limit and stop the active attempt', async (t) => {
  const h = harness(t, { limits: { maxOutputBytes: 4096 }, checkRunner: () => ({ status: 'passed', log: 'x'.repeat(1000) }) });
  const run = h.engine.create({ brief }); await reachQA(h, run);
  const tools = h.starts.at(-1).tools;
  for (let index = 0; index < 4; index++) tools.runCheck('test', ['test']);
  expectCode(() => tools.runCheck('test', ['test']), 'OUTPUT_LIMIT');
  const attempt = h.engine.find(run.id).missions[4].attempts[0];
  assert.equal(attempt.outputBytes, 4000);
  assert.equal(attempt.state, 'failed');
  assert.equal(h.engine.find(run.id).evidence.length, 4);
  assert.equal(h.cancelCount, 1);
});

test('an empty owner marker from a dead process is recoverable without manual deletion', (t) => {
  const h = harness(t); h.engine.create({ brief }); h.engine.close();
  const child = spawnSync(process.execPath, ['-e', ''], { windowsHide: true });
  assert.equal(child.status, 0);
  writeFileSync(join(h.directory, `owner-${child.pid}-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.lock`), '');
  const recovered = h.create();
  assert.equal(recovered.list().length, 1);
});

test('completed runs and evidence survive a normal server restart', async (t) => {
  const h = harness(t); const run = h.engine.create({ brief }); h.engine.start(run.id);
  for (let index = 0; index < 6; index++) await finish(h);
  const before = h.engine.find(run.id); h.engine.close();
  const recovered = h.create();
  assert.deepEqual(recovered.find(run.id), before);
  assert.equal(h.starts.length, 6);
});

test('a persistence failure freezes the engine and requests stop instead of advancing', (t) => {
  const h = harness(t); const run = h.engine.create({ brief }); h.engine.start(run.id);
  const target = join(h.directory, 'journal.json');
  const backup = join(h.directory, 'journal-backup.json');
  renameSync(target, backup); mkdirSync(target);
  expectCode(() => h.engine.pause(run.id), 'STORE_UNAVAILABLE');
  assert.equal(h.engine.health().available, false);
  assert.equal(h.engine.find(run.id).state, 'running');
  assert.equal(h.cancelCount, 1);
  expectCode(() => h.engine.create({ brief }), 'ORCHESTRATOR_UNAVAILABLE');
  h.engine.close(); rmdirSync(target); renameSync(backup, target);
  const recovered = h.create();
  assert.equal(recovered.find(run.id).state, 'interrupted');
});

test('QA can update a developer test without invalidating historical accepted snapshots', async (t) => {
  const h = harness(t); const run = h.engine.create({ brief }); h.engine.start(run.id);
  for (let index = 0; index < 3; index++) await finish(h);
  const dev = h.starts.at(-1);
  const result = resultFor(dev);
  dev.tools.writeArtifact('tests/existing.test.ts', 'Première version du test.');
  result.artifacts.push(...dev.tools.captureArtifacts(['tests/existing.test.ts']));
  dev.onResult(result); dev.onClose(0); await tick();
  const qa = h.starts.at(-1);
  qa.tools.writeArtifact('tests/existing.test.ts', 'Test renforcé par QA.');
  await finish(h); await finish(h);
  const finished = h.engine.find(run.id);
  assert.equal(finished.state, 'completed');
  assert.equal(finished.missions[3].attempts[0].acceptedFiles['tests/existing.test.ts'].content, 'Première version du test.');
  assert.equal(finished.files['tests/existing.test.ts'].content, 'Test renforcé par QA.');
  h.engine.close();
  assert.equal(h.create().find(run.id).state, 'completed');
});

test('schema validator rejects unknown fields, roles, traversal and line-ending identities', () => {
  const fixtures = JSON.parse(readFileSync(new URL('../contracts/agent-contract-examples.json', import.meta.url), 'utf8'));
  validateEnvelope('mission', fixtures.missions[0]);
  for (const patch of [{ role: 'administrator' }, { missionId: 'example\n' }, { command: 'shell' }, { expectedArtifacts: ['../outside'] }]) expectCode(() => validateEnvelope('mission', { ...fixtures.missions[0], ...patch }), 'INVALID_OUTPUT');
});

test('adapter launch exception does not pretend the process stopped', (t) => {
  const h = harness(t, { adapter: { mode: 'example', start: () => { throw new Error('launch uncertain'); }, confirmStopped: () => false } });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  assert.equal(h.engine.find(run.id).state, 'blocked');
  assert.ok(h.engine.health().reservation);
  expectCode(() => h.engine.reconcile(run.id), 'SHUTDOWN_UNCONFIRMED');
});

function request(base, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(new URL(path, base), { method: options.method || 'GET', headers: { Host: '127.0.0.1:4318', ...options.headers } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject); req.end(options.body);
  });
}

test('versioned HTTP API preserves old routes and enforces host, origin, JSON and server-owned configuration', async (t) => {
  const h = harness(t);
  const server = createApp({ bridge: createBridge(), orchestrator: h.engine });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
  assert.equal((await request(base, '/api/health')).body.bridgeEnabled, false);
  assert.equal((await request(base, '/api/v1/orchestration')).body.liveGeneration, false);
  assert.equal((await request(base, '/api/v1/runs', { headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request(base, '/api/v1/runs', { headers: { Host: 'attacker.example' } })).status, 403);
  assert.equal((await request(base, '/api/v1/runs', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await request(base, '/api/v1/runs', { method: 'POST', headers, body: '{' })).status, 400);
  assert.equal((await request(base, '/api/v1/runs', { method: 'POST', headers, body: 'x'.repeat(65537) })).status, 413);
  assert.equal((await request(base, '/api/v1/runs', { method: 'POST', headers, body: JSON.stringify({ brief, workspaceId: '/arbitrary' }) })).status, 400);
  const created = await request(base, '/api/v1/runs', { method: 'POST', headers, body: JSON.stringify({ brief }) });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await request(base, `/api/v1/runs/${id}/start`, { method: 'POST', headers, body: '{"command":"shell"}' })).status, 400);
  assert.equal((await request(base, `/api/v1/runs/${id}/start`, { method: 'POST', headers, body: '{}' })).status, 202);
  assert.equal((await request(base, `/api/v1/runs/${id}`)).body.state, 'running');
  assert.equal((await request(base, '/api/v1/runs')).body.runs.length, 1);
  assert.equal((await request(base, `/api/v1/runs/${id}/pause`, { method: 'POST', headers, body: '{}' })).body.state, 'pause_requested');
  assert.equal((await request(base, '/api/v1/runs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).status, 404);
});
