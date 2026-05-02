import type { RobotInfo, RobotCredentials, ZenohConfig } from '../types/robotics';

declare global {
  interface Window {
    __ENV__?: { VITE_API_URL?: string };
  }
}

const API_BASE = (window.__ENV__?.VITE_API_URL || '').replace(/\/$/, '');
const ROBOTICS_URL = `${API_BASE}/api/robotics`;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ROBOTICS_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const roboticsApi = {
  // -- Fleet ------------------------------------------------------------
  listRobots: (): Promise<{ robots: RobotInfo[]; count: number }> =>
    apiFetch('/fleet/robots'),

  getRobot: (id: string): Promise<RobotInfo> =>
    apiFetch(`/fleet/robots/${id}`),

  registerRobot: (body: {
    name: string;
    robot_id: string;
    robot_type?: string;
    parcel_id?: string | null;
  }): Promise<{ robot_id: string; name: string; credentials: RobotCredentials }> =>
    apiFetch('/fleet/robots', { method: 'POST', body: JSON.stringify(body) }),

  updateRobot: (id: string, attrs: Record<string, unknown>): Promise<void> =>
    apiFetch(`/fleet/robots/${id}`, { method: 'PATCH', body: JSON.stringify(attrs) }),

  decommissionRobot: (id: string): Promise<void> =>
    apiFetch(`/fleet/robots/${id}`, { method: 'DELETE' }),

  provisionRobot: (body: {
    name: string;
    robot_id: string;
    robot_type?: string;
    parcel_id?: string | null;
    device_uuid: string;
    claim_code: string;
  }): Promise<{
    robot_id: string;
    name: string;
    device_uuid: string;
    credentials: RobotCredentials;
    tailscale_auth_key: string | null;
    tailscale_login_server: string | null;
    ngsi_entity_id: string | null;
  }> => apiFetch('/fleet/robots/provision', { method: 'POST', body: JSON.stringify(body) }),

  checkVpnStatus: (): Promise<{
    vpn_available: boolean;
    vpn_url: string;
    vpn_status: any;
    hint?: string;
  }> => apiFetch('/fleet/vpn/check'),

  claimControl: (id: string): Promise<{ status: string; robot_id: string; controlledBy: string }> =>
    apiFetch(`/fleet/robots/${id}/claim-control`, { method: 'POST' }),

  releaseControl: (id: string): Promise<{ status: string; robot_id: string }> =>
    apiFetch(`/fleet/robots/${id}/release-control`, { method: 'POST' }),

  getRoute: (
    id: string,
    from?: string,
    to?: string,
    limit?: number,
  ): Promise<{ robot_id: string; geometry: any }> => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (limit) params.set('limit', String(limit));
    return apiFetch(`/fleet/robots/${id}/route?${params}`);
  },

  // -- Teleop config ----------------------------------------------------
  getConfig: (robotId: string, tenantId: string): Promise<ZenohConfig> =>
    apiFetch(`/teleop/${robotId}/config?tenant_id=${tenantId}`),

  // -- SSE telemetry ----------------------------------------------------
  streamTelemetry(
    robotId: string,
    onData: (data: any) => void,
    onError?: (err: Event) => void,
  ): () => void {
    const url = `${ROBOTICS_URL}/teleop/${robotId}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (e) => {
      try { onData(JSON.parse(e.data)); } catch { /* skip malformed frames */ }
    };
    if (onError) es.onerror = onError;
    return () => es.close();
  },

  // -- Fleet actions ----------------------------------------------------
  pauseAll: (): Promise<{ action: string; robots_affected: number; status: string }> =>
    apiFetch('/fleet/actions/pause-all', { method: 'POST' }),

  estopAll: (): Promise<{ action: string; robots_affected: number; status: string }> =>
    apiFetch('/fleet/actions/estop-all', { method: 'POST' }),

  // -- WebSocket control ------------------------------------------------
  connectControl(robotId: string): WebSocket {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = API_BASE.replace(/^https?:/, '');
    return new WebSocket(`${protocol}//${base}/api/robotics/teleop/${robotId}/control`);
  },
};
