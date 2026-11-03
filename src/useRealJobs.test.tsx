import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, requestApi, type RealJob } from './bridge-api';
import { useRealJobs } from './useRealJobs';
vi.mock('./bridge-api', async importOriginal => ({ ...await importOriginal<typeof import('./bridge-api')>(), requestApi: vi.fn() }));
const job: RealJob = { id: 'job-1', role: 'qa_engineer', brief: 'Analyse de test', mode: 'codex', state: 'running', createdAt: new Date().toISOString(), events: [], result: '' };
describe('Suivi réel indépendant de la page Connexions', () => {
  afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
  it('récupère le résultat sans monter la page Connexions et arrête le polling', async () => {
    vi.useFakeTimers(); vi.mocked(requestApi).mockResolvedValue({ ...job, state: 'completed', result: 'Résultat observé' });
    const { result } = renderHook(useRealJobs);
    act(() => result.current.onJob(job));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.jobs[0].state).toBe('completed');
    expect(result.current.jobs[0].result).toBe('Résultat observé');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(requestApi).toHaveBeenCalledTimes(1);
  });
  it('signale une coupure et reprend le suivi sans inventer de réussite', async () => {
    vi.useFakeTimers(); vi.mocked(requestApi).mockRejectedValueOnce(new Error('API indisponible')).mockResolvedValueOnce({ ...job, state: 'failed', error: 'Quota indisponible' });
    const { result } = renderHook(useRealJobs); act(() => result.current.onJob(job));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.pollError).toBe('API indisponible'); expect(result.current.jobs[0].state).toBe('running');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.jobs[0].state).toBe('failed'); expect(result.current.pollError).toBe('');
  });
  it('classe un job perdu après redémarrage comme inconnu et arrête le polling', async () => {
    vi.useFakeTimers(); vi.mocked(requestApi).mockRejectedValue(new ApiError('Tâche inconnue', 404));
    const { result } = renderHook(useRealJobs); act(() => result.current.onJob(job));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.jobs[0].state).toBe('unknown');
    expect(result.current.jobs[0].error).toContain('issue réelle est inconnue');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(requestApi).toHaveBeenCalledTimes(1);
  });
  it('préserve la sortie partielle déjà reçue lorsque le job disparaît ensuite', async () => {
    vi.useFakeTimers();
    vi.mocked(requestApi).mockResolvedValueOnce({ ...job, result: 'Sortie partielle observée', events: [{ at: job.createdAt, type: 'item.completed' }] }).mockRejectedValueOnce(new ApiError('Tâche inconnue', 404));
    const { result } = renderHook(useRealJobs); act(() => result.current.onJob(job));
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(result.current.jobs[0].state).toBe('unknown');
    expect(result.current.jobs[0].result).toBe('Sortie partielle observée');
    expect(result.current.jobs[0].events).toHaveLength(1);
  });
});
