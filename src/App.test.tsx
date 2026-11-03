import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { STORAGE_KEY } from './storage';

describe('Parcours de l’atelier', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());
  it('annonce le mode simulé et expose les six rôles', async () => {
    render(<App />);
    expect(screen.getByText(/Aucun agent IA n’est exécuté par ces animations/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Équipe d’agents/ }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    await userEvent.click(screen.getAllByRole('button', { name: 'Voir les consignes' })[0]);
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Consignes du rôle' })).toBeVisible();
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Fermer' })[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('crée un projet et enregistre ses six tâches sans lancer la simulation', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }));
    await user.type(screen.getByLabelText(/Nom du projet/), 'Atlas interne');
    await user.type(screen.getByLabelText(/Que souhaitez-vous construire/), 'Un outil interne pour partager les décisions et les documents de notre équipe.');
    await user.click(screen.getByRole('button', { name: 'Créer le projet' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Atlas interne' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lancer la simulation' })).toBeEnabled();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.projects[0].tasks).toHaveLength(6);
    expect(saved.projects[0].state).toBe('draft');
    expect(saved.projects[0].artifacts).toHaveLength(0);
  });
  it('termine une simulation et garde ses documents après rechargement', async () => {
    vi.useFakeTimers(); const rendered = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre la simulation' }));
    await act(async () => { vi.advanceTimersByTime(6600); });
    expect(screen.getByText('Simulation terminée')).toBeVisible();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.projects[0].state).toBe('completed');
    expect(saved.projects[0].artifacts).toHaveLength(6);
    rendered.unmount(); render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Historique' }));
    expect(screen.getByRole('heading', { name: 'Documents de simulation' })).toBeVisible();
    expect(screen.getAllByText('Simulation locale')).toHaveLength(12);
  });
  it('filtre les projets par recherche et par état', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher un projet' }), { target: { value: 'Fieldnotes' } });
    expect(screen.getByText('Fieldnotes — journal d’équipe')).toBeVisible();
    expect(screen.queryByText('Orbit — portail client')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminés' }));
    expect(screen.getByRole('heading', { name: 'Aucun projet trouvé' })).toBeVisible();
  });
});
