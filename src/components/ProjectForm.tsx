import { useState, type FormEvent } from 'react';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { Modal } from './ui';
import type { NewProject } from '../domain';

export function ProjectForm({ onClose, onCreate }: { onClose: () => void; onCreate: (input: NewProject) => void }) {
  const [name, setName] = useState(''); const [brief, setBrief] = useState('');
  const [type, setType] = useState('Application web'); const [priority, setPriority] = useState('Normale');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    try { onCreate({ name, brief, type, priority }); } catch (e) { setError(e instanceof Error ? e.message : 'Création impossible.'); }
  }
  return <Modal title="Donnons forme à votre idée." onClose={onClose}>
    <p className="modal-intro">Un brief, six expertises, un projet qui prend forme.</p>
    <form onSubmit={submit} className="project-form">
      <label htmlFor="project-name">Nom du projet <span>*</span></label>
      <input id="project-name" autoFocus required minLength={3} maxLength={80} placeholder="Ex. Atlas — votre espace de travail" value={name} onChange={e => setName(e.target.value)} />
      <label htmlFor="project-brief">Que souhaitez-vous construire ? <span>*</span></label>
      <textarea id="project-brief" required minLength={20} maxLength={4000} rows={5} placeholder="Décrivez le problème, les utilisateurs et les fonctionnalités essentielles…" value={brief} onChange={e => setBrief(e.target.value)} aria-describedby="brief-hint" />
      <p className="field-hint" id="brief-hint">20 à 4 000 caractères. Un brief précis donne un meilleur point de départ.</p>
      <div className="form-pair"><div><label htmlFor="project-type">Type de projet</label><select id="project-type" value={type} onChange={e => setType(e.target.value)}><option>Application web</option><option>Outil interne</option><option>Site vitrine</option><option>Dashboard</option></select></div><div><label htmlFor="project-priority">Priorité</label><select id="project-priority" value={priority} onChange={e => setPriority(e.target.value)}><option>Normale</option><option>Haute</option><option>Basse</option></select></div></div>
      <div className="form-note"><FlaskConical size={18} /><p><strong>Création en mode simulation.</strong> Six tâches seront préparées. Aucun appel IA, aucun coût. Vous gardez la main sur le lancement.</p></div>
      {error && <p role="alert" className="error-text">{error}</p>}
      <div className="modal-actions"><button className="btn secondary" type="button" onClick={onClose}>Annuler</button><button className="btn primary" type="submit">Créer le projet<ArrowRight size={16} /></button></div>
    </form>
  </Modal>;
}
