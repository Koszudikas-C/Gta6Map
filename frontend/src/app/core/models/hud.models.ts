export type DeviceMode = 'desktop' | 'mobile' | 'console';

export type WheelAction = 'map' | 'filters' | '3d' | 'cinema' | 'center' | 'pin' | 'clear-pins';

export interface MapCoordinates {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface GamepadLegendItem {
  button: string;
  label: string;
}

export interface ClientTelemetryEvent {
  level: 'error' | 'warn' | 'perf';
  source: 'js' | 'webgl' | 'http' | 'rum';
  message: string;
  meta?: Record<string, unknown>;
  stack?: string;
  route: string;
  deviceType: DeviceMode;
  gamepadConnected: boolean;
  buildVersion: string;
  timestamp: string;
}

export type MethodPerfSortKey = 'totalMs' | 'maxMs' | 'p95Ms' | 'avgMs' | 'count';

export interface MethodPerfStats {
  name: string;
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  lastMs: number;
  slowCount: number;
  slowThresholdMs: number;
  lastMeta?: Record<string, unknown>;
  lastTimestamp: string;
}
