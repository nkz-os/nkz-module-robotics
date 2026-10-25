import { describe, expect, it } from 'vitest';
import { estopView, heartbeatKey, robotConfig } from './format';

describe('heartbeatKey', () => {
  it('distinguishes never seen, online and stale', () => {
    expect(heartbeatKey(null)).toEqual({ key: 'live.never' });
    expect(heartbeatKey({ online: true, heartbeat_age_s: 0.8 } as never)).toEqual({ key: 'live.online' });
    expect(heartbeatKey({ online: false, heartbeat_age_s: 75 } as never)).toEqual({ key: 'live.staleFor', n: 75 });
  });
});

describe('estopView', () => {
  it('only confirms when the robot reports ESTOP', () => {
    expect(estopView(null, null)).toBe('idle');
    expect(estopView({ published: true, robot_connected: false }, 'AUTO')).toBe('sentNoRobot');
    expect(estopView({ published: true, robot_connected: true }, 'AUTO')).toBe('sentUnconfirmed');
    expect(estopView({ published: true, robot_connected: true }, 'ESTOP')).toBe('confirmed');
  });
});

describe('robotConfig', () => {
  it('produces the settings the robot bridge needs, without the password', () => {
    const text = robotConfig({ endpoint: 'tcp/192.0.2.10:7447', username: 'u1', password: 'secret', key_prefix: 'nkz/acme/u1' });
    expect(text).toContain('tcp/192.0.2.10:7447');
    expect(text).toContain('nkz/acme/u1');
    expect(text).not.toContain('secret');
  });
});
