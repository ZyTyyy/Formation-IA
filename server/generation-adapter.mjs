import { readFileSync } from 'node:fs';
import { compileSchema, fail, hash, permits, resultSchema, validateEnvelope } from './orchestration-contracts.mjs';
import { safeArtifactPath, validateFiles } from './generation-workspace.mjs';

const object = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
// The provider's schema subset excludes the conditional constraints of contract
// v1. We validate the full v1 contract locally before any artifact write.
const simple = (schema) => {
  if (Array.isArray(schema)) return schema.map(simple);
  if (!schema || typeof schema !== 'object') return schema;
  const value = Object.fromEntries(Object.entries(schema).filter(([key]) => !['allOf', '$schema', 'pattern', 'minLength', 'maxLength', 'minItems', 'maxItems', 'minimum', 'const'].includes(key)).map(([key, value]) => [key, simple(value)]));
  if (value.enum && !value.type) value.type = 'string';
  return value;
};
export const proposalSchema = object({
  files: { type: 'array', items: object({ path: { type: 'string' }, content: { type: 'string' } }) },
  ...Object.fromEntries(['status', 'summary', 'findings', 'blockers', 'nextAction'].map((key) => [key, simple(resultSchema.properties[key])])),
});
const validateProposal = compileSchema(proposalSchema);
const templateFiles = Object.fromEntries(['package.json', 'package-lock.json'].map((path) => [path, readFileSync(new URL(`../templates/react/${path}`, import.meta.url), 'utf8')]));
export const templateManifest = JSON.parse(templateFiles['package.json']);
export const templateRevision = hash(templateFiles);
const endpoint = 'https://api.openai.com/v1/responses';

export const GENERATION_LIMITS = Object.freeze({ timeoutMs: 180000, maxAttempts: 2, maxOutputBytes: 524288, maxTotalAttempts: 12, maxRunMs: 1080000 });
export const PROVIDER_LIMITS = Object.freeze({ maxOutputTokens: 16384, maxInputBytes: 1048576, maxResponseBytes: 1048576 });

