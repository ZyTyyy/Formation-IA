import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { compileSchema, fail, missionSchema, resultSchema, ROLES, hash, validPath, validateResult, fileFingerprint } from './orchestration-contracts.mjs';

const string = { type: 'string' };
const nullableString = { type: ['string', 'null'] };
const object = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const array = (items, maxItems = 4096) => ({ type: 'array', maxItems, items });
const integer = { type: 'integer', minimum: 0 };
const files = { type: 'object', maxProperties: 256, additionalProperties: object({ content: string, revision: string, producerMissionId: string }) };
const statuses = ['draft', 'running', 'pause_requested', 'paused', 'blocked', 'needs_changes', 'cancel_requested', 'cancelled', 'completed', 'interrupted'];
const attemptStates = ['running', 'accepted', 'needs_changes', 'blocked', 'failed', 'unknown'];
const reference = object({ runId: string, missionId: string, attempt: integer, executionId: string });
const schema = object({
  schemaVersion: { const: 1 }, reservation: { anyOf: [reference, { type: 'null' }] },
  runs: array(object({
    id: string, projectId: string, workspaceId: string, mode: { const: 'example' }, brief: string,
    state: { enum: statuses }, createdAt: string, updatedAt: string,
    budget: object({ maxTotalAttempts: integer, maxRunMs: integer, usedAttempts: integer, elapsedMs: integer }),
    limits: object({ timeoutMs: integer, maxAttempts: integer, maxOutputBytes: integer }),
    instructions: object({ global: string, contract: string, hash: string, roles: { type: 'object', additionalProperties: object({ text: string, hash: string }), required: ROLES } }),
    files,
    evidence: array(object({ id: string, missionId: string, attempt: integer, criterionId: string, commandId: string, status: { enum: ['passed', 'failed'] }, fingerprint: string, at: string, log: string, provenance: { const: 'test-adapter' } })),
    events: array(object({ id: string, at: string, type: string, missionId: nullableString, attempt: integer, detail: string })),
    missions: array(object({
      id: string, role: { enum: ROLES }, state: { enum: ['queued', ...attemptStates] },
      attempts: array(object({
        number: integer, executionId: string, sessionId: nullableString, chargedMs: integer, mission: missionSchema,
        startedAt: string, finishedAt: nullableString, state: { enum: attemptStates },
        error: nullableString, errorCode: nullableString, result: { anyOf: [resultSchema, { type: 'null' }] },
        closeConfirmed: { type: 'boolean' }, outputBytes: integer, partialOutput: string,
        captures: array(object({ path: string, revision: string, content: string })),
        partialArtifacts: array(object({ path: string, revision: string, content: string })),
        acceptedFiles: { anyOf: [files, { type: 'null' }] },
      }), 2),
    }), 6),
  }), 100),
});
const validate = compileSchema(schema);
export function validateState(state) {
  if (!validate(state)) fail('STORE_CORRUPT', 'Le journal persistant est invalide ; aucune réinitialisation automatique.', 500);
  const ids = new Set();
  const executions = new Set();
  const missionIds = new Set();
  let openAttempts = 0;
  for (const run of state.runs) {
    if (ids.has(run.id) || run.missions.length !== 6 || run.budget.maxTotalAttempts < 1 || run.budget.maxRunMs < 1 || Object.values(run.limits).some((value) => value < 1)) fail('STORE_CORRUPT', 'Identités ou limites persistées invalides.', 500);
    ids.add(run.id);
    let attempts = 0;
    let chargedMs = 0;
    if (run.instructions.hash !== hash({ global: run.instructions.global, contract: run.instructions.contract, roles: run.instructions.roles })) fail('STORE_CORRUPT', 'Instructions persistées incohérentes.', 500);
    for (const [index, mission] of run.missions.entries()) {
      if (mission.role !== ROLES[index]) fail('STORE_CORRUPT', 'Ordre des rôles invalide.', 500);
      const last = mission.attempts.at(-1);
      const retryQueued = mission.state === 'queued' && last?.closeConfirmed && ['failed', 'blocked', 'unknown'].includes(last.state);
      if (missionIds.has(mission.id) || (!last && mission.state !== 'queued') || (last && mission.state !== last.state && !retryQueued)) fail('STORE_CORRUPT', 'État de mission sans tentative correspondante ou rejeu d’une décision acceptée.', 500);
      missionIds.add(mission.id);
      for (const [number, attempt] of mission.attempts.entries()) {
        attempts++;
        chargedMs += attempt.chargedMs;
        if (attempt.number !== number + 1 || attempt.mission.attempt !== attempt.number || attempt.mission.runId !== run.id || attempt.mission.missionId !== mission.id || attempt.mission.role !== mission.role || attempt.mission.mode !== 'example' || executions.has(attempt.executionId)) fail('STORE_CORRUPT', 'Tentative persistée incohérente.', 500);
        executions.add(attempt.executionId);
        if (!attempt.closeConfirmed) openAttempts++;
        if (!Number.isFinite(Date.parse(attempt.startedAt)) || (attempt.finishedAt !== null && !Number.isFinite(Date.parse(attempt.finishedAt)))) fail('STORE_CORRUPT', 'Date de tentative invalide.', 500);
        for (const file of [...attempt.captures, ...attempt.partialArtifacts]) {
          if (!validPath(file.path) || file.revision !== hash(file.content)) fail('STORE_CORRUPT', 'Version de fichier archivée invalide.', 500);
        }
        if (attempt.state === 'accepted' || attempt.state === 'needs_changes') {
          if (!attempt.closeConfirmed || !attempt.result || !attempt.acceptedFiles || attempt.result.status !== (attempt.state === 'accepted' ? 'ready' : 'needs_changes')) fail('STORE_CORRUPT', 'Acceptation sans résultat ou instantané confirmé.', 500);
          for (const [path, file] of Object.entries(attempt.acceptedFiles)) {
            if (!validPath(path) || file.revision !== hash(file.content)) fail('STORE_CORRUPT', 'Instantané d’acceptation invalide.', 500);
          }
          try { validateResult({ ...run, files: attempt.acceptedFiles }, index, attempt, attempt.result); } catch { fail('STORE_CORRUPT', 'Résultat accepté incompatible avec son instantané ou ses preuves historiques.', 500); }
        }
      }
    }
    if (attempts !== run.budget.usedAttempts || attempts > run.budget.maxTotalAttempts || chargedMs !== run.budget.elapsedMs) fail('STORE_CORRUPT', 'Compteur de tentatives ou durée incohérent.', 500);
    for (const [path, file] of Object.entries(run.files)) {
      if (!validPath(path) || file.revision !== hash(file.content)) fail('STORE_CORRUPT', 'Fichier persistant invalide.', 500);
    }
    if (run.state === 'draft' && (attempts || Object.keys(run.files).length || run.missions.some((mission) => mission.state !== 'queued'))) fail('STORE_CORRUPT', 'Brouillon avec exécution cachée.', 500);
    if (run.state === 'completed' && (run.missions.some((mission) => mission.state !== 'accepted') || state.reservation?.runId === run.id)) fail('STORE_CORRUPT', 'Succès sans six missions acceptées.', 500);
    if (run.state === 'completed' && fileFingerprint(run.files, true) !== fileFingerprint(run.missions[4].attempts.at(-1).acceptedFiles, true)) fail('STORE_CORRUPT', 'Succès sur des sources différentes de la version QA.', 500);
    if (run.state === 'needs_changes' && !run.missions.some((mission) => mission.state === 'needs_changes')) fail('STORE_CORRUPT', 'État de correction sans constat.', 500);
    for (let index = 1; index < run.missions.length; index++) {
      if (run.missions[index].attempts.length && run.missions.slice(0, index).some((mission, previous) => mission.state !== 'accepted' && !(previous === 4 && mission.state === 'needs_changes'))) fail('STORE_CORRUPT', 'Dépendance persistée non acceptée.', 500);
    }
  }
  if (openAttempts !== (state.reservation ? 1 : 0)) fail('STORE_CORRUPT', 'Tentatives sans réservation cohérente.', 500);
  if (state.reservation) {
    const { runId, missionId, attempt, executionId } = state.reservation;
    const found = state.runs.find((run) => run.id === runId)?.missions.find((mission) => mission.id === missionId)?.attempts[attempt - 1];
    if (!found || found.executionId !== executionId || found.closeConfirmed) fail('STORE_CORRUPT', 'Réservation persistée incohérente.', 500);
  }
}

