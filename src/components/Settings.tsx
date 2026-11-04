import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, Check, Info, RefreshCw, Terminal } from 'lucide-react';
import { requestApi, type Health, type RealJob } from '../bridge-api';
import { downloadFile } from './ui';

export function Settings({ jobs, onJob, pollError }: { jobs: RealJob[]; onJob: (job: RealJob) => void; pollError: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(''); const [checking, setChecking] = useState(false);
  const [brief, setBrief] = useState(''); const [consent, setConsent] = useState(false); const [launching, setLaunching] = useState(false);
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const active = jobs.some(j => j.state === 'running');
  async function check() {
    setChecking(true); setError('');
    try { setHealth(await requestApi<Health>('/api/health')); }
    catch (e) { setHealth(null); setError(e instanceof Error ? e.message : 'Connexion indisponible.'); }
    finally { setChecking(false); }
  }
  useEffect(() => { if (local) void check(); }, [local]);
  async function analyze(event: FormEvent) {
    event.preventDefault(); if (!consent || active || !health?.bridgeEnabled || health.blocked) return;
    setLaunching(true); setError('');
    try { onJob(await requestApi<RealJob>('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'product_manager', brief }) })); }
    catch (e) { setError(e instanceof Error ? e.message : 'L’analyse n’a pas abouti.'); }
    finally { setLaunching(false); }
  }
  return <div className="settings-content"><p className="modal-intro">L’essentiel devant vous. Les détails seulement si vous en avez besoin.</p>
    <section className="mode-explanation"><div className="mode-heading"><h3><Info size={18} />Le mode démo</h3><span className="subtle-badge"><Check size={13} />Sans clé · sans coût</span></div><p>Votre idée traverse un exemple de préparation en trois étapes. Vous obtenez six modèles de documents pour cadrer votre projet.</p><p>Cette démonstration n’appelle aucune IA et ne génère pas d’application fonctionnelle. Les animations ne représentent pas des agents autonomes en activité.</p></section>
    <details className="advanced-settings"><summary><Terminal size={17} /><span>Connexion Codex avancée</span><span className="connection-tag">{health?.blocked ? 'Bloquée' : health?.bridgeEnabled ? 'Activée' : 'Désactivée'}</span></summary><div className="advanced-content"><p>Une analyse réelle de votre idée est possible avec le serveur local et une session Codex authentifiée. Cette connexion est en lecture seule : elle ne construit pas l’application.</p><dl><div><dt>CLI Codex</dt><dd>{health?.cliAvailable ? 'Détecté' : 'Non vérifié'}</dd></div><div><dt>Authentification</dt><dd>À vérifier lors du lancement</dd></div></dl>{local ? <button className="quiet-button" onClick={check} disabled={checking}><RefreshCw size={14} />{checking ? 'Vérification…' : 'Vérifier la connexion'}</button> : <p>Cette fonction est disponible uniquement avec la version locale.</p>}
      <p className="setup-caption">Activation côté serveur : <code>CODEX_BRIDGE_ENABLED=1</code>. Le CLI doit être connecté avec <code>codex login</code>. La configuration personnelle est ignorée ; aucun MCP n’est déclaré dans le projet livré. Toute modification de configuration exige une nouvelle vérification.</p>
      {health?.blocked && <p className="message error-message" role="alert">{health.blockReason || 'L’arrêt de la mission précédente n’est pas confirmé.'}</p>}
      <form className="analysis-form" onSubmit={analyze}><label htmlFor="analysis-idea">L’idée à analyser</label><textarea id="analysis-idea" rows={3} required minLength={10} maxLength={12000} value={brief} onChange={e => setBrief(e.target.value)} placeholder="Décrivez votre idée et ce que vous souhaitez clarifier…" /><label className="consent-label"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>J’autorise cette analyse réelle et la consommation éventuelle de quota Codex.</span></label><button className="button secondary" disabled={!local || !health?.bridgeEnabled || !health.cliAvailable || health.blocked || !consent || active || launching}>{active ? 'Analyse en cours…' : launching ? 'Lancement…' : 'Analyser mon idée'}</button></form>
      {(error || pollError) && <p className="message error-message" role="alert">{error || pollError}</p>}
      {jobs.length > 0 && <div className="analysis-results"><h3>Vos analyses réelles</h3><p>Conservées en mémoire pour cette session. Exportez les résultats utiles.</p>{jobs.map(job => <details key={job.id}><summary>{job.state === 'completed' ? 'Analyse terminée' : job.state === 'failed' ? 'Analyse échouée' : job.state === 'unknown' ? 'Issue inconnue' : 'Analyse en cours'}<small>{new Date(job.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></summary><p>{job.brief}</p>{job.error && <p className="error-message">{job.error}</p>}<pre className="document-content">{job.result || 'Aucun résultat reçu pour le moment.'}</pre>{job.result && <button className="quiet-button" onClick={() => downloadFile(`analyse-${job.id}.md`, job.result)}><ArrowDownToLine size={15} />Exporter</button>}</details>)}</div>}
    </div></details>
  </div>;
}
