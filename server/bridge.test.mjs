import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { request as httpRequest } from 'node:http';
import { createBridge, createCodexRunner, BridgeError } from './bridge.mjs';
import { createApp } from './app.mjs';

const valid = { role: 'product_manager', brief: 'Une application de suivi de projets.' };
function harness(options = {}) {
  let callbacks;
  let canceled = false;
  const bridge = createBridge({ enabled: true, cliAvailable: true, runner: (input) => {
    callbacks = input;
    return { cancel: () => { canceled = true; input.onClose(1); } };
  }, ...options });
  return { bridge, get callbacks() { return callbacks; }, get canceled() { return canceled; } };
}
const expectCode = (operation, code) => assert.throws(operation, (error) => error instanceof BridgeError && error.code === code);
function request(base, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(new URL(path, base), { method: options.method || 'GET', headers: { Host: '127.0.0.1:4318', ...options.headers } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, json: () => JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end(options.body);
  });
}

test('bridge is explicitly disabled by default', () => {
  const bridge = createBridge();
  assert.equal(bridge.health().bridgeEnabled, false);
  assert.equal(bridge.health().authenticationVerified, false);
  assert.equal(bridge.health().jobPersistence, 'memory');
  expectCode(() => bridge.start(valid), 'BRIDGE_DISABLED');
});

test('validates role, brief, extra fields and CLI availability before launching', () => {
  const { bridge } = harness();
  expectCode(() => bridge.start({ ...valid, role: '__proto__' }), 'INVALID_ROLE');
  expectCode(() => bridge.start({ ...valid, brief: 'court' }), 'INVALID_BRIEF');
  expectCode(() => bridge.start({ ...valid, brief: 'x'.repeat(12001) }), 'INVALID_BRIEF');
  expectCode(() => bridge.start({ ...valid, command: 'arbitrary' }), 'UNKNOWN_FIELD');
  expectCode(() => harness({ cliAvailable: false }).bridge.start(valid), 'CLI_UNAVAILABLE');
});

test('only actual turn completion and successful exit produce completed state', () => {
  const h = harness();
  const job = h.bridge.start(valid);
  assert.equal(job.state, 'running');
  assert.equal(job.mode, 'codex');
  h.callbacks.onMessage('Une analyse réellement reçue du processus.');
  h.callbacks.onEvent('turn.completed');
  h.callbacks.onClose(0);
  const result = h.bridge.find(job.id);
  assert.equal(result.state, 'completed');
  assert.equal(result.result, 'Une analyse réellement reçue du processus.');
  assert.equal(result.events[0].type, 'turn.completed');
  assert.ok(result.finishedAt);
  assert.equal(h.bridge.health().activeJobId, null);
});

test('refuses concurrency and never upgrades partial output to a success', () => {
  const h = harness();
  const job = h.bridge.start(valid);
  expectCode(() => h.bridge.start(valid), 'BRIDGE_BUSY');
  h.callbacks.onMessage('Résultat partiel');
  h.callbacks.onClose(0);
  assert.equal(h.bridge.find(job.id).state, 'failed');
  assert.equal(h.bridge.find(job.id).result, 'Résultat partiel');
  assert.match(h.bridge.find(job.id).error, /sans résultat confirmé/);
});

test('nonzero exit, model errors and synchronous spawn failures stay failures', () => {
  const h = harness();
  const job = h.bridge.start(valid);
  h.callbacks.onEvent('turn.completed');
  h.callbacks.onError('Quota épuisé');
  h.callbacks.onClose(1);
  assert.equal(h.bridge.find(job.id).state, 'failed');
  assert.equal(h.bridge.find(job.id).error, 'Quota épuisé');
  const broken = harness({ runner: () => { throw new Error('failed'); } });
  assert.equal(broken.bridge.start(valid).state, 'failed');
});

test('timeout cancels the owned adapter and preserves an error', async () => {
  const h = harness({ timeoutMs: 10 });
  const job = h.bridge.start(valid);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(h.canceled, true);
  assert.equal(h.bridge.find(job.id).state, 'failed');
  assert.match(h.bridge.find(job.id).error, /durée maximale/);
  assert.equal(h.bridge.health().shutdownUnconfirmed, false);
});

test('timeout without process close is terminal but blocks new processes until confirmed close', async () => {
  let callbacks;
  let launches = 0;
  let cancelCalls = 0;
  const bridge = createBridge({ enabled: true, cliAvailable: true, timeoutMs: 10, runner: (input) => {
    launches++;
    callbacks = input;
    return { cancel: () => { cancelCalls++; } };
  } });
  const job = bridge.start(valid);
  callbacks.onMessage('Analyse partielle avant échéance.');
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(cancelCalls, 1);
  const failed = bridge.find(job.id);
  assert.equal(failed.state, 'failed');
  assert.ok(failed.finishedAt);
  assert.match(failed.error, /fermeture doit être confirmée/);
  const health = bridge.health();
  assert.equal(health.activeJobId, null);
  assert.equal(health.shutdownUnconfirmed, true);
  assert.equal(health.blocked, true);
  assert.equal(health.blockedJobId, job.id);
  assert.match(health.blockReason, /Aucun nouveau processus/);
  expectCode(() => bridge.start(valid), 'BRIDGE_SHUTDOWN_UNCONFIRMED');
  assert.equal(launches, 1);
  callbacks.onMessage('Message tardif qui ne doit pas modifier un résultat terminal.');
  callbacks.onEvent('turn.completed');
  callbacks.onClose(0);
  assert.equal(bridge.find(job.id).state, 'failed');
  assert.equal(bridge.find(job.id).result, 'Analyse partielle avant échéance.');
  assert.equal(bridge.find(job.id).finishedAt, failed.finishedAt);
  assert.equal(bridge.health().blocked, false);
  assert.equal(bridge.health().blockedJobId, null);
  bridge.start(valid);
  assert.equal(launches, 2);
  callbacks.onClose(1);
});

