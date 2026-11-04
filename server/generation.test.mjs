import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, rmdirSync, mkdirSync, symlinkSync, linkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createGenerationWorkspace, safeArtifactPath, validateFiles } from './generation-workspace.mjs';
import { createGenerationAdapter, GENERATION_LIMITS, PROVIDER_LIMITS } from './generation-adapter.mjs';
import { createOrchestrator } from './orchestrator.mjs';
import { hash, loadInstructions, ROLES } from './orchestration-contracts.mjs';
import { validateState } from './orchestration-store.mjs';

const brief = 'Créer un gestionnaire de dépenses personnel, en euros, avec persistance locale.';
const code = (fn, expected) => assert.throws(fn, (error) => error.code === expected);
const filesFor = (values) => Object.fromEntries(Object.entries(values).map(([path, content]) => [path, { content, revision: hash(content), producerMissionId: 'fixture' }]));
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'factory-generation-'));
  t.after(() => {
    assert.equal(resolve(root), join(resolve(tmpdir()), basename(root)));
    assert.ok(basename(root).startsWith('factory-generation-'));
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}
const proposal = (mission, changes = {}) => ({
  files: mission.expectedArtifacts.filter((path) => !['package.json', 'package-lock.json'].includes(path)).map((path) => ({ path: path.endsWith('/') ? `${path}app.ts` : path, content: `Fixture de test ${mission.role} ${path}.` })),
  status: mission.role === 'qa_engineer' ? 'blocked' : 'ready',
  summary: 'Fixture injectée, aucune requête réelle.', findings: [],
  blockers: mission.role === 'qa_engineer' ? [{ code: 'CHECKS_UNAVAILABLE', message: 'Commandes indisponibles dans cette étape.' }] : [],
  nextAction: 'Vérifier le livrable.', ...changes,
});
const provider = (value, changes = {}) => ({
  id: `resp_${randomUUID().replaceAll('-', '')}`, status: 'completed',
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: typeof value === 'string' ? value : JSON.stringify(value) }] }],
  usage: { input_tokens: 123, output_tokens: 456 }, ...changes,
});
const response = (value) => new Response(JSON.stringify(value), { status: 200 });
async function until(check) {
  for (let i = 0; i < 300; i++) { if (check()) return; await new Promise((done) => setTimeout(done, 5)); }
  assert.fail('État attendu non atteint.');
}
function harness(t, { fetchImpl, ...options } = {}) {
  const root = temporary(t);
  const requests = [];
  const workspace = createGenerationWorkspace(join(root, 'projects'));
  const adapter = createGenerationAdapter({ apiKey: 'test-secret-never-log', model: 'test-model', fetchImpl: async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, init, body });
    return fetchImpl ? fetchImpl(url, init, body) : response(provider(proposal(JSON.parse(body.input).mission)));
  } });
  const engines = [];
  const create = (extra = {}) => {
    const engine = createOrchestrator({ directory: join(root, 'journal'), workspace, adapter, limits: GENERATION_LIMITS, ...options, ...extra });
    engines.push(engine);
    return engine;
  };
  const engine = create();
  t.after(() => engines.forEach((item) => item.close()));
  return { root, workspace, requests, adapter, engine, create };
}

test('portable path policy rejects traversal, Windows device names, metadata and ambiguous paths', () => {
  for (const path of ['../x', '/x', 'C:/x', 'src\\x', 'src/x:stream', 'src/CON.ts', 'src/aux', 'src/lpt1.txt', 'src/x.', '.env', 'src/.codex/config.toml', 'src/node_modules/a', '__proto__', 'src/a\n']) code(() => safeArtifactPath(path), 'UNSAFE_PATH');
  assert.equal(safeArtifactPath('src/components/Expense.tsx'), 'src/components/Expense.tsx');
  for (const values of [{ 'src/A.ts': 'a', 'src/a.ts': 'b' }, { 'SRC/a.ts': 'a', 'src/b.ts': 'b' }, { src: 'a', 'src/b.ts': 'b' }]) code(() => validateFiles(filesFor(values)), 'PATH_COLLISION');
});

