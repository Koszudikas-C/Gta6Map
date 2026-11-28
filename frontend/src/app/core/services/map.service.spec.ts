import { TestBed } from '@angular/core/testing';
import { LEONIDA_POIS } from '../data/leonida-map.data';
import { MapService } from './map.service';
import { TelemetryService } from './telemetry.service';

const mockCreateNative3DLayer = jest.fn();
jest.mock('./native-3d-layer', () => ({
  createNative3DLayer: (...args: unknown[]) => mockCreateNative3DLayer(...args),
}));

interface MockMapState {
  options: Record<string, unknown> | null;
  handlers: Record<string, Array<(e?: unknown) => void>>;
  layers: Array<Record<string, unknown>>;
  zoom: number;
  center: { lng: number; lat: number };
  pitch: number;
  bearing: number;
  instances: Array<Record<string, unknown>>;
}

const mockState: MockMapState = {
  options: null,
  handlers: {},
  layers: [],
  zoom: 10.5,
  center: { lng: -0.661387, lat: 0.416441 },
  pitch: 0,
  bearing: 0,
  instances: [],
};

jest.mock('maplibre-gl', () => {
  class MockGeoJsonSource {
    setData = jest.fn();
    getClusterExpansionZoom = jest.fn().mockResolvedValue(4);
  }

  class MockMap {
    private readonly sources = new Map<string, MockGeoJsonSource>();
    private readonly layers = new Map<string, Record<string, unknown>>();
    private readonly images = new Set<string>();

    constructor(options: Record<string, unknown>) {
      mockState.options = options;
      mockState.instances.push(this as unknown as Record<string, unknown>);
      const style = options['style'] as { layers?: Array<Record<string, unknown>> } | undefined;
      for (const layer of style?.layers ?? []) {
        const id = String(layer['id'] ?? '');
        if (id) {
          this.layers.set(id, layer);
        }
      }
    }

    on(event: string, layerOrCb: string | ((e?: unknown) => void), maybeCb?: (e?: unknown) => void): void {
      const cb = typeof layerOrCb === 'function' ? layerOrCb : maybeCb;
      if (!cb) return;
      if (event === 'load' && typeof layerOrCb === 'function') {
        mockState.handlers['load'] ??= [];
        mockState.handlers['load'].push(cb);
        return;
      }
      if (typeof layerOrCb === 'string') {
        return;
      }
      mockState.handlers[event] ??= [];
      mockState.handlers[event].push(cb);
    }

    once(_event: string, cb: () => void): void {
      cb();
    }

    addSource(id: string): void {
      this.sources.set(id, new MockGeoJsonSource());
    }

    getSource(id: string): MockGeoJsonSource | undefined {
      return this.sources.get(id);
    }

    addLayer(layer: Record<string, unknown>): void {
      const id = String(layer['id'] ?? '');
      this.layers.set(id, layer);
      mockState.layers.push(layer);
    }

    getLayer(id: string): Record<string, unknown> | undefined {
      return this.layers.get(id);
    }

    hasImage(id: string): boolean {
      return this.images.has(id);
    }

    addImage(id: string): void {
      this.images.add(id);
    }

    getCenter(): { lng: number; lat: number } {
      return mockState.center;
    }

    getZoom(): number {
      return mockState.zoom;
    }

    getPitch(): number {
      return mockState.pitch;
    }

    getBearing(): number {
      return mockState.bearing;
    }

    getMaxZoom(): number {
      return 17.5;
    }

    setMaxZoom = jest.fn();
    setZoom = jest.fn((val: number) => {
      mockState.zoom = val;
    });
    setBearing = jest.fn((val: number) => {
      mockState.bearing = val;
    });
    setPitch = jest.fn((val: number) => {
      mockState.pitch = val;
    });
    setTerrain = jest.fn();
    setLayoutProperty = jest.fn();
    setPaintProperty = jest.fn();
    setFilter = jest.fn();
    removeLayer = jest.fn((id: string) => {
      this.layers.delete(id);
    });
    easeTo = jest.fn((opts?: { zoom?: number }) => {
      if (typeof opts?.zoom === 'number') {
        mockState.zoom = opts.zoom;
      }
    });
    flyTo = jest.fn();
    panBy = jest.fn();
    queryRenderedFeatures = jest.fn().mockReturnValue([]);
    remove = jest.fn();
    getCanvas = jest.fn().mockReturnValue({
      style: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, bottom: 720 }),
    });
  }

  class MockPopup {
    setDOMContent(): this {
      return this;
    }
    isOpen(): boolean {
      return false;
    }
    remove = jest.fn();
  }

  class MockMarker {
    private readonly el: HTMLElement;
    private lngLat: [number, number] = [0, 0];

    constructor(opts?: { element?: HTMLElement }) {
      this.el = opts?.element ?? document.createElement('div');
    }

    setLngLat(pos: [number, number] | { lng: number; lat: number }): this {
      this.lngLat = Array.isArray(pos) ? pos : [pos.lng, pos.lat];
      return this;
    }

    getLngLat(): { lng: number; lat: number } {
      return { lng: this.lngLat[0], lat: this.lngLat[1] };
    }

    setPopup(): this {
      return this;
    }

    addTo(): this {
      return this;
    }

    on(): this {
      return this;
    }

    getElement(): HTMLElement {
      return this.el;
    }

    getPopup(): null {
      return null;
    }

    remove = jest.fn();
  }

  return {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    setWorkerUrl: jest.fn(),
  };
});

