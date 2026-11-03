import { roles, type Project } from './domain';
export const STORAGE_KEY = 'ai-software-factory:v1';
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
const isString = (v: unknown) => typeof v === 'string';
const isDate = (v: unknown) => isString(v) && Number.isFinite(Date.parse(v as string));
export function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  if (!['id', 'name', 'brief', 'type', 'priority'].every(k => isString(value[k]))) return false;
  if (!isDate(value.createdAt) || !isDate(value.updatedAt) || typeof value.example !== 'boolean') return false;
  if (!['draft', 'running', 'paused', 'completed'].includes(String(value.state))) return false;
  if (!Array.isArray(value.tasks) || value.tasks.length !== roles.length) return false;
  if (!value.tasks.every((t, i) => isRecord(t) && isString(t.id) && isString(t.title) && t.role === roles[i].id && ['queued', 'running', 'done'].includes(String(t.state)))) return false;
  const tasks = value.tasks as Project['tasks'];
  const done = tasks.filter(t => t.state === 'done').length;
  if (!tasks.every((t, i) => i < done ? t.state === 'done' : t.state !== 'done')) return false;
  if (tasks.filter(t => t.state === 'running').length > 1) return false;
  if (value.state === 'completed' && done !== roles.length) return false;
  if ((value.state === 'running' || value.state === 'paused') && (done === roles.length || tasks[done]?.state !== 'running')) return false;
  if (value.state === 'draft' && tasks.some(t => t.state !== 'queued')) return false;
  if (!Array.isArray(value.artifacts) || value.artifacts.length !== done || !value.artifacts.every((a, i) => isRecord(a) && isString(a.id) && a.role === roles[i].id && isString(a.title) && isString(a.content) && isDate(a.createdAt) && a.mode === 'simulation')) return false;
  return Array.isArray(value.activity) && value.activity.every(a => isRecord(a) && isString(a.id) && isString(a.text) && isDate(a.createdAt) && a.mode === 'simulation');
}
export function loadProjects(storage: Pick<Storage, 'getItem'>): { projects: Project[] | null; error: string | null } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { projects: null, error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.projects) || parsed.projects.length > 100 || !parsed.projects.every(isProject) || new Set(parsed.projects.map(p => p.id)).size !== parsed.projects.length) throw new Error('invalid');
    // A closed browser cannot run agents: resume only on an explicit action.
    return { projects: parsed.projects.map(p => p.state === 'running' ? { ...p, state: 'paused' as const } : p), error: null };
  } catch { return { projects: null, error: 'Les données locales sont illisibles ou inaccessibles. Une session temporaire a été ouverte ; exportez vos nouveaux projets pour les conserver.' }; }
}
export function saveProjects(storage: Pick<Storage, 'setItem'>, projects: Project[]): string | null {
  try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projects })); return null; }
  catch { return 'Sauvegarde locale indisponible. Exportez vos projets avant de fermer cette page.'; }
}
