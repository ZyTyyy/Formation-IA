import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { createBridge, createCodexRunner, detectCli } from './bridge.mjs';
import { createOrchestrator } from './orchestrator.mjs';
import { createGenerationAdapter, GENERATION_LIMITS } from './generation-adapter.mjs';
import { createGenerationWorkspace } from './generation-workspace.mjs';
import { join } from 'node:path';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT doit être un entier entre 1024 et 65535.');
const binary = process.env.CODEX_BIN || 'codex';
const cli = detectCli(binary);
const bridge = createBridge({ enabled: process.env.CODEX_BRIDGE_ENABLED === '1', cliAvailable: cli.available, cliVersion: cli.version, runner: createCodexRunner({ binary, cwd }) });
const generationEnabled = process.env.FACTORY_GENERATION_ENABLED === '1';
const generationOptions = generationEnabled ? {
  adapter: createGenerationAdapter({ apiKey: process.env.OPENAI_API_KEY, model: process.env.FACTORY_GENERATION_MODEL }),
  workspace: createGenerationWorkspace(join(cwd, '.local', 'projects')),
  limits: GENERATION_LIMITS,
} : {};
const orchestrator = createOrchestrator({ directory: join(cwd, '.local', 'orchestrator'), ...generationOptions });
if (generationEnabled) console.warn('Génération API activée : jusqu’à 12 requêtes par projet, 180 s par mission et 18 min cumulées ; 16 384 tokens de sortie par requête. Aucun plafond monétaire garanti. Les commandes clientes restent désactivées.');
const server = createApp({ bridge, orchestrator, port });
server.listen(port, '127.0.0.1', () => console.log(`API locale : http://127.0.0.1:${port} — pont Codex ${bridge.health().bridgeEnabled ? 'activé (quota réel)' : 'désactivé'}`));
server.on('error', (error) => { orchestrator.close(); console.error(`API indisponible : ${error.code || error.message}`); process.exitCode = 1; });
const stop = () => { bridge.shutdown(); orchestrator.close(); server.close(); setTimeout(() => process.exit(), 1000).unref(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
