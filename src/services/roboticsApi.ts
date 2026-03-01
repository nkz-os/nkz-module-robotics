// =============================================================================
// Robotics API Client
// Communicates with nkz-module-robotics backend (FastAPI).
// =============================================================================

declare global {
  interface Window {
    __ENV__?: { VITE_API_URL?: string };
    __NKZ_SDK__?: { auth?: { getToken?: () => string } };
    __nekazariAuth?: { token?: string };
  }
}

// API base is injected at runtime by the host nginx (window.__ENV__.VITE_API_URL).
// Falls back to build-time env var, then empty string (relative paths work when
// the frontend and API are served from the same origin).
const API_BASE =
  window.__ENV__?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_URL ||
  '';

const ROBOTICS_URL = `${API_BASE}/api/robotics`;

// Auth is handled via httpOnly cookie (credentials: 'include').

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${ROBOTICS_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Twist {
  linear: Vector3;
  angular: Vector3;
}

export interface ZenohConfig {
  mode: string;
  connect: string[];
  namespaces: Record<string, string>;
  safety: Record<string, unknown>;
}

export interface RobotTelemetry {
  battery_pct?: number;
  heading_deg?: number;
  lat?: number;
  lon?: number;
  lin_x?: number;
  ang_z?: number;
  ts?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export const roboticsApi = {
  async getConfig(robotId: string, tenantId: string): Promise<ZenohConfig> {
    const res = await apiFetch(`/devices/${robotId}/config?tenant_id=${tenantId}`);
    return res.json();
  },

  async emergencyStop(robotId: string, tenantId: string): Promise<void> {
    await apiFetch(`/devices/${robotId}/emergency_stop?tenant_id=${tenantId}`, {
      method: 'POST',
    });
  },

  async publishCmdVel(robotId: string, tenantId: string, twist: Twist): Promise<void> {
    await apiFetch(`/devices/${robotId}/cmd_vel?tenant_id=${tenantId}`, {
      method: 'POST',
      body: JSON.stringify(twist),
    });
  },

  async heartbeat(robotId: string, tenantId: string): Promise<void> {
    await apiFetch(`/devices/${robotId}/heartbeat?tenant_id=${tenantId}`, {
      method: 'POST',
    });
  },

  async ping(robotId: string, tenantId: string): Promise<number> {
    const t0 = Date.now();
    await apiFetch(`/devices/${robotId}/ping?tenant_id=${tenantId}`, {
      method: 'POST',
    });
    return Date.now() - t0;
  },

  /**
   * Subscribe to robot telemetry via SSE.
   * The backend proxies the Zenoh telemetry topic as a text/event-stream.
   *
   * Returns a cleanup function — call it to close the EventSource.
   */
  streamTelemetry(
    robotId: string,
    tenantId: string,
    onData: (telemetry: RobotTelemetry) => void,
    onError?: (err: Event) => void,
  ): () => void {
    // EventSource with withCredentials sends cookies cross-origin.
    const params = new URLSearchParams({ tenant_id: tenantId });
    const url = `${ROBOTICS_URL}/devices/${robotId}/telemetry/stream?${params}`;

    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e: MessageEvent) => {
      try {
        const data: RobotTelemetry = JSON.parse(e.data);
        if (!data.error) onData(data);
      } catch { /* skip malformed frames */ }
    };

    if (onError) {
      es.onerror = onError;
    }

    return () => es.close();
  },
};