test('snapshots are physical, immutable, versioned and separated by workspace identity', (t) => {
  const root = temporary(t);
  const workspace = createGenerationWorkspace(join(root, 'projects'));
  const id = randomUUID();
  const a = filesFor({ 'src/app.ts': 'first', 'docs/PRODUCT.md': 'brief' });
  const b = filesFor({ 'src/app.ts': 'second', 'docs/PRODUCT.md': 'brief' });
  const first = workspace.materialize(id, a);
  assert.equal(workspace.materialize(id, a), first);
  const second = workspace.materialize(id, b);
  assert.notEqual(first, second);
  assert.equal(readFileSync(join(first, 'src/app.ts'), 'utf8'), 'first');
  assert.equal(readFileSync(join(second, 'src/app.ts'), 'utf8'), 'second');
  assert.notEqual(workspace.materialize(randomUUID(), a), first);
  code(() => workspace.materialize('../escape', a), 'UNSAFE_WORKSPACE');
});

test('modified, missing and extra disk files never silently pass or get overwritten', (t) => {
  const workspace = createGenerationWorkspace(join(temporary(t), 'projects'));
  const id = randomUUID();
  const files = filesFor({ 'src/app.ts': 'original' });
  const target = workspace.materialize(id, files);
  writeFileSync(join(target, 'src/app.ts'), 'modified');
  code(() => workspace.materialize(id, files), 'WORKSPACE_INTEGRITY');
  assert.equal(readFileSync(join(target, 'src/app.ts'), 'utf8'), 'modified');
  writeFileSync(join(target, 'src/app.ts'), 'original');
  writeFileSync(join(target, 'extra.txt'), 'extra');
  code(() => workspace.verify(id, files), 'WORKSPACE_INTEGRITY');
  unlinkSync(join(target, 'extra.txt'));
  unlinkSync(join(target, 'src/app.ts'));
  code(() => workspace.verify(id, files), 'WORKSPACE_INTEGRITY');
  code(() => workspace.materialize(id, files), 'WORKSPACE_INTEGRITY');
});

test('junctions and hardlinks cannot expose or overwrite outside files', (t) => {
  const root = temporary(t);
  const outside = join(root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'app.ts'), 'outside');
  symlinkSync(outside, join(root, 'linked'), 'junction');
  code(() => createGenerationWorkspace(join(root, 'linked', 'projects')), 'UNSAFE_WORKSPACE');
  const workspace = createGenerationWorkspace(join(root, 'projects'));
  const id = randomUUID();
  symlinkSync(outside, join(root, 'projects', id), 'junction');
  code(() => workspace.materialize(id, filesFor({ 'src/app.ts': 'changed' })), 'UNSAFE_WORKSPACE');
  const next = randomUUID();
  const files = filesFor({ 'src/app.ts': 'outside' });
  const target = workspace.materialize(next, files);
  unlinkSync(join(target, 'src/app.ts'));
  linkSync(join(outside, 'app.ts'), join(target, 'src/app.ts'));
  code(() => workspace.verify(next, files), 'WORKSPACE_INTEGRITY');
  assert.equal(readFileSync(join(outside, 'app.ts'), 'utf8'), 'outside');
});

test('workspace size, hash and file count limits are enforced before materialization', (t) => {
  const workspace = createGenerationWorkspace(join(temporary(t), 'projects'));
  code(() => workspace.materialize(randomUUID(), { 'src/app.ts': { content: 'x', revision: 'forged' } }), 'WORKSPACE_INTEGRITY');
  code(() => workspace.materialize(randomUUID(), filesFor({ 'src/app.ts': 'x'.repeat(16 * 1024 * 1024 + 1) })), 'WORKSPACE_LIMIT');
  code(() => workspace.materialize(randomUUID(), filesFor(Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`src/a${i}`, 'x'])))), 'WORKSPACE_LIMIT');
});

