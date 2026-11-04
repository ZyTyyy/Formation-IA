import { useEffect, useRef, useState } from 'react';
import { Aperture, ArrowLeft, Download, Settings2, Sparkles } from 'lucide-react';
import { advanceProject, createProject, pauseProject, startProject, type Artifact, type Project } from './domain';
import { loadProjects, saveProjects } from './storage';
import { useRealJobs } from './useRealJobs';
import { Composer } from './components/Composer';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { Library } from './components/Library';
import { Settings } from './components/Settings';
import { downloadFile, Modal } from './components/ui';

type View = 'create' | 'library' | 'project';
function initialData() {
  try { const data = loadProjects(window.localStorage); return { projects: data.projects ?? [], error: data.error }; }
  catch { return { projects: [], error: 'Stockage inaccessible. Exportez votre dossier pour le conserver.' }; }
}
export function App() {
  const [initial] = useState(initialData);
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [storageError, setStorageError] = useState(initial.error);
  const [view, setView] = useState<View>('create');
  const [selectedId, setSelectedId] = useState<string>();
  const [settings, setSettings] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState('');
  const { jobs, onJob, pollError } = useRealJobs();
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const selected = projects.find(p => p.id === selectedId);
  const running = projects.some(p => p.state === 'running');
  useEffect(() => {
    if (initial.error) return;
    try { setStorageError(saveProjects(window.localStorage, projects)); }
    catch { setStorageError('Sauvegarde indisponible. Exportez votre dossier avant de fermer cette page.'); }
  }, [projects, initial.error]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setProjects(current => current.map(advanceProject)), 2200);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [view, selectedId]);
  function navigate(next: View) { setError(''); setView(next); }
  function create(brief: string) {
    try {
      if (projects.length >= 100) throw new Error('La limite de 100 projets est atteinte.');
      const firstLine = brief.trim().split(/[.!?\n:]/)[0].trim();
      const name = firstLine.length > 60 ? firstLine.slice(0, 60).replace(/\s+\S*$/, '') + '…' : firstLine;
      const project = startProject(createProject({ name: name.length >= 3 ? name : 'Ma nouvelle application', brief, type: 'Application web', priority: 'Normale' }));
      setProjects(current => [project, ...current]); setSelectedId(project.id); navigate('project');
    } catch (e) { setError(e instanceof Error ? e.message : 'La création n’a pas abouti. Réessayez.'); }
  }
  function toggle() { setProjects(current => current.map(p => p.id === selectedId ? p.state === 'running' ? pauseProject(p) : startProject(p) : p)); }
  return <div className="factory-app">
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <div className="ambient ambient-blue" aria-hidden="true" /><div className="ambient ambient-peach" aria-hidden="true" />
    <header className="app-header">
      <button className="wordmark" aria-label="Factory — accueil" onClick={() => navigate('create')}><span className="brand-icon"><Aperture size={23} strokeWidth={1.4} /></span><span>Factory<span className="wordmark-dot">.</span></span></button>
      <nav className="glass navigation" aria-label="Navigation principale"><button aria-current={view === 'create' ? 'page' : undefined} className={view === 'create' ? 'selected' : ''} onClick={() => navigate('create')}>Créer</button><button aria-current={view !== 'create' ? 'page' : undefined} className={view !== 'create' ? 'selected' : ''} onClick={() => navigate('library')}>Mes projets{projects.length > 0 && <span className="nav-count">{projects.length}</span>}</button></nav>
      <button className="glass settings-button" aria-label="Réglages" onClick={() => setSettings(true)}><Settings2 size={19} /></button>
    </header>
    <main id="main-content">
      {storageError && <div className="message error-message" role="alert">{storageError}<button onClick={() => downloadFile('factory-projets.json', JSON.stringify({ version: 1, projects }, null, 2), 'application/json')}>Exporter les projets<Download size={15} /></button></div>}
      {view === 'create' && <Composer headingRef={heading} onCreate={create} error={error} onAbout={() => setSettings(true)} />}
      {view === 'library' && <Library projects={projects} headingRef={heading} onNew={() => navigate('create')} onOpen={p => { setSelectedId(p.id); navigate('project'); }} />}
      {view === 'project' && selected && <div className="project-page"><button className="back-button" onClick={() => navigate('library')}><ArrowLeft size={16} />Mes projets</button><ProjectWorkspace project={selected} headingRef={heading} onToggle={toggle} onArtifact={setArtifact} onNew={() => navigate('create')} /></div>}
    </main>
    <footer className="app-footer"><span>Une idée suffit.</span><button onClick={() => setSettings(true)}><span className="demo-dot" />Mode démo<span className="footer-divider">/</span>{storageError ? 'Session temporaire · export conseillé' : 'Enregistré sur cet appareil'}</button><span>AI Software Factory</span></footer>
    {settings && <Modal title="À votre rythme." onClose={() => setSettings(false)} wide><Settings jobs={jobs} onJob={onJob} pollError={pollError} /></Modal>}
    {artifact && <Modal title={artifact.title} onClose={() => setArtifact(null)} wide><span className="document-badge"><Sparkles size={13} />Document de démonstration</span><pre className="document-content">{artifact.content}</pre><div className="modal-actions"><button className="button secondary" onClick={() => setArtifact(null)}>Fermer</button><button className="button primary" onClick={() => downloadFile(`${artifact.role}.md`, artifact.content)}><Download size={16} />Télécharger le document</button></div></Modal>}
  </div>;
}