export function openJournal(directory) {
  const root = resolve(directory);
  mkdirSync(root, { recursive: true });
  const target = join(root, 'journal.json');
  const token = randomUUID();
  const lock = join(root, `owner-${process.pid}-${token}.lock`);
  let closed = false;
  let poisoned = false;
  try {
    // Each contender publishes a unique PID-bearing marker BEFORE scanning.
    // A successful owner retains its marker throughout its lifetime. Contenders
    // seeing each other may both fail, but cannot both claim the journal.
    // A crash before writing content is recoverable from the filename itself.
    const fd = openSync(lock, 'wx');
    try { writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); fsyncSync(fd); } finally { closeSync(fd); }
    for (const name of readdirSync(root)) {
      if (name === `owner-${process.pid}-${token}.lock` || !name.startsWith('owner-') || !name.endsWith('.lock')) continue;
      const match = /^owner-([1-9][0-9]*)-([a-f0-9-]{36})\.lock$/.exec(name);
      if (!match || !Number.isSafeInteger(Number(match[1]))) fail('STORE_LOCKED', 'Marqueur de propriétaire invalide.', 503);
      let alive = true;
      try { process.kill(Number(match[1]), 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
      if (alive) fail('STORE_LOCKED', 'Un processus possède déjà le journal.', 503);
      try { unlinkSync(join(root, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } catch (error) {
    if (existsSync(lock)) unlinkSync(lock);
    if (error.code === 'EEXIST') fail('STORE_LOCKED', 'Le journal est déjà verrouillé.', 503);
    throw error;
  }
  const close = () => {
    if (closed) return;
    closed = true;
    if (existsSync(lock)) unlinkSync(lock);
  };
  let initial;
  try {
    if (existsSync(target) && statSync(target).size > 32 * 1024 * 1024) fail('STORE_CORRUPT', 'Journal trop volumineux.', 500);
    initial = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : { schemaVersion: 1, runs: [], reservation: null };
    validateState(initial);
  } catch (error) { close(); if (error.code === 'STORE_CORRUPT') throw error; fail('STORE_CORRUPT', 'Impossible de lire le journal ; fichier conservé.', 500); }
  return {
    initial,
    commit(state) {
      if (closed || poisoned) fail('STORE_UNAVAILABLE', 'Journal fermé ou écriture précédente échouée.', 503);
      if (!existsSync(lock)) { poisoned = true; fail('STORE_UNAVAILABLE', 'Propriété du journal perdue.', 503); }
      validateState(state);
      const text = JSON.stringify(state);
      if (Buffer.byteLength(text) > 32 * 1024 * 1024) fail('STORE_FULL', 'Limite du journal atteinte.', 503);
      const temp = join(root, `${token}.tmp`);
      try {
        const fd = openSync(temp, 'w');
        try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
        renameSync(temp, target);
      } catch {
        poisoned = true;
        fail('STORE_UNAVAILABLE', 'Écriture atomique échouée ; moteur bloqué pour préserver le journal.', 503);
      }
    },
    close,
  };
}