test('real transport executes four roles, materializes sources/lock and stops at unverified QA', async (t) => {
  const h = harness(t);
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => h.engine.find(run.id).state === 'blocked');
  const final = h.engine.find(run.id);
  assert.equal(final.mode, 'real');
  assert.equal(final.deliveryVerified, false);
  assert.deepEqual(final.missions.map((item) => item.state), ['accepted', 'accepted', 'accepted', 'accepted', 'blocked', 'queued']);
  assert.equal(h.requests.length, 5);
  assert.equal(final.evidence.length, 0);
  assert.ok(final.missions[4].attempts[0].result.checks.every((check) => check.status === 'not_run' && check.evidenceId === null));
  const path = h.workspace.verify(final.workspaceId, final.files);
  assert.ok(readFileSync(join(path, 'src/app.ts'), 'utf8').includes('Fixture'));
  const manifest = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(path, 'package-lock.json'), 'utf8'));
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies);
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(manifest.scripts.test, 'vitest run');
  assert.equal(final.events.filter((item) => item.type === 'provider_response').length, 5);
  for (const [index, req] of h.requests.entries()) {
    assert.equal(req.url, 'https://api.openai.com/v1/responses');
    assert.equal(req.init.redirect, 'error');
    assert.deepEqual(req.body.tools, []);
    assert.equal(req.body.tool_choice, 'none');
    assert.equal(req.body.store, false);
    assert.equal(req.body.max_output_tokens, PROVIDER_LIMITS.maxOutputTokens);
    assert.equal(req.body.previous_response_id, undefined);
    assert.ok(req.body.instructions.includes(loadInstructions().roles[ROLES[index]].text));
    const input = JSON.parse(req.body.input);
    assert.equal(input.inputs.length, input.mission.inputs.length);
    assert.equal(input.mission.role, ROLES[index]);
  }
  assert.ok(!JSON.stringify(final).includes('test-secret-never-log'));
  h.engine.close();
  assert.deepEqual(h.create().find(run.id).files, final.files);
});

test('server config is explicit and real mode cannot receive a fake check runner or change mode', (t) => {
  code(() => createGenerationAdapter({ model: 'test' }), 'GENERATION_CONFIG');
  code(() => createGenerationAdapter({ apiKey: 'secret' }), 'GENERATION_CONFIG');
  const h = harness(t);
  code(() => h.create({ checkRunner: () => ({ status: 'passed', log: 'fake' }) }), 'INVALID_ADAPTER');
  code(() => h.create({ workspace: null }), 'INVALID_ADAPTER');
  const run = h.engine.create({ brief });
  h.engine.close();
  const fake = h.create({ adapter: { mode: 'example', start() {}, confirmStopped: () => true } });
  code(() => fake.start(run.id), 'MODE_MISMATCH');
});

for (const [name, transform] of [
  ['malformed JSON', () => '{'],
  ['unauthorized path', (p) => ({ ...p, files: [{ path: 'src/escape.ts', content: 'x' }] })],
  ['Windows alias', (p) => ({ ...p, files: [{ path: 'docs/CON.md', content: 'x' }] })],
  ['duplicate path', (p) => ({ ...p, files: [...p.files, ...p.files] })],
  ['extra command field', (p) => ({ ...p, command: 'touch outside' })],
  ['forged test evidence', (p) => ({ ...p, checks: [{ status: 'passed', evidenceId: 'invented' }] })],
  ['inconsistent ready', (p) => ({ ...p, blockers: [{ code: 'MISSING', message: 'missing' }] })],
]) {
  test(`invalid proposal blocks without writing: ${name}`, async (t) => {
    const h = harness(t, { fetchImpl: (_url, _init, body) => response(provider(transform(proposal(JSON.parse(body.input).mission)))) });
    const run = h.engine.create({ brief });
    h.engine.start(run.id);
    await until(() => h.engine.find(run.id).state === 'blocked');
    assert.deepEqual(h.engine.find(run.id).files, {});
    assert.equal(h.requests.length, 1);
    assert.equal(h.engine.health().reservation, null);
    const failed = h.engine.find(run.id);
    assert.ok(failed.missions[0].attempts[0].sessionId.startsWith('resp_'));
    const observed = JSON.parse(failed.events.find((event) => event.type === 'provider_response').detail);
    assert.equal(observed.inputTokens, 123);
    assert.equal(observed.outputTokens, 456);
  });
}

