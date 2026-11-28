import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DEV_PERF_STORAGE_KEY, TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(DEV_PERF_STORAGE_KEY);
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [TelemetryService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TelemetryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.useRealTimers();
    localStorage.removeItem(DEV_PERF_STORAGE_KEY);
  });

  it('should debounce and batch telemetry events to /api/telemetry/client-error', () => {
    service.capture({ level: 'error', source: 'js', message: 'Test error 1' });
    service.capture({ level: 'perf', source: 'rum', message: 'map_load_ms:120' });

    jest.advanceTimersByTime(1500);

    const req = httpMock.expectOne('/api/telemetry/client-error');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.events).toHaveLength(2);
    expect(req.request.body.events[0].message).toBe('Test error 1');
    expect(req.request.body.events[1].source).toBe('rum');
    req.flush({ ok: true });
  });

  it('should persist dev performance metrics in localStorage and compute summary', () => {
    service.capture({ level: 'perf', source: 'rum', message: 'map_load_ms:240' });
    service.capture({ level: 'perf', source: 'rum', message: 'fps_sample:60' });
    service.capture({ level: 'perf', source: 'rum', message: 'fps_sample:50' });

    jest.advanceTimersByTime(1500);
    httpMock.expectOne('/api/telemetry/client-error').flush({ ok: true });

    const saved = service.getDevMetrics();
    expect(saved.length).toBe(3);

    const summary = service.getDevMetricsSummary();
    expect(summary.count).toBe(3);
    expect(summary.avgFps).toBe(55);
    expect(summary.minFps).toBe(50);
    expect(summary.lastMapLoadMs).toBe(240);

    const exported = JSON.parse(service.exportDevMetricsJson());
    expect(exported.summary.count).toBe(3);
    expect(exported.events).toHaveLength(3);

    service.clearDevMetrics();
    expect(service.getDevMetrics()).toHaveLength(0);
  });

  it('coalesces localStorage writes during bursts while keeping in-memory metrics current', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    service.capture({ level: 'perf', source: 'rum', message: 'fps_sample:99' });
    service.capture({ level: 'perf', source: 'rum', message: 'fps_sample:98' });
    service.capture({ level: 'perf', source: 'rum', message: 'fps_sample:100' });

    expect(service.getDevMetrics()).toHaveLength(3);
    expect(setItemSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1100);
    httpMock.expectOne('/api/telemetry/client-error').flush({ ok: true });
    setItemSpy.mockRestore();
  });

  it('records high-precision method timings with percentiles and rate-limited slow-call events', async () => {
    service.recordTiming('map.groupOverlappingPois', 1.2345, { count: 10 }, 8);
    service.recordTiming('map.groupOverlappingPois', 3.4567, { count: 20 }, 8);
    service.recordTiming('map.groupOverlappingPois', 5.0, { count: 30 }, 8);

    const fastStats = service.getMethodPerfStat('map.groupOverlappingPois');
    expect(fastStats).not.toBeNull();
    expect(fastStats!.count).toBe(3);
    expect(fastStats!.minMs).toBe(1.235);
    expect(fastStats!.maxMs).toBe(5);
    expect(fastStats!.p95Ms).toBe(5);
    expect(fastStats!.slowCount).toBe(0);
    expect(fastStats!.lastMeta).toEqual({ count: 30 });

    const syncResult = service.measure(
      'quickSearch.groupedSearchResults',
      () => ['a', 'b'],
      (res) => ({ len: res.length }),
      10,
    );
    expect(syncResult).toEqual(['a', 'b']);

    const asyncResult = await service.measureAsync(
      'map.loadLandmarks',
      async () => 42,
      (val) => ({ val }),
      20,
    );
    expect(asyncResult).toBe(42);

    // Slow calls increment slowCount and rate-limit slow_fn capture events within 2000ms cooldown
    service.recordTiming('native3d.renderScene', 9.5, { frame: 1 }, 6);
    service.recordTiming('native3d.renderScene', 12.25, { frame: 2 }, 6);

    const slowStats = service.getMethodPerfStat('native3d.renderScene');
    expect(slowStats!.slowCount).toBe(2);

    const eventsAfterCooldownGate = service.getDevMetrics();
    const slowEvents1 = eventsAfterCooldownGate.filter((e) => e.message.startsWith('slow_fn:'));
    expect(slowEvents1).toHaveLength(1);
    expect(slowEvents1[0].message).toBe('slow_fn:native3d.renderScene:9.5ms');

    jest.advanceTimersByTime(2100);
    httpMock.expectOne('/api/telemetry/client-error').flush({ ok: true });

    service.recordTiming('native3d.renderScene', 14.0, { frame: 3 }, 6);
    const slowEvents2 = service
      .getDevMetrics()
      .filter((e) => e.message.startsWith('slow_fn:'));
    expect(slowEvents2).toHaveLength(2);

    jest.advanceTimersByTime(1500);
    httpMock.expectOne('/api/telemetry/client-error').flush({ ok: true });

    const summary = service.getDevMetricsSummary();
    expect(summary.trackedMethods).toBeGreaterThanOrEqual(4);
    expect(summary.totalMethodCalls).toBe(8);
    expect(summary.totalSlowCalls).toBe(3);

    const exported = JSON.parse(service.exportDevMetricsJson());
    expect(Array.isArray(exported.methods)).toBe(true);
    expect(exported.methods.some((m: { name: string }) => m.name === 'native3d.renderScene')).toBe(
      true,
    );

    const winPerf = (
      window as unknown as {
        __leonidaPerf?: {
          methods: () => unknown[];
          method: (n: string) => unknown;
          slowest: (limit?: number) => unknown[];
          table: (limit?: number) => unknown[];
        };
      }
    ).__leonidaPerf;
    expect(winPerf?.methods().length).toBeGreaterThanOrEqual(4);
    expect(winPerf?.method('map.groupOverlappingPois')).not.toBeNull();
    expect(winPerf?.slowest(2)).toHaveLength(2);

    service.clearDevMetrics();
    expect(service.getMethodPerfStats()).toHaveLength(0);
    expect(service.getDevMetrics()).toHaveLength(0);
  });
});
