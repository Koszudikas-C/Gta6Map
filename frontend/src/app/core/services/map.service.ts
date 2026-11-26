import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { MapCoordinates } from '../models/hud.models';
import { TelemetryService } from './telemetry.service';

const LEONIDA_INITIAL_STYLE: StyleSpecification = {
  version: 8,
  name: 'Leonida Tactical HUD',
  sources: {},
  layers: [
    {
      id: 'leonida-asphalt-bg',
      type: 'background',
      paint: {
        'background-color': '#120B1E',
      },
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly ngZone = inject(NgZone);
  private readonly telemetry = inject(TelemetryService);

  private map: MapLibreMap | null = null;
  private fpsRafId: number | null = null;
  private lowFpsStartTime: number | null = null;
  private lastLowFpsReportTime = 0;

  readonly isLoaded = signal(false);
  readonly is3DMode = signal(false);
  readonly coordinates = signal<MapCoordinates>({
    lng: -80.1918,
    lat: 25.7617,
    zoom: 12.5,
    pitch: 0,
    bearing: 0,
  });

  initMap(container: HTMLElement): void {
    if (this.map) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      try {
        const initStart = performance.now();
        const map = new MapLibreMap({
          container,
          style: LEONIDA_INITIAL_STYLE,
          center: [-80.1918, 25.7617],
          zoom: 12.5,
          pitch: 0,
          bearing: 0,
          maxPitch: 65,
          attributionControl: false,
        });

        map.on('load', () => {
          const loadDurationMs = Math.round(performance.now() - initStart);
          this.telemetry.capture({
            level: 'perf',
            source: 'rum',
            message: `map_load_ms:${loadDurationMs}`,
          });
          this.ngZone.run(() => this.isLoaded.set(true));
          this.startFpsMonitor();
        });

        map.on('move', () => {
          const center = map.getCenter();
          this.ngZone.run(() => {
            this.coordinates.set({
              lng: Number(center.lng.toFixed(4)),
              lat: Number(center.lat.toFixed(4)),
              zoom: Number(map.getZoom().toFixed(2)),
              pitch: Number(map.getPitch().toFixed(1)),
              bearing: Number(map.getBearing().toFixed(1)),
            });
          });
        });

        map.on('error', (e: { error?: { message?: string } }) => {
          this.telemetry.capture({
            level: 'error',
            source: 'webgl',
            message: e.error?.message ?? 'MapLibre rendering error',
          });
        });

        this.map = map;
      } catch (err) {
        this.telemetry.capture({
          level: 'error',
          source: 'webgl',
          message: err instanceof Error ? err.message : 'Failed to initialize MapLibre',
        });
      }
    });
  }

  toggle3D(): void {
    const next = !this.is3DMode();
    this.is3DMode.set(next);

    if (!this.map) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.map?.easeTo({
        pitch: next ? 55 : 0,
        bearing: next ? -18 : 0,
        duration: 450,
      });
    });
  }

  panBy(dx: number, dy: number): void {
    if (!this.map) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.map?.panBy([dx, dy], { duration: 0 });
    });
  }

  zoomBy(delta: number): void {
    if (!this.map) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      const current = this.map?.getZoom() ?? 12.5;
      this.map?.easeTo({ zoom: Math.max(2, Math.min(20, current + delta)), duration: 180 });
    });
  }

  private startFpsMonitor(): void {
    if (this.fpsRafId !== null || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    let frames = 0;
    let lastSampleTime = performance.now();

    const tick = (now: number): void => {
      frames++;
      const elapsed = now - lastSampleTime;

      if (elapsed >= 1000) {
        const fps = (frames * 1000) / elapsed;
        frames = 0;
        lastSampleTime = now;

        if (fps < 30) {
          this.lowFpsStartTime ??= now;
          if (now - this.lowFpsStartTime >= 5000 && now - this.lastLowFpsReportTime >= 30000) {
            this.lastLowFpsReportTime = now;
            this.telemetry.capture({
              level: 'warn',
              source: 'rum',
              message: `low_fps:${Math.round(fps)}`,
            });
          }
        } else {
          this.lowFpsStartTime = null;
        }
      }

      this.fpsRafId = requestAnimationFrame(tick);
    };

    this.fpsRafId = requestAnimationFrame(tick);
  }

  destroy(): void {
    if (this.fpsRafId !== null) {
      cancelAnimationFrame(this.fpsRafId);
      this.fpsRafId = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.isLoaded.set(false);
    }
  }
}
