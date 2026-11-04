import { createServer } from 'node:http';
import { BridgeError } from './bridge.mjs';

const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

export function createApp({ bridge, orchestrator = null, port = 4318 }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, '127.0.0.1:5173', 'localhost:5173']);
  return createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 16384 }, async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    try {
      if (!allowedHosts.has(req.headers.host)) throw new BridgeError(403, 'INVALID_HOST', 'Hôte non autorisé.');
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) throw new BridgeError(403, 'INVALID_ORIGIN', 'Origine non autorisée.');
      // Same-origin development proxy is supported; cross-origin direct calls are not enabled.
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/v1/')) {
        if (!orchestrator) throw new BridgeError(503, 'ORCHESTRATOR_UNAVAILABLE', 'Orchestrateur local absent.');
        if (req.method === 'GET' && url.pathname === '/api/v1/orchestration') return send(200, orchestrator.health());
        if (req.method === 'GET' && url.pathname === '/api/v1/runs') return send(200, { runs: orchestrator.list() });
        const runMatch = /^\/api\/v1\/runs\/([a-f0-9-]{36})(?:\/(start|pause|resume|cancel|retry|reconcile))?$/.exec(url.pathname);
        if (req.method === 'GET' && runMatch && !runMatch[2]) return send(200, orchestrator.find(runMatch[1]));
        if (req.method === 'POST' && (url.pathname === '/api/v1/runs' || runMatch?.[2])) {
          const input = await readJson(req);
          if (url.pathname === '/api/v1/runs') return send(201, orchestrator.create(input));
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new BridgeError(400, 'UNKNOWN_FIELD', 'Cette action attend un objet JSON vide.');
          return send(202, orchestrator[runMatch[2]](runMatch[1]));
        }
        return send(404, { error: { code: 'NOT_FOUND', message: 'Route inconnue.' } });
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, bridge.health());
      const match = /^\/api\/jobs\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (req.method === 'GET' && match) return send(200, bridge.find(match[1]));
      if (req.method === 'POST' && url.pathname === '/api/jobs') {
        const input = await readJson(req);
        return send(202, bridge.start(input));
      }
      return send(404, { error: { code: 'NOT_FOUND', message: 'Route inconnue.' } });
    } catch (error) {
      send(error instanceof BridgeError ? error.status : 500, { error: { code: error instanceof BridgeError ? error.code : 'INTERNAL_ERROR', message: error instanceof BridgeError ? error.message : 'Erreur interne du serveur.' } });
    }
  });
}

async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BridgeError(415, 'JSON_REQUIRED', 'Le corps doit être au format application/json.');
  if (Number(req.headers['content-length']) > 65536) throw new BridgeError(413, 'BODY_TOO_LARGE', 'Corps de requête trop volumineux.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new BridgeError(413, 'BODY_TOO_LARGE', 'Corps de requête trop volumineux.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new BridgeError(400, 'INVALID_JSON', 'Le JSON est invalide.'); }
}
