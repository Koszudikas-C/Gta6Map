import { Injectable, NgZone, inject, signal } from '@angular/core';
import { GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification, setWorkerUrl } from 'maplibre-gl';
import { buildLeonida3DBuildings } from '../data/leonida-3d-buildings';
import {
  LEONIDA_MAP_CONFIG,
  LEONIDA_POIS,
  LeonidaPoi,
  MapQualityMode,
  poisToGeoJson,
} from '../data/leonida-map.data';
import { MapCoordinates } from '../models/hud.models';
import { TelemetryService } from './telemetry.service';

const QUALITY_STORAGE_KEY = 'gta6map_quality';

function loadInitialQualityMode(): MapQualityMode {
  if (typeof localStorage === 'undefined') {
    return 'hd';
  }
  const saved = localStorage.getItem(QUALITY_STORAGE_KEY);
  return saved === 'light' ? 'light' : 'hd';
}

interface LeonidaAssetUrls {
  workerUrl: string;
  satelliteTilesUrl: string;
  demTilesUrl: string;
  landmarksUrl: string;
}

function resolveAssetUrls(): LeonidaAssetUrls {
  const baseUrl = typeof document !== 'undefined' ? new URL('.', document.baseURI).href : '/';
  return {
    workerUrl: `${baseUrl}maplibre-gl-worker.mjs`,
    satelliteTilesUrl: `${baseUrl}tiles/${LEONIDA_MAP_CONFIG.styles.satellite.id}/{z}/{x}/{y}.webp`,
    demTilesUrl: `${baseUrl}tiles/dem/{z}/{x}/{y}.png`,
    landmarksUrl: `${baseUrl}data/leonida-landmarks.json`,
  };
}

