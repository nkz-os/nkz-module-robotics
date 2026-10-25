import { describe, expect, it } from 'vitest';
import { estopView, heartbeatKey, linkKey, num, robotConfig } from './format';

describe('heartbeatKey', () => {
  it('distinguishes never seen, online and stale', () => {
    expect(heartbeatKey(null)).toEqual({ key: 'live.never' });
    expect(heartbeatKey({ online: true, heartbeat_age_s: 0.8 } as never)).toEqual({ key: 'live.online' });
    expect(heartbeatKey({ online: false, heartbeat_age_s: 75 } as never)).toEqual({ key: 'live.staleFor', n: 75 });
  });
});

describe('estopView', () => {
  const sent = { published: true, robot_connected: true, sent_at: 100 };
  const live = (mode: string | null, mode_at: number | null, online = true) =>
    ({ online, heartbeat_age_s: 0.5, vitals_age_ms: 1, mode, mode_at, telemetry: null }) as never;

  it('only confirms when the online robot reports ESTOP after the stop was sent', () => {
    expect(estopView(null, null)).toBe('idle');
    expect(estopView({ ...sent, robot_connected: false }, live('AUTO', 90))).toBe('sentNoRobot');
    expect(estopView(sent, live('AUTO', 90))).toBe('sentUnconfirmed');
    expect(estopView(sent, live('ESTOP', 101))).toBe('confirmed');
  });

  it('does not confirm from a stale or offline ESTOP', () => {
    expect(estopView(sent, live('ESTOP', 50))).toBe('sentUnconfirmed');              // reported before this stop
    expect(estopView({ ...sent, robot_connected: false }, live('ESTOP', 101, false))).toBe('sentNoRobot');
    expect(estopView(sent, null)).toBe('sentUnconfirmed');
  });
});

describe('linkKey', () => {
  it('does not show an unknown link as up', () => {
    expect(linkKey(true)).toBe('live.linkUp');
    expect(linkKey(false)).toBe('live.linkDown');
    expect(linkKey(null)).toBe('live.linkUnknown');
  });
});

describe('num', () => {
  it('formats numbers and shows a dash for missing or malformed telemetry', () => {
    expect(num(12.345, 1)).toBe('12.3');
    expect(num(undefined, 1)).toBe('—');
    expect(num('7' as never, 0)).toBe('—');
    expect(num(Number.NaN, 0)).toBe('—');
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
