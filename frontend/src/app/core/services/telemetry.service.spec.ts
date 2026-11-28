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
});
