import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowUpRight, Check, Circle, FileText, LoaderCircle, Pause, Play, X } from 'lucide-react';
import { progress, roles, stateLabels, type Artifact, type Project } from '../domain';

export function Avatar({ role, small = false }: { role: typeof roles[number]; small?: boolean }) {
  return <span aria-hidden="true" className={`agent-avatar ${role.tone} ${small ? 'small' : ''}`}>{role.short}</span>;
}
export function Status({ project }: { project: Project }) {
  return <span className={`status ${project.state}`}><span aria-hidden="true" />{stateLabels[project.state]}</span>;
}
export function ProgressBar({ project }: { project: Project }) {
  return <div className="progress-track" role="progressbar" aria-label={`Progression de ${project.name}`} aria-valuenow={progress(project)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress(project)}%` }} /></div>;
}
export function RunButton({ project, onChange }: { project: Project; onChange: (action: 'start' | 'pause') => void }) {
  return project.state === 'completed' ? <span className="completed-label"><Check size={15} />Simulation terminée</span> : <button className={project.state === 'running' ? 'btn secondary' : 'btn primary'} onClick={() => onChange(project.state === 'running' ? 'pause' : 'start')}>
    {project.state === 'running' ? <Pause size={15} /> : <Play size={15} />}{project.state === 'running' ? 'Mettre en pause' : project.state === 'paused' ? 'Reprendre la simulation' : 'Lancer la simulation'}
  </button>;
}
export function Pipeline({ project, onRole }: { project: Project; onRole: (role: typeof roles[number]) => void }) {
  return <ol className="pipeline" aria-label="Les six étapes du projet">{roles.map((role, i) => <li className={project.tasks[i].state} key={role.id}>
    <button onClick={() => onRole(role)} aria-label={`${role.title} : ${project.tasks[i].state === 'done' ? 'terminé' : project.tasks[i].state === 'running' ? (project.state === 'paused' ? 'en pause' : 'simulation en cours') : 'en attente'}`}>
      <span className="pipeline-avatar"><Avatar role={role} />{project.tasks[i].state === 'done' && <span className="pipeline-check"><Check size={10} /></span>}</span>
      <span className="pipeline-label">{role.label}</span><span className="pipeline-state">{project.tasks[i].state === 'done' ? 'Terminé' : project.tasks[i].state === 'running' ? project.state === 'paused' ? 'En pause' : 'En cours' : 'À venir'}</span>
    </button>
  </li>)}</ol>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => { const el = dialog.current; if (el && !el.open) el.showModal(); return () => { if (el?.open) el.close(); }; }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={id} onCancel={onClose}>
    <div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></button></div>{children}
  </dialog>;
}
export function Empty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="empty"><span className="empty-icon"><FileText size={24} /></span><h2>{title}</h2><p>{description}</p>{children}</div>;
}
export function TaskIcon({ state }: { state: string }) {
  return state === 'done' ? <Check className="text-emerald-700" size={17} /> : state === 'running' ? <LoaderCircle className="text-accent" size={17} /> : <Circle className="text-muted" size={15} />;
}
export function downloadFile(name: string, content: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ArtifactList({ project, onOpen }: { project: Project; onOpen: (artifact: Artifact) => void }) {
  return project.artifacts.length ? <div className="artifact-grid">{project.artifacts.map(a => <button className="artifact-card" key={a.id} onClick={() => onOpen(a)}><FileText size={22} /><span><strong>{a.title}</strong><small>Markdown · Simulation locale</small></span><ArrowUpRight size={17} /></button>)}</div> : <Empty title="Les livrables arrivent ici" description="Lancez la simulation pour préparer les documents des six rôles." />;
}
