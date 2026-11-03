import { describe, expect, it } from 'vitest';
import {
  advanceProject, createProject, pauseProject, progress, roles,
  seedProjects, startProject, type NewProject,
} from './domain';

const input: NewProject = {
  name: '  Atelier équipe  ',
  brief: '  Un espace partagé pour suivre les projets et les livrables de chaque équipe.  ',
  type: 'Application web',
  priority: 'Haute',
};

describe('création de projet', () => {
  it('normalise le brief et prépare six tâches ordonnées sans résultat inventé', () => {
    const project = createProject(input);
    expect(project.name).toBe('Atelier équipe');
    expect(project.brief).toBe(input.brief.trim());
    expect(project.state).toBe('draft');
    expect(project.example).toBe(false);
    expect(project.tasks.map(task => task.role)).toEqual(roles.map(role => role.id));
    expect(project.tasks.every(task => task.state === 'queued')).toBe(true);
    expect(new Set(project.tasks.map(task => task.id)).size).toBe(6);
    expect(project.artifacts).toEqual([]);
    expect(progress(project)).toBe(0);
    expect(Date.parse(project.createdAt)).toBeGreaterThan(0);
  });

  it.each([
    { name: 'ab', brief: input.brief },
    { name: 'x'.repeat(81), brief: input.brief },
    { name: input.name, brief: 'trop court' },
    { name: input.name, brief: 'x'.repeat(4001) },
    { name: '   ', brief: input.brief },
  ])('rejette les bornes invalides : %j', values => {
    expect(() => createProject({ ...input, ...values })).toThrow();
  });

  it('accepte exactement les bornes minimales et maximales', () => {
    expect(createProject({ ...input, name: 'abc', brief: 'x'.repeat(20) }).name).toBe('abc');
    expect(createProject({ ...input, name: 'x'.repeat(80), brief: 'x'.repeat(4000) }).brief).toHaveLength(4000);
  });
});

describe('pipeline de simulation', () => {
  it('ne démarre que le premier rôle et ne modifie pas le projet précédent', () => {
    const draft = createProject(input);
    const running = startProject(draft);
    expect(draft.state).toBe('draft');
    expect(draft.tasks.every(task => task.state === 'queued')).toBe(true);
    expect(running.state).toBe('running');
    expect(running.tasks.map(task => task.state)).toEqual(['running', 'queued', 'queued', 'queued', 'queued', 'queued']);
    expect(startProject(running)).toBe(running);
    expect(advanceProject(draft)).toBe(draft);
  });

  it('respecte les dépendances et produit un seul document par étape', () => {
    let project = startProject(createProject(input));
    for (let index = 0; index < roles.length; index++) {
      const previous = project;
      project = advanceProject(project);
      expect(previous.artifacts).toHaveLength(index);
      expect(project.artifacts).toHaveLength(index + 1);
      expect(project.artifacts.at(-1)?.role).toBe(roles[index].id);
      expect(project.tasks.slice(0, index + 1).every(task => task.state === 'done')).toBe(true);
      expect(project.tasks.filter(task => task.state === 'running')).toHaveLength(index === 5 ? 0 : 1);
      expect(project.tasks.slice(index + 2).every(task => task.state === 'queued')).toBe(true);
      expect(progress(project)).toBe(Math.round((index + 1) / 6 * 100));
    }
    expect(project.state).toBe('completed');
    expect(progress(project)).toBe(100);
    expect(advanceProject(project)).toBe(project);
    expect(startProject(project)).toBe(project);
    expect(pauseProject(project)).toBe(project);
  });

  it('interrompt la progression et reprend le rôle en cours sans doublon', () => {
    const running = advanceProject(startProject(createProject(input)));
    const paused = pauseProject(running);
    expect(paused.state).toBe('paused');
    expect(paused.tasks[1].state).toBe('running');
    expect(advanceProject(paused)).toBe(paused);
    expect(pauseProject(paused)).toBe(paused);
    const resumed = startProject(paused);
    expect(resumed.tasks.filter(task => task.state === 'running')).toHaveLength(1);
    expect(resumed.artifacts).toHaveLength(1);
    expect(advanceProject(resumed).artifacts.map(artifact => artifact.role)).toEqual(['product_manager', 'ux_designer']);
    expect(resumed.activity.at(-1)?.text).toBe('Simulation reprise');
  });

  it('étiquette tous les livrables et événements et exclut les faux rapports de réussite', () => {
    let project = startProject(createProject(input));
    for (let index = 0; index < 6; index++) project = advanceProject(project);
    expect(project.activity.every(event => event.mode === 'simulation')).toBe(true);
    for (const artifact of project.artifacts) {
      expect(artifact.mode).toBe('simulation');
      expect(artifact.content).toContain('SIMULATION LOCALE');
      expect(artifact.content).toContain('sans appel à une IA');
    }
    expect(project.artifacts.find(a => a.role === 'fullstack_developer')?.content).toContain('Aucun code applicatif n’a été généré, compilé ou déployé');
    expect(project.artifacts.find(a => a.role === 'qa_engineer')?.content).toContain('Aucun test automatisé ni contrôle navigateur n’a été exécuté');
    expect(project.artifacts.find(a => a.role === 'code_reviewer')?.content).toContain('Aucun dépôt n’a été analysé');
  });
});

describe('exemples initiaux', () => {
  it('identifie les démos et fournit trois états cohérents sans activité autonome', () => {
    const projects = seedProjects();
    expect(projects).toHaveLength(3);
    expect(projects.every(project => project.example)).toBe(true);
    expect(projects.map(project => project.state)).toEqual(['paused', 'draft', 'completed']);
    expect(projects.map(progress)).toEqual([50, 0, 100]);
    expect(projects.map(project => project.artifacts.length)).toEqual([3, 0, 6]);
  });
});
