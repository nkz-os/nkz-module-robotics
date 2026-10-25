import type { EstopOut, LiveState, ZenohCredential } from '../types/robotics';

export type HeartbeatView = { key: 'live.never' } | { key: 'live.online' } | { key: 'live.staleFor'; n: number };

export function heartbeatKey(live: Pick<LiveState, 'online' | 'heartbeat_age_s'> | null): HeartbeatView {
  if (!live || live.heartbeat_age_s === null || live.heartbeat_age_s === undefined) return { key: 'live.never' };
  if (live.online) return { key: 'live.online' };
  return { key: 'live.staleFor', n: Math.round(live.heartbeat_age_s) };
}

export type EstopView = 'idle' | 'sentNoRobot' | 'sentUnconfirmed' | 'confirmed';

/**
 * An E-Stop counts as done only when the robot, online, reports ESTOP after this
 * stop was sent (both times are the server's clock). An older ESTOP proves nothing.
 */
export function estopView(result: EstopOut | null, live: LiveState | null): EstopView {
  if (!result) return 'idle';
  if (live?.online && live.mode === 'ESTOP' && live.mode_at !== null && live.mode_at >= result.sent_at) {
    return 'confirmed';
  }
  return result.robot_connected ? 'sentUnconfirmed' : 'sentNoRobot';
}

/** Platform link label; unknown (stream not open yet) is never shown as up. */
export function linkKey(linkUp: boolean | null): 'live.linkUp' | 'live.linkDown' | 'live.linkUnknown' {
  if (linkUp === null) return 'live.linkUnknown';
  return linkUp ? 'live.linkUp' : 'live.linkDown';
}

/** Telemetry comes from the robot as-is: a missing or malformed value shows a dash, never a crash. */
export function num(value: unknown, digits: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

/** Settings for the robot's cloud bridge (the password is shown separately, once). */
export function robotConfig(c: ZenohCredential): string {
  return [
    `zenoh_endpoint: ${c.endpoint}`,
    `zenoh_username: ${c.username}`,
    `key_prefix: ${c.key_prefix}`,
    'zenoh_password: <stored in the credentials file, never in robot_config.json>',
  ].join('\n');
}
