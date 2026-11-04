import { randomUUID } from 'node:crypto';
import { openJournal } from './orchestration-store.mjs';
import { buildMission, CHECKS, fail, fileFingerprint, hash, loadInstructions, permits, POLICIES, ROLES, validateEnvelope, validateResult } from './orchestration-contracts.mjs';

const stamp = () => new Date().toISOString();
const clone = (value) => structuredClone(value);
const latest = (mission) => mission.attempts.at(-1);
const runnable = (mission, index) => mission.state === 'accepted' || (index === 4 && mission.state === 'needs_changes');
const DEFAULTS = { timeoutMs: 120000, maxAttempts: 2, maxOutputBytes: 262144, maxTotalAttempts: 12, maxRunMs: 900000 };

/** An injected test adapter only. No CLI, shell, network or real workspace is exposed here. */
export function createOrchestrator({ directory, adapter = null, checkRunner = null, limits = {}, now = Date.now } = {}) {
  if (!directory) throw new Error('Répertoire de journal requis côté serveur.');
  if (adapter && (adapter.mode !== 'example' || typeof adapter.start !== 'function' || typeof adapter.confirmStopped !== 'function')) fail('INVALID_ADAPTER', 'Seul un adaptateur de test explicite avec confirmation d’arrêt est accepté.', 500);
  const config = { ...DEFAULTS, ...limits };
  if (Object.keys(limits).some((key) => !Object.hasOwn(DEFAULTS, key)) || Object.values(config).some((value) => !Number.isSafeInteger(value) || value < 1) || config.maxAttempts > 2) fail('INVALID_LIMITS', 'Limites serveur invalides.', 500);
  const instructions = loadInstructions();
  const journal = openJournal(directory);
  let state = journal.initial;
  let closed = false;
  let fatal = false;
  let handle = null;
  let timer = null;
  let resultCandidate = null;
  const findRun = (data, id) => data.runs.find((run) => run.id === id) || fail('RUN_NOT_FOUND', 'Exécution inconnue.', 404);
  const event = (run, type, detail = '', mission = null, attempt = 0) => {
    run.updatedAt = stamp();
    run.events.push({ id: randomUUID(), at: run.updatedAt, type, missionId: mission, attempt, detail: String(detail).slice(0, 1000) });
  };
  function change(operation) {
    if (closed || fatal) fail('ORCHESTRATOR_UNAVAILABLE', 'Moteur fermé ou bloqué par une erreur de persistance.', 503);
    const next = clone(state);
    const value = operation(next);
    try { journal.commit(next); } catch (error) { fatal = true; clearTimeout(timer); try { handle?.cancel(); } catch { /* Reservation remains durable. */ } throw error; }
    state = next;
    return value;
  }
  function locate(data, reservation) {
    const run = findRun(data, reservation.runId);
    const index = run.missions.findIndex((mission) => mission.id === reservation.missionId);
    const mission = run.missions[index];
    return { run, index, mission, attempt: mission.attempts[reservation.attempt - 1] };
  }
  function accountTime(run, attempt) {
    const elapsed = Math.max(attempt.chargedMs, now() - Date.parse(attempt.startedAt), 0);
    run.budget.elapsedMs += elapsed - attempt.chargedMs;
    attempt.chargedMs = elapsed;
  }
  if (state.reservation) {
    change((data) => {
      const { run, mission, attempt } = locate(data, data.reservation);
      accountTime(run, attempt);
      if (attempt.state === 'running') {
        attempt.state = 'unknown'; attempt.finishedAt = stamp(); attempt.errorCode = 'INTERRUPTED'; attempt.error = 'Issue inconnue après redémarrage ; aucun redémarrage automatique.';
        mission.state = 'unknown';
      }
      run.state = 'interrupted';
      event(run, 'recovery_required', 'Arrêt de l’ancienne exécution à confirmer avant nouvelle tentative.', mission.id, attempt.number);
    });
  } else if (state.runs.some((run) => ['running', 'pause_requested', 'cancel_requested'].includes(run.state))) {
    change((data) => {
      for (const run of data.runs) {
        if (!['running', 'pause_requested', 'cancel_requested'].includes(run.state)) continue;
        run.state = run.state === 'cancel_requested' ? 'cancelled' : 'paused';
        event(run, 'recovered_at_checkpoint', 'Reprise explicite requise au point de contrôle enregistré.');
      }
    });
  }
  function assertSlot() {
    if (state.reservation || state.runs.some((run) => ['running', 'pause_requested', 'cancel_requested'].includes(run.state))) fail('ORCHESTRATOR_BUSY', 'Une exécution ou un arrêt non confirmé réserve le moteur.');
  }
  function budgetAvailable(run) {
    return run.budget.usedAttempts < run.budget.maxTotalAttempts && run.budget.elapsedMs < run.budget.maxRunMs;
  }
  const validReservation = (reservation) => !closed && !fatal && state.reservation?.executionId === reservation.executionId;

  function failAttempt(reservation, code, message) {
    if (!validReservation(reservation)) return;
    change((data) => {
      const { run, mission, attempt } = locate(data, reservation);
      if (attempt.state !== 'running') return;
      accountTime(run, attempt);
      attempt.state = 'failed'; attempt.errorCode = code; attempt.error = String(message).slice(0, 2000); attempt.finishedAt = stamp();
      mission.state = 'failed'; run.state = run.state === 'cancel_requested' ? 'cancel_requested' : 'blocked';
      event(run, 'attempt_failed', `${code} : ${message}`, mission.id, attempt.number);
    });
  }
  function requestStop(reservation, code, message) {
    failAttempt(reservation, code, message);
    try { handle?.cancel(); } catch { /* Only onClose or trusted reconciliation can release the reservation. */ }
  }

  function toolsFor(reservation) {
    const current = () => {
      if (!validReservation(reservation)) fail('STALE_ATTEMPT', 'Tentative inactive.');
      const found = locate(state, reservation);
      if (found.attempt.state !== 'running' || found.run.state === 'cancel_requested') fail('STALE_ATTEMPT', 'La tentative ne peut plus utiliser d’outil.');
      if (!found.attempt.sessionId) fail('SESSION_REQUIRED', 'Le contrôleur doit identifier la session avant utilisation des outils.');
      return found;
    };
    return Object.freeze({
      // Test-only virtual content. Stage 4 must supply a real isolated workspace adapter.
      writeArtifact(path, content) {
        const { attempt } = current();
        if (!permits(attempt.mission.permissions.writePaths, path) || typeof content !== 'string') fail('WRITE_FORBIDDEN', 'Fichier hors de l’allocation.', 403);
        const bytes = Buffer.byteLength(content);
        if (bytes + attempt.outputBytes > attempt.mission.limits.maxOutputBytes) { requestStop(reservation, 'OUTPUT_LIMIT', 'Plafond de sortie atteint.'); fail('OUTPUT_LIMIT', 'Plafond de sortie atteint.'); }
        change((data) => {
          const { run, mission, attempt: entry } = locate(data, reservation);
          if (!Object.hasOwn(run.files, path) && Object.keys(run.files).length >= 256) fail('OUTPUT_LIMIT', 'Trop de fichiers.');
          run.files[path] = { content, revision: hash(content), producerMissionId: mission.id };
          if (!entry.partialArtifacts.some((file) => file.path === path && file.revision === hash(content))) {
            if (entry.partialArtifacts.length >= 4096) fail('OUTPUT_LIMIT', 'Trop de versions partielles.');
            entry.partialArtifacts.push({ path, revision: hash(content), content });
          }
          entry.outputBytes += bytes;
        });
      },
      readArtifact(path) {
        const { run, attempt } = current();
        if (!permits(attempt.mission.permissions.readPaths, path)) fail('READ_FORBIDDEN', 'Lecture hors allocation.', 403);
        if (!Object.hasOwn(run.files, path)) fail('MISSING_INPUT', 'Fichier absent.', 404);
        return clone(run.files[path]);
      },
      captureArtifacts(paths) {
        const { run, attempt } = current();
        if (!Array.isArray(paths) || paths.length > 256 || new Set(paths).size !== paths.length) fail('INVALID_CAPTURE', 'Liste de capture invalide.', 400);
        const captured = paths.map((path) => {
          if (!permits(attempt.mission.permissions.writePaths, path) || !Object.hasOwn(run.files, path)) fail('MISSING_ARTIFACT', 'Capture hors allocation ou fichier absent.');
          return { path, revision: run.files[path].revision, content: run.files[path].content };
        });
        change((data) => {
          const entry = locate(data, reservation).attempt;
          for (const file of captured) {
            const index = entry.captures.findIndex((item) => item.path === file.path);
            if (index === -1) entry.captures.push(file); else entry.captures[index] = file;
          }
        });
        return captured.map(({ path, revision }) => ({ path, revision }));
      },
      runCheck(commandId, criterionIds) {
        const { run, attempt } = current();
        if (!attempt.mission.permissions.commandIds.includes(commandId) || !CHECKS.includes(commandId) || !Array.isArray(criterionIds) || criterionIds.length !== 1 || criterionIds[0] !== commandId) fail('COMMAND_FORBIDDEN', 'Commande ou critères hors allocation.', 403);
        if (!checkRunner) return { status: 'not_run', evidenceId: null, revision: fileFingerprint(run.files, true) };
        const fingerprint = fileFingerprint(run.files, true);
        const outcome = checkRunner({ commandId, files: clone(run.files) });
        if (!outcome || !['passed', 'failed'].includes(outcome.status) || typeof outcome.log !== 'string' || Buffer.byteLength(outcome.log) > attempt.mission.limits.maxOutputBytes) fail('INVALID_CHECK', 'Résultat du contrôleur injecté invalide.');
        const logBytes = Buffer.byteLength(outcome.log);
        if (logBytes + current().attempt.outputBytes > attempt.mission.limits.maxOutputBytes) { requestStop(reservation, 'OUTPUT_LIMIT', 'Plafond cumulé de journaux atteint.'); fail('OUTPUT_LIMIT', 'Plafond cumulé de journaux atteint.'); }
        const id = randomUUID();
        change((data) => {
          const { run: draft, attempt: entry } = locate(data, reservation);
          if (draft.evidence.length >= 256) fail('OUTPUT_LIMIT', 'Trop de preuves.');
          entry.outputBytes += logBytes;
          draft.evidence.push({ id, missionId: entry.mission.missionId, attempt: entry.number, criterionId: commandId, commandId, status: outcome.status, fingerprint, at: stamp(), log: outcome.log, provenance: 'test-adapter' });
        });
        return { status: outcome.status, evidenceId: id, revision: fingerprint };
      },
      readEvidence(id) {
        const { run, attempt } = current();
        const allowed = [attempt.mission.missionId, ...attempt.mission.dependencies];
        const evidence = run.evidence.find((entry) => entry.id === id && allowed.includes(entry.missionId));
        if (!evidence) fail('EVIDENCE_FORBIDDEN', 'Preuve hors des entrées autorisées.', 403);
        return clone(evidence);
      },
    });
  }

  function onClose(reservation, exitCode) {
    if (!validReservation(reservation)) return;
    clearTimeout(timer); timer = null; handle = null;
    const candidate = resultCandidate; resultCandidate = null;
    change((data) => {
      const { run, index, mission, attempt } = locate(data, reservation);
      accountTime(run, attempt);
      attempt.closeConfirmed = true;
      data.reservation = null;
      if (attempt.state === 'running') {
        let error = null;
        try {
          if (attempt.chargedMs > attempt.mission.limits.timeoutMs || run.budget.elapsedMs > run.budget.maxRunMs) fail('TIMEOUT', 'Résultat reçu après la durée autorisée.');
          if (exitCode !== 0) fail('ADAPTER_FAILED', 'L’adaptateur n’a pas terminé avec succès.');
          if (!candidate) fail('INVALID_OUTPUT', 'Aucun résultat structuré reçu.');
          validateResult(run, index, attempt, candidate);
        } catch (caught) { error = caught; }
        if (error) {
          attempt.state = 'failed'; attempt.errorCode = error.code || 'INVALID_OUTPUT'; attempt.error = error.message;
          mission.state = 'failed'; run.state = 'blocked';
        } else {
          attempt.result = clone(candidate);
          attempt.acceptedFiles = clone(run.files);
          attempt.state = candidate.status === 'ready' ? 'accepted' : candidate.status;
          mission.state = attempt.state;
          if (!runnable(mission, index)) run.state = candidate.status === 'needs_changes' ? 'needs_changes' : 'blocked';
        }
        attempt.finishedAt = stamp();
      }
      if (run.state === 'cancel_requested') run.state = 'cancelled';
      else if (run.state === 'pause_requested') run.state = 'paused';
      event(run, 'attempt_closed', `${attempt.state} ; arrêt confirmé (code ${exitCode}).`, mission.id, attempt.number);
    });
    queueMicrotask(() => {
      try { pump(reservation.runId); } catch { fatal = true; /* Fail closed; durable checkpoint remains recoverable. */ }
    });
  }

  function pump(id) {
    if (closed || fatal || state.reservation) return;
    const run = findRun(state, id);
    if (run.state !== 'running') return;
    const index = run.missions.findIndex((mission, number) => !runnable(mission, number));
    if (index === -1) {
      change((data) => {
        const draft = findRun(data, id);
        draft.state = draft.missions.some((mission) => mission.state === 'needs_changes') ? 'needs_changes' : 'completed';
        event(draft, 'pipeline_finished', 'Pipeline injecté terminé ; aucune application réelle validée.');
      });
      return;
    }
    const task = run.missions[index];
    if (task.state !== 'queued') return;
    if (!budgetAvailable(run) || task.attempts.length >= run.limits.maxAttempts) {
      change((data) => { const draft = findRun(data, id); draft.state = 'blocked'; event(draft, 'budget_exhausted', 'Plafond de durée ou de tentatives atteint.'); });
      return;
    }
    const mission = buildMission(run, index, task.attempts.length + 1);
    validateEnvelope('mission', mission);
    const executionId = randomUUID();
    const reservation = { runId: id, missionId: task.id, attempt: mission.attempt, executionId };
    change((data) => {
      const draft = findRun(data, id);
      draft.budget.usedAttempts++;
      draft.missions[index].state = 'running';
      draft.missions[index].attempts.push({ number: mission.attempt, executionId, sessionId: null, chargedMs: 0, mission, startedAt: new Date(now()).toISOString(), finishedAt: null, state: 'running', error: null, errorCode: null, result: null, closeConfirmed: false, outputBytes: 0, partialOutput: '', captures: [], partialArtifacts: [], acceptedFiles: null });
      data.reservation = reservation;
      event(draft, 'attempt_started', `Instructions ${draft.instructions.roles[task.role].hash}`, task.id, mission.attempt);
    });
    resultCandidate = null;
    timer = setTimeout(() => requestStop(reservation, 'TIMEOUT', 'Durée maximale dépassée ; arrêt à confirmer.'), Math.min(run.limits.timeoutMs, run.budget.maxRunMs - run.budget.elapsedMs));
    timer.unref?.();
    try {
      const activeHandle = adapter.start({
        executionId, mission: clone(mission), instructions: { global: run.instructions.global, contract: run.instructions.contract, role: run.instructions.roles[task.role].text, hash: run.instructions.roles[task.role].hash },
        tools: toolsFor(reservation),
        onSession: (sessionId) => {
          if (!validReservation(reservation)) return;
          const { run: currentRun, attempt } = locate(state, reservation);
          if (attempt.state !== 'running') return;
          if (attempt.sessionId || typeof sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/.test(sessionId) || currentRun.missions.some((entry) => entry.attempts.some((item) => item.sessionId === sessionId))) {
            requestStop(reservation, 'INDEPENDENCE_VIOLATION', 'Session invalide ou déjà utilisée.'); return;
          }
          change((data) => { locate(data, reservation).attempt.sessionId = sessionId; });
        },
        onResult: (value) => {
          if (!validReservation(reservation) || locate(state, reservation).attempt.state !== 'running') return;
          try {
            const text = typeof value === 'string' ? value : JSON.stringify(value);
            if (Buffer.byteLength(text) + locate(state, reservation).attempt.outputBytes > mission.limits.maxOutputBytes) fail('OUTPUT_LIMIT', 'Résultat trop volumineux.');
            if (locate(state, reservation).attempt.partialOutput) fail('INVALID_OUTPUT', 'Plusieurs résultats finaux reçus pour une seule tentative.');
            change((data) => { const { attempt } = locate(data, reservation); attempt.partialOutput = text; attempt.outputBytes += Buffer.byteLength(text); });
            const parsed = JSON.parse(text);
            validateEnvelope('result', parsed);
            resultCandidate = parsed;
          } catch (error) { requestStop(reservation, error.code || 'INVALID_OUTPUT', error.message); }
        },
        onError: (message) => requestStop(reservation, 'ADAPTER_FAILED', String(message)),
        onClose: (code) => onClose(reservation, code),
      });
      if (validReservation(reservation)) {
        if (!activeHandle || typeof activeHandle.cancel !== 'function') fail('INVALID_ADAPTER', 'Poignée d’arrêt absente.');
        handle = activeHandle;
        if (locate(state, reservation).attempt.state !== 'running') { try { handle.cancel(); } catch { /* Keep reservation. */ } }
      }
    } catch (error) { requestStop(reservation, error.code || 'ADAPTER_FAILED', error.message); }
  }

  function activate(id, retry = false) {
    if (!adapter) fail('ORCHESTRATOR_UNAVAILABLE', 'Aucun adaptateur injecté. La génération réelle n’est pas disponible.', 503);
    assertSlot();
    const run = findRun(state, id);
    if (!budgetAvailable(run)) fail('BUDGET_EXHAUSTED', 'Plafond global atteint ; aucune relance automatique.');
    if (retry) {
      if (!['blocked', 'interrupted'].includes(run.state)) fail('INVALID_TRANSITION', 'Cette exécution ne peut pas être retentée.');
      const task = run.missions.find((mission, index) => !runnable(mission, index));
      if (!task || task.attempts.length >= run.limits.maxAttempts) fail('ATTEMPTS_EXHAUSTED', 'Plafond de tentatives de cette mission atteint.');
    } else if (!['draft', 'paused'].includes(run.state)) fail('INVALID_TRANSITION', 'Démarrage ou reprise impossible dans cet état.');
    change((data) => {
      const draft = findRun(data, id);
      if (retry) draft.missions.find((mission, index) => !runnable(mission, index)).state = 'queued';
      draft.state = 'running'; event(draft, retry ? 'retry_requested' : 'run_started');
    });
    pump(id);
    return api.find(id);
  }

  const api = {
    health: () => ({ available: !!adapter && !fatal && !closed, mode: adapter ? 'example' : null, persistence: 'local-json', maxConcurrency: 1, liveGeneration: false, monetaryUsageMeasured: false, limits: clone(config), reservation: clone(state.reservation), blocked: fatal || !!state.reservation && locate(state, state.reservation).attempt.state !== 'running' }),
    list: () => state.runs.map(({ id, projectId, brief, mode, state: status, createdAt, updatedAt }) => ({ id, projectId, brief, mode, state: status, createdAt, updatedAt })),
    find: (id) => ({ ...clone(findRun(state, id)), deliveryVerified: false }),
    create(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.brief !== 'string' || input.brief.trim().length < 10 || input.brief.length > 12000) fail('INVALID_BRIEF', 'Seul un brief de 10 à 12 000 caractères est accepté.', 400);
      if (state.runs.length >= 100) fail('STORE_FULL', 'Limite de 100 exécutions atteinte ; aucun historique supprimé automatiquement.', 503);
      const id = randomUUID();
      change((data) => {
        const run = { id, projectId: randomUUID(), workspaceId: randomUUID(), brief: input.brief.trim(), mode: 'example', state: 'draft', createdAt: stamp(), updatedAt: stamp(),
          budget: { maxTotalAttempts: config.maxTotalAttempts, maxRunMs: config.maxRunMs, usedAttempts: 0, elapsedMs: 0 },
          limits: { timeoutMs: config.timeoutMs, maxAttempts: config.maxAttempts, maxOutputBytes: config.maxOutputBytes },
          instructions: clone(instructions), files: {}, evidence: [], events: [],
          missions: ROLES.map((role) => ({ id: randomUUID(), role, state: 'queued', attempts: [] })),
        };
        event(run, 'run_created', 'Pipeline de test ; aucune exécution modèle réelle.');
        data.runs.push(run);
      });
      return api.find(id);
    },
    start: (id) => { if (findRun(state, id).state !== 'draft') fail('INVALID_TRANSITION', 'Le projet a déjà démarré.'); return activate(id); },
    resume: (id) => { if (findRun(state, id).state !== 'paused') fail('INVALID_TRANSITION', 'La reprise exige une pause effective.'); return activate(id); },
    retry: (id) => activate(id, true),
    pause(id) {
      const run = findRun(state, id);
      if (run.state !== 'running') fail('INVALID_TRANSITION', 'Seule une exécution active peut être mise en pause.');
      change((data) => {
        const draft = findRun(data, id);
        draft.state = data.reservation?.runId === id ? 'pause_requested' : 'paused';
        event(draft, 'pause_requested', 'Aucune nouvelle mission avant reprise explicite.');
      });
      return api.find(id);
    },
    cancel(id) {
      const run = findRun(state, id);
      if (['cancelled', 'completed'].includes(run.state)) fail('INVALID_TRANSITION', 'Exécution déjà terminale.');
      change((data) => { const draft = findRun(data, id); draft.state = data.reservation?.runId === id ? 'cancel_requested' : 'cancelled'; event(draft, 'cancel_requested'); });
      if (state.reservation?.runId === id) requestStop(clone(state.reservation), 'CANCELLED', 'Annulation demandée ; arrêt à confirmer.');
      return api.find(id);
    },
    reconcile(id) {
      const run = findRun(state, id);
      const reservation = state.reservation;
      if (!reservation || reservation.runId !== id || !['interrupted', 'blocked', 'cancel_requested'].includes(run.state)) fail('INVALID_TRANSITION', 'Aucun arrêt inconnu à réconcilier.');
      if (!adapter || adapter.confirmStopped(reservation.executionId) !== true) fail('SHUTDOWN_UNCONFIRMED', 'Le contrôleur ne confirme pas l’arrêt. Le moteur reste réservé.');
      clearTimeout(timer); timer = null; handle = null; resultCandidate = null;
      change((data) => {
        const { run: draft, mission, attempt } = locate(data, reservation);
        accountTime(draft, attempt);
        if (attempt.state === 'running') { attempt.state = 'unknown'; mission.state = 'unknown'; attempt.finishedAt = stamp(); }
        attempt.closeConfirmed = true;
        draft.state = draft.state === 'cancel_requested' ? 'cancelled' : 'blocked';
        data.reservation = null;
        event(draft, 'shutdown_reconciled', 'Arrêt confirmé par le contrôleur ; nouvelle tentative explicite nécessaire.', mission.id, attempt.number);
      });
      return api.find(id);
    },
    close() {
      if (closed) return;
      // Persist the reservation; restart must verify termination, even after graceful shutdown.
      clearTimeout(timer);
      closed = true;
      try { handle?.cancel(); } catch { /* Recovery remains explicit. */ }
      journal.close();
    },
  };
  return api;
}
