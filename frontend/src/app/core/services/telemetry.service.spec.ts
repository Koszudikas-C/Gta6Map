import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
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
});
