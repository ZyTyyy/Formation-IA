import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, fileFingerprint, hash, validPath } from './orchestration-contracts.mjs';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const forbidden = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i;
export function safeArtifactPath(path) {
  if (!validPath(path) || path.split('/').some((part) => part.startsWith('.') || part.endsWith('.') || forbidden.test(part) || ['node_modules', '__proto__', 'prototype', 'constructor'].includes(part.toLowerCase()))) {
    fail('UNSAFE_PATH', 'Chemin de fichier non portable ou réservé.', 400);
  }
  return path;
}

// Only the trusted server writes here. No generated program or model tool runs
// on the host. This is NOT a sandbox against another hostile local OS process.
function directory(path, create = false) {
  const absolute = resolve(path);
  const parent = dirname(absolute);
  if (parent !== absolute) directory(parent, create);
  let stat;
  try { stat = lstatSync(absolute); } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    mkdirSync(absolute);
    stat = lstatSync(absolute);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(absolute).toLowerCase() !== absolute.toLowerCase()) fail('UNSAFE_WORKSPACE', 'Répertoire lié ou non canonique refusé.');
  return absolute;
}

export function validateFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length > 256) fail('WORKSPACE_LIMIT', 'Manifeste de fichiers invalide.');
  const names = new Map();
  let bytes = 0;
  for (const [path, file] of Object.entries(files)) {
    safeArtifactPath(path);
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join('/');
      const key = name.toLowerCase();
      const kind = i === parts.length ? 'file' : 'directory';
      const existing = names.get(key);
      if (existing && (existing.name !== name || existing.kind !== kind)) fail('PATH_COLLISION', 'Collision de noms ou de casse.');
      names.set(key, { name, kind });
    }
    if (!file || typeof file.content !== 'string' || file.revision !== hash(file.content)) fail('WORKSPACE_INTEGRITY', 'Contenu incompatible avec sa version.');
    bytes += Buffer.byteLength(file.content);
  }
  if (bytes > 16 * 1024 * 1024) fail('WORKSPACE_LIMIT', 'Instantané supérieur à 16 Mio.');
}

export function createGenerationWorkspace(root) {
  const base = directory(root, true);
  if (base === parse(base).root) fail('UNSAFE_WORKSPACE', 'Une racine système ne peut pas héberger les projets.');
  function paths(workspaceId, files) {
    if (typeof workspaceId !== 'string' || !uuid.test(workspaceId)) fail('UNSAFE_WORKSPACE', 'Identifiant de projet invalide.');
    validateFiles(files);
    directory(base);
    const project = join(base, workspaceId);
    return { project, target: join(project, fileFingerprint(files)) };
  }
  function inspect(target, files) {
    directory(target);
    const found = [];
    const walk = (dir, prefix = '') => {
      for (const name of readdirSync(dir)) {
        const path = prefix + name;
        safeArtifactPath(path);
        const full = join(dir, name);
        const stat = lstatSync(full);
        if (stat.isSymbolicLink()) fail('UNSAFE_WORKSPACE', 'Lien symbolique ou jonction refusé.');
        if (stat.isDirectory()) {
          if (!Object.keys(files).some((file) => file.startsWith(path + '/'))) fail('WORKSPACE_INTEGRITY', 'Répertoire inattendu.');
          directory(full);
          walk(full, path + '/');
        } else {
          if (!stat.isFile() || stat.nlink !== 1 || !Object.hasOwn(files, path) || stat.size !== Buffer.byteLength(files[path].content) || hash(readFileSync(full, 'utf8')) !== files[path].revision) fail('WORKSPACE_INTEGRITY', 'Fichier modifié, lié ou inattendu.');
          found.push(path);
        }
      }
    };
    walk(target);
    if (found.length !== Object.keys(files).length) fail('WORKSPACE_INTEGRITY', 'Instantané incomplet.');
    return target;
  }
  return Object.freeze({
    verify(workspaceId, files) {
      const { target } = paths(workspaceId, files);
      try { return inspect(target, files); } catch (error) {
        if (error.code === 'ENOENT') fail('WORKSPACE_INTEGRITY', 'Instantané manquant ; aucune recréation silencieuse.');
        throw error;
      }
    },
    materialize(workspaceId, files) {
      const { project, target } = paths(workspaceId, files);
      directory(project, true);
      let exists = true;
      try { lstatSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; exists = false; }
      if (exists) return inspect(target, files);
      const staging = join(project, `pending-${randomUUID()}`);
      mkdirSync(staging);
      for (const [path, file] of Object.entries(files)) {
        const full = join(staging, ...path.split('/'));
        directory(dirname(full), true);
        const fd = openSync(full, 'wx', 0o600);
        try { writeFileSync(fd, file.content, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
      }
      inspect(staging, files);
      // A crash leaves an unreferenced pending directory, never a valid snapshot.
      directory(project);
      renameSync(staging, target);
      return inspect(target, files);
    },
  });
}
