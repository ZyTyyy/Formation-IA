import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { seedProjects } from './domain';
import { STORAGE_KEY } from './storage';
const brief = 'Un espace pour partager les idées et les documents de mon équipe.';
function createIdea() {
  fireEvent.change(screen.getByLabelText('Décrivez votre application'), { target: { value: brief } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer mon app' }));
}
describe('Parcours simplifié : une idée suffit', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ bridgeEnabled: false, cliAvailable: true, authenticationVerified: false }) }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('présente un seul champ et refuse une description trop courte', () => {
    render(<App />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Créer mon app' })).toBeDisabled();
    expect(screen.queryByText('Product Manager')).not.toBeInTheDocument();
    expect(screen.getByText(/sans génération d’application/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Décrivez votre application'), { target: { value: 'Une app courte' } });
    expect(screen.getByText(/20 minimum/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Créer mon app' })).toBeDisabled();
  });
  it('utilise une inspiration et prépare automatiquement le projet sans gérer les rôles', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Un espace client' }));
    expect(screen.getByLabelText('Décrivez votre application')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Créer mon app' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon app' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.projects[0].tasks).toHaveLength(6);
    expect(saved.projects[0].state).toBe('running');
    expect(saved.projects[0].artifacts).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('termine le dossier, ouvre un document explicite puis le retrouve après rechargement', async () => {
    vi.useFakeTimers(); const mounted = render(<App />); createIdea();
    await act(async () => { vi.advanceTimersByTime(13200); });
    expect(screen.getByRole('heading', { name: 'Votre dossier est prêt.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Télécharger le dossier' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Votre idée, clarifiée/ }));
    expect(within(screen.getByRole('dialog')).getByText(/SIMULATION LOCALE/)).toBeVisible();
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Fermer' })[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    mounted.unmount(); render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mes projets/ }));
    expect(screen.getByText('Dossier prêt')).toBeVisible();
    expect(screen.getByRole('button', { name: /Un espace pour partager/ })).toBeVisible();
  });
  it('met en pause et ne redémarre pas une préparation après rechargement', async () => {
    vi.useFakeTimers(); const mounted = render(<App />); createIdea();
    await act(async () => { vi.advanceTimersByTime(2200); });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    await act(async () => { vi.advanceTimersByTime(8800); });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).projects[0].artifacts).toHaveLength(1);
    mounted.unmount(); render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Mes projets/ }));
    fireEvent.click(screen.getByRole('button', { name: /Un espace pour partager/ }));
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).projects[0].state).toBe('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
  });
  it('conserve les anciens projets et permet de les rechercher', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projects: seedProjects() }));
    render(<App />); fireEvent.click(screen.getByRole('button', { name: /Mes projets/ }));
    fireEvent.change(screen.getByLabelText('Rechercher un projet'), { target: { value: 'Orbit' } });
    expect(screen.getByText('Orbit — portail client')).toBeVisible();
    expect(screen.queryByText('Forma — suivi d’habitudes')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher un projet'), { target: { value: 'Inconnu' } });
    expect(screen.getByRole('heading', { name: 'Aucune idée à ce nom.' })).toBeVisible();
  });
  it('ne prétend pas avoir sauvegardé lorsque le stockage refuse les écritures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    render(<App />);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: /Session temporaire · export conseillé/ })).toBeVisible();
    expect(screen.queryByText('Enregistré sur cet appareil')).not.toBeInTheDocument();
  });
  it('réserve la connexion réelle aux réglages et garde le pont désactivé', async () => {
    render(<App />);
    expect(screen.queryByText('Connexion Codex avancée')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(screen.getByText(/Cette démonstration n’appelle aucune IA/)).toBeVisible();
    await userEvent.click(screen.getByText('Connexion Codex avancée'));
    expect(screen.getByRole('button', { name: 'Analyser mon idée' })).toBeDisabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Analyser mon idée' })).toBeDisabled();
  });
});
