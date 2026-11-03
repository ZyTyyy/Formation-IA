import { describe, expect, it, vi } from 'vitest';
import { advanceProject, createProject, seedProjects, startProject, type Project } from './domain';
import { isProject, loadProjects, saveProjects, STORAGE_KEY } from './storage';

const project = () => createProject({ name: 'Projet test', brief: 'Un espace partagé pour suivre les actions et décisions de notre équipe.', type: 'Outil interne', priority: 'Normale' });
const storageWith = (value: unknown) => ({ getItem: vi.fn(() => JSON.stringify(value)) });
const snapshot = (projects: Project[]) => ({ version: 1, projects });

describe('persistance des projets', () => {
  it('renvoie une absence de session sans erreur pour un stockage vide', () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(loadProjects(storage)).toEqual({ projects: null, error: null });
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('sérialise la version et recharge les projets valides', () => {
    const projects = seedProjects();
    const storage = { setItem: vi.fn() };
    expect(saveProjects(storage, projects)).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(snapshot(projects)));
    expect(loadProjects(storageWith(snapshot(projects)))).toEqual({ projects, error: null });
  });

  it('met en pause une simulation rechargée sans produire de résultat supplémentaire', () => {
    const running = advanceProject(startProject(project()));
    const result = loadProjects(storageWith(snapshot([running])));
    expect(result.error).toBeNull();
    expect(result.projects?.[0].state).toBe('paused');
    expect(result.projects?.[0].tasks).toEqual(running.tasks);
    expect(result.projects?.[0].artifacts).toEqual(running.artifacts);
    expect(running.state).toBe('running');
  });

  it('remonte une erreur de lecture sans écraser le stockage', () => {
    const storage = { getItem: vi.fn(() => { throw new DOMException('denied', 'SecurityError'); }), setItem: vi.fn() };
    const result = loadProjects(storage);
    expect(result.projects).toBeNull();
    expect(result.error).toContain('session temporaire');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('remonte une erreur d’écriture/quota pour préserver une possibilité d’export', () => {
    const storage = { setItem: vi.fn(() => { throw new DOMException('full', 'QuotaExceededError'); }) };
    expect(saveProjects(storage, [project()])).toContain('Exportez');
  });

  it('rejette un JSON tronqué', () => {
    expect(loadProjects({ getItem: () => '{"version":1,' }).error).not.toBeNull();
  });

  it.each([
    null,
    [],
    { version: 2, projects: [] },
    { version: 1, projects: [null] },
    { version: 1, projects: [{ id: 'incomplet' }] },
  ])('rejette les formats invalides : %j', value => {
    expect(loadProjects(storageWith(value)).projects).toBeNull();
    expect(loadProjects(storageWith(value)).error).not.toBeNull();
  });

  it('rejette les projets dupliqués et les sessions démesurées', () => {
    const sample = project();
    expect(loadProjects(storageWith(snapshot([sample, sample]))).error).not.toBeNull();
    expect(loadProjects(storageWith(snapshot(Array.from({ length: 101 }, project)))).error).not.toBeNull();
  });
});

describe('validation des données persistées', () => {
  it('accepte chaque état généré par le moteur et les exemples', () => {
    let current = project();
    expect(isProject(current)).toBe(true);
    current = startProject(current);
    expect(isProject(current)).toBe(true);
    for (let index = 0; index < 6; index++) {
      current = advanceProject(current);
      expect(isProject(current)).toBe(true);
    }
    expect(seedProjects().every(isProject)).toBe(true);
  });

  it('rejette un rôle inconnu et un ordre de pipeline modifié', () => {
    const sample = project();
    expect(isProject({ ...sample, tasks: [{ ...sample.tasks[0], role: 'other' }, ...sample.tasks.slice(1)] })).toBe(false);
    expect(isProject({ ...sample, tasks: [...sample.tasks].reverse() })).toBe(false);
  });

  it('rejette les transitions incohérentes, les dates invalides et les artefacts mal étiquetés', () => {
    const sample = project();
    expect(isProject({ ...sample, createdAt: 'invalid' })).toBe(false);
    expect(isProject({ ...sample, state: 'completed' })).toBe(false);
    expect(isProject({ ...sample, state: 'running' })).toBe(false);
    expect(isProject({ ...sample, tasks: sample.tasks.map((task, index) => index === 2 ? { ...task, state: 'done' } : task) })).toBe(false);
    const advanced = advanceProject(startProject(sample));
    expect(isProject({ ...advanced, artifacts: [] })).toBe(false);
    expect(isProject({ ...advanced, artifacts: advanced.artifacts.map(artifact => ({ ...artifact, mode: 'codex' })) })).toBe(false);
    expect(isProject({ ...advanced, activity: advanced.activity.map(event => ({ ...event, mode: 'codex' })) })).toBe(false);
  });

  it('rejette plusieurs rôles déclarés en cours', () => {
    const running = startProject(project());
    expect(isProject({ ...running, tasks: running.tasks.map((task, index) => index === 1 ? { ...task, state: 'running' } : task) })).toBe(false);
  });
});
