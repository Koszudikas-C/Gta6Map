import { TestBed } from '@angular/core/testing';
import { LEONIDA_POIS } from '../data/leonida-map.data';
import { MapService } from './map.service';
import { TelemetryService } from './telemetry.service';

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
  zoom: 2.2,
  center: { lng: -25, lat: 10 },
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
      return 6;
    }

    setMaxZoom = jest.fn();
    setZoom = jest.fn();
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
    easeTo = jest.fn();
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
  let telemetrySpy: { capture: jest.Mock };
  const originalImage = globalThis.Image;

  beforeEach(() => {
    mockState.options = null;
    mockState.handlers = {};
    mockState.layers = [];
    mockState.zoom = 2.2;
    mockState.center = { lng: -25, lat: 10 };
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

    telemetrySpy = { capture: jest.fn() };
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

  it('configures MapLibre for smooth high-FPS rendering and fixed POI text anchor', async () => {
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
    expect(style.sky?.['sky-color']).toBe('#2F90B0');
    expect(style.sky?.['horizon-color']).toBe('#2F90B0');
    const satLayer = style.layers.find((l) => l.id === 'leonida-satellite-layer');
    expect(satLayer?.paint?.['raster-fade-duration']).toBe(0);

    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const poiLayer = mockState.layers.find((l) => l['id'] === 'leonida-pois-symbol');
    const layout = poiLayer?.['layout'] as Record<string, unknown> | undefined;
    expect(layout?.['text-anchor']).toBe('top');
    expect(layout?.['text-variable-anchor']).toBeUndefined();
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
    mockState.center = { lng: -12.3456, lat: 21.6543 };

    // Live tracking disabled by default -> move does not trigger Angular state update
    moveHandler?.();
    expect(service.coordinates().lng).toBe(-25);

    // moveend still synchronizes final coordinates
    moveEndHandler?.();
    expect(service.coordinates().lng).toBe(-12.3456);

    // Live tracking enabled -> move updates when interval elapsed
    service.setLiveCoordinatesEnabled(true);
    nowSpy.mockReturnValue(800);
    mockState.center = { lng: 10.5, lat: 15.25 };
    moveHandler?.();
    expect(service.coordinates().lng).toBe(10.5);
  });

  it('skips redundant DOM style mutations when zoom-derived custom pin size is unchanged', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    const pin = service.addCustomPin(10, 20, 'Test Pin');
    const markers = (service as unknown as { customPinMarkers: Map<string, { getElement: () => HTMLElement }> })
      .customPinMarkers;
    const el = markers.get(pin.id)!.getElement();
    const widthSpy = jest.spyOn(el.style, 'width', 'set');

    const zoomHandler = mockState.handlers['zoom']?.[0];
    mockState.zoom = 2.2;
    zoomHandler?.();
    expect(widthSpy).toHaveBeenCalledTimes(1);

    // Repeated zoom frames with identical rounded pin size should not write to DOM
    mockState.zoom = 2.25;
    zoomHandler?.();
    zoomHandler?.();
    expect(widthSpy).toHaveBeenCalledTimes(1);

    // Significant zoom change updates DOM once
    mockState.zoom = 4.0;
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
    mapInst.getZoom = jest.fn(() => 5.5);
    mapInst.getMaxZoom = jest.fn(() => 5.5);

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
    expect(poisCall?.[1]?.['clusterMaxZoom']).toBe(4);
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
    mockState.zoom = 1.5;
    const minSize = (service as unknown as { getPinSizeForZoom: () => number }).getPinSizeForZoom();
    mockState.zoom = 5.5;
    const maxSize = (service as unknown as { getPinSizeForZoom: () => number }).getPinSizeForZoom();
    expect(maxSize).toBeGreaterThan(minSize);
    expect(minSize).toBeGreaterThanOrEqual(16);
    expect(maxSize).toBeLessThanOrEqual(32);
  });

  it('searches by coordinates and returns exact target plus nearest POIs', () => {
    const results = service.searchPoisFast('-31.819, 18.759', 'Todas', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toContain('__coord__:');
    expect(results[0].name).toBe('Ir para -31.819, 18.759');
    expect(results[0].lng).toBeCloseTo(-31.819, 3);
    expect(results[0].lat).toBeCloseTo(18.759, 3);
  });

  it('caps MapLibre pixelRatio <= 1.5 and restricts 3D buildings layer minzoom to 3.6', async () => {
    service.initMap(document.createElement('div'));
    for (const cb of mockState.handlers['load'] ?? []) {
      await cb();
    }

    expect(Number(mockState.options?.['pixelRatio'])).toBeLessThanOrEqual(1.5);
    expect(mockState.options?.['fadeDuration']).toBe(0);
    const buildingsLayer = mockState.layers.find((l) => l['id'] === 'leonida-buildings-3d');
    expect(buildingsLayer?.['minzoom']).toBe(3.6);
  });
});
