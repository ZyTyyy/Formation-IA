import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Cable, Check, ChevronDown, CircleAlert, Download, Factory, FileClock, FlaskConical, FolderKanban, LayoutDashboard, ListTodo, Menu, Plus, Search, Users, X } from 'lucide-react';
import { advanceProject, createProject, pauseProject, roles, seedProjects, startProject, type Artifact, type NewProject, type Project } from './domain';
import { loadProjects, saveProjects } from './storage';
import { Dashboard, ProjectTable } from './components/Dashboard';
import { ProjectDetail, TaskList } from './components/ProjectDetail';
import { ProjectForm } from './components/ProjectForm';
import { Connections } from './components/Connections';
import type { RealJob } from './bridge-api';
import { useRealJobs } from './useRealJobs';
import { Avatar, downloadFile, Empty, Modal } from './components/ui';

type View = 'dashboard' | 'projects' | 'project' | 'agents' | 'tasks' | 'history' | 'connections';
const nav = [{ id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard }, { id: 'projects', label: 'Projets', icon: FolderKanban }, { id: 'agents', label: 'Équipe d’agents', icon: Users }, { id: 'tasks', label: 'Tâches', icon: ListTodo }, { id: 'history', label: 'Historique', icon: FileClock }] as const;
function initialData() {
  try { const loaded = loadProjects(window.localStorage); return { projects: loaded.projects ?? seedProjects(), error: loaded.error }; }
  catch { return { projects: seedProjects(), error: 'Stockage local inaccessible. Les projets resteront dans cette session ; utilisez l’export pour les conserver.' }; }
}
export function App() {
  const [initial] = useState(initialData); const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [storageError, setStorageError] = useState(initial.error); const [view, setView] = useState<View>('dashboard');
  const [selectedId, setSelectedId] = useState(initial.projects[0]?.id); const [newProject, setNewProject] = useState(false);
  const [role, setRole] = useState<typeof roles[number] | null>(null); const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all'); const [mobileNav, setMobileNav] = useState(false);
  const { jobs, onJob, pollError } = useRealJobs(); const [realResultId, setRealResultId] = useState<string | null>(null);
  const realResult = jobs.find(j => j.id === realResultId);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 767px)').matches ?? false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 767px)');
    if (!media) return;
    const changed = () => setIsMobile(media.matches);
    media.addEventListener('change', changed); return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!mobileNav || !isMobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    buttons[0]?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNav(false);
      if (event.key === 'Tab' && buttons.length) {
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [mobileNav, isMobile]);
  useEffect(() => {
    if (initial.error) return;
    try { setStorageError(saveProjects(window.localStorage, projects)); } catch { setStorageError('Sauvegarde locale indisponible. Exportez vos projets avant de fermer.'); }
  }, [projects, initial.error]);
  const running = projects.some(p => p.state === 'running');
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setProjects(current => current.map(advanceProject)), 2200);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  function navigate(next: View) { setView(next); setMobileNav(false); setQuery(''); setFilter('all'); }
  function select(project: Project) { setSelectedId(project.id); navigate('project'); }
  function run(id: string, action: 'start' | 'pause') { setProjects(current => current.map(p => p.id === id ? action === 'start' ? startProject(p) : pauseProject(p) : p)); setNotice(action === 'start' ? 'Simulation lancée · aucun appel IA.' : 'Simulation mise en pause.'); }
  function addProject(input: NewProject) {
    if (projects.length >= 100) throw new Error('La limite locale de 100 projets est atteinte.');
    const created = createProject(input); setProjects(current => [created, ...current]); setNewProject(false); select(created); setNotice('Projet créé. Les six rôles sont prêts.');
  }
  const selected = projects.find(p => p.id === selectedId) || projects[0];
  const visibleProjects = projects.filter(p => (filter === 'all' || p.state === filter) && `${p.name} ${p.brief}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  const pageLabel = nav.find(n => n.id === view)?.label || (view === 'connections' ? 'Connexions' : 'Espace projet');
  const history = projects.flatMap(p => p.artifacts.map(a => ({ ...a, projectName: p.name }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="app-shell"><a href="#main-content" className="skip-link">Aller au contenu</a>{mobileNav && <button className="mobile-backdrop" aria-label="Fermer la navigation" onClick={() => setMobileNav(false)} />}
    <aside id="factory-navigation" ref={sidebarRef} inert={isMobile && !mobileNav} className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}><button className="brand" onClick={() => navigate('dashboard')} aria-label="AI Software Factory — accueil"><span className="brand-mark"><Factory size={25} strokeWidth={1.7} /></span><span><strong>AI Software<span>Factory</span></strong><small>THE SOFTWARE WORKSHOP</small></span></button>
      <div className="workspace-label"><span className="workspace-icon">W</span><span>Mon atelier<small>Espace personnel</small></span><ChevronDown size={14} aria-hidden="true" /></div>
      <p className="nav-label">WORKSPACE</p><nav aria-label="Navigation principale">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id || (id === 'projects' && view === 'project') ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{id === 'projects' && <span className="nav-count">{projects.length}</span>}{id === 'agents' && <span className="nav-count">6</span>}</button>)}</nav>
      <div className="sidebar-divider" /><p className="nav-label">CONFIGURATION</p><button className={`nav-item ${view === 'connections' ? 'active' : ''}`} onClick={() => navigate('connections')}><Cable size={18} /><span>Connexions & capacités</span></button>
      <div className="sidebar-bottom"><div className="sandbox-note"><span className="sandbox-icon"><FlaskConical size={19} /></span><strong>Un espace pour explorer.</strong><p>Testez le cycle complet, sans clé API et sans coût.</p><button onClick={() => navigate('connections')}>Comprendre les modes<ArrowUpRight size={14} /></button></div><div className="profile"><span className="profile-avatar">VO</span><span><strong>Votre workspace</strong><small><span />Stockage sur cet appareil</small></span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Ouvrir la navigation" aria-expanded={mobileNav} aria-controls="factory-navigation">{mobileNav ? <X size={21} /> : <Menu size={21} />}</button><span>Workspace</span><span className="crumb-separator">/</span><strong>{pageLabel}</strong></div><div className="topbar-actions"><label className="search-box"><Search size={15} /><input aria-label="Rechercher un projet" placeholder="Rechercher un projet…" value={query} onChange={e => { setQuery(e.target.value); setView('projects'); }} /></label><span className="local-indicator"><span />Atelier local</span></div></header>
      <main id="main-content" tabIndex={-1}><div className="mode-banner"><FlaskConical size={15} /><p><strong>Mode simulation</strong><span>Explorez le travail des six rôles. Aucun agent IA n’est exécuté par ces animations.</span></p><button onClick={() => navigate('connections')}>Voir les capacités<ArrowRight size={14} /></button></div>
      {storageError && <div className="error-banner mb-6" role="alert"><CircleAlert size={18} /><span>{storageError}</span></div>}
      {pollError && <div className="error-banner mb-6" role="alert"><CircleAlert size={18} /><span>Suivi de la mission réelle interrompu : {pollError} Nouvelle tentative automatique.</span></div>}
      {view === 'dashboard' && <Dashboard projects={projects} onNew={() => setNewProject(true)} onSelect={select} onRun={run} onRole={setRole} onAgents={() => navigate('agents')} onProjects={() => navigate('projects')} />}
      {view === 'projects' && <><div className="page-heading"><div><p className="eyebrow">DE L’INTENTION À L’EXÉCUTION</p><h1>Vos projets.</h1><p className="page-subtitle">Un brief, une équipe, des étapes lisibles.</p></div><button className="btn primary" onClick={() => setNewProject(true)}><Plus size={17} />Nouveau projet</button></div><div className="filter-bar"><div className="filter-buttons">{[['all', 'Tous'], ['draft', 'À démarrer'], ['running', 'En simulation'], ['paused', 'En pause'], ['completed', 'Terminés']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><span>{visibleProjects.length} projet{visibleProjects.length > 1 ? 's' : ''}</span></div><section className="panel"><ProjectTable projects={visibleProjects} onSelect={select} /></section></>}
      {view === 'project' && selected && <ProjectDetail key={selected.id} project={selected} onBack={() => navigate('projects')} onRun={action => run(selected.id, action)} onRole={setRole} onArtifact={setArtifact} />}
      {view === 'agents' && <><div className="page-heading"><div><p className="eyebrow">L’ÉQUIPE DE PRODUCTION</p><h1>Six rôles. Un cap commun.</h1><p className="page-subtitle">Des responsabilités explicites, des consignes dédiées, des livrables identifiés.</p></div><span className="outline-tag">06 SPÉCIALITÉS</span></div><div className="agents-grid">{roles.map((r, i) => <section className="panel agent-card" key={r.id}><div className="flex justify-between items-start"><Avatar role={r} /><span className="mono-caption">AGENT / 0{i + 1}</span></div><h2>{r.title}</h2><p>{r.mission}</p><div className="agent-deliverable"><small>LIVRABLE ATTENDU</small><strong>{r.deliverable}</strong></div><button className="text-link" onClick={() => setRole(r)}>Voir les consignes<ArrowUpRight size={16} /></button></section>)}</div><div className="integration-strip"><Users size={18} /><p>Ces fiches décrivent des rôles. Pendant la construction du MVP, six sous-agents Codex ont reçu de vraies missions distinctes. Les simulations de cette interface sont indépendantes de ces sessions.</p></div></>}
      {view === 'tasks' && <><div className="page-heading"><div><p className="eyebrow">LE TRAVAIL, ÉTAPE PAR ÉTAPE</p><h1>Le suivi des tâches.</h1><p className="page-subtitle">Chaque rôle intervient quand son prédécesseur a terminé.</p></div><span className="outline-tag">{projects.reduce((n, p) => n + p.tasks.length, 0)} TÂCHES</span></div>{projects.length ? <div className="task-projects">{projects.map(p => <section className="panel" key={p.id}><div className="section-heading"><h2><button className="text-link" onClick={() => select(p)}>{p.name}<ArrowUpRight size={15} /></button></h2><span className="mono-caption">{p.example ? 'EXEMPLE · ' : ''}SIMULATION</span></div><TaskList project={p} onArtifact={setArtifact} /></section>)}</div> : <Empty title="Aucune tâche pour le moment" description="Créez un projet pour préparer son cycle de production." />}</>}
      {view === 'history' && <><div className="page-heading"><div><p className="eyebrow">LA TRACE DE CHAQUE ÉTAPE</p><h1>Les résultats de l’atelier.</h1><p className="page-subtitle">Consultez et exportez les documents préparés pour vos projets.</p></div><button className="btn secondary" onClick={() => downloadFile('factory-projets.json', JSON.stringify({ version: 1, projects }, null, 2), 'application/json')}><Download size={16} />Tout exporter</button></div>{jobs.length > 0 && <section className="panel mb-6"><div className="section-heading"><h2>Missions Codex réelles</h2><span className="mono-caption">SESSION EN MÉMOIRE</span></div>{jobs.map(j => <button className="history-row" key={j.id} onClick={() => setRealResultId(j.id)}><span className="mini-project"><Check size={17} /></span><span><strong>{roles.find(r => r.id === j.role)?.title}</strong><small>{j.state === 'completed' ? 'Terminée' : j.state === 'failed' ? 'Échouée' : j.state === 'unknown' ? 'Issue inconnue' : 'En cours'} · Réel</small></span><ArrowUpRight size={17} /></button>)}</section>}{history.length ? <section className="panel"><div className="section-heading"><h2>Documents de simulation</h2><span className="mono-caption">{history.length} DOCUMENTS</span></div>{history.map(a => <button className="history-row" key={a.id} onClick={() => setArtifact(a)}><Avatar role={roles.find(r => r.id === a.role)!} small /><span><strong>{a.title}</strong><small>{a.projectName}</small></span><span className="history-type">Simulation locale</span><time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleDateString('fr-FR')}</time><ArrowUpRight size={17} /></button>)}</section> : <Empty title="Une page blanche, pour le moment" description="Les documents apparaîtront au fil de vos simulations." />}</>}
      {view === 'connections' && <Connections jobs={jobs} onJob={onJob} />}
      <footer className="page-footer"><span>AI Software Factory<span className="mx-2">/</span>Construit avec intention.</span><span>React · TypeScript · Tailwind</span></footer></main>
    </div>
    {newProject && <ProjectForm onClose={() => setNewProject(false)} onCreate={addProject} />}
    {role && <Modal title={role.title} onClose={() => setRole(null)}><div className="role-detail"><Avatar role={role} /><p>{role.mission}</p><h3>Consignes du rôle</h3><p>{role.instructions}</p><h3>Livrable identifiable</h3><div className="role-output"><FileClock size={18} /><strong>{role.deliverable}</strong><code>{role.file}</code></div><div className="form-note"><FlaskConical size={18} /><p>Dans ce MVP, la simulation prépare un modèle de ce document. Une mission réelle peut être lancée séparément via le pont local configuré.</p></div></div><div className="modal-actions"><button className="btn secondary" onClick={() => setRole(null)}>Fermer</button><button className="btn primary" onClick={() => { setRole(null); navigate('connections'); }}>Voir les connexions<ArrowRight size={15} /></button></div></Modal>}
    {artifact && <Modal title={artifact.title} wide onClose={() => setArtifact(null)}><span className="simulation-tag"><FlaskConical size={14} />SIMULATION LOCALE</span><pre className="artifact-content">{artifact.content}</pre><div className="modal-actions"><button className="btn secondary" onClick={() => setArtifact(null)}>Fermer</button><button className="btn primary" onClick={() => downloadFile(roles.find(r => r.id === artifact.role)!.file, artifact.content)}><Download size={15} />Exporter en Markdown</button></div></Modal>}
    {realResult && <Modal title="Résultat Codex réel" wide onClose={() => setRealResultId(null)}><p className="modal-intro">État : {realResult.state} · Conservé en mémoire pour cette session.</p>{realResult.error && <p className="error-text">{realResult.error}</p>}<pre className="artifact-content">{realResult.result || 'Aucun résultat disponible.'}</pre><div className="modal-actions"><button className="btn secondary" onClick={() => setRealResultId(null)}>Fermer</button><button className="btn primary" onClick={() => downloadFile(`codex-${realResult.id}.md`, realResult.result || realResult.error || '')}><Download size={15} />Exporter</button></div></Modal>}
    <div className="toast-region" role="status" aria-live="polite">{notice && <div className="toast"><Check size={17} />{notice}</div>}</div>
  </div>;
}
