import { Injectable, NgZone, inject, signal } from '@angular/core';
import { GeoJSONSource, Map as MapLibreMap, Marker, Popup, StyleSpecification, setWorkerUrl } from 'maplibre-gl';
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
import {
  CUSTOM_PIN_ICONS,
  CustomMapPin,
  CustomPinIconType,
  createCustomPinPopupContent,
} from './custom-pin-popup.helper';

const QUALITY_STORAGE_KEY = 'gta6map_quality';

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
}

function resolveAssetUrls(): LeonidaAssetUrls {
  const baseUrl = typeof document !== 'undefined' ? new URL('.', document.baseURI).href : '/';
  return {
    workerUrl: `${baseUrl}maplibre-gl-worker.mjs`,
    satelliteTilesUrl: `${baseUrl}tiles/${LEONIDA_MAP_CONFIG.styles.satellite.id}/{z}/{x}/{y}.webp`,
    demTilesUrl: `${baseUrl}tiles/dem/{z}/{x}/{y}.png`,
    apiPoisUrl: `${baseUrl}api/pois`,
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

const CUSTOM_PINS_STORAGE_KEY = 'leonida_custom_pins_v1';

function loadSavedCustomPins(): CustomMapPin[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly ngZone = inject(NgZone);
  private readonly telemetry = inject(TelemetryService);

  private map: MapLibreMap | null = null;
  private explorerMarker: Marker | null = null;
  private customPinMarkers = new Map<string, Marker>();
  private fpsRafId: number | null = null;
  private lowFpsStartTime: number | null = null;
  private lastLowFpsReportTime = 0;
  private allPois: LeonidaPoi[] = LEONIDA_POIS;
  private currentQuery = '';
  private currentCategory = 'Todas';

  readonly isLoaded = signal(false);
  readonly is3DMode = signal(false);
  readonly isPinMode = signal(false);
  readonly customPins = signal<CustomMapPin[]>(loadSavedCustomPins());
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
          void this.loadLandmarks(urls.apiPoisUrl, urls.landmarksUrl);
          this.ngZone.run(() => this.isLoaded.set(true));
          this.startFpsMonitor();
        });

        let lastCoordUpdate = 0;
        map.on('move', () => {
          const now = performance.now();
          if (now - lastCoordUpdate < 100) {
            return;
          }
          lastCoordUpdate = now;
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

  private searchPrefixIndex = new Map<string, LeonidaPoi[]>();
  private categoryIndex = new Map<string, LeonidaPoi[]>();
  private poiById = new Map<string, LeonidaPoi>();
  readonly poisVersion = signal(0);
  readonly groupedPoisByCategory = signal<Array<{ category: string; items: LeonidaPoi[] }>>([]);

  constructor() {
    this.buildSearchIndex(this.allPois);
  }

  filterPois(query: string, category: string): void {
    this.currentQuery = query;
    this.currentCategory = category;

    const normalized = normalizeSearchText(query.trim());
    const filtered =
      normalized.length > 0
        ? this.searchPoisFast(normalized, category, Number.MAX_SAFE_INTEGER)
        : category === 'Todas'
          ? this.allPois
          : (this.categoryIndex.get(category) ?? []);

    this.visiblePoisCount.set(filtered.length);
    const source = this.map?.getSource('leonida-pois') as GeoJSONSource | undefined;
    source?.setData(poisToGeoJson(filtered));
  }

  searchPoisFast(query: string, category = 'Todas', limit = 24): LeonidaPoi[] {
    this.poisVersion();
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
  }

  getPoisByCategory(category: string): LeonidaPoi[] {
    this.poisVersion();
    return category === 'Todas' ? this.allPois : (this.categoryIndex.get(category) ?? []);
  }

  flyToPoi(poi: LeonidaPoi): void {
    this.map?.flyTo({
      center: [poi.lng, poi.lat],
      zoom: Math.max(this.map.getZoom(), 5.2),
      duration: 600,
    });
    this.selectedPoi.set(poi);
  }

  getFeaturedPois(limit = 8): LeonidaPoi[] {
    this.poisVersion();
    return this.allPois.slice(0, limit);
  }

  private buildSearchIndex(pois: LeonidaPoi[]): void {
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
  }

  private async loadLandmarks(apiUrl: string, fallbackUrl: string): Promise<void> {
    if (typeof fetch !== 'function') {
      return;
    }

    const data = (await this.fetchPoisFromUrl(apiUrl)) ?? (await this.fetchPoisFromUrl(fallbackUrl));
    if (!data || data.length === 0) {
      return;
    }

    this.allPois = data;
    const buildingsSource = this.map?.getSource('leonida-buildings') as GeoJSONSource | undefined;
    buildingsSource?.setData(buildLeonida3DBuildings(data));
    this.ngZone.run(() => {
      this.buildSearchIndex(data);
      this.totalPoisCount.set(data.length);
      this.filterPois(this.currentQuery, this.currentCategory);
    });
  }

  private async fetchPoisFromUrl(url: string): Promise<LeonidaPoi[] | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }
      const payload = (await res.json()) as LeonidaPoi[] | { pois?: unknown[]; items?: unknown[]; data?: unknown[] };
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

      return rawList.map((item) => this.normalizePoi(item as Record<string, unknown>));
    } catch {
      return null;
    }
  }

  private normalizePoi(raw: Record<string, unknown>): LeonidaPoi {
    return {
      id: String(raw['id'] ?? ''),
      name: String(raw['title'] ?? raw['name'] ?? ''),
      category: String(raw['category_name'] ?? raw['category'] ?? 'Pontos-Chave') as LeonidaPoi['category'],
      region: String(raw['region'] ?? 'Leonida'),
      description: String(raw['description'] ?? ''),
      lng: Number(raw['coord_x'] ?? raw['lng'] ?? 0),
      lat: Number(raw['coord_y'] ?? raw['lat'] ?? 0),
    };
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
      minzoom: 2.8,
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

    map.on('click', (e) => {
      if (!this.isPinMode()) {
        return;
      }
      const targetEl = e.originalEvent?.target as HTMLElement | null;
      if (targetEl?.closest('.maplibregl-marker, .maplibregl-popup')) {
        return;
      }
      const hit = map.queryRenderedFeatures(e.point, {
        layers: ['leonida-pois-circle', 'leonida-clusters'],
      });
      if (hit.length > 0) {
        return;
      }
      this.ngZone.run(() => {
        this.addCustomPin(e.lngLat.lng, e.lngLat.lat);
      });
    });

    map.on('zoom', () => this.syncCustomPinSizes());

    this.renderSavedCustomPins();
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
    this.customPins.set([]);
    this.saveCustomPins([]);
  }

  private renderSavedCustomPins(): void {
    for (const pin of this.customPins()) {
      this.mountCustomPinMarker(pin);
    }
  }

  private getPinSizeForZoom(): number {
    const zoom = this.map?.getZoom() ?? 2.5;
    return Math.round(Math.max(16, Math.min(32, 12 + zoom * 3.5)));
  }

  private syncCustomPinSizes(): void {
    const size = this.getPinSizeForZoom();
    const fontSize = `${Math.round(size * 0.52)}px`;
    for (const marker of this.customPinMarkers.values()) {
      const el = marker.getElement();
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.fontSize = fontSize;
    }
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
      this.map?.easeTo({ zoom: Math.max(0.5, Math.min(7, current + delta)), duration: 180 });
    });
  }

  resetView(): void {
    if (!this.map) {
      return;
    }
    const is3D = this.is3DMode();
    this.ngZone.runOutsideAngular(() => {
      this.map?.stop();
      requestAnimationFrame(() => {
        this.map?.flyTo({
          center: LEONIDA_MAP_CONFIG.initialCenter,
          zoom: LEONIDA_MAP_CONFIG.initialZoom,
          pitch: is3D ? 58 : 0,
          bearing: 0,
          duration: 500,
          essential: true,
        });
      });
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