test('failed cancellation remains terminal and blocked instead of launching another process', async () => {
  let callbacks;
  const bridge = createBridge({ enabled: true, cliAvailable: true, timeoutMs: 10, runner: (input) => {
    callbacks = input;
    return { cancel: () => { throw new Error('Cannot kill'); } };
  } });
  const job = bridge.start(valid);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(bridge.find(job.id).state, 'failed');
  assert.match(bridge.find(job.id).error, /demande d’arrêt a échoué/);
  assert.equal(bridge.health().shutdownUnconfirmed, true);
  expectCode(() => bridge.start(valid), 'BRIDGE_SHUTDOWN_UNCONFIRMED');
  callbacks.onClose(1);
  assert.equal(bridge.health().shutdownUnconfirmed, false);
});

test('bounds history, events and returns snapshots instead of live references', () => {
  const h = harness({ historyLimit: 1 });
  const first = h.bridge.start(valid);
  for (let i = 0; i < 220; i++) h.callbacks.onEvent('item.completed');
  assert.equal(h.bridge.find(first.id).events.length, 200);
  first.state = 'completed';
  assert.equal(h.bridge.find(first.id).state, 'running');
  h.callbacks.onClose(1);
  h.bridge.start(valid);
  expectCode(() => h.bridge.find(first.id), 'JOB_NOT_FOUND');
  h.bridge.shutdown();
});

test('Codex adapter uses a fixed shell-free read-only command and stdin prompt', () => {
  let invocation;
  let prompt = '';
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.stdin.on('data', (chunk) => { prompt += chunk; });
  child.kill = () => {};
  const events = [];
  const messages = [];
  let closed;
  const runner = createCodexRunner({ binary: 'fixed-codex', cwd: '/fixed/workspace', spawnProcess: (...args) => { invocation = args; return child; } });
  runner({ ...valid, onEvent: (event) => events.push(event), onMessage: (message) => messages.push(message), onClose: (code) => { closed = code; }, onError: assert.fail });
  assert.equal(invocation[0], 'fixed-codex');
  assert.deepEqual(invocation[1], [
    'exec', '--json', '--ignore-user-config', '--strict-config', '--sandbox', 'read-only',
    '-c', 'agents.enabled=false',
    '-c', 'features.apps=false',
    '-c', 'features.plugins=false',
    '-c', 'features.memories=false',
    '-c', 'features.request_permissions_tool=false',
    '-C', '/fixed/workspace', '-',
  ]);
  assert.equal(invocation[2].shell, false);
  assert.ok(prompt.includes(valid.brief));
  assert.ok(!invocation[1].includes(valid.brief));
  child.stdout.write('{"type":"item.completed","item":{"type":"agent_message","text":"Analyse vérifiée"}}\n');
  child.stdout.write('{"type":"turn.completed"}\n');
  child.emit('close', 0);
  assert.deepEqual(events, ['item.completed', 'turn.completed']);
  assert.deepEqual(messages, ['Analyse vérifiée']);
  assert.equal(closed, 0);
});

test('a process error with an existing PID cannot falsely confirm termination', () => {
  const child = new EventEmitter();
  child.pid = 12345;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  let closeCalls = 0;
  let errorCalls = 0;
  const runner = createCodexRunner({ spawnProcess: () => child });
  runner({ ...valid, onEvent: () => {}, onMessage: () => {}, onError: () => { errorCalls++; }, onClose: () => { closeCalls++; } });
  child.emit('error', Object.assign(new Error('Cannot terminate'), { code: 'EACCES' }));
  assert.equal(errorCalls, 1);
  assert.equal(closeCalls, 0);
  child.emit('close', 1);
  assert.equal(closeCalls, 1);
});

test('HTTP API validates Host, Origin, JSON type, size, disabled bridge and not-found jobs', async (t) => {
  const bridge = createBridge();
  const server = createApp({ bridge, port: 4318 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await request(base, '/api/health')).status, 200);
  assert.equal((await request(base, '/api/health', { headers: { Host: 'attacker.example' } })).status, 403);
  assert.equal((await request(base, '/api/health', { headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request(base, '/api/jobs', { method: 'POST', body: JSON.stringify(valid) })).status, 415);
  assert.equal((await request(base, '/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await request(base, '/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })).status, 503);
  assert.equal((await request(base, '/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(65537) })).status, 413);
  assert.equal((await request(base, '/api/jobs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).status, 404);
  assert.equal((await request(base, '/other')).status, 404);
});

test('HTTP API returns real job lifecycle from injected adapter without model calls', async (t) => {
  const h = harness();
  const server = createApp({ bridge: h.bridge });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Host: '127.0.0.1:4318', Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
  const response = await request(base, '/api/jobs', { method: 'POST', headers, body: JSON.stringify(valid) });
  assert.equal(response.status, 202);
  const created = await response.json();
  h.callbacks.onMessage('Livrable du processus injecté pour le test.');
  h.callbacks.onEvent('turn.completed');
  h.callbacks.onClose(0);
  const result = await request(base, '/api/jobs/' + created.id, { headers });
  assert.equal((await result.json()).state, 'completed');
});
