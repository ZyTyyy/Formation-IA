import type { RoleId } from './domain';
export interface Health { bridgeEnabled: boolean; cliAvailable: boolean; cliVersion: string | null; authenticationVerified: boolean; blocked?: boolean; blockReason?: string }
export interface RealJob { id: string; role: RoleId; brief: string; mode: 'codex'; state: 'running' | 'completed' | 'failed' | 'unknown'; createdAt: string; finishedAt?: string; events: { at: string; type: string }[]; result: string; error?: string }
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function requestApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000) });
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('API locale absente. Démarrez npm start depuis le dossier du projet.');
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error?.message || `Erreur HTTP ${response.status}`, response.status);
  return data as T;
}
