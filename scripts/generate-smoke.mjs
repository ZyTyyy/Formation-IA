import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { createGenerationAdapter, GENERATION_LIMITS, PROVIDER_LIMITS } from '../server/generation-adapter.mjs';
import { createGenerationWorkspace } from '../server/generation-workspace.mjs';
import { createOrchestrator } from '../server/orchestrator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.length === 3 && process.argv[2] === '--check';
const runRequested = process.argv.length === 3 && process.argv[2] === '--run';
if (!checkOnly && !runRequested) {
  console.error('Usage : node scripts/generate-smoke.mjs --check | --run');
  process.exitCode = 2;
} else {
  const prerequisites = {
    enabled: process.env.FACTORY_GENERATION_ENABLED === '1',
    apiKeyPresent: !!process.env.OPENAI_API_KEY?.trim(),
    modelConfigured: !!process.env.FACTORY_GENERATION_MODEL?.trim(),
  };
  console.log(JSON.stringify({ prerequisites, limits: GENERATION_LIMITS, providerLimits: PROVIDER_LIMITS, monetaryUsageMeasured: false }, null, 2));
  if (Object.values(prerequisites).some((value) => !value)) {
    console.error('Génération désactivée ou configuration incomplète. Aucun appel API effectué.');
    process.exitCode = 2;
  } else if (!checkOnly) {
    console.warn('Essai réel facturable : au maximum 12 requêtes, sans plafond monétaire garanti. Sources transmises à OpenAI. Aucun test client, installation ou aperçu exécuté.');
    const adapter = createGenerationAdapter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.FACTORY_GENERATION_MODEL });
    const workspace = createGenerationWorkspace(join(root, '.local', 'projects'));
    const engine = createOrchestrator({ directory: join(root, '.local', 'orchestrator'), adapter, workspace, limits: GENERATION_LIMITS });
    let run;
    const stop = () => { if (run && !['cancelled', 'completed'].includes(engine.find(run.id).state)) engine.cancel(run.id); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
      run = engine.create({ brief: 'Créer une application React, TypeScript et Tailwind de suivi des dépenses personnelles en EUR, sans backend ni compte. Ajouter, modifier et supprimer une dépense avec date civile, libellé, montant positif à deux décimales et catégorie. Afficher le total et un filtre mensuel. Persister sur cet appareil, valider le stockage et gérer stockage corrompu ou refusé. Interface française accessible au clavier et mobile ; prévoir les tests métier et de persistance.' });
      console.log(`Exécution : ${run.id}`);
      engine.start(run.id);
      while (['running', 'pause_requested', 'cancel_requested'].includes(engine.find(run.id).state) || engine.health().reservation?.runId === run.id) await setTimeout(200);
      const final = engine.find(run.id);
      const path = Object.keys(final.files).length ? workspace.verify(final.workspaceId, final.files) : null;
      console.log(JSON.stringify({ runId: final.id, state: final.state, roles: final.missions.map(({ role, state }) => ({ role, state })), snapshot: path, deliveryVerified: false, providerResponses: final.events.filter(({ type }) => type === 'provider_response').map(({ detail }) => JSON.parse(detail)) }, null, 2));
      // QA is expected to be blocked until stage 5; never report success as delivery.
      if (final.missions[3].state !== 'accepted') process.exitCode = 1;
    } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); engine.close(); }
  }
}
