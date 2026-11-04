import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'smol-toml';
import { BridgeError } from './bridge.mjs';

export const ROLES = ['product_manager', 'ux_designer', 'software_architect', 'fullstack_developer', 'qa_engineer', 'code_reviewer'];
export const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const fail = (code, message, status = 409) => { throw new BridgeError(status, code, message); };
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
// The v1 schemas deliberately use conditional fragments without repeated type declarations.
const ajv = new Ajv2020({ allErrors: true, strict: false, ownProperties: true });
export const missionSchema = JSON.parse(read('contracts/agent-mission.schema.json'));
export const resultSchema = JSON.parse(read('contracts/agent-result.schema.json'));
const validators = { mission: ajv.compile(missionSchema), result: ajv.compile(resultSchema) };
export function validateEnvelope(kind, value) {
  if (!validators[kind](value)) fail('INVALID_OUTPUT', `Contrat ${kind} invalide : ${ajv.errorsText(validators[kind].errors).slice(0, 1000)}`, 400);
}
export const validPath = (path) => typeof path === 'string' && path.length <= 240 && new RegExp(resultSchema.properties.artifacts.items.properties.path.pattern).test(path);
export const permits = (paths, path) => validPath(path) && paths.some((allowed) => allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed);

export function loadInstructions() {
  const global = read('AGENTS.md');
  const contract = read('docs/AGENT-CONTRACTS.md');
  const roles = {};
  for (const role of ROLES) {
    const source = read(`.codex/agents/${role}.toml`);
    const parsed = parse(source);
    if (parsed.name !== role || typeof parsed.developer_instructions !== 'string' || !parsed.developer_instructions.trim()) fail('INVALID_ROLE_CONFIG', `Instructions invalides : ${role}.`, 500);
    roles[role] = { text: parsed.developer_instructions, hash: hash(source) };
  }
  return { global, contract, roles, hash: hash({ global, contract, roles }) };
}

const DOCS = ['docs/PRODUCT.md', 'docs/UX.md', 'docs/ARCHITECTURE.md', 'docs/CAPABILITIES.md'];
const CODE = ['src/', 'tests/', 'public/', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'tailwind.config.js', 'postcss.config.js', 'README.md'];
export const CHECKS = ['typecheck', 'test', 'build', 'browser-check'];
export const POLICIES = [
  { read: [], write: [DOCS[0]], expected: [DOCS[0]] },
  { read: DOCS.slice(0, 1), write: [DOCS[1]], expected: [DOCS[1]] },
  { read: DOCS.slice(0, 2), write: DOCS.slice(2), expected: DOCS.slice(2) },
  { read: [...DOCS, ...CODE], write: CODE, expected: ['src/', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'README.md'] },
  { read: [...DOCS, ...CODE], write: ['tests/', 'docs/QA.md'], expected: ['docs/QA.md'], checks: CHECKS },
  { read: [...DOCS, ...CODE, 'docs/QA.md'], write: ['docs/REVIEW.md'], expected: ['docs/REVIEW.md'] },
];

export const fileFingerprint = (files, sourceOnly = false) => hash(Object.keys(files).filter((path) => !sourceOnly || !path.startsWith('docs/')).sort().map((path) => [path, files[path].revision]));

export function buildMission(run, index, attempt) {
  const policy = POLICIES[index];
  const inputs = Object.entries(run.files).filter(([path]) => permits(policy.read, path)).map(([path, file]) => ({ path, revision: file.revision, producerMissionId: file.producerMissionId }));
  return {
    contractVersion: 1, mode: 'example', context: 'application', workspaceId: run.workspaceId,
    projectId: run.projectId, runId: run.id, missionId: run.missions[index].id, attempt,
    role: ROLES[index], purpose: attempt === 1 ? 'initial' : 'correction',
    objective: `Produire les livrables du rôle ${ROLES[index]} dans le pipeline de test injecté.`, brief: run.brief,
    inputRevision: fileFingerprint(run.files), inputs, dependencies: run.missions.slice(0, index).map((mission) => mission.id),
    permissions: { readPaths: [...policy.read], writePaths: [...policy.write], commandIds: [...(policy.checks || [])] },
    expectedArtifacts: [...policy.expected],
    acceptanceCriteria: (policy.checks || ['deliverable']).map((id) => ({ id, description: id === 'deliverable' ? 'Livrables requis présents et cohérents avec les entrées.' : `Contrôle ${id} requis sur la version courante.` })),
    limits: { ...run.limits },
    mustDifferFromExecutionIds: index === 5 ? run.missions.slice(3, 5).flatMap((mission) => mission.attempts.map((entry) => entry.sessionId).filter(Boolean)) : [],
  };
}

export function validateResult(run, index, attempt, result) {
  validateEnvelope('result', result);
  const mission = attempt.mission;
  for (const key of ['contractVersion', 'mode', 'missionId', 'attempt', 'role', 'inputRevision']) {
    if (result[key] !== mission[key]) fail('RESULT_MISMATCH', `Le résultat ne correspond pas à la mission (${key}).`);
  }
  if (['blocked', 'failed'].includes(result.status)) return;
  if (new Set(result.artifacts.map((item) => item.path)).size !== result.artifacts.length) fail('INVALID_OUTPUT', 'Livrables dupliqués.');
  for (const input of mission.inputs) {
    if (!permits(mission.permissions.writePaths, input.path) && run.files[input.path]?.revision !== input.revision) fail('STALE_INPUT', 'Une entrée de référence a changé.');
  }
  for (const artifact of result.artifacts) {
    const captured = attempt.captures.find((item) => item.path === artifact.path && item.revision === artifact.revision);
    if (!permits(mission.permissions.writePaths, artifact.path) || !captured || !captured.content.trim() || run.files[artifact.path]?.revision !== artifact.revision) fail('MISSING_ARTIFACT', 'Livrable absent, non capturé, périmé ou hors allocation.');
  }
  for (const expected of mission.expectedArtifacts) {
    if (!result.artifacts.some((artifact) => permits([expected], artifact.path))) fail('MISSING_ARTIFACT', `Livrable obligatoire absent : ${expected}.`);
  }
  const criteria = new Set(mission.acceptanceCriteria.map((item) => item.id));
  if (new Set(result.checks.map((check) => check.criterionId)).size !== result.checks.length) fail('INVALID_OUTPUT', 'Contrôles dupliqués.');
  for (const check of result.checks) {
    if (!criteria.has(check.criterionId)) fail('INVALID_EVIDENCE', 'Critère inconnu.');
    if (check.status === 'not_run') continue;
    const evidence = run.evidence.find((entry) => entry.id === check.evidenceId);
    if (!evidence || evidence.provenance !== 'test-adapter' || evidence.missionId !== mission.missionId || evidence.attempt !== mission.attempt || evidence.criterionId !== check.criterionId || evidence.status !== check.status || evidence.fingerprint !== fileFingerprint(run.files, true)) fail('INVALID_EVIDENCE', 'Preuve absente, périmée ou incompatible avec la mission.');
  }
  if (index === 4 && result.status === 'ready' && [...criteria].some((id) => !result.checks.some((check) => check.criterionId === id && check.status === 'passed'))) fail('VERIFICATION_REQUIRED', 'Les quatre contrôles QA sont requis.');
  if (!attempt.sessionId || (index === 5 && mission.mustDifferFromExecutionIds.includes(attempt.sessionId))) fail('INDEPENDENCE_VIOLATION', 'Session absente ou session auteur réutilisée par le reviewer.');
}

export const compileSchema = (schema) => ajv.compile(schema);
