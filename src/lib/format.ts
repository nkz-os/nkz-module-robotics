import type { EstopOut, LiveState, RobotMode, ZenohCredential } from '../types/robotics';

export type HeartbeatView = { key: 'live.never' } | { key: 'live.online' } | { key: 'live.staleFor'; n: number };

export function heartbeatKey(live: Pick<LiveState, 'online' | 'heartbeat_age_s'> | null): HeartbeatView {
  if (!live || live.heartbeat_age_s === null || live.heartbeat_age_s === undefined) return { key: 'live.never' };
  if (live.online) return { key: 'live.online' };
  return { key: 'live.staleFor', n: Math.round(live.heartbeat_age_s) };
}

export type EstopView = 'idle' | 'sentNoRobot' | 'sentUnconfirmed' | 'confirmed';

/** An E-Stop counts as done only when the robot itself reports ESTOP. */
export function estopView(result: EstopOut | null, mode: RobotMode | null): EstopView {
  if (!result) return 'idle';
  if (mode === 'ESTOP') return 'confirmed';
  return result.robot_connected ? 'sentUnconfirmed' : 'sentNoRobot';
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