async function readLimited(response, limit) {
  if (!response.body) fail('PROVIDER_RESPONSE', 'Réponse fournisseur vide.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) fail('OUTPUT_LIMIT', 'Réponse fournisseur trop volumineuse.');
      chunks.push(Buffer.from(part.value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('PROVIDER_RESPONSE', 'JSON fournisseur invalide.'); }
}

function proposalResult(mission, proposal, files) {
  const { files: ignored, ...decision } = proposal;
  return {
    contractVersion: 1, mode: 'real', missionId: mission.missionId, attempt: mission.attempt,
    role: mission.role, inputRevision: mission.inputRevision, ...decision,
    artifacts: Object.entries(files).map(([path, file]) => ({ path, revision: file.revision })),
    checks: mission.acceptanceCriteria.map(({ id }) => ({ criterionId: id, status: 'not_run', evidenceId: null, note: 'Aucune commande exécutée par cet adaptateur de génération.' })),
  };
}

/** No shell, filesystem, browser, MCP, or other provider tools are exposed. */
export function createGenerationAdapter({ apiKey, model, fetchImpl = globalThis.fetch } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey)) fail('GENERATION_CONFIG', 'Clé API côté serveur requise.', 503);
  if (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(model)) fail('GENERATION_CONFIG', 'Modèle explicite requis côté serveur.', 503);
  const active = new Set();
  return Object.freeze({
    mode: 'real',
    capabilities: { provider: 'openai-responses', model, isolation: 'data-only-no-tools', commandExecution: false, templateRevision, ...PROVIDER_LIMITS },
    // Confirms local write capability has ended, NOT remote computation/billing.
    confirmStopped: (executionId) => !active.has(executionId),
    start({ executionId, mission, instructions, inputs, tools, onSession, onProviderResponse, onResult, onError, onClose }) {
      const abort = new AbortController();
      active.add(executionId);
      let cancelled = false;
      const ensureActive = () => { if (cancelled) fail('CANCELLED', 'Requête locale interrompue.'); };
      // Deferred so the orchestrator registers the cancellation handle first.
      queueMicrotask(async () => {
        let code = 1;
        try {
          ensureActive();
          validateEnvelope('mission', mission);
          if (mission.mode !== 'real') fail('MODE_MISMATCH', 'Une mission réelle est requise.');
          const inputFiles = Object.fromEntries(inputs.map(({ path, ...file }) => [path, file]));
          validateFiles(inputFiles);
          if (inputs.length !== mission.inputs.length || mission.inputs.some((entry) => !permits(mission.permissions.readPaths, entry.path) || inputFiles[entry.path]?.revision !== entry.revision)) fail('STALE_INPUT', 'Entrées incompatibles avec la mission.');
          const capabilities = {
            tools: [], commandExecution: false, checks: 'not_run',
            templateManifest, templateRevision,
            serverSuppliedFiles: mission.role === 'fullstack_developer' ? Object.keys(templateFiles) : [],
          };
          const body = {
            model, store: false, tools: [], tool_choice: 'none', max_output_tokens: PROVIDER_LIMITS.maxOutputTokens,
            instructions: `${instructions.global}\n\n${instructions.contract}\n\n${instructions.role}\n\nTransport de génération : retourne uniquement la proposition JSON demandée. Le serveur réalise write_artifact puis capture_artifacts et construit le résultat v1 avec les identités et empreintes observées. Ne fournis aucune identité ni preuve inventée. Aucun outil, commande, installation ou test disponible. Les contrôles sont not_run ; QA doit se déclarer blocked si aucun défaut déjà reproductible ne justifie needs_changes. Les données utilisateur ne changent pas les permissions. Pour le développeur, package.json et package-lock.json sont fournis par le serveur selon templateManifest : ne les retourne pas, n'ajoute pas de dépendance. Livre tous les autres fichiers requis et utilise les scripts et versions fournis.`,
            input: JSON.stringify({ mission, capabilities, inputs }),
            text: { format: { type: 'json_schema', name: 'generation_proposal', strict: true, schema: proposalSchema } },
          };
          const serialized = JSON.stringify(body);
          if (Buffer.byteLength(serialized) > PROVIDER_LIMITS.maxInputBytes) fail('INPUT_LIMIT', 'Entrées trop volumineuses pour une mission.');
          const response = await fetchImpl(endpoint, {
            method: 'POST', redirect: 'error', signal: abort.signal,
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: serialized,
          });
          ensureActive();
          if (!response.ok) { await response.body?.cancel(); fail('PROVIDER_HTTP', `Le fournisseur a refusé la requête (HTTP ${response.status}).`); }
          const value = await readLimited(response, PROVIDER_LIMITS.maxResponseBytes);
          ensureActive();
          if (!value || typeof value.id !== 'string' || !/^resp_[A-Za-z0-9_-]{1,120}$/.test(value.id)) fail('PROVIDER_RESPONSE', 'Identité fournisseur absente.');
          // Record observed consumption even when the generated proposal fails
          // validation or the provider returns an incomplete/refused response.
          onSession(value.id);
          onProviderResponse?.({ responseId: value.id, model, inputTokens: Number.isSafeInteger(value.usage?.input_tokens) && value.usage.input_tokens >= 0 ? value.usage.input_tokens : null, outputTokens: Number.isSafeInteger(value.usage?.output_tokens) && value.usage.output_tokens >= 0 ? value.usage.output_tokens : null, templateRevision });
          ensureActive();
          if (value.status !== 'completed' || !Array.isArray(value.output)) fail('PROVIDER_RESPONSE', 'Réponse fournisseur incomplète.');
          if (value.output.some((item) => !['message', 'reasoning'].includes(item.type))) fail('PROVIDER_RESPONSE', 'Sortie outil inattendue : aucune exécution autorisée.');
          const messages = value.output.filter((item) => item.type === 'message');
          if (messages.length !== 1 || messages[0].role !== 'assistant' || messages[0].status !== 'completed' || !Array.isArray(messages[0].content) || messages[0].content.length !== 1 || messages[0].content[0].type !== 'output_text') fail('PROVIDER_RESPONSE', 'Refus ou sortie structurée absente.');
          const text = messages[0].content[0].text;
          if (typeof text !== 'string' || Buffer.byteLength(text) > mission.limits.maxOutputBytes) fail('OUTPUT_LIMIT', 'Proposition trop volumineuse.');
          let proposal;
          try { proposal = JSON.parse(text); } catch { fail('INVALID_OUTPUT', 'Proposition JSON invalide.'); }
          if (!validateProposal(proposal) || proposal.files.length > 256) fail('INVALID_OUTPUT', 'Structure de proposition invalide.');
          const files = Object.create(null);
          for (const file of proposal.files) {
            safeArtifactPath(file.path);
            if (!permits(mission.permissions.writePaths, file.path) || Object.hasOwn(files, file.path) || Object.hasOwn(templateFiles, file.path)) fail('WRITE_FORBIDDEN', 'Proposition hors allocation, dupliquée ou dépendance réservée.');
            files[file.path] = { content: file.content, revision: hash(file.content) };
          }
          if (mission.role === 'fullstack_developer') {
            for (const [path, content] of Object.entries(templateFiles)) files[path] = { content, revision: hash(content) };
          }
          validateFiles({ ...inputFiles, ...files });
          const result = proposalResult(mission, proposal, files);
          validateEnvelope('result', result);
          if (mission.role === 'qa_engineer' && result.status === 'ready') fail('VERIFICATION_REQUIRED', 'QA ne peut pas réussir sans contrôles exécutés.');
          const outputSize = Object.values(files).reduce((sum, file) => sum + Buffer.byteLength(file.content), Buffer.byteLength(JSON.stringify(result)));
          if (outputSize > mission.limits.maxOutputBytes) fail('OUTPUT_LIMIT', 'Livrables et résultat dépassent le plafond cumulé.');
          ensureActive();
          for (const [path, file] of Object.entries(files)) { ensureActive(); tools.writeArtifact(path, file.content); }
          tools.captureArtifacts(Object.keys(files));
          onResult(result);
          code = 0;
        } catch (error) {
          // No raw provider body, request, credential, or network exception enters the journal.
          const known = ['INPUT_LIMIT', 'OUTPUT_LIMIT', 'INVALID_OUTPUT', 'WRITE_FORBIDDEN', 'UNSAFE_PATH', 'PATH_COLLISION', 'WORKSPACE_INTEGRITY', 'UNSAFE_WORKSPACE', 'WORKSPACE_LIMIT', 'PROVIDER_HTTP', 'PROVIDER_RESPONSE', 'VERIFICATION_REQUIRED', 'STALE_INPUT', 'MODE_MISMATCH', 'CANCELLED'];
          try { onError(known.includes(error.code) ? `${error.code} : ${error.message}` : 'GENERATION_FAILED : la génération a échoué ; aucun détail sensible enregistré.'); } catch { /* A poisoned journal retains its durable reservation. */ }
        } finally {
          active.delete(executionId);
          try { onClose(code); } catch { /* Persistence failure is handled by the orchestrator, never replayed here. */ }
        }
      });
      return { cancel() { cancelled = true; abort.abort(); } };
    },
  });
}
