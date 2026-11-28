import { Injectable, NgZone, inject, isDevMode, signal } from '@angular/core';
import { GeoJSONSource, Map as MapLibreMap, Marker, Popup, StyleSpecification, setWorkerUrl } from 'maplibre-gl';
import type { Native3DCustomLayer } from './native-3d-layer';
import { buildLeonida3DBuildings } from '../data/leonida-3d-buildings';
import {
  LEONIDA_MAP_CONFIG,
  LEONIDA_POIS,
  LeonidaPoi,
  MapQualityMode,
  gtaviGameToLngLat,
  legacyLeonidaToGtaviLngLat,
  normalizeToMapLngLat,
  poisToGeoJson,
} from '../data/leonida-map.data';
import {
  ALL_POI_BLIPS,
  POI_BLIP_CATALOG,
  PoiBlipId,
  buildMapBlipSvg,
  getPoiIconUrl,
  getPoiItemMeta,
  renderLucideIconElements,
} from '../data/poi-category-icons';
import { groupOverlappingPois } from '../data/poi-callout-layout';
import { MapCoordinates } from '../models/hud.models';
import { environment } from '../../../environments/environment';
import { TelemetryService } from './telemetry.service';
import {
  CUSTOM_PIN_ICONS,
  CustomMapPin,
  CustomPinIconType,
  createCustomPinPopupContent,
} from './custom-pin-popup.helper';

const QUALITY_STORAGE_KEY = 'gta6map_quality';

const ROUTE_STORAGE_KEY = 'leonida_custom_route_v1';

const ROUTE_SEQUENCE_COLORS = [
  '#22C55E', // 1: Verde (Início)
  '#FACC15', // 2: Amarelo
  '#FF9B55', // 3: Laranja
  '#F44E8F', // 4: Magenta
  '#A855F7', // 5: Roxo
  '#38BDF8', // 6: Azul
] as const;