for (const [name, make] of [
  ['HTTP quota', () => new Response('secret provider body', { status: 429 })],
  ['network failure', () => { throw new Error('test-secret-never-log'); }],
  ['incomplete', (p) => response(provider(p, { status: 'incomplete' }))],
  ['tool request', (p) => response(provider(p, { output: [{ type: 'function_call', name: 'shell' }] }))],
  ['refusal', (p) => response(provider(p, { output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'no' }] }] }))],
  ['oversized response', () => new Response('x'.repeat(PROVIDER_LIMITS.maxResponseBytes + 1))],
]) {
  test(`provider failure is bounded and not retried automatically: ${name}`, async (t) => {
    const h = harness(t, { fetchImpl: (_url, _init, body) => make(proposal(JSON.parse(body.input).mission)) });
    const run = h.engine.create({ brief });
    h.engine.start(run.id);
    await until(() => h.engine.find(run.id).state === 'blocked');
    const final = h.engine.find(run.id);
    assert.equal(h.requests.length, 1);
    assert.equal(final.budget.usedAttempts, 1);
    assert.deepEqual(final.files, {});
    assert.ok(!JSON.stringify(final).includes('test-secret-never-log'));
    assert.ok(!JSON.stringify(final).includes('secret provider body'));
    if (['incomplete', 'tool request', 'refusal'].includes(name)) {
      assert.ok(final.missions[0].attempts[0].sessionId.startsWith('resp_'));
      assert.equal(JSON.parse(final.events.find((event) => event.type === 'provider_response').detail).outputTokens, 456);
    }
  });
}

test('cancellation cannot publish late responses and holds reservation until local transport ends', async (t) => {
  let finish;
  const h = harness(t, { fetchImpl: (_url, _init, body) => new Promise((done) => { finish = () => done(response(provider(proposal(JSON.parse(body.input).mission)))); }) });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => !!finish);
  h.engine.cancel(run.id);
  assert.equal(h.requests[0].init.signal.aborted, true);
  assert.equal(h.engine.find(run.id).state, 'cancel_requested');
  assert.ok(h.engine.health().reservation);
  code(() => h.engine.reconcile(run.id), 'SHUTDOWN_UNCONFIRMED');
  finish();
  await until(() => h.engine.find(run.id).state === 'cancelled');
  assert.deepEqual(h.engine.find(run.id).files, {});
  assert.equal(h.engine.health().reservation, null);
});

test('pause prevents the next request; disk tampering blocks resume before billing', async (t) => {
  let finish;
  const h = harness(t, { fetchImpl: (_url, _init, body) => new Promise((done) => { finish = () => done(response(provider(proposal(JSON.parse(body.input).mission)))); }) });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => !!finish);
  h.engine.pause(run.id);
  finish();
  await until(() => h.engine.find(run.id).state === 'paused');
  assert.equal(h.requests.length, 1);
  const paused = h.engine.find(run.id);
  const path = h.workspace.verify(paused.workspaceId, paused.files);
  writeFileSync(join(path, 'docs/PRODUCT.md'), 'tampered');
  h.engine.resume(run.id);
  assert.equal(h.engine.find(run.id).state, 'blocked');
  assert.equal(h.requests.length, 1);
  assert.equal(h.engine.find(run.id).budget.usedAttempts, 1);
});

test('timeout aborts the request, ignores late output, and charges an attempt', async (t) => {
  let finish;
  const h = harness(t, { limits: { ...GENERATION_LIMITS, timeoutMs: 30 }, fetchImpl: (_url, _init, body) => new Promise((done) => { finish = () => done(response(provider(proposal(JSON.parse(body.input).mission)))); }) });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => h.engine.find(run.id).state === 'blocked');
  assert.equal(h.requests[0].init.signal.aborted, true);
  assert.ok(h.engine.health().reservation);
  finish();
  await until(() => h.engine.health().reservation === null);
  assert.deepEqual(h.engine.find(run.id).files, {});
  assert.equal(h.engine.find(run.id).missions[0].attempts[0].errorCode, 'TIMEOUT');
});

test('real QA cannot pass with a model declaration, and fake persisted proofs are rejected', async (t) => {
  const h = harness(t, { fetchImpl: (_url, _init, body) => {
    const mission = JSON.parse(body.input).mission;
    return response(provider(proposal(mission, { status: 'ready', blockers: [] })));
  } });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => h.engine.find(run.id).state === 'blocked');
  assert.equal(h.engine.find(run.id).missions[4].state, 'failed');
  const state = JSON.parse(readFileSync(join(h.root, 'journal/journal.json'), 'utf8'));
  state.runs[0].evidence.push({ id: 'fake', missionId: 'fake', attempt: 1, criterionId: 'test', commandId: 'test', status: 'passed', fingerprint: 'fake', at: new Date().toISOString(), log: 'fake', provenance: 'test-adapter' });
  code(() => validateState(state), 'STORE_CORRUPT');
});

