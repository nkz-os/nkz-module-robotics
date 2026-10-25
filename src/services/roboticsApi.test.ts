import { afterEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return import('./roboticsApi');
}

function stubFetch(status: number, body: unknown) {
  const f = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  vi.stubGlobal('fetch', f);
  return f;
}

describe('roboticsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the runtime API origin with the session cookie', async () => {
    vi.stubGlobal('window', { __ENV__: { VITE_API_URL: 'https://api.example.test/' } });
    const f = stubFetch(200, { robots: [], link_up: true });
    const { roboticsApi } = await load();
    await roboticsApi.listRobots();
    expect(f.mock.calls[0][0]).toBe('https://api.example.test/api/robotics/fleet/robots');
    expect(f.mock.calls[0][1].credentials).toBe('include');
  });

  it('posts the E-Stop for exactly one robot', async () => {
    vi.stubGlobal('window', { __ENV__: { VITE_API_URL: 'https://api.example.test' } });
    const f = stubFetch(200, { published: true, robot_connected: true });
    const { roboticsApi } = await load();
    await roboticsApi.estop('3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c');
    expect(f.mock.calls[0][0]).toBe(
      'https://api.example.test/api/robotics/fleet/robots/3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c/estop');
    expect(f.mock.calls[0][1].method).toBe('POST');
  });

  it('builds the stream URL on the API origin', async () => {
    vi.stubGlobal('window', { __ENV__: { VITE_API_URL: 'https://api.example.test' } });
    const { streamUrl } = await load();
    expect(streamUrl('u1')).toBe('https://api.example.test/api/robotics/teleop/u1/stream');
  });

  it('turns errors into ApiError with status', async () => {
    vi.stubGlobal('window', { __ENV__: { VITE_API_URL: 'https://api.example.test' } });
    stubFetch(503, { detail: 'Robot link is down' });
    const { roboticsApi, ApiError } = await load();
    const err = await roboticsApi.estop('u1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).status).toBe(503);
  });
});