describe('MapService', () => {
  let service: MapService;
  let telemetrySpy: {
    capture: jest.Mock;
    recordTiming: jest.Mock;
    measure: jest.Mock;
    measureAsync: jest.Mock;
    getSlowestMethods: jest.Mock;
  };
  const originalImage = globalThis.Image;

  beforeEach(() => {
    mockState.options = null;
    mockState.handlers = {};
    mockState.layers = [];
    mockState.zoom = 10.5;
    mockState.center = { lng: -0.661387, lat: 0.416441 };
    mockState.pitch = 0;
    mockState.bearing = 0;
    mockState.instances = [];
    localStorage.clear();

    // Prevent JSDOM Image from stalling registerPoiBlipImages
    (globalThis as unknown as { Image: unknown }).Image = class {
      onerror: (() => void) | null = null;
      set src(_val: string) {
        queueMicrotask(() => this.onerror?.());
      }
    };

    telemetrySpy = {
      capture: jest.fn(),
      recordTiming: jest.fn(),
      measure: jest.fn((_name: string, fn: () => unknown, meta?: unknown) => {
        const res = fn();
        if (typeof meta === 'function') {
          (meta as (r: unknown) => unknown)(res);
        }
        return res;
      }),
      measureAsync: jest.fn(async (_name: string, fn: () => Promise<unknown>, meta?: unknown) => {
        const res = await fn();
        if (typeof meta === 'function') {
          (meta as (r: unknown) => unknown)(res);
        }
        return res;
      }),
      getSlowestMethods: jest.fn().mockReturnValue([]),
    };
    TestBed.configureTestingModule({
      providers: [
        MapService,
        { provide: TelemetryService, useValue: telemetrySpy },
      ],
    });
    service = TestBed.inject(MapService);
  });

  afterEach(() => {
    service.destroy();
    (globalThis as unknown as { Image: unknown }).Image = originalImage;
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('configures MapLibre for smooth high-FPS rendering and renders only POI icons without map text labels', async () => {
    const container = document.createElement('div');
    service.initMap(container);

    expect(mockState.options).toMatchObject({
      fadeDuration: 0,
      maxTileCacheSize: 256,
      cancelPendingTileRequestsWhileZooming: true,
    });

    const style = mockState.options?.['style'] as {
      sky?: Record<string, unknown>;
      layers: Array<{ id: string; paint?: Record<string, unknown> }>;
    };
    expect(style.sky?.['sky-color']).toBe('#4891a8');
    expect(style.sky?.['horizon-color']).toBe('#4891a8');
    const satLayer = style.layers.find((l) => l.id === 'leonida-satellite-layer');
    expect(satLayer?.paint?.['raster-fade-duration']).toBe(0);

    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const poiLayer = mockState.layers.find((l) => l['id'] === 'leonida-pois-symbol');
    const layout = poiLayer?.['layout'] as Record<string, unknown> | undefined;
    expect(layout?.['text-field']).toBeUndefined();
    expect(layout?.['text-anchor']).toBeUndefined();
  });

  it('ignores benign AbortError from cancelled tile requests while capturing real WebGL errors', () => {
    service.initMap(document.createElement('div'));
    const errorHandler = mockState.handlers['error']?.[0];
    expect(errorHandler).toBeDefined();

    errorHandler?.({ error: { name: 'AbortError', message: 'The operation was aborted. ' } });
    errorHandler?.({ error: { message: 'The operation was aborted.' } });
    expect(telemetrySpy.capture).not.toHaveBeenCalled();

    errorHandler?.({ error: { message: 'WebGL context lost' } });
    expect(telemetrySpy.capture).toHaveBeenCalledWith({
      level: 'error',
      source: 'webgl',
      message: 'WebGL context lost',
    });
  });

  it('suppresses move coordinate signal updates when sidebar is closed and flushes on moveend', () => {
    service.initMap(document.createElement('div'));
    const moveHandler = mockState.handlers['move']?.[0];
    const moveEndHandler = mockState.handlers['moveend']?.[0];

    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(500);
    mockState.center = { lng: -0.5432, lat: 0.6543 };

    // Live tracking disabled by default -> move does not trigger Angular state update
    moveHandler?.();
    expect(service.coordinates().lng).toBe(-0.661387);

    // moveend still synchronizes final coordinates
    moveEndHandler?.();
    expect(service.coordinates().lng).toBe(-0.5432);

    // Live tracking enabled -> move updates when interval elapsed
    service.setLiveCoordinatesEnabled(true);
    nowSpy.mockReturnValue(800);
    mockState.center = { lng: -0.45, lat: 0.55 };
    moveHandler?.();
    expect(service.coordinates().lng).toBe(-0.45);
  });

  it('skips redundant DOM style mutations when zoom-derived custom pin size is unchanged', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const pin = service.addCustomPin(-0.6, 0.4, 'Test Pin');
    const markers = (service as unknown as { customPinMarkers: Map<string, { getElement: () => HTMLElement }> })
      .customPinMarkers;
    const el = markers.get(pin.id)!.getElement();
    const widthSpy = jest.spyOn(el.style, 'width', 'set');

    const zoomHandler = mockState.handlers['zoom']?.[0];
    mockState.zoom = 10.5;
    zoomHandler?.();
    expect(widthSpy).toHaveBeenCalledTimes(1);

    // Repeated zoom frames with identical rounded pin size should not write to DOM
    mockState.zoom = 10.52;
    zoomHandler?.();
    zoomHandler?.();
    expect(widthSpy).toHaveBeenCalledTimes(1);

    // Significant zoom change updates DOM once
    mockState.zoom = 15.0;
    zoomHandler?.();
    expect(widthSpy).toHaveBeenCalledTimes(2);
  });

  it('clears routeBlinkTimer and fpsRafId on destroy', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    service.togglePoiMark(LEONIDA_POIS[0]);
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    const cancelRafSpy = jest.spyOn(globalThis, 'cancelAnimationFrame');

    service.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(cancelRafSpy).toHaveBeenCalled();
  });

  it('orbitCameraBy adjusts bearing, clamps pitch [0, 65], and toggles 3D terrain/buildings', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    service.orbitCameraBy(10, 12);
    expect(mockState.bearing).toBe(10);
    expect(mockState.pitch).toBe(12);
    expect(service.is3DMode()).toBe(true);

    service.orbitCameraBy(0, 100);
    expect(mockState.pitch).toBe(65);

    service.orbitCameraBy(0, -100);
    expect(mockState.pitch).toBe(0);
    expect(service.is3DMode()).toBe(false);
  });

  it('stops POI blinking when removed from route even if previously focused via flyToPoi', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const poi = LEONIDA_POIS[0];
    service.flyToPoi(poi, true);
    service.togglePoiMark(poi);

    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    service.togglePoiMark(poi);

    const mapInst = mockState.instances[0] as unknown as {
      getSource: (id: string) => { setData: jest.Mock };
    };
    const stopsSource = mapInst.getSource('leonida-route-stops');
    const lastCall = stopsSource.setData.mock.calls[stopsSource.setData.mock.calls.length - 1][0];
    expect(lastCall.features).toHaveLength(0);
    expect(clearIntervalSpy).toHaveBeenCalled();

    // Also verify clearRoute clears focusPoi
    service.flyToPoi(poi, true);
    service.togglePoiMark(poi);
    service.clearRoute();
    const afterClear = stopsSource.setData.mock.calls[stopsSource.setData.mock.calls.length - 1][0];
    expect(afterClear.features).toHaveLength(0);
  });

  it('updates the map representative icon when cycling co-located stacked POIs', async () => {
    const container = document.createElement('div');
    service.initMap(container);
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const mapInst = mockState.instances[0] as unknown as {
      getZoom: jest.Mock;
      getMaxZoom: jest.Mock;
      getSource: (id: string) => { setData: jest.Mock };
    };
    mapInst.getZoom = jest.fn(() => 15.5);
    mapInst.getMaxZoom = jest.fn(() => 17.5);

    const first = LEONIDA_POIS[0];
    const stackedPartner = {
      ...first,
      id: `${first.id}-stacked`,
      name: 'Y Vice City',
      category: 'Pontos-Chave' as const,
    };
    (service as unknown as { currentFilteredPois: typeof first[] }).currentFilteredPois = [
      first,
      stackedPartner,
    ];
    (service as unknown as { syncPoiCalloutData: (force?: boolean) => void }).syncPoiCalloutData(true);

    service.selectPoi(first);
    expect(service.coLocatedPois()).toHaveLength(2);

    const poisSource = mapInst.getSource('leonida-pois');
    const beforeSwitch = poisSource.setData.mock.calls[poisSource.setData.mock.calls.length - 1][0];
    expect(beforeSwitch.features[0].properties.id).toBe(first.id);

    service.cycleCoLocatedPoi(1);
    expect(service.selectedPoi()?.id).toBe(stackedPartner.id);

    const afterSwitch = poisSource.setData.mock.calls[poisSource.setData.mock.calls.length - 1][0];
    expect(afterSwitch.features[0].properties.id).toBe(stackedPartner.id);
    expect(afterSwitch.features[0].properties.stackCount).toBe(2);
    expect(afterSwitch.features[0].properties.iconKey).not.toBe(
      beforeSwitch.features[0].properties.iconKey,
    );
  });

  it('uses an integer clusterMaxZoom and separate raster-dem sources for hillshade and 3D terrain', async () => {
    service.initMap(document.createElement('div'));
    const mapInst = mockState.instances[0] as unknown as {
      addSource: (id: string, opts: Record<string, unknown>) => void;
    };
    const addSourceSpy = jest.spyOn(mapInst, 'addSource');

    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const style = mockState.options?.['style'] as {
      sources: Record<string, unknown>;
      layers: Array<{ id: string; source?: string }>;
    };
    const hillshadeLayer = style.layers.find((l) => l.id === 'leonida-hillshade');
    expect(style.sources['leonida-dem']).toBeDefined();
    expect(style.sources['leonida-hillshade-dem']).toBeDefined();
    expect(hillshadeLayer?.source).toBe('leonida-hillshade-dem');

    const poisCall = addSourceSpy.mock.calls.find(([id]) => id === 'leonida-pois');
    expect(poisCall).toBeDefined();
    expect(Number.isInteger(poisCall?.[1]?.['clusterMaxZoom'])).toBe(true);
    expect(poisCall?.[1]?.['clusterMaxZoom']).toBe(14);
  });

  it('builds high-resolution 96px SVG map blips with Lucide strokes and geometricPrecision', () => {
    const { buildMapBlipSvg, POI_BLIP_CATALOG } = require('../data/poi-category-icons');
    const svg = buildMapBlipSvg(POI_BLIP_CATALOG.landmark);
    expect(svg).toContain('width="96"');
    expect(svg).toContain('height="96"');
    expect(svg).toContain('shape-rendering="geometricPrecision"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('<radialGradient');
  });

  it('scales POI overlay markers dynamically with zoom just like custom pins', () => {
    service.initMap(document.createElement('div'));
    mockState.zoom = 10;
    const minSize = (service as unknown as { getPinSizeForZoom: () => number }).getPinSizeForZoom();
    mockState.zoom = 17;
    const maxSize = (service as unknown as { getPinSizeForZoom: () => number }).getPinSizeForZoom();
    expect(maxSize).toBeGreaterThan(minSize);
    expect(minSize).toBeGreaterThanOrEqual(16);
    expect(maxSize).toBeLessThanOrEqual(34);
  });

  it('searches by native and legacy coordinates and returns exact target plus nearest POIs', () => {
    const nativeResults = service.searchPoisFast('-0.661, 0.416', 'Todas', 5);
    expect(nativeResults.length).toBeGreaterThan(0);
    expect(nativeResults[0].id).toContain('__coord__:');
    expect(nativeResults[0].name).toBe('Ir para -0.661, 0.416');
    expect(nativeResults[0].lng).toBeCloseTo(-0.661, 3);
    expect(nativeResults[0].lat).toBeCloseTo(0.416, 3);

    const legacyResults = service.searchPoisFast('-31.819, 18.759', 'Todas', 5);
    expect(legacyResults.length).toBeGreaterThan(0);
    expect(legacyResults[0].id).toContain('__coord__:');
    expect(legacyResults[0].lng).toBeGreaterThan(-1.6);
    expect(legacyResults[0].lng).toBeLessThan(0.2);
  });

  it('caps MapLibre pixelRatio <= 1.5 and configures high-resolution street-level tile pyramid', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    expect(Number(mockState.options?.['pixelRatio'])).toBeLessThanOrEqual(1.5);
    expect(mockState.options?.['fadeDuration']).toBe(0);
    expect(mockState.options?.['minZoom']).toBe(8.5);
    expect(mockState.options?.['maxZoom']).toBe(17.5);

    const style = mockState.options?.['style'] as {
      sources: Record<string, { tileSize?: number; maxzoom?: number; bounds?: number[]; tiles?: string[] }>;
    };
    const satSource = style.sources['leonida-satellite'];
    expect(satSource.tileSize).toBe(256);
    expect(satSource.maxzoom).toBe(17);
    expect(satSource.bounds).toEqual([-1.40625, 0, 0, 1.4061088354351563]);
    expect(satSource.tiles?.[0]).toContain('map-tiles.b-cdn.net/assets/gtavi/day/{z}/{x}_{y}.jpg');

    const buildingsLayer = mockState.layers.find((l) => l['id'] === 'leonida-buildings-3d');
    expect(buildingsLayer?.['minzoom']).toBe(13);

    mockState.zoom = 11;
    service.zoomBy(5);
    expect(mockState.zoom).toBe(16);

    // isolatePoi persists even if loadLandmarks finishes afterward
    service.isolatePoi(LEONIDA_POIS[0]);
    expect(service.visiblePoisCount()).toBe(1);
    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => LEONIDA_POIS,
    });
    try {
      await (service as unknown as { loadLandmarks: (a: string, b: string) => Promise<void> }).loadLandmarks(
        '/api/pois',
        '/data/leonida-landmarks.json',
      );
      expect(service.visiblePoisCount()).toBe(1);
    } finally {
      (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
    }
  });

  it('renders extracted GTAVIMap PNG icon inside POI overlay markers and preserves icon field in normalizePoi', () => {
    const { getPoiCategoryMeta, getPoiIconUrl } = require('../data/poi-category-icons');
    expect(getPoiIconUrl('ammu_nations_blip')).toBe('icons/gtavi/ammu_nations_blip.png');
    expect(getPoiIconUrl('../evil')).toBeNull();
    expect(getPoiCategoryMeta('Saltos e Acrobacias').id).toBe('stunt');
    expect(getPoiCategoryMeta('Atividades e Esportes').id).toBe('activity');

    const normalized = (
      service as unknown as { normalizePoi: (r: Record<string, unknown>) => { icon?: string; lng: number } }
    ).normalizePoi({
      id: 'gtavi_1',
      name: 'Murais 1010',
      category: 'Pontos de Referência',
      lng: -0.574184,
      lat: 0.68693,
      icon: '1010_murals_blip',
    });
    expect(normalized.icon).toBe('1010_murals_blip');
    expect(normalized.lng).toBeCloseTo(-0.574184, 5);

    const btn = document.createElement('button');
    (
      service as unknown as {
        renderPoiMarkerContent: (el: HTMLButtonElement, key: string, stack: number, icon?: string) => void;
      }
    ).renderPoiMarkerContent(btn, 'landmark', 2, '1010_murals_blip');
    expect(btn.querySelector('img.leonida-poi-png')?.getAttribute('src')).toBe(
      'icons/gtavi/1010_murals_blip.png',
    );
    expect(btn.querySelector('.leonida-poi-stack-pill')?.textContent).toBe('2');
  });

  it('lazy-loads native 3D GLB layer below POI layers on toggle3D and restores 2D / cancels cleanly', async () => {
    const fakeLayer = {
      id: 'native-pause-map-3d',
      type: 'custom' as const,
      renderingMode: '3d' as const,
      backgroundColor: '#44899f',
      render: jest.fn(),
      setTheme: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
    };
    mockCreateNative3DLayer.mockReset().mockResolvedValue(fakeLayer);

    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const mapInst = mockState.instances[0] as unknown as {
      addLayer: (l: Record<string, unknown>, beforeId?: string) => void;
      removeLayer: jest.Mock;
      setLayoutProperty: jest.Mock;
      setPaintProperty: jest.Mock;
    };
    const addLayerSpy = jest.spyOn(mapInst, 'addLayer');

    service.toggle3D();
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCreateNative3DLayer).toHaveBeenCalledTimes(1);
    expect(addLayerSpy).toHaveBeenCalledWith(fakeLayer as unknown as Record<string, unknown>, 'leonida-route-line');
    expect(mapInst.setLayoutProperty).toHaveBeenCalledWith('leonida-satellite-layer', 'visibility', 'none');
    expect(mapInst.setLayoutProperty).toHaveBeenCalledWith('leonida-buildings-3d', 'visibility', 'none');
    expect(mapInst.setPaintProperty).toHaveBeenCalledWith('leonida-ocean-bg', 'background-color', '#44899f');
    expect(service.native3DActive()).toBe(true);
    expect(service.is3DLoading()).toBe(false);

    // Toggle off restores 2D satellite layer and removes native layer
    service.toggle3D();
    expect(mapInst.removeLayer).toHaveBeenCalledWith('native-pause-map-3d');
    expect(mapInst.setLayoutProperty).toHaveBeenCalledWith('leonida-satellite-layer', 'visibility', 'visible');
    expect(service.native3DActive()).toBe(false);

    // Cancel mid-load clears loading flag cleanly without mounting
    fakeLayer.dispose.mockClear();
    (service as unknown as { native3DLayer: unknown }).native3DLayer = null;
    let resolveDelayed: ((v: typeof fakeLayer) => void) | null = null;
    mockCreateNative3DLayer.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDelayed = resolve;
        }),
    );
    service.toggle3D();
    expect(service.is3DLoading()).toBe(true);
    service.toggle3D();
    expect(service.is3DLoading()).toBe(false);
    resolveDelayed?.(fakeLayer);
    await new Promise((r) => setTimeout(r, 0));
    expect(service.native3DActive()).toBe(false);
  });

  it('instruments hot rendering and list methods via TelemetryService and wires onTiming to native 3D layer', async () => {
    const fakeLayer = {
      id: 'native-pause-map-3d',
      type: 'custom' as const,
      renderingMode: '3d' as const,
      backgroundColor: '#44899f',
      render: jest.fn(),
      setTheme: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
    };
    mockCreateNative3DLayer.mockReset().mockResolvedValue(fakeLayer);

    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    service.filterPois('Vice', 'Todas');
    service.searchPoisFast('Vice', 'Todas', 10);

    const measuredNames = telemetrySpy.measure.mock.calls.map((c) => c[0] as string);
    expect(measuredNames).toContain('map.buildSearchIndex');
    expect(measuredNames).toContain('map.filterPois');
    expect(measuredNames).toContain('map.searchPoisFast');
    expect(measuredNames).toContain('map.groupOverlappingPois');
    expect(measuredNames).toContain('map.poisSourceSetData');

    service.toggle3D();
    await new Promise((r) => setTimeout(r, 0));
    const callOpts = mockCreateNative3DLayer.mock.calls[0]?.[0] as {
      onTiming?: (name: string, durationMs: number, meta?: Record<string, unknown>) => void;
    };
    expect(typeof callOpts?.onTiming).toBe('function');
    callOpts.onTiming?.('native3d.renderScene', 2.5, { frame: 1 });
    expect(telemetrySpy.recordTiming).toHaveBeenCalledWith(
      'native3d.renderScene',
      2.5,
      { frame: 1 },
      undefined,
    );
  });
});
