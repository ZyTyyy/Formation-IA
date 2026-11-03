export const roles = [
  { id: 'product_manager', title: 'Product Manager', short: 'PM', label: 'Cadrage', tone: 'orange', mission: 'Transformer votre idée en un périmètre clair et des critères vérifiables.', deliverable: 'Cahier des charges', file: 'product.md', instructions: 'Définir le problème, les utilisateurs, les fonctionnalités prioritaires et des critères d’acceptation testables. Signaler les hypothèses.' },
  { id: 'ux_designer', title: 'UX Designer', short: 'UX', label: 'Expérience', tone: 'pink', mission: 'Dessiner un parcours simple, accessible et cohérent.', deliverable: 'Parcours & interface', file: 'experience.md', instructions: 'Définir les parcours, la navigation, les états vides et les erreurs. Prévoir clavier, contrastes et écrans mobiles.' },
  { id: 'software_architect', title: 'Software Architect', short: 'SA', label: 'Architecture', tone: 'blue', mission: 'Définir les composants, les données et les contrats techniques.', deliverable: 'Architecture technique', file: 'architecture.md', instructions: 'Décrire les frontières, contrats, données et compromis. Distinguer capacités disponibles et intégrations à configurer.' },
  { id: 'fullstack_developer', title: 'Fullstack Developer', short: 'FS', label: 'Développement', tone: 'green', mission: 'Implémenter les fonctionnalités et connecter les composants.', deliverable: 'Plan d’implémentation', file: 'implementation.md', instructions: 'Implémenter le périmètre accepté avec TypeScript strict, validation des entrées et gestion d’erreurs. Rapporter les fichiers et vérifications réels.' },
  { id: 'qa_engineer', title: 'QA Engineer', short: 'QA', label: 'Validation', tone: 'yellow', mission: 'Vérifier les parcours et rendre les défauts reproductibles.', deliverable: 'Plan de validation', file: 'validation.md', instructions: 'Exécuter les tests utiles, vérifier cas limites et persistance. Ne jamais qualifier un test de réussi sans l’avoir exécuté.' },
  { id: 'code_reviewer', title: 'Code Reviewer', short: 'CR', label: 'Revue', tone: 'purple', mission: 'Examiner la qualité, la sécurité et les risques de régression.', deliverable: 'Grille de revue', file: 'review.md', instructions: 'Chercher des défauts concrets, prioriser et citer fichiers et lignes. Distinguer revue effectuée et points non vérifiés.' },
] as const;

export type RoleId = typeof roles[number]['id'];
export type TaskState = 'queued' | 'running' | 'done';
export type ProjectState = 'draft' | 'running' | 'paused' | 'completed';
export interface Task { id: string; role: RoleId; title: string; state: TaskState }
export interface Artifact { id: string; role: RoleId; title: string; content: string; createdAt: string; mode: 'simulation' }
export interface Activity { id: string; text: string; createdAt: string; mode: 'simulation' }
export interface Project {
  id: string; name: string; brief: string; type: string; priority: string;
  createdAt: string; updatedAt: string; state: ProjectState;
  tasks: Task[]; artifacts: Artifact[]; activity: Activity[]; example: boolean;
}
export interface NewProject { name: string; brief: string; type: string; priority: string }
export const taskTitles = ['Cadrer le produit et les objectifs', 'Concevoir les parcours utilisateur', 'Définir l’architecture technique', 'Préparer l’implémentation', 'Établir le plan de validation', 'Préparer la revue de code'];
export const stateLabels: Record<ProjectState, string> = { draft: 'À démarrer', running: 'En simulation', paused: 'En pause', completed: 'Terminée' };
const uid = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();
const activity = (text: string): Activity => ({ id: uid(), text, createdAt: timestamp(), mode: 'simulation' });

export function createProject(input: NewProject, example = false): Project {
  const name = input.name.trim(); const brief = input.brief.trim();
  if (name.length < 3 || name.length > 80) throw new Error('Le nom doit contenir entre 3 et 80 caractères.');
  if (brief.length < 20 || brief.length > 4000) throw new Error('Le brief doit contenir entre 20 et 4 000 caractères.');
  return { id: uid(), name, brief, type: input.type, priority: input.priority, createdAt: timestamp(), updatedAt: timestamp(), state: 'draft', example,
    tasks: roles.map((role, i) => ({ id: uid(), role: role.id, title: taskTitles[i], state: 'queued' })), artifacts: [], activity: [activity('Projet créé · six étapes préparées')] };
}

