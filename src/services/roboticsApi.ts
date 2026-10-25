/**
 * Robotics API client. The API origin is a runtime value injected by the host
 * page (window.__ENV__.VITE_API_URL); calls carry the session cookie, which is
 * host-only on the API host — never a relative /api call.
 */
import type { EnrollOut, EstopAllOut, EstopOut, FleetOut } from '../types/robotics';

declare global {
  interface Window {
    __ENV__?: { VITE_API_URL?: string };
  }
}

function origin(): string {
  const runtime = typeof window !== 'undefined' ? window.__ENV__?.VITE_API_URL : undefined;
  const buildTime = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
  return (runtime ?? buildTime ?? '').replace(/\/$/, '');
}

const base = () => `${origin()}/api/robotics`;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly detail: string) {
    super(detail || `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : '');
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const post = <T>(path: string) => request<T>(path, { method: 'POST', body: '{}' });
const id = (uuid: string) => encodeURIComponent(uuid);

export const roboticsApi = {
  listRobots: () => request<FleetOut>('/fleet/robots'),
  enroll: (uuid: string) => post<EnrollOut>(`/fleet/robots/${id(uuid)}/enroll`),
  enrollment: (uuid: string) => request<{ device_uuid: string; state: string }>(`/fleet/robots/${id(uuid)}/enrollment`),
  rotate: (uuid: string) => post<EnrollOut>(`/fleet/robots/${id(uuid)}/rotate-credential`),
  unenroll: (uuid: string) => request<void>(`/fleet/robots/${id(uuid)}/enrollment`, { method: 'DELETE' }),
  estop: (uuid: string) => post<EstopOut>(`/fleet/robots/${id(uuid)}/estop`),
  estopAll: () => post<EstopAllOut>('/fleet/actions/estop-all'),
};

/** Server-Sent Events URL of one robot's live stream (cookie-authenticated, direct route). */
export function streamUrl(uuid: string): string {
  return `${base()}/teleop/${id(uuid)}/stream`;
}
