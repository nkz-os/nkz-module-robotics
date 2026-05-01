export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Twist {
  linear: Vector3;
  angular: Vector3;
}

export interface RobotTelemetry {
  battery_pct: number;
  heading_deg: number;
  lat: number;
  lon: number;
  lin_x: number;
  ang_z: number;
  speed_kmh: number;
  ts: number;
  error?: string;
}

export interface RobotInfo {
  id: string;
  name: string;
  type: string;
  operationMode: 'MONITOR' | 'MANUAL' | 'AUTO' | 'ESTOP';
  battery: number;
  location?: { type: string; coordinates: [number, number] };
  dateModified?: string;
}

export type DriveMode = 'ACKERMANN_FRONT' | 'ACKERMANN_DUAL' | 'CRAB' | 'DIFFERENTIAL';

export type OperationMode = 'MONITOR' | 'MANUAL' | 'AUTO' | 'ESTOP';

export interface Geofence {
  id: string;
  name: string;
  type: 'inclusion' | 'exclusion';
  geometry: GeoJSON.Polygon;
  active: boolean;
}

export interface ZenohConfig {
  mode: string;
  connect: string[];
  namespaces: Record<string, string>;
  safety: Record<string, unknown>;
}

export interface RobotCredentials {
  username: string;
  password: string;
  endpoint: string;
}