function template(project: Project, role: typeof roles[number]): string {
  const sections: Record<RoleId, string> = {
    product_manager: `## Intention\n${project.brief}\n\n## Périmètre proposé\n- Identifier le parcours principal et les données nécessaires.\n- Livrer une première version de type ${project.type}.\n- Priorité déclarée : ${project.priority}.\n\n## Critères à préciser\n- Le parcours principal fonctionne au clavier et sur mobile.\n- Les données saisies persistent après rechargement.\n- Les erreurs sont visibles et compréhensibles.`,
    ux_designer: '## Parcours proposé\nAccueil → création → espace projet → suivi → livrables.\n\n## États à concevoir\nVide, chargement, erreur, progression et terminé.\n\n## Accessibilité à vérifier\nLabels explicites, focus visible, ordre de tabulation, contraste et réduction des animations.',
    software_architect: '## Structure proposée\nReact + TypeScript + Tailwind pour l’interface. Domaine indépendant de la présentation et adaptateur de persistance.\n\n## Contrats à définir\nValidation des entrées, identification des ressources et gestion des erreurs.\n\n## Points de décision\nStockage, authentification, hébergement et intégrations restent à valider pour ce projet.',
    fullstack_developer: '## Séquence de travail proposée\n1. Modéliser les données et les règles métier.\n2. Construire les composants et la navigation.\n3. Connecter la persistance et traiter les erreurs.\n4. Vérifier le parcours de bout en bout.\n\nAucun code applicatif n’a été généré, compilé ou déployé par cette simulation.',
    qa_engineer: '## Scénarios à exécuter\n- Créer un projet avec des valeurs valides et invalides.\n- Vérifier les dépendances et la pause/reprise.\n- Recharger et contrôler la persistance.\n- Parcourir l’interface au clavier et sur mobile.\n\nAucun test automatisé ni contrôle navigateur n’a été exécuté par cette simulation.',
    code_reviewer: '## Grille de revue proposée\n- Vérifier les règles métier et les transitions.\n- Chercher les entrées non validées et les secrets exposés.\n- Examiner les tests et leurs limites.\n- Prioriser les défauts avec références de fichiers.\n\nAucun dépôt n’a été analysé. Ce document n’est pas une approbation de code.',
  };
  return `# ${role.deliverable} — ${project.name}\n\n> SIMULATION LOCALE · modèle de document déterministe, sans appel à une IA.\n\n${sections[role.id]}\n\n---\nResponsable du rôle : ${role.title}.\nDocument de préparation à adapter et vérifier avant utilisation.`;
}

export function startProject(project: Project): Project {
  if (project.state === 'running' || project.state === 'completed') return project;
  const index = project.tasks.findIndex(t => t.state !== 'done');
  if (index < 0) return project;
  return { ...project, state: 'running', updatedAt: timestamp(), tasks: project.tasks.map((t, i) => i === index ? { ...t, state: 'running' } : t), activity: [...project.activity, activity(project.state === 'paused' ? 'Simulation reprise' : 'Simulation démarrée · aucun appel IA')] };
}
export function pauseProject(project: Project): Project {
  return project.state !== 'running' ? project : { ...project, state: 'paused', updatedAt: timestamp(), activity: [...project.activity, activity('Simulation mise en pause')] };
}
export function advanceProject(project: Project): Project {
  if (project.state !== 'running') return project;
  const index = project.tasks.findIndex(t => t.state === 'running');
  if (index < 0) return project;
  const role = roles[index]; const last = index === roles.length - 1;
  const artifact: Artifact = { id: uid(), role: role.id, title: role.deliverable, content: template(project, role), createdAt: timestamp(), mode: 'simulation' };
  return { ...project, updatedAt: timestamp(), state: last ? 'completed' : 'running',
    tasks: project.tasks.map((t, i) => i === index ? { ...t, state: 'done' } : i === index + 1 ? { ...t, state: 'running' } : t),
    artifacts: [...project.artifacts, artifact], activity: [...project.activity, activity(`${role.title} · document de simulation disponible`), ...(last ? [activity('Simulation terminée · six documents préparés')] : [])] };
}
export const progress = (project: Project) => Math.round(project.tasks.filter(t => t.state === 'done').length / roles.length * 100);

export function seedProjects(): Project[] {
  const main = createProject({ name: 'Orbit — portail client', brief: 'Un espace client pour une agence créative : centraliser les projets, partager les livrables et suivre les retours de chaque client.', type: 'Application web', priority: 'Normale' }, true);
  let started = startProject(main);
  for (let i = 0; i < 3; i++) started = advanceProject(started);
  const archive = createProject({ name: 'Forma — suivi d’habitudes', brief: 'Une application simple pour définir ses habitudes et visualiser sa régularité chaque semaine.', type: 'Application web', priority: 'Normale' }, true);
  let finished = startProject(archive);
  for (let i = 0; i < 6; i++) finished = advanceProject(finished);
  return [pauseProject(started), createProject({ name: 'Fieldnotes — journal d’équipe', brief: 'Un journal partagé pour garder les décisions, les notes et les actions d’une petite équipe produit.', type: 'Outil interne', priority: 'Haute' }, true), finished];
}
