import { useCallback, useEffect, useState } from 'react';
import { ApiError, requestApi, type RealJob } from './bridge-api';

// Owned by App, so navigation never stops the real-job monitor.
export function useRealJobs() {
  const [jobs, setJobs] = useState<RealJob[]>([]);
  const [pollError, setPollError] = useState('');
  const onJob = useCallback((job: RealJob) => setJobs(current => [job, ...current.filter(j => j.id !== job.id)].slice(0, 50)), []);
  const markLost = useCallback((id: string) => setJobs(current => current.map(job => job.id === id ? { ...job, state: 'unknown', error: 'Le serveur ne conserve plus cette mission. Son issue réelle est inconnue, par exemple après un redémarrage. Aucun succès ni échec du modèle ne peut être confirmé.' } : job)), []);
  const activeJob = jobs.find(j => j.state === 'running');
  const activeId = activeJob?.id;
  useEffect(() => {
    if (!activeId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const updated = await requestApi<RealJob>(`/api/jobs/${activeId}`);
        if (!stopped) { onJob(updated); setPollError(''); if (updated.state === 'running') timer = setTimeout(poll, 1500); }
      } catch (error) {
        if (!stopped) {
          if (error instanceof ApiError && error.status === 404 && activeId) {
            markLost(activeId);
            setPollError('');
          } else { setPollError(error instanceof Error ? error.message : 'Suivi interrompu.'); timer = setTimeout(poll, 5000); }
        }
      }
    }
    timer = setTimeout(poll, 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [activeId, onJob, markLost]);
  return { jobs, onJob, pollError };
}
