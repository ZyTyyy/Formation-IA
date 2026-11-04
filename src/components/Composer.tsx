import { useRef, useState, type RefObject } from 'react';
import { ArrowUp, Globe2, Plus, Sparkles } from 'lucide-react';
const suggestions = [
  { label: 'Un espace client', brief: 'Un espace client pour mon agence : partager les projets et les documents, suivre les retours et garder toutes les discussions au même endroit.' },
  { label: 'Un suivi d’habitudes', brief: 'Une application pour suivre mes habitudes au quotidien, noter mes progrès et visualiser ma régularité chaque semaine.' },
  { label: 'Un carnet d’idées', brief: 'Un carnet d’idées personnel pour enregistrer mes inspirations, les organiser par thème et retrouver facilement mes notes.' },
];
export function Composer({ headingRef, onCreate, error, onAbout }: { headingRef: RefObject<HTMLHeadingElement | null>; onCreate: (brief: string) => void; error: string; onAbout: () => void }) {
  const [brief, setBrief] = useState(''); const textarea = useRef<HTMLTextAreaElement>(null);
  return <section className="create-page" aria-labelledby="create-title">
    <div className="intro-mark" aria-hidden="true"><div className="orb-core" /><Sparkles size={28} strokeWidth={1.25} /></div>
    <p className="eyebrow">DE L’IDÉE À CE QUI SUIT</p>
    <h1 id="create-title" ref={headingRef} tabIndex={-1}>Et si on créait<br /><span>votre prochaine app ?</span></h1>
    <p className="intro-copy">Vous avez l’idée.<br className="mobile-break" /> Donnons-lui une première forme.</p>
    <form className="glass composer" onSubmit={e => { e.preventDefault(); onCreate(brief); }}>
      <label htmlFor="app-idea" className="sr-only">Décrivez votre application</label>
      <textarea id="app-idea" ref={textarea} rows={3} required minLength={20} maxLength={4000} value={brief} onChange={e => setBrief(e.target.value)} placeholder="Une app pour…" aria-describedby="idea-hint demo-hint" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (brief.trim().length >= 20) e.currentTarget.form?.requestSubmit(); } }} />
      <div className="composer-bottom"><span className="composer-type"><Globe2 size={15} />Application web</span><button className="create-button" type="submit" disabled={brief.trim().length < 20}>Créer mon app<span><ArrowUp size={18} /></span></button></div>
    </form>
    <div className="composer-caption"><span id="idea-hint">{brief.length ? `${brief.length.toLocaleString('fr-FR')} / 4 000 caractères${brief.trim().length < 20 ? ' · 20 minimum' : ''}` : 'Décrivez simplement ce que votre app doit faire.'}</span><span className="shortcut" aria-hidden="true">⌘ / Ctrl ↵</span></div>
    {error && <p className="message error-message" role="alert">{error}</p>}
    <div className="suggestions"><p>Un peu d’inspiration ?</p><div>{suggestions.map(s => <button className="suggestion" key={s.label} onClick={() => { setBrief(s.brief); textarea.current?.focus(); }}><Plus size={13} />{s.label}</button>)}</div></div>
    <p className="demo-note" id="demo-hint">Mode démo : un dossier de préparation, sans génération d’application.<button onClick={onAbout}>En savoir plus<span className="sr-only"> sur le mode démo</span></button></p>
  </section>;
}