test('developer cannot replace server-pinned dependencies and lockfile', async (t) => {
  const h = harness(t, { fetchImpl: (_url, _init, body) => {
    const mission = JSON.parse(body.input).mission;
    const p = proposal(mission);
    if (mission.role === 'fullstack_developer') p.files.push({ path: 'package.json', content: '{"scripts":{"postinstall":"unsafe"}}' });
    return response(provider(p));
  } });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => h.engine.find(run.id).state === 'blocked');
  assert.equal(h.engine.find(run.id).files['package.json'], undefined);
  assert.equal(h.engine.find(run.id).missions[3].state, 'failed');
});

test('reviewer uses a fresh stateless response identity; reuse is rejected', async (t) => {
  let developerId;
  const h = harness(t, { fetchImpl: (_url, _init, body) => {
    const mission = JSON.parse(body.input).mission;
    const p = proposal(mission);
    if (mission.role === 'qa_engineer') Object.assign(p, { status: 'needs_changes', blockers: [], findings: [{ id: 'defect', priority: 'P1', path: 'src/app.ts', line: 1, description: 'Fixture non exécutable.', reproduction: 'Lire le fichier injecté.' }] });
    const value = provider(p);
    if (mission.role === 'fullstack_developer') developerId = value.id;
    if (mission.role === 'code_reviewer') value.id = developerId;
    return response(value);
  } });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => h.engine.find(run.id).missions[5].state === 'failed');
  assert.equal(h.requests.length, 6);
  assert.equal(h.engine.find(run.id).missions[5].attempts[0].errorCode, 'INDEPENDENCE_VIOLATION');
  assert.equal(h.engine.find(run.id).files['docs/REVIEW.md'], undefined);
});

test('restart never replays a real request; explicit reconciliation and retry preserve the unknown attempt', async (t) => {
  let finishOld;
  let finishNew;
  let newRequests = 0;
  const h = harness(t, { fetchImpl: (_url, _init, body) => new Promise((done) => {
    finishOld = () => done(response(provider(proposal(JSON.parse(body.input).mission, { files: [{ path: 'docs/PRODUCT.md', content: 'old response' }] }))));
  }) });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => !!finishOld);
  h.engine.close();
  const replacementAdapter = createGenerationAdapter({ apiKey: 'new-test-secret', model: 'test-model', fetchImpl: async (_url, init) => {
    newRequests++;
    return new Promise((done) => { finishNew = () => done(response(provider(proposal(JSON.parse(JSON.parse(init.body).input).mission)))); });
  } });
  const recovered = h.create({ adapter: replacementAdapter });
  assert.equal(recovered.find(run.id).state, 'interrupted');
  assert.equal(newRequests, 0);
  code(() => recovered.retry(run.id), 'ORCHESTRATOR_BUSY');
  recovered.reconcile(run.id);
  assert.equal(newRequests, 0);
  recovered.retry(run.id);
  recovered.pause(run.id);
  await until(() => !!finishNew);
  finishNew();
  await until(() => recovered.find(run.id).state === 'paused');
  finishOld();
  await new Promise((done) => setImmediate(done));
  const final = recovered.find(run.id);
  assert.equal(newRequests, 1);
  assert.equal(final.budget.usedAttempts, 2);
  assert.equal(final.missions[0].attempts[0].state, 'unknown');
  assert.equal(final.missions[0].attempts[1].state, 'accepted');
  assert.ok(!JSON.stringify(final.files).includes('old response'));
});

test('journal failure during provider callbacks freezes locally without an unhandled rejection', async (t) => {
  let finish;
  const h = harness(t, { fetchImpl: (_url, _init, body) => new Promise((done) => { finish = () => done(response(provider(proposal(JSON.parse(body.input).mission)))); }) });
  const run = h.engine.create({ brief });
  h.engine.start(run.id);
  await until(() => !!finish);
  const journal = join(h.root, 'journal/journal.json');
  const durable = readFileSync(journal, 'utf8');
  unlinkSync(journal);
  mkdirSync(journal);
  finish();
  await until(() => h.engine.health().blocked);
  await new Promise((done) => setImmediate(done));
  assert.equal(h.engine.health().available, false);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.engine.find(run.id).files, {});
  h.engine.close();
  // Only remove the exact empty directory we created as a failed rename target.
  rmdirSync(journal);
  writeFileSync(journal, durable);
  assert.equal(h.create().find(run.id).state, 'interrupted');
});
