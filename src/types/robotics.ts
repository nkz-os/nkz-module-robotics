/** Wire types of the robotics API (/api/robotics). Mirror backend/app/api/*.py. */

export type EnrollmentState = 'applying' | 'active' | 'failed' | 'pending_acl';
export type RobotMode = 'MANUAL' | 'AUTO' | 'MISSION' | 'ESTOP';

/** Robot telemetry as published by the robot (robot bridge spec, "RobotTelemetry"). */
export interface RobotTelemetry {
  battery_pct: number;
  heading_deg: number;
  lat: number;
  lon: number;
  lin_x: number;
  ang_z: number;
  speed_kmh: number;
  ts: number;
}

export interface LiveState {
  online: boolean;
  heartbeat_age_s: number | null;
  vitals_age_ms: number | null;
  mode: RobotMode | null;
  telemetry: RobotTelemetry | null;
}

export interface FleetRobot {
  device_uuid: string;
  name: string;
  enrollment: { state: EnrollmentState } | null;
  live: LiveState | null;
}

export interface FleetOut {
  robots: FleetRobot[];
  link_up: boolean;
}

export interface ZenohCredential {
  endpoint: string;
  username: string;
  password: string;
  key_prefix: string;
}

export interface EnrollOut {
  device_uuid: string;
  state: EnrollmentState;
  zenoh: ZenohCredential;
}

export interface EstopOut {
  published: boolean;
  robot_connected: boolean;
}

export interface EstopAllOut {
  results: (EstopOut & { device_uuid: string })[];
  failed: string[];
}
