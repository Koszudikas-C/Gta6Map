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
