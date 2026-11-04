import type { RefObject } from 'react';
import { ArrowDownToLine, ArrowRight, Check, ChevronRight, FileText, Pause, Play, Sparkles } from 'lucide-react';
import { progress, type Artifact, type Project } from '../domain';
import { downloadFile } from './ui';
const stages = [
  { name: 'Comprendre votre idée', detail: 'Les besoins et l’expérience à imaginer.' },
  { name: 'Préparer la solution', detail: 'Une structure et un plan de réalisation.' },
  { name: 'Vérifier le dossier', detail: 'Les points à tester et à relire.' },
];
const documentNames = ['Votre idée, clarifiée', 'Les parcours utilisateur', 'Le plan technique', 'Les étapes de réalisation', 'Les points à tester', 'La grille de vérification'];
export function ProjectWorkspace({ project, headingRef, onToggle, onArtifact, onNew }: { project: Project; headingRef: RefObject<HTMLHeadingElement | null>; onToggle: () => void; onArtifact: (artifact: Artifact) => void; onNew: () => void }) {
  const done = project.state === 'completed'; const count = project.artifacts.length;
  return <section className="workspace" aria-labelledby="project-title">
    <div className={`result-emblem ${done ? 'finished' : ''}`} aria-hidden="true">{done ? <Check size={27} /> : <Sparkles size={26} strokeWidth={1.3} />}</div>
    <p className="eyebrow">VOTRE IDÉE PREND FORME</p>
    <h1 id="project-title" ref={headingRef} tabIndex={-1}>{done ? 'Votre dossier est prêt.' : project.state === 'paused' ? 'On reprend quand vous voulez.' : project.state === 'draft' ? 'Tout commence ici.' : 'Un peu plus concret à chaque étape.'}</h1>
    <p className="workspace-subtitle">{done ? 'Une première base pour passer de l’intention à la réalisation.' : 'Le déroulement est automatique. Vous pouvez simplement suivre.'}</p>
    <div className="glass preparation"><div className="brief-summary"><span className="small-label">VOTRE PROJET{project.example ? ' · EXEMPLE' : ''}</span><h2>{project.name}</h2><p>{project.brief}</p></div>
      <div className="preparation-progress"><div><span>{done ? 'Dossier de démonstration terminé' : project.state === 'paused' ? 'Préparation en pause' : project.state === 'draft' ? 'Prêt à démarrer' : 'Préparation du dossier de démonstration'}</span><strong>{progress(project)} %</strong></div><div className="progress-track" role="progressbar" aria-label="Préparation du dossier" aria-valuenow={progress(project)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress(project)}%` }} /></div></div>
      <ol className="simple-stages">{stages.map((stage, index) => { const completed = count >= (index + 1) * 2; const active = !completed && count >= index * 2; return <li key={stage.name} className={completed ? 'complete' : active ? 'current' : ''}><span className="step-icon" aria-hidden="true">{completed ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span><div><h3>{stage.name}</h3><p>{stage.detail}</p></div><span className="step-state">{completed ? 'Terminé' : active ? project.state === 'paused' ? 'En pause' : project.state === 'draft' ? 'À démarrer' : 'En cours' : 'À venir'}</span></li>; })}</ol>
      {!done && <div className="preparation-control"><span><span className="demo-dot" />Démonstration locale</span><button className="quiet-button" onClick={onToggle}>{project.state === 'running' ? <Pause size={14} /> : <Play size={14} />}{project.state === 'running' ? 'Mettre en pause' : 'Reprendre'}</button></div>}
    </div>
    <p className="sr-only" role="status">{done ? 'Dossier terminé. Six documents disponibles.' : `${count} documents sur six préparés${project.state === 'paused' ? ', en pause' : ''}.`}</p>
    {done ? <><div className="result-actions"><button className="button primary" onClick={() => downloadFile('mon-projet-dossier.md', project.artifacts.map(a => a.content).join('\n\n---\n\n'))}><ArrowDownToLine size={17} />Télécharger le dossier</button><button className="quiet-button" onClick={onNew}>Une autre idée<ArrowRight size={16} /></button></div><p className="result-disclaimer">6 documents de préparation · Markdown · Aucun code d’application généré</p><Documents project={project} onArtifact={onArtifact} /></> : count > 0 && <details className="documents-disclosure"><summary>Consulter les documents déjà préparés<span>{count}</span></summary><Documents project={project} onArtifact={onArtifact} /></details>}
  </section>;
}
function Documents({ project, onArtifact }: { project: Project; onArtifact: (artifact: Artifact) => void }) {
  return <div className="document-list"><h2>À l’intérieur de votre dossier</h2>{project.artifacts.map((a, i) => <button className="document-row" key={a.id} onClick={() => onArtifact(a)}><FileText size={18} /><span>{documentNames[i]}<small>Document de préparation</small></span><ChevronRight size={17} /></button>)}</div>;
}