function loadSavedRoute(): LeonidaPoi[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(ROUTE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

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
  apiPoisUrl: string;
  landmarksUrl: string;
  native3DThemeBaseUrl: string;
}

function resolveAssetUrls(): LeonidaAssetUrls {
  const baseUrl = typeof document !== 'undefined' ? new URL('.', document.baseURI).href : '/';
  return {
    workerUrl: `${baseUrl}maplibre-gl-worker.mjs`,
    satelliteTilesUrl: LEONIDA_MAP_CONFIG.tileUrl,
    demTilesUrl: `${baseUrl}tiles/dem/{z}/{x}/{y}.png`,
    apiPoisUrl: `${baseUrl}api/pois`,
    landmarksUrl: `${baseUrl}data/leonida-landmarks.json`,
    native3DThemeBaseUrl: `${baseUrl}${LEONIDA_MAP_CONFIG.native3D.themePath}`,
  };
}

function buildLeonidaStyle(urls: LeonidaAssetUrls): StyleSpecification {
  const oceanColor = LEONIDA_MAP_CONFIG.styles.satellite.oceanColor;
  return {
    version: 8,
    name: 'Leonida Interactive Map',
    sky: {
      'sky-color': oceanColor,
      'horizon-color': oceanColor,
      'fog-color': oceanColor,
      'sky-horizon-blend': 0.5,
      'fog-ground-blend': 0.5,
    },
    sources: {
      'leonida-satellite': {
        type: 'raster',
        tiles: [urls.satelliteTilesUrl],
        bounds: LEONIDA_MAP_CONFIG.tileBounds,
        tileSize: LEONIDA_MAP_CONFIG.tileSize,
        minzoom: LEONIDA_MAP_CONFIG.minZoom,
        maxzoom: LEONIDA_MAP_CONFIG.styles.satellite.maxZoom,
        scheme: 'xyz',
      },
      'leonida-dem': {
        type: 'raster-dem',
        tiles: [urls.demTilesUrl],
        tileSize: 512,
        encoding: 'terrarium',
        minzoom: 0,
        maxzoom: 1,
      },
      'leonida-hillshade-dem': {
        type: 'raster-dem',
        tiles: [urls.demTilesUrl],
        tileSize: 512,
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
        paint: { 'raster-fade-duration': 0 },
      },
      {
        id: 'leonida-hillshade',
        type: 'hillshade',
        source: 'leonida-hillshade-dem',
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

const CUSTOM_PINS_STORAGE_KEY = 'leonida_custom_pins_v1';

function loadSavedCustomPins(): CustomMapPin[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: CustomMapPin) => {
      const [lng, lat] = normalizeToMapLngLat(Number(p.lng), Number(p.lat));
      return { ...p, lng, lat };
    });
  } catch {
    return [];
  }
}

export function parseCoordinateQuery(raw: string): { lng: number; lat: number } | null {
  const cleaned = raw.trim().replace(/[()°]/g, '');
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }
  const [[minLng, minLat], [maxLng, maxLat]] = LEONIDA_MAP_CONFIG.maxBounds;
  if (first >= minLng && first <= maxLng && second >= minLat && second <= maxLat) {
    return { lng: first, lat: second };
  }
  if (first >= -135 && first <= 80 && second >= -75 && second <= 78) {
    const [lng, lat] = legacyLeonidaToGtaviLngLat(first, second);
    return { lng, lat };
  }
  if (Math.abs(first) <= 16000 && Math.abs(second) <= 16000) {
    const [lng, lat] = gtaviGameToLngLat(first, second);
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
      return { lng, lat };
    }
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly ngZone = inject(NgZone);
  private readonly telemetry = inject(TelemetryService);

  private map: MapLibreMap | null = null;
  private explorerMarker: Marker | null = null;
  private focusPoi: LeonidaPoi | null = null;
  private routeBlinkTimer: ReturnType<typeof setInterval> | null = null;
  private customPinMarkers = new Map<string, Marker>();
  private poiOverlayEl: HTMLElement | null = null;
  private poiMarkerNodes = new Map<
    string,
    {
      el: HTMLButtonElement;
      iconKey: string;
      iconName: string;
      stackCount: number;
      lng: number;
      lat: number;
    }
  >();
  private lastPoiOverlaySize = -1;
  private fpsRafId: number | null = null;
  private lowFpsStartTime: number | null = null;
  private lastLowFpsReportTime = 0;
  private allPois: LeonidaPoi[] = LEONIDA_POIS;
  private currentQuery = '';
  private currentCategory = 'Todas';
  private currentFilteredPois: LeonidaPoi[] = this.allPois;
  private poiGroupsById = new Map<string, LeonidaPoi[]>();
  private lastCalloutZoom = -1;
  private lastCalloutSignature = '';
  private lastPinSize = -1;
  private trackLiveCoordinates = false;
  private isMapMoving = false;
  private native3DLayer: Native3DCustomLayer | null = null;
  private native3DAbort: AbortController | null = null;
  private native3DAssetsBase = '';

  readonly isLoaded = signal(false);
  readonly is3DMode = signal(false);
  readonly is3DLoading = signal(false);
  readonly native3DActive = signal(false);
  readonly isPinMode = signal(false);
  readonly customPins = signal<CustomMapPin[]>(loadSavedCustomPins());
  readonly qualityMode = signal<MapQualityMode>(loadInitialQualityMode());
  readonly selectedPoi = signal<LeonidaPoi | null>(null);
  readonly coLocatedPois = signal<LeonidaPoi[]>([]);
  readonly routePois = signal<LeonidaPoi[]>(loadSavedRoute());
  readonly markedPoiIds = signal<Set<string>>(new Set());
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
        this.native3DAssetsBase = urls.native3DThemeBaseUrl;
        setWorkerUrl(urls.workerUrl);

        const map = new MapLibreMap({
          container,
          style: buildLeonidaStyle(urls),
          center: LEONIDA_MAP_CONFIG.initialCenter,
          zoom: LEONIDA_MAP_CONFIG.initialZoom,
          minZoom: 8.5,
          maxZoom:
            this.qualityMode() === 'hd'
              ? LEONIDA_MAP_CONFIG.hdMaxZoom
              : LEONIDA_MAP_CONFIG.lightMaxZoom,
          maxBounds: LEONIDA_MAP_CONFIG.maxBounds,
          renderWorldCopies: false,
          pitch: 0,
          bearing: 0,
          maxPitch: 65,
          attributionControl: false,
          fadeDuration: 0,
          maxTileCacheSize: 256,
          cancelPendingTileRequestsWhileZooming: true,
          pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1,
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
          void this.registerPoiBlipImages(map);
          void this.loadLandmarks(urls.apiPoisUrl, urls.landmarksUrl);
          this.ngZone.run(() => this.isLoaded.set(true));
          this.startFpsMonitor();
        });

        map.on('movestart', () => {
          this.isMapMoving = true;
        });

        let lastCoordUpdate = 0;
        map.on('move', () => {
          if (!this.trackLiveCoordinates) {
            return;
          }
          const now = performance.now();
          if (now - lastCoordUpdate < 150) {
            return;
          }
          lastCoordUpdate = now;
          this.emitCoordinates(map);
        });

        map.on('moveend', () => {
          this.isMapMoving = false;
          this.emitCoordinates(map);
        });

        map.on('error', (e: { error?: { name?: string; message?: string } }) => {
          const err = e.error;
          const msg = err?.message ?? '';
          if (err?.name === 'AbortError' || /aborted/i.test(msg)) {
            return;
          }
          this.telemetry.capture({
            level: 'error',
            source: 'webgl',
            message: msg || 'MapLibre rendering error',
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

  setLiveCoordinatesEnabled(enabled: boolean): void {
    this.trackLiveCoordinates = enabled;
    if (enabled && this.map) {
      this.emitCoordinates(this.map);
    }
  }

  private emitCoordinates(map: MapLibreMap): void {
    const center = map.getCenter();
    const next: MapCoordinates = {
      lng: Number(center.lng.toFixed(4)),
      lat: Number(center.lat.toFixed(4)),
      zoom: Number(map.getZoom().toFixed(2)),
      pitch: Number(map.getPitch().toFixed(1)),
      bearing: Number(map.getBearing().toFixed(1)),
    };
    const current = this.coordinates();
    if (
      current.lng === next.lng &&
      current.lat === next.lat &&
      current.zoom === next.zoom &&
      current.pitch === next.pitch &&
      current.bearing === next.bearing
    ) {
      return;
    }
    this.ngZone.run(() => {
      this.coordinates.set(next);
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
    const nextMaxZoom =
      mode === 'hd' ? LEONIDA_MAP_CONFIG.hdMaxZoom : LEONIDA_MAP_CONFIG.lightMaxZoom;
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
        this.map?.easeTo({ pitch: 58, bearing: -18, duration: 420 });
        this.map?.once('moveend', () => {
          if (!this.is3DMode() || !this.map || this.native3DActive()) {
            return;
          }
          this.apply3DFallbackState(true);
        });
        void this.activateNative3DLayer();
      } else {
        this.unmountNative3DLayer();
        this.apply3DFallbackState(false);
        this.map?.easeTo({ pitch: 0, bearing: 0, duration: 380 });
      }
    });
  }

  private apply3DFallbackState(enabled: boolean): void {
    if (!this.map) {
      return;
    }
    if (enabled) {
      if (this.map.getSource('leonida-dem')) {
        this.map.setTerrain({ source: 'leonida-dem', exaggeration: 0.08 });
      }
      if (this.map.getLayer('leonida-hillshade')) {
        this.map.setLayoutProperty('leonida-hillshade', 'visibility', 'visible');
      }
      if (this.map.getLayer('leonida-buildings-3d')) {
        this.map.setLayoutProperty('leonida-buildings-3d', 'visibility', 'visible');
      }
    } else {
      this.map.setTerrain(null);
      if (this.map.getLayer('leonida-hillshade')) {
        this.map.setLayoutProperty('leonida-hillshade', 'visibility', 'none');
      }
      if (this.map.getLayer('leonida-buildings-3d')) {
        this.map.setLayoutProperty('leonida-buildings-3d', 'visibility', 'none');
      }
    }
  }

  private async activateNative3DLayer(): Promise<void> {
    if (!this.map || !this.is3DMode()) {
      return;
    }
    if (this.native3DLayer) {
      this.mountNative3DLayer(this.native3DLayer);
      return;
    }

    this.native3DAbort?.abort();
    const controller = new AbortController();
    this.native3DAbort = controller;
    this.ngZone.run(() => this.is3DLoading.set(true));

    try {
      const { createNative3DLayer } = await import('./native-3d-layer');
      const layer = await this.telemetry.measureAsync(
        'map.activateNative3DLayer',
        () =>
          createNative3DLayer({
            signal: controller.signal,
            geometryUrl: LEONIDA_MAP_CONFIG.native3D.geometryUrl,
            themeBaseUrl: this.native3DAssetsBase,
            fallbackThemeBaseUrl: LEONIDA_MAP_CONFIG.native3D.fallbackThemeBaseUrl,
            theme: 'day',
            onTiming: (name, durationMs, meta, slowThresholdMs) =>
              this.telemetry.recordTiming(name, durationMs, meta, slowThresholdMs),
          }),
        { layer: 'native-pause-map-3d' },
        5000,
      );

      if (controller.signal.aborted || !this.map || !this.is3DMode()) {
        layer.dispose();
        return;
      }

      this.native3DLayer = layer;
      this.mountNative3DLayer(layer);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        // Fallback 3D layer remains active if native 3D GLB fails to download
      }
    } finally {
      if (this.native3DAbort === controller) {
        this.native3DAbort = null;
        this.ngZone.run(() => this.is3DLoading.set(false));
      }
    }
  }

  private mountNative3DLayer(layer: Native3DCustomLayer): void {
    if (!this.map) {
      return;
    }
    this.telemetry.measure(
      'map.mountNative3DLayer',
      () => {
        this.ngZone.runOutsideAngular(() => {
          if (!this.map) {
            return;
          }
          this.map.setTerrain(null);
          if (this.map.getLayer('leonida-hillshade')) {
            this.map.setLayoutProperty('leonida-hillshade', 'visibility', 'none');
          }
          if (this.map.getLayer('leonida-buildings-3d')) {
            this.map.setLayoutProperty('leonida-buildings-3d', 'visibility', 'none');
          }
          if (this.map.getLayer('leonida-satellite-layer')) {
            this.map.setLayoutProperty('leonida-satellite-layer', 'visibility', 'none');
          }
          if (this.map.getLayer('leonida-ocean-bg')) {
            this.map.setPaintProperty('leonida-ocean-bg', 'background-color', layer.backgroundColor);
          }
          if (!this.map.getLayer(layer.id)) {
            const beforeId = this.map.getLayer('leonida-route-line')
              ? 'leonida-route-line'
              : this.map.getLayer('leonida-clusters')
                ? 'leonida-clusters'
                : undefined;
            this.map.addLayer(layer, beforeId);
          }
        });
        this.ngZone.run(() => this.native3DActive.set(true));
      },
      { layerId: layer.id },
      16,
    );
  }

  private unmountNative3DLayer(): void {
    if (this.native3DAbort) {
      this.native3DAbort.abort();
      this.native3DAbort = null;
    }
    this.ngZone.run(() => {
      this.is3DLoading.set(false);
      this.native3DActive.set(false);
    });
    if (!this.map || typeof this.map.getLayer !== 'function') {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      if (!this.map) {
        return;
      }
      if (this.native3DLayer && this.map.getLayer(this.native3DLayer.id)) {
        this.map.removeLayer(this.native3DLayer.id);
      }
      if (this.map.getLayer('leonida-satellite-layer')) {
        this.map.setLayoutProperty('leonida-satellite-layer', 'visibility', 'visible');
      }
      if (this.map.getLayer('leonida-ocean-bg')) {
        this.map.setPaintProperty(
          'leonida-ocean-bg',
          'background-color',
          LEONIDA_MAP_CONFIG.styles.satellite.oceanColor,
        );
      }
    });
  }

  private searchPrefixIndex = new Map<string, LeonidaPoi[]>();
  private categoryIndex = new Map<string, LeonidaPoi[]>();
  private poiById = new Map<string, LeonidaPoi>();
  private isolatedPoi: LeonidaPoi | null = null;
  readonly poisVersion = signal(0);
  readonly groupedPoisByCategory = signal<Array<{ category: string; items: LeonidaPoi[] }>>([]);

  constructor() {
    this.buildSearchIndex(this.allPois);
  }

  filterPois(query: string, category: string): void {
    this.telemetry.measure(
      'map.filterPois',
      () => {
        this.isolatedPoi = null;
        this.currentQuery = query;
        this.currentCategory = category;

        const normalized = normalizeSearchText(query.trim());
        const filtered =
          normalized.length > 0
            ? this.searchPoisFast(normalized, category, Number.MAX_SAFE_INTEGER).filter(
                (poi) => !poi.id.startsWith('__coord__:'),
              )
            : category === 'Todas'
              ? this.allPois
              : (this.categoryIndex.get(category) ?? []);

        this.currentFilteredPois = filtered;
        this.visiblePoisCount.set(filtered.length);
        this.syncPoiCalloutData(true);
      },
      () => ({
        queryLen: query.length,
        category,
        resultCount: this.currentFilteredPois.length,
      }),
      12,
    );
  }

  isolatePoi(poi: LeonidaPoi): void {
    this.isolatedPoi = poi;
    this.currentFilteredPois = [poi];
    this.visiblePoisCount.set(1);
    this.syncPoiCalloutData(true);
  }

  selectPoi(poi: LeonidaPoi | null): void {
    this.selectedPoi.set(poi);
    if (!poi) {
      this.coLocatedPois.set([]);
      if (this.focusPoi !== null) {
        this.focusPoi = null;
        this.syncRouteVisuals();
      }
      return;
    }
    const group = this.poiGroupsById.get(poi.id) ?? [poi];
    this.coLocatedPois.set(group);
    if (group.length > 1) {
      this.syncPoiCalloutData(true);
    }
  }

  cycleCoLocatedPoi(delta: 1 | -1): void {
    const group = this.coLocatedPois();
    if (group.length <= 1) {
      return;
    }
    const current = this.selectedPoi();
    const idx = current ? group.findIndex((p) => p.id === current.id) : 0;
    const nextIdx = (idx + delta + group.length) % group.length;
    const nextPoi = group[nextIdx];
    this.selectedPoi.set(nextPoi);
    if (this.focusPoi) {
      this.focusPoi = nextPoi;
      this.syncRouteVisuals();
    }
    this.syncPoiCalloutData(true);
  }

  private syncPoiCalloutData(force = false): void {
    const source = this.map?.getSource('leonida-pois') as GeoJSONSource | undefined;
    if (!source || !this.map) {
      return;
    }
    const zoom = this.map.getZoom();
    if (!force && zoom <= 13.5 && this.lastCalloutZoom <= 13.5 && this.lastCalloutZoom >= 0) {
      return;
    }
    if (!force && Math.abs(zoom - this.lastCalloutZoom) < 0.5) {
      return;
    }
    this.telemetry.measure(
      'map.syncPoiCalloutData',
      () => {
        this.lastCalloutZoom = zoom;
        const { geoJson, groupsByPoiId } = this.telemetry.measure(
          'map.groupOverlappingPois',
          () =>
            groupOverlappingPois(
              this.currentFilteredPois,
              zoom,
              22,
              this.selectedPoi()?.id,
            ),
          (res) => ({
            zoom: Number(zoom.toFixed(2)),
            inputPois: this.currentFilteredPois.length,
            outputFeatures: res.geoJson.features.length,
          }),
          8,
        );
        const signature = geoJson.features
          .map((f) => `${f.properties?.['id'] ?? ''}:${f.properties?.['stackCount'] ?? 1}`)
          .join('|');
        this.poiGroupsById = groupsByPoiId;
        const activePoi = this.selectedPoi();
        if (activePoi) {
          this.coLocatedPois.set(groupsByPoiId.get(activePoi.id) ?? [activePoi]);
        }
        if (!force && signature === this.lastCalloutSignature) {
          return;
        }
        this.lastCalloutSignature = signature;
        for (const feature of geoJson.features) {
          const count = feature.properties?.['stackCount'] as number | undefined;
          const badgeIcon = feature.properties?.['stackBadgeIcon'] as string | undefined;
          if (count && count > 1 && badgeIcon) {
            this.ensureNumberBadgeImage(badgeIcon, String(count), '#F44E8F', '#FFF6F8', 8);
          }
        }
        this.telemetry.measure(
          'map.poisSourceSetData',
          () => source.setData(geoJson),
          { features: geoJson.features.length },
          10,
        );
        setTimeout(() => this.syncPoiOverlayMarkers(), 0);
      },
      () => ({
        force,
        zoom: Number(zoom.toFixed(2)),
        inputPois: this.currentFilteredPois.length,
      }),
      12,
    );
  }

  searchPoisFast(query: string, category = 'Todas', limit = 24): LeonidaPoi[] {
    this.poisVersion();
    return this.telemetry.measure(
      'map.searchPoisFast',
      () => {
        const coord = parseCoordinateQuery(query);
        if (coord && category !== 'Ocultos') {
          const coordTarget: LeonidaPoi = {
            id: `__coord__:${coord.lng.toFixed(4)},${coord.lat.toFixed(4)}`,
            name: `Ir para ${coord.lng.toFixed(3)}, ${coord.lat.toFixed(3)}`,
            category: 'Pontos-Chave',
            region: 'Coordenadas exatas',
            description: `Localização exata em ${coord.lng.toFixed(3)}, ${coord.lat.toFixed(3)}.`,
            lng: coord.lng,
            lat: coord.lat,
          };
          const pool = category === 'Todas' ? this.allPois : (this.categoryIndex.get(category) ?? []);
          const nearest = [...pool]
            .sort(
              (a, b) =>
                (a.lng - coord.lng) ** 2 +
                (a.lat - coord.lat) ** 2 -
                ((b.lng - coord.lng) ** 2 + (b.lat - coord.lat) ** 2),
            )
            .slice(0, Math.max(0, limit - 1));
          return [coordTarget, ...nearest].slice(0, limit);
        }

        const tokens = normalizeSearchText(query.trim())
          .split(/[\s,.\-_/]+/)
          .filter(Boolean);
        if (tokens.length === 0) {
          return [];
        }

        const firstBucket = this.searchPrefixIndex.get(tokens[0]) ?? [];
        if (firstBucket.length === 0) {
          return [];
        }

        const results: LeonidaPoi[] = [];
        for (const poi of firstBucket) {
          if (category !== 'Todas' && poi.category !== category) {
            continue;
          }
          if (tokens.length > 1) {
            const haystack = normalizeSearchText(`${poi.name} ${poi.region} ${poi.category}`);
            if (!tokens.every((t) => haystack.includes(t))) {
              continue;
            }
          }
          results.push(poi);
          if (results.length >= limit) {
            break;
          }
        }
        return results;
      },
      (results) => ({
        queryLen: query.length,
        category,
        limit,
        resultCount: results.length,
      }),
      8,
    );
  }

  getPoisByCategory(category: string): LeonidaPoi[] {
    this.poisVersion();
    return category === 'Todas' ? this.allPois : (this.categoryIndex.get(category) ?? []);
  }

  getRouteStep(id: string): number {
    return this.routePois().findIndex((p) => p.id === id) + 1;
  }

  getRouteStepColor(step: number): string {
    if (step <= 0) {
      return '#FFB458';
    }
    return ROUTE_SEQUENCE_COLORS[(step - 1) % ROUTE_SEQUENCE_COLORS.length];
  }

  isPoiMarked(id: string): boolean {
    return this.getRouteStep(id) > 0;
  }

  togglePoiMark(poi: LeonidaPoi): void {
    const current = this.routePois();
    const exists = current.some((p) => p.id === poi.id);
    const next = exists ? current.filter((p) => p.id !== poi.id) : [...current, poi];
    if (exists && this.focusPoi?.id === poi.id) {
      this.focusPoi = null;
    }
    this.routePois.set(next);
    this.saveRoute(next);
    this.syncRouteVisuals();
  }

  clearRoute(): void {
    this.focusPoi = null;
    this.routePois.set([]);
    this.saveRoute([]);
    this.syncRouteVisuals();
  }

  private saveRoute(route: LeonidaPoi[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
    } catch {}
  }

  flyToPoi(poi: LeonidaPoi, highlightBlink = false): void {
    const targetZoom = this.map
      ? Math.min(this.map.getMaxZoom(), Math.max(this.map.getZoom(), 15.5))
      : 15.5;
    this.map?.flyTo({
      center: [poi.lng, poi.lat],
      zoom: targetZoom,
      duration: 600,
      essential: true,
    });
    this.selectedPoi.set(poi);
    const group = this.poiGroupsById.get(poi.id) ?? [poi];
    this.coLocatedPois.set(group);
    this.focusPoi = highlightBlink ? poi : null;
    this.syncRouteVisuals();
    if (group.length > 1) {
      this.syncPoiCalloutData(true);
    }
  }

  private startRouteBlinkLoop(): void {
    if (this.routeBlinkTimer !== null || typeof window === 'undefined') {
      return;
    }
    let bright = true;
    this.routeBlinkTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (!this.map || !this.map.getLayer('leonida-route-blips')) {
        return;
      }
      bright = !bright;
      this.map.setPaintProperty('leonida-route-blips', 'icon-opacity', bright ? 1 : 0.2);
    }, 450);
  }

  private syncRouteVisuals(): void {
    if (!this.map) {
      return;
    }
    this.telemetry.measure(
      'map.syncRouteVisuals',
      () => {
        if (!this.map) {
          return;
        }
        const route = this.routePois();
        const stopFeatures = route.map((poi, index) => {
          const step = index + 1;
          const color = this.getRouteStepColor(step);
          const badgeIcon = `route-badge-${step}-${color.replace('#', '')}`;
          this.ensureNumberBadgeImage(badgeIcon, String(step), color, '#120B1E', 9);
          return {
            type: 'Feature' as const,
            properties: {
              id: poi.id,
              step: String(step),
              color,
              badgeIcon,
              iconKey: getPoiItemMeta(poi.category, poi.name).id,
            },
            geometry: {
              type: 'Point' as const,
              coordinates: [poi.lng, poi.lat] as [number, number],
            },
          };
        });

        if (this.focusPoi && !route.some((p) => p.id === this.focusPoi!.id)) {
          stopFeatures.push({
            type: 'Feature' as const,
            properties: {
              id: this.focusPoi.id,
              step: '',
              color: '#FFB458',
              badgeIcon: '',
              iconKey: getPoiItemMeta(this.focusPoi.category, this.focusPoi.name).id,
            },
            geometry: {
              type: 'Point' as const,
              coordinates: [this.focusPoi.lng, this.focusPoi.lat] as [number, number],
            },
          });
        }

        const stopsSource = this.map.getSource('leonida-route-stops') as GeoJSONSource | undefined;
        stopsSource?.setData({
          type: 'FeatureCollection',
          features: stopFeatures,
        });

        if (this.map.getLayer('leonida-pois-symbol')) {
          const activeIds = stopFeatures.map((f) => f.properties.id);
          this.map.setFilter(
            'leonida-pois-symbol',
            activeIds.length > 0
              ? ['all', ['!', ['has', 'point_count']], ['!', ['in', ['get', 'id'], ['literal', activeIds]]]]
              : ['!', ['has', 'point_count']],
          );
        }

        const routeSource = this.map.getSource('leonida-route') as GeoJSONSource | undefined;
        routeSource?.setData({
          type: 'FeatureCollection',
          features:
            route.length >= 2
              ? [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'LineString',
                      coordinates: route.map((p) => [p.lng, p.lat]),
                    },
                  },
                ]
              : [],
        });

        if (stopFeatures.length > 0) {
          this.startRouteBlinkLoop();
        } else {
          if (this.routeBlinkTimer !== null) {
            clearInterval(this.routeBlinkTimer);
            this.routeBlinkTimer = null;
          }
          if (this.map.getLayer('leonida-route-blips')) {
            this.map.setPaintProperty('leonida-route-blips', 'icon-opacity', 1);
          }
        }
      },
      () => ({ stopsCount: this.routePois().length }),
      8,
    );
  }

  getFeaturedPois(limit = 8): LeonidaPoi[] {
    this.poisVersion();
    return this.allPois.slice(0, limit);
  }

  private buildSearchIndex(pois: LeonidaPoi[]): void {
    this.telemetry.measure(
      'map.buildSearchIndex',
      () => {
        const index = new Map<string, LeonidaPoi[]>();
        const catIndex = new Map<string, LeonidaPoi[]>();
        const idMap = new Map<string, LeonidaPoi>();

        for (const poi of pois) {
          idMap.set(poi.id, poi);
          let catBucket = catIndex.get(poi.category);
          if (!catBucket) {
            catBucket = [];
            catIndex.set(poi.category, catBucket);
          }
          catBucket.push(poi);

          const seenPrefixes = new Set<string>();
          const tokens = normalizeSearchText(`${poi.name} ${poi.region} ${poi.category}`)
            .split(/[\s,.\-_/]+/)
            .filter(Boolean);
          for (const token of tokens) {
            for (let len = 1; len <= token.length; len++) {
              const prefix = token.slice(0, len);
              if (seenPrefixes.has(prefix)) {
                continue;
              }
              seenPrefixes.add(prefix);
              let bucket = index.get(prefix);
              if (!bucket) {
                bucket = [];
                index.set(prefix, bucket);
              }
              bucket.push(poi);
            }
          }
        }

        const grouped = Array.from(catIndex.entries())
          .map(([category, items]) => ({ category, items }))
          .sort((a, b) => b.items.length - a.items.length);

        this.searchPrefixIndex = index;
        this.categoryIndex = catIndex;
        this.poiById = idMap;
        this.groupedPoisByCategory.set(grouped);
        this.poisVersion.update((v) => v + 1);
      },
      () => ({
        poiCount: pois.length,
        prefixKeys: this.searchPrefixIndex.size,
        categories: this.categoryIndex.size,
      }),
      25,
    );
  }

  private async loadLandmarks(apiUrl: string, fallbackUrl: string): Promise<void> {
    if (typeof fetch !== 'function') {
      return;
    }

    await this.telemetry.measureAsync(
      'map.loadLandmarks',
      async () => {
        const apiData = await this.fetchPoisFromUrl(apiUrl);
        let data = apiData;
        if (!apiData || apiData.length === 0) {
          data = await this.fetchPoisFromUrl(fallbackUrl);
        } else if (apiData.length >= 10) {
          const staticData = await this.fetchPoisFromUrl(fallbackUrl);
          if (staticData && staticData.length > 0) {
            data = this.telemetry.measure(
              'map.mergeLandmarks',
              () => {
                const seenIds = new Set(apiData.map((p) => p.id));
                const seenNamesCoords = new Set(
                  apiData.map(
                    (p) => `${p.name.trim().toLowerCase()}|${p.lng.toFixed(3)}|${p.lat.toFixed(3)}`,
                  ),
                );
                const extras = staticData.filter((p) => {
                  if (seenIds.has(p.id)) {
                    return false;
                  }
                  const sig = `${p.name.trim().toLowerCase()}|${p.lng.toFixed(3)}|${p.lat.toFixed(3)}`;
                  return !seenNamesCoords.has(sig);
                });
                return [...apiData, ...extras];
              },
              (merged) => ({
                apiCount: apiData.length,
                staticCount: staticData.length,
                mergedCount: merged.length,
              }),
              20,
            );
          }
        }
        if (!data || data.length === 0) {
          return;
        }

        this.allPois = data;
        const buildingsSource = this.map?.getSource('leonida-buildings') as GeoJSONSource | undefined;
        if (buildingsSource) {
          const buildingsFc = this.telemetry.measure(
            'map.build3DBuildings',
            () => buildLeonida3DBuildings(data),
            (fc) => ({ inputPois: data.length, buildingsCount: fc.features.length }),
            20,
          );
          buildingsSource.setData(buildingsFc);
        }
        this.ngZone.run(() => {
          this.buildSearchIndex(data);
          this.totalPoisCount.set(data.length);
          if (this.isolatedPoi) {
            this.isolatePoi(this.isolatedPoi);
          } else {
            this.filterPois(this.currentQuery, this.currentCategory);
          }
        });
      },
      () => ({ totalPois: this.allPois.length }),
      250,
    );
  }

  private async fetchPoisFromUrl(url: string): Promise<LeonidaPoi[] | null> {
    return this.telemetry.measureAsync(
      'map.fetchPoisFromUrl',
      async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            return null;
          }
          const payload = (await res.json()) as
            | LeonidaPoi[]
            | { pois?: unknown[]; items?: unknown[]; data?: unknown[] };
          const rawList = Array.isArray(payload)
            ? payload
            : Array.isArray(payload.pois)
              ? payload.pois
              : Array.isArray(payload.items)
                ? payload.items
                : Array.isArray(payload.data)
                  ? payload.data
                  : null;

          if (!rawList || rawList.length === 0) {
            return null;
          }

          return this.telemetry.measure(
            'map.normalizePoisList',
            () => rawList.map((item) => this.normalizePoi(item as Record<string, unknown>)),
            (normalized) => ({ count: normalized.length }),
            16,
          );
        } catch {
          return null;
        }
      },
      (list) => ({ url, count: list?.length ?? 0 }),
      200,
    );
  }

  private normalizePoi(raw: Record<string, unknown>): LeonidaPoi {
    const [lng, lat] = normalizeToMapLngLat(
      Number(raw['coord_x'] ?? raw['lng'] ?? 0),
      Number(raw['coord_y'] ?? raw['lat'] ?? 0),
    );
    return {
      id: String(raw['id'] ?? ''),
      name: String(raw['title'] ?? raw['name'] ?? ''),
      category: String(raw['category_name'] ?? raw['category'] ?? 'Pontos-Chave') as LeonidaPoi['category'],
      region: String(raw['region'] ?? 'Leonida'),
      description: String(raw['description'] ?? ''),
      lng,
      lat,
      ...(raw['icon'] ? { icon: String(raw['icon']) } : {}),
    };
  }

  private add3DBuildingsLayer(map: MapLibreMap): void {
    const buildingsFc = this.telemetry.measure(
      'map.build3DBuildings',
      () => buildLeonida3DBuildings(this.allPois),
      (fc) => ({ inputPois: this.allPois.length, buildingsCount: fc.features.length }),
      20,
    );
    map.addSource('leonida-buildings', {
      type: 'geojson',
      data: buildingsFc,
    });

    map.addLayer({
      id: 'leonida-buildings-3d',
      type: 'fill-extrusion',
      source: 'leonida-buildings',
      minzoom: 13,
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

  private async registerPoiBlipImages(map: MapLibreMap): Promise<void> {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return;
    }

    await this.telemetry.measureAsync(
      'map.registerPoiBlipImages',
      () =>
        Promise.all(
          ALL_POI_BLIPS.map(
            (blip) =>
              new Promise<void>((resolve) => {
                const imageId = `poi-blip-${blip.id}`;
                if (map.hasImage(imageId)) {
                  resolve();
                  return;
                }
                const iconPx = 96;
                const img = new Image(iconPx, iconPx);
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = iconPx;
                    canvas.height = iconPx;
                    const ctx = canvas.getContext('2d');
                    if (ctx && !map.hasImage(imageId)) {
                      ctx.imageSmoothingEnabled = true;
                      ctx.imageSmoothingQuality = 'high';
                      ctx.drawImage(img, 0, 0, iconPx, iconPx);
                      map.addImage(imageId, ctx.getImageData(0, 0, iconPx, iconPx), { pixelRatio: 3.5 });
                    }
                  } catch {}
                  resolve();
                };
                img.onerror = () => resolve();
                img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildMapBlipSvg(blip, iconPx))}`;
              }),
          ),
        ),
      { blipCount: ALL_POI_BLIPS.length },
      300,
    );
  }

  private addPoiLayers(map: MapLibreMap): void {
    map.addSource('leonida-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'leonida-route-line',
      type: 'line',
      source: 'leonida-route',
      paint: {
        'line-color': '#FFB458',
        'line-width': 3,
        'line-dasharray': [2, 1.5],
        'line-opacity': 0.88,
      },
    });

    map.addSource('leonida-route-stops', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'leonida-route-blips',
      type: 'symbol',
      source: 'leonida-route-stops',
      layout: {
        'icon-image': ['concat', 'poi-blip-', ['get', 'iconKey']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.56, 14, 0.84, 17, 1.05],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-opacity': 1,
      },
    });

    map.addLayer({
      id: 'leonida-route-step-badge',
      type: 'symbol',
      source: 'leonida-route-stops',
      filter: ['!=', ['get', 'badgeIcon'], ''],
      layout: {
        'icon-image': ['get', 'badgeIcon'],
        'icon-offset': [12, -12],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    const initialPoisGeoJson = this.telemetry.measure(
      'map.poisToGeoJson',
      () => poisToGeoJson(this.allPois),
      (fc) => ({ count: fc.features.length }),
      16,
    );
    map.addSource('leonida-pois', {
      type: 'geojson',
      data: initialPoisGeoJson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 40,
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
        'circle-pitch-alignment': 'viewport',
        'circle-pitch-scale': 'viewport',
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
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#FFF6F8',
      },
    });

    map.addLayer({
      id: 'leonida-pois-symbol',
      type: 'symbol',
      source: 'leonida-pois',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['concat', 'poi-blip-', ['get', 'iconKey']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.56, 14, 0.84, 17, 1.05],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 2,
      },
      paint: {
        'icon-opacity': 0,
      },
    });

    map.addLayer({
      id: 'leonida-poi-stack-badge',
      type: 'symbol',
      source: 'leonida-pois',
      filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'stackCount'], 1]],
      layout: {
        'icon-image': ['get', 'stackBadgeIcon'],
        'icon-offset': [11, -11],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-opacity': 0,
      },
    });
  }

  private ensureNumberBadgeImage(
    imageId: string,
    label: string,
    bgColor: string,
    textColor: string,
    radiusPx: number,
  ): void {
    if (!this.map || this.map.hasImage(imageId) || typeof document === 'undefined') {
      return;
    }
    const dpr = 2;
    const size = Math.ceil((radiusPx + 3) * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.scale(dpr, dpr);
    const cx = size / 2;
    const cy = size / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#120B1E';
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = `700 ${label.length > 1 ? 9 : 10.5}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 0.5);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.map.addImage(imageId, imgData, { pixelRatio: dpr });
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

    map.on('click', 'leonida-pois-symbol', (e) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.['id'] as string | undefined;
      const found = this.allPois.find((p) => p.id === id) ?? null;
      this.ngZone.run(() => this.selectPoi(found));
    });

    map.on('click', (e) => {
      if (!this.isPinMode()) {
        return;
      }
      const targetEl = e.originalEvent?.target as HTMLElement | null;
      if (targetEl?.closest('.maplibregl-marker, .maplibregl-popup')) {
        return;
      }
      const hit = map.queryRenderedFeatures(e.point, {
        layers: ['leonida-pois-symbol', 'leonida-clusters'],
      });
      if (hit.length > 0) {
        return;
      }
      this.ngZone.run(() => {
        this.addCustomPin(e.lngLat.lng, e.lngLat.lat);
      });
    });

    map.on('zoom', () => this.syncCustomPinSizes());
    map.on('zoomend', () => {
      this.syncPoiCalloutData();
      this.syncPoiOverlayMarkers();
    });
    map.on('move', () => this.repositionPoiOverlayMarkers());
    map.on('moveend', () => this.syncPoiOverlayMarkers());
    map.on('sourcedata', (e) => {
      if (e.sourceId === 'leonida-pois' && e.isSourceLoaded) {
        this.syncPoiOverlayMarkers();
      }
    });

    this.renderSavedCustomPins();
    this.syncRouteVisuals();
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

  orbitCameraBy(bearingDelta: number, pitchDelta: number): void {
    if (!this.map) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      if (!this.map) {
        return;
      }
      if (bearingDelta !== 0) {
        this.map.setBearing(this.map.getBearing() + bearingDelta);
      }
      if (pitchDelta !== 0) {
        const nextPitch = Math.max(0, Math.min(65, this.map.getPitch() + pitchDelta));
        this.map.setPitch(nextPitch);
        if (nextPitch > 8 && !this.is3DMode()) {
          this.ngZone.run(() => this.is3DMode.set(true));
          if (!this.native3DActive()) {
            this.apply3DFallbackState(true);
          }
          void this.activateNative3DLayer();
        } else if (nextPitch <= 1 && this.is3DMode()) {
          this.ngZone.run(() => this.is3DMode.set(false));
          this.unmountNative3DLayer();
          this.apply3DFallbackState(false);
        }
      }
    });
  }

  togglePinMode(): void {
    const next = !this.isPinMode();
    this.isPinMode.set(next);
    if (this.map) {
      this.map.getCanvas().style.cursor = next ? 'crosshair' : '';
    }
  }

  addCustomPin(lng: number, lat: number, title?: string): CustomMapPin {
    const pins = this.customPins();
    const pin: CustomMapPin = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pin-${Date.now()}`,
      title: title ?? `Ponto #${pins.length + 1}`,
      notes: '',
      lng,
      lat,
      color: '#38BDF8',
      iconType: 'pin',
      createdAt: new Date().toISOString(),
    };
    const next = [pin, ...pins];
    this.customPins.set(next);
    this.saveCustomPins(next);
    this.mountCustomPinMarker(pin);
    return pin;
  }

  updateCustomPin(id: string, patch: Partial<Pick<CustomMapPin, 'title' | 'notes' | 'color' | 'iconType'>>): void {
    const updated = this.customPins().map((p) => (p.id === id ? { ...p, ...patch } : p));
    this.customPins.set(updated);
    this.saveCustomPins(updated);
    const target = updated.find((p) => p.id === id);
    if (target && (patch.color !== undefined || patch.iconType !== undefined)) {
      const marker = this.customPinMarkers.get(id);
      if (marker) {
        this.applyPinVisual(marker.getElement(), target.color, target.iconType);
      }
    }
  }

  removeCustomPin(id: string): void {
    const marker = this.customPinMarkers.get(id);
    if (marker) {
      marker.getPopup()?.remove();
      marker.remove();
      this.customPinMarkers.delete(id);
    }
    const next = this.customPins().filter((p) => p.id !== id);
    this.customPins.set(next);
    this.saveCustomPins(next);
  }

  clearCustomPins(): void {
    for (const marker of this.customPinMarkers.values()) {
      marker.getPopup()?.remove();
      marker.remove();
    }
    this.customPinMarkers.clear();
    this.poiMarkerNodes.clear();
    this.poiOverlayEl?.remove();
    this.poiOverlayEl = null;
    this.lastPinSize = -1;
    this.customPins.set([]);
    this.saveCustomPins([]);
  }

  closeAllCustomPinPopups(): void {
    for (const marker of this.customPinMarkers.values()) {
      const popup = marker.getPopup();
      if (popup?.isOpen()) {
        popup.remove();
      }
    }
  }

  addCustomPinAtScreen(clientX: number, clientY: number): CustomMapPin | null {
    if (!this.map) {
      return null;
    }
    const rect = this.map.getCanvas().getBoundingClientRect();
    const lngLat = this.map.unproject([clientX - rect.left, clientY - rect.top]);
    return this.addCustomPin(lngLat.lng, lngLat.lat);
  }

  getVisibleMapTargets(): { x: number; y: number; type: 'poi' | 'pin'; id: string }[] {
    if (!this.map) {
      return [];
    }
    return this.telemetry.measure(
      'map.getVisibleMapTargets',
      () => {
        if (!this.map) {
          return [];
        }
        const rect = this.map.getCanvas().getBoundingClientRect();
        const targets: { x: number; y: number; type: 'poi' | 'pin'; id: string }[] = [];
        const seenIds = new Set<string>();

        for (const [id, marker] of this.customPinMarkers.entries()) {
          const lngLat = marker.getLngLat();
          const pt = this.map.project(lngLat);
          const x = rect.left + pt.x;
          const y = rect.top + pt.y;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            targets.push({ x, y, type: 'pin', id });
          }
        }

        const poiLayers = ['leonida-route-blips', 'leonida-pois-symbol'].filter((id) =>
          Boolean(this.map?.getLayer(id)),
        );
        if (poiLayers.length > 0) {
          const features = this.map.queryRenderedFeatures({ layers: poiLayers });
          for (const feature of features) {
            const id = feature.properties?.['id'] as string | undefined;
            if (!id || seenIds.has(id)) {
              continue;
            }
            seenIds.add(id);
            const geometry = feature.geometry as { coordinates?: [number, number] } | undefined;
            const coords = geometry?.coordinates;
            if (!coords) {
              continue;
            }
            const pt = this.map.project(coords);
            const x = rect.left + pt.x;
            const y = rect.top + pt.y;
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              targets.push({ x, y, type: 'poi', id });
            }
          }
        }

        return targets;
      },
      (targets) => ({ targetCount: targets.length }),
      8,
    );
  }

  handleScreenClick(clientX: number, clientY: number): void {
    if (!this.map) {
      return;
    }

    this.telemetry.measure(
      'map.handleScreenClick',
      () => {
        if (!this.map) {
          return;
        }
        const targetEl =
          typeof document !== 'undefined'
            ? (document.elementFromPoint(clientX, clientY) as HTMLElement | null)
            : null;
        const markerEl = targetEl?.closest('.maplibregl-marker');
        if (markerEl) {
          for (const marker of this.customPinMarkers.values()) {
            if (marker.getElement() === markerEl) {
              marker.togglePopup();
              return;
            }
          }
        }

        const canvas = this.map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const point: [number, number] = [clientX - rect.left, clientY - rect.top];
        const queryBox: [[number, number], [number, number]] = [
          [point[0] - 16, point[1] - 16],
          [point[0] + 16, point[1] + 16],
        ];

        const poiLayers = ['leonida-route-blips', 'leonida-pois-symbol'].filter((id) =>
          Boolean(this.map?.getLayer(id)),
        );
        if (poiLayers.length > 0) {
          const poiHits = this.map.queryRenderedFeatures(queryBox, { layers: poiLayers });
          const id = poiHits[0]?.properties?.['id'] as string | undefined;
          const found = this.allPois.find((p) => p.id === id) ?? null;
          if (found) {
            this.ngZone.run(() => this.selectPoi(found));
            return;
          }
        }

        // Fallback: match nearest visible POI icon within 24px of cursor
        let nearestPoiId: string | null = null;
        let nearestDistSq = 24 * 24;
        for (const target of this.getVisibleMapTargets()) {
          if (target.type !== 'poi') {
            continue;
          }
          const dx = target.x - clientX;
          const dy = target.y - clientY;
          const distSq = dx * dx + dy * dy;
          if (distSq <= nearestDistSq) {
            nearestDistSq = distSq;
            nearestPoiId = target.id;
          }
        }
        if (nearestPoiId) {
          const found = this.allPois.find((p) => p.id === nearestPoiId) ?? null;
          if (found) {
            this.ngZone.run(() => this.selectPoi(found));
            return;
          }
        }

        if (this.map.getLayer('leonida-clusters')) {
          const clusterHits = this.map.queryRenderedFeatures(queryBox, {
            layers: ['leonida-clusters'],
          });
          const feature = clusterHits[0];
          const clusterId = feature?.properties?.['cluster_id'] as number | undefined;
          const source = this.map.getSource('leonida-pois') as GeoJSONSource | undefined;
          const geometry = feature?.geometry as { coordinates?: [number, number] } | undefined;
          if (clusterId !== undefined && source && geometry?.coordinates) {
            void source.getClusterExpansionZoom(clusterId).then((zoom) => {
              this.map?.easeTo({ center: geometry.coordinates!, zoom, duration: 360 });
            });
            return;
          }
        }

        if (this.isPinMode()) {
          const lngLat = this.map.unproject(point);
          this.ngZone.run(() => {
            this.addCustomPin(lngLat.lng, lngLat.lat);
          });
        }
      },
      { clientX: Math.round(clientX), clientY: Math.round(clientY) },
      8,
    );
  }

  private renderSavedCustomPins(): void {
    for (const pin of this.customPins()) {
      this.mountCustomPinMarker(pin);
    }
  }

  private getPinSizeForZoom(): number {
    const zoom = this.map?.getZoom() ?? LEONIDA_MAP_CONFIG.initialZoom;
    return Math.round(Math.max(16, Math.min(34, 16 + (zoom - 9.5) * 2.4)));
  }

  private syncCustomPinSizes(): void {
    this.syncPoiOverlaySizes();
    if (this.customPinMarkers.size === 0) {
      return;
    }
    const size = this.getPinSizeForZoom();
    if (size === this.lastPinSize) {
      return;
    }
    this.telemetry.measure(
      'map.syncCustomPinSizes',
      () => {
        this.lastPinSize = size;
        const fontSize = `${Math.round(size * 0.52)}px`;
        for (const marker of this.customPinMarkers.values()) {
          const el = marker.getElement();
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.fontSize = fontSize;
        }
      },
      () => ({ customPins: this.customPinMarkers.size }),
      4,
    );
  }

  private ensurePoiOverlay(): HTMLElement | null {
    if (!this.map || typeof this.map.getCanvasContainer !== 'function') {
      return null;
    }
    if (!this.poiOverlayEl) {
      const overlay = document.createElement('div');
      overlay.className = 'leonida-poi-overlay';
      this.map.getCanvasContainer().appendChild(overlay);
      this.poiOverlayEl = overlay;
    }
    return this.poiOverlayEl;
  }

  private syncPoiOverlaySizes(): void {
    if (this.poiMarkerNodes.size === 0) {
      return;
    }
    const size = this.getPinSizeForZoom();
    if (size === this.lastPoiOverlaySize) {
      return;
    }
    this.telemetry.measure(
      'map.syncPoiOverlaySizes',
      () => {
        this.lastPoiOverlaySize = size;
        for (const entry of this.poiMarkerNodes.values()) {
          entry.el.style.width = `${size}px`;
          entry.el.style.height = `${size}px`;
        }
      },
      () => ({ domNodes: this.poiMarkerNodes.size }),
      4,
    );
  }

  private repositionPoiOverlayMarkers(): void {
    if (!this.map || this.poiMarkerNodes.size === 0 || typeof this.map.project !== 'function') {
      return;
    }
    this.telemetry.measure(
      'map.repositionPoiOverlayMarkers',
      () => {
        if (!this.map) {
          return;
        }
        const size = this.getPinSizeForZoom();
        const sizeChanged = size !== this.lastPoiOverlaySize;
        if (sizeChanged) {
          this.lastPoiOverlaySize = size;
        }
        for (const entry of this.poiMarkerNodes.values()) {
          const pt = this.map.project([entry.lng, entry.lat]);
          entry.el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
          if (sizeChanged) {
            entry.el.style.width = `${size}px`;
            entry.el.style.height = `${size}px`;
          }
        }
      },
      () => ({ domNodes: this.poiMarkerNodes.size }),
      4,
    );
  }

  private syncPoiOverlayMarkers(): void {
    if (
      !this.map ||
      typeof this.map.queryRenderedFeatures !== 'function' ||
      !this.map.getLayer('leonida-pois-symbol')
    ) {
      return;
    }
    const overlay = this.ensurePoiOverlay();
    if (!overlay) {
      return;
    }

    this.telemetry.measure(
      'map.syncPoiOverlayMarkers',
      () => {
        if (!this.map) {
          return;
        }
        const rendered = this.telemetry.measure(
          'map.queryRenderedPois',
          () => this.map!.queryRenderedFeatures({ layers: ['leonida-pois-symbol'] }),
          (list) => ({ renderedCount: list.length }),
          6,
        );
        this.telemetry.measure(
          'map.reconcilePoiDom',
          () => {
            const seen = new Set<string>();
            const size = this.getPinSizeForZoom();
            this.lastPoiOverlaySize = size;

            for (const feature of rendered) {
              const id = String(feature.properties?.['id'] ?? '');
              if (!id || seen.has(id)) {
                continue;
              }
              const coords =
                feature.geometry.type === 'Point'
                  ? (feature.geometry.coordinates as [number, number])
                  : null;
              if (!coords) {
                continue;
              }
              seen.add(id);

              const iconKey = String(feature.properties?.['iconKey'] ?? 'landmark') as PoiBlipId;
              const iconName = String(feature.properties?.['icon'] ?? '');
              const stackCount = Number(feature.properties?.['stackCount'] ?? 1);
              const name = String(feature.properties?.['name'] ?? '');
              const existing = this.poiMarkerNodes.get(id);
              const pt = this.map!.project(coords);

              if (existing) {
                existing.lng = coords[0];
                existing.lat = coords[1];
                existing.el.style.width = `${size}px`;
                existing.el.style.height = `${size}px`;
                existing.el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
                if (
                  existing.iconKey !== iconKey ||
                  existing.iconName !== iconName ||
                  existing.stackCount !== stackCount
                ) {
                  existing.iconKey = iconKey;
                  existing.iconName = iconName;
                  existing.stackCount = stackCount;
                  this.renderPoiMarkerContent(existing.el, iconKey, stackCount, iconName);
                }
                continue;
              }

              const el = document.createElement('button');
              el.type = 'button';
              el.className = 'leonida-poi-marker';
              el.setAttribute('aria-label', name || id);
              el.style.width = `${size}px`;
              el.style.height = `${size}px`;
              el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
              this.renderPoiMarkerContent(el, iconKey, stackCount, iconName);
              el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.ngZone.run(() => {
                  const found = this.allPois.find((p) => p.id === id) ?? null;
                  if (found) {
                    this.selectPoi(found);
                  }
                });
              });

              overlay.appendChild(el);
              this.poiMarkerNodes.set(id, {
                el,
                iconKey,
                iconName,
                stackCount,
                lng: coords[0],
                lat: coords[1],
              });
            }

            for (const [id, entry] of this.poiMarkerNodes.entries()) {
              if (!seen.has(id)) {
                entry.el.remove();
                this.poiMarkerNodes.delete(id);
              }
            }
          },
          () => ({ domNodes: this.poiMarkerNodes.size }),
          6,
        );
      },
      () => ({ domNodes: this.poiMarkerNodes.size }),
      8,
    );
  }

  private renderPoiMarkerContent(
    el: HTMLButtonElement,
    iconKey: PoiBlipId,
    stackCount: number,
    iconName = '',
  ): void {
    const meta = POI_BLIP_CATALOG[iconKey] ?? POI_BLIP_CATALOG.landmark;
    el.style.borderColor = meta.color;
    const pngUrl = getPoiIconUrl(iconName);
    const stackHtml =
      stackCount > 1 ? `<span class="leonida-poi-stack-pill">${stackCount}</span>` : '';
    if (pngUrl) {
      el.innerHTML = `<img class="leonida-poi-png" src="${pngUrl}" alt="" decoding="async" loading="lazy" />${stackHtml}`;
      return;
    }
    const inner = renderLucideIconElements(meta.icon);
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#FFF6F8" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" aria-hidden="true">${inner}</svg>${stackHtml}`;
  }

  private applyPinVisual(el: HTMLElement, color: string, iconType: CustomPinIconType): void {
    const iconMeta = CUSTOM_PIN_ICONS.find((i) => i.type === iconType) ?? CUSTOM_PIN_ICONS[0];
    const size = this.getPinSizeForZoom();
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.background = color;
    el.style.border = '2px solid #0f172a';
    el.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.45)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = `${Math.round(size * 0.52)}px`;
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.textContent = iconMeta.symbol;
  }

  private mountCustomPinMarker(pin: CustomMapPin): void {
    if (!this.map || this.customPinMarkers.has(pin.id)) {
      return;
    }

    const markerEl = document.createElement('div');
    this.applyPinVisual(markerEl, pin.color || '#FF4FD8', pin.iconType || 'pin');

    const popup = new Popup({ offset: 18, closeButton: false });
    const popupEl = createCustomPinPopupContent(pin, {
      onUpdate: (patch) => this.ngZone.run(() => this.updateCustomPin(pin.id, patch)),
      onRemove: () => this.ngZone.run(() => this.removeCustomPin(pin.id)),
      onClose: () => popup.remove(),
    });
    popup.setDOMContent(popupEl);

    const marker = new Marker({ element: markerEl, draggable: true })
      .setLngLat([pin.lng, pin.lat])
      .setPopup(popup)
      .addTo(this.map);

    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      this.ngZone.run(() => {
        const updated = this.customPins().map((p) =>
          p.id === pin.id ? { ...p, lng: pos.lng, lat: pos.lat } : p,
        );
        this.customPins.set(updated);
        this.saveCustomPins(updated);
      });
    });

    this.customPinMarkers.set(pin.id, marker);
    this.lastPinSize = -1;
  }

  private saveCustomPins(pins: CustomMapPin[]): void {
    try {
      localStorage.setItem(CUSTOM_PINS_STORAGE_KEY, JSON.stringify(pins));
    } catch {
      // Ignore storage quota errors
    }
  }

  zoomBy(delta: number): void {
    if (!this.map) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      const current = this.map?.getZoom() ?? LEONIDA_MAP_CONFIG.initialZoom;
      const maxZoom = this.map?.getMaxZoom() ?? LEONIDA_MAP_CONFIG.hdMaxZoom;
      this.map?.easeTo({ zoom: Math.max(8.5, Math.min(maxZoom, current + delta)), duration: 180 });
    });
  }

  zoomImmediateBy(delta: number): void {
    if (!this.map) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      const current = this.map?.getZoom() ?? LEONIDA_MAP_CONFIG.initialZoom;
      const maxZoom = this.map?.getMaxZoom() ?? LEONIDA_MAP_CONFIG.hdMaxZoom;
      this.map?.setZoom(Math.max(8.5, Math.min(maxZoom, current + delta)));
    });
  }

  resetView(): void {
    if (!this.map) {
      return;
    }
    const is3D = this.is3DMode();
    this.ngZone.runOutsideAngular(() => {
      this.map?.flyTo({
        center: LEONIDA_MAP_CONFIG.initialCenter,
        zoom: LEONIDA_MAP_CONFIG.initialZoom,
        pitch: is3D ? 58 : 0,
        bearing: 0,
        duration: 500,
        essential: true,
      });
    });
  }

  private startFpsMonitor(): void {
    if (this.fpsRafId !== null || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    let frames = 0;
    let lastSampleTime = performance.now();
    let lastDevPerfLogTime = lastSampleTime;

    const tick = (now: number): void => {
      if (typeof document !== 'undefined' && document.hidden) {
        frames = 0;
        lastSampleTime = now;
        lastDevPerfLogTime = now;
        this.lowFpsStartTime = null;
        this.fpsRafId = requestAnimationFrame(tick);
        return;
      }

      frames++;
      const elapsed = now - lastSampleTime;

      if (elapsed >= 1000) {
        if (elapsed > 3000) {
          frames = 0;
          lastSampleTime = now;
          this.fpsRafId = requestAnimationFrame(tick);
          return;
        }
        const fps = (frames * 1000) / elapsed;
        frames = 0;
        lastSampleTime = now;

        const roundedFps = Math.round(fps);
        const dropMeta =
          roundedFps < 60
            ? {
                pitch: Math.round(this.map?.getPitch() ?? 0),
                zoom: Number((this.map?.getZoom() ?? 0).toFixed(2)),
                isMoving: this.isMapMoving,
                visiblePois: this.visiblePoisCount(),
                topSlowMethods: this.telemetry.getSlowestMethods(3).map((m) => ({
                  name: m.name,
                  maxMs: m.maxMs,
                  p95Ms: m.p95Ms,
                  count: m.count,
                })),
              }
            : undefined;

        if (isDevMode() && now - lastDevPerfLogTime >= 5000) {
          lastDevPerfLogTime = now;
          this.telemetry.capture({
            level: 'perf',
            source: 'rum',
            message: `fps_sample:${roundedFps}`,
            ...(dropMeta ? { meta: dropMeta } : {}),
          });
        }

        if (fps < 30) {
          this.lowFpsStartTime ??= now;
          if (now - this.lowFpsStartTime >= 5000 && now - this.lastLowFpsReportTime >= 30000) {
            this.lastLowFpsReportTime = now;
            this.telemetry.capture({
              level: 'warn',
              source: 'rum',
              message: `low_fps:${roundedFps}`,
              ...(dropMeta ? { meta: dropMeta } : {}),
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
    this.unmountNative3DLayer();
    if (this.native3DLayer) {
      this.native3DLayer.dispose();
      this.native3DLayer = null;
    }
    if (this.routeBlinkTimer !== null) {
      clearInterval(this.routeBlinkTimer);
      this.routeBlinkTimer = null;
    }
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