function buildLeonidaStyle(urls: LeonidaAssetUrls): StyleSpecification {
  return {
    version: 8,
    name: 'Leonida GTADB Map',
    sources: {
      'leonida-satellite': {
        type: 'raster',
        tiles: [urls.satelliteTilesUrl],
        tileSize: LEONIDA_MAP_CONFIG.tileSize,
        minzoom: LEONIDA_MAP_CONFIG.minZoom,
        maxzoom: LEONIDA_MAP_CONFIG.styles.satellite.maxZoom,
        scheme: 'xyz',
      },
      'leonida-dem': {
        type: 'raster-dem',
        tiles: [urls.demTilesUrl],
        tileSize: LEONIDA_MAP_CONFIG.tileSize,
        encoding: 'terrarium',
        minzoom: 0,
        maxzoom: 1,
      },
    },
    layers: [
      {
        id: 'leonida-ocean-bg',
        type: 'background',
        paint: {
          'background-color': LEONIDA_MAP_CONFIG.styles.satellite.oceanColor,
        },
      },
      {
        id: 'leonida-satellite-layer',
        type: 'raster',
        source: 'leonida-satellite',
        layout: { visibility: 'visible' },
        paint: { 'raster-fade-duration': 150 },
      },
      {
        id: 'leonida-hillshade',
        type: 'hillshade',
        source: 'leonida-dem',
        layout: { visibility: 'none' },
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': '#120B1E',
          'hillshade-highlight-color': '#FFB458',
        },
      },
    ],
  };
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly ngZone = inject(NgZone);
  private readonly telemetry = inject(TelemetryService);

  private map: MapLibreMap | null = null;
  private explorerMarker: Marker | null = null;
  private fpsRafId: number | null = null;
  private lowFpsStartTime: number | null = null;
  private lastLowFpsReportTime = 0;
  private allPois: LeonidaPoi[] = LEONIDA_POIS;
  private currentQuery = '';
  private currentCategory = 'Todas';

  readonly isLoaded = signal(false);
  readonly is3DMode = signal(false);
  readonly qualityMode = signal<MapQualityMode>(loadInitialQualityMode());
  readonly selectedPoi = signal<LeonidaPoi | null>(null);
  readonly totalPoisCount = signal(LEONIDA_POIS.length);
  readonly visiblePoisCount = signal(LEONIDA_POIS.length);
  readonly coordinates = signal<MapCoordinates>({
    lng: LEONIDA_MAP_CONFIG.initialCenter[0],
    lat: LEONIDA_MAP_CONFIG.initialCenter[1],
    zoom: LEONIDA_MAP_CONFIG.initialZoom,
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
        const urls = resolveAssetUrls();
        setWorkerUrl(urls.workerUrl);

        const map = new MapLibreMap({
          container,
          style: buildLeonidaStyle(urls),
          center: LEONIDA_MAP_CONFIG.initialCenter,
          zoom: LEONIDA_MAP_CONFIG.initialZoom,
          minZoom: 0.5,
          maxZoom: this.qualityMode() === 'hd' ? 6.0 : 4.5,
          maxBounds: LEONIDA_MAP_CONFIG.maxBounds,
          renderWorldCopies: false,
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
          this.add3DBuildingsLayer(map);
          this.addPoiLayers(map);
          this.bindPoiInteractions(map);
          void this.loadLandmarks(urls.landmarksUrl);
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

  toggleQualityMode(): void {
    this.setQualityMode(this.qualityMode() === 'hd' ? 'light' : 'hd');
  }

  setQualityMode(mode: MapQualityMode): void {
    this.qualityMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(QUALITY_STORAGE_KEY, mode);
    }
    if (!this.map) {
      return;
    }
    const nextMaxZoom = mode === 'hd' ? 6.0 : 4.5;
    this.ngZone.runOutsideAngular(() => {
      this.map?.setMaxZoom(nextMaxZoom);
      if ((this.map?.getZoom() ?? 0) > nextMaxZoom) {
        this.map?.easeTo({ zoom: nextMaxZoom, duration: 250 });
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
      if (next) {
        this.map?.setTerrain({ source: 'leonida-dem', exaggeration: 26 });
        this.map?.setLayoutProperty('leonida-hillshade', 'visibility', 'visible');
        this.map?.setLayoutProperty('leonida-buildings-3d', 'visibility', 'visible');
        this.map?.easeTo({ pitch: 60, bearing: -18, duration: 550 });
      } else {
        this.map?.setTerrain(null);
        this.map?.setLayoutProperty('leonida-hillshade', 'visibility', 'none');
        this.map?.setLayoutProperty('leonida-buildings-3d', 'visibility', 'none');
        this.map?.easeTo({ pitch: 0, bearing: 0, duration: 450 });
      }
      this.syncExplorerMarker(next);
    });
  }

  filterPois(query: string, category: string): void {
    this.currentQuery = query;
    this.currentCategory = category;

    const normalized = query.trim().toLowerCase();
    const filtered = this.allPois.filter((poi) => {
      const matchesCat = category === 'Todas' || poi.category === category;
      const matchesQuery =
        normalized.length === 0 ||
        poi.name.toLowerCase().includes(normalized) ||
        poi.region.toLowerCase().includes(normalized);
      return matchesCat && matchesQuery;
    });

    this.visiblePoisCount.set(filtered.length);
    const source = this.map?.getSource('leonida-pois') as GeoJSONSource | undefined;
    source?.setData(poisToGeoJson(filtered));
  }

  private async loadLandmarks(url: string): Promise<void> {
    if (typeof fetch !== 'function') {
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as LeonidaPoi[];
      if (!Array.isArray(data) || data.length === 0) {
        return;
      }
      this.allPois = data;
      const buildingsSource = this.map?.getSource('leonida-buildings') as GeoJSONSource | undefined;
      buildingsSource?.setData(buildLeonida3DBuildings(data));
      this.ngZone.run(() => {
        this.totalPoisCount.set(data.length);
        this.filterPois(this.currentQuery, this.currentCategory);
      });
    } catch {
      // Fallback already populated with LEONIDA_POIS
    }
  }

  private add3DBuildingsLayer(map: MapLibreMap): void {
    map.addSource('leonida-buildings', {
      type: 'geojson',
      data: buildLeonida3DBuildings(this.allPois),
    });

    map.addLayer({
      id: 'leonida-buildings-3d',
      type: 'fill-extrusion',
      source: 'leonida-buildings',
      layout: { visibility: this.is3DMode() ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  private addPoiLayers(map: MapLibreMap): void {
    map.addSource('leonida-pois', {
      type: 'geojson',
      data: poisToGeoJson(this.allPois),
      cluster: true,
      clusterMaxZoom: 4,
      clusterRadius: 42,
    });

    map.addLayer({
      id: 'leonida-clusters',
      type: 'circle',
      source: 'leonida-pois',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#C9349B',
          20,
          '#F36A78',
          60,
          '#FF9B55',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 16, 20, 21, 60, 26],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#120B1E',
      },
    });

    map.addLayer({
      id: 'leonida-cluster-count',
      type: 'symbol',
      source: 'leonida-pois',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#FFF6F8',
      },
    });

    map.addLayer({
      id: 'leonida-pois-circle',
      type: 'circle',
      source: 'leonida-pois',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 6.5,
        'circle-color': '#F44E8F',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFA66B',
      },
    });

    map.addLayer({
      id: 'leonida-pois-label',
      type: 'symbol',
      source: 'leonida-pois',
      minzoom: 3.2,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.4],
      },
      paint: {
        'text-color': '#FFF6F8',
        'text-halo-color': '#120B1E',
        'text-halo-width': 1.5,
      },
    });
  }

  private bindPoiInteractions(map: MapLibreMap): void {
    map.on('click', 'leonida-clusters', async (e) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.['cluster_id'] as number | undefined;
      if (clusterId === undefined) {
        return;
      }
      const source = map.getSource('leonida-pois') as GeoJSONSource | undefined;
      if (!source) {
        return;
      }
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const geometry = feature?.geometry as { coordinates?: [number, number] } | undefined;
      if (geometry?.coordinates) {
        map.easeTo({ center: geometry.coordinates, zoom, duration: 360 });
      }
    });

    map.on('click', 'leonida-pois-circle', (e) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.['id'] as string | undefined;
      const found = this.allPois.find((p) => p.id === id) ?? null;
      this.ngZone.run(() => this.selectedPoi.set(found));
    });
  }

  private syncExplorerMarker(active: boolean): void {
    if (!this.map) {
      return;
    }
    if (active && !this.explorerMarker) {
      const center = this.map.getCenter();
      this.explorerMarker = new Marker({ color: '#FFA66B', draggable: true })
        .setLngLat(center)
        .addTo(this.map);
      this.explorerMarker.on('dragend', () => {
        const lngLat = this.explorerMarker?.getLngLat();
        if (lngLat) {
          this.map?.flyTo({ center: lngLat, pitch: 65, duration: 500 });
        }
      });
    } else if (!active && this.explorerMarker) {
      this.explorerMarker.remove();
      this.explorerMarker = null;
    }
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
      const current = this.map?.getZoom() ?? LEONIDA_MAP_CONFIG.initialZoom;
      this.map?.easeTo({ zoom: Math.max(0.5, Math.min(7, current + delta)), duration: 180 });
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
