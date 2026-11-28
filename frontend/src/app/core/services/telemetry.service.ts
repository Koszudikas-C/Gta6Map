import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { ClientTelemetryEvent, DeviceMode } from '../models/hud.models';

export const DEV_PERF_STORAGE_KEY = 'leonida_dev_perf_metrics';
const MAX_DEV_PERF_ENTRIES = 250;

export interface DevPerfSummary {
  count: number;
  avgFps: number | null;
  minFps: number | null;
  lastMapLoadMs: number | null;
  lastUpdated: string | null;
}

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly queue: ClientTelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private devMetricsCache: ClientTelemetryEvent[] | null = null;
  private readonly buildVersion = '0.1.0-alpha';

  constructor() {
    if (this.isDevMetricsEnabled()) {
      this.exposeDevConsoleHelpers();
      this.recordStartupPerfMetrics();
    }
  }

  capture(
    partial: Omit<ClientTelemetryEvent, 'route' | 'deviceType' | 'gamepadConnected' | 'buildVersion' | 'timestamp'>,
    context?: { deviceType?: DeviceMode; gamepadConnected?: boolean }
  ): void {
    const event: ClientTelemetryEvent = {
      ...partial,
      route: isPlatformBrowser(this.platformId) ? window.location.pathname : '/',
      deviceType: context?.deviceType ?? this.detectDeviceType(),
      gamepadConnected: context?.gamepadConnected ?? false,
      buildVersion: this.buildVersion,
      timestamp: new Date().toISOString(),
    };

    if (this.isDevMetricsEnabled()) {
      this.persistDevMetric(event);
    }

    this.queue.push(event);
    this.scheduleFlush();
  }

  getDevMetrics(): ClientTelemetryEvent[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }
    if (this.devMetricsCache !== null) {
      return [...this.devMetricsCache];
    }
    try {
      const raw = localStorage.getItem(DEV_PERF_STORAGE_KEY);
      if (!raw) {
        this.devMetricsCache = [];
        return [];
      }
      const parsed = JSON.parse(raw);
      this.devMetricsCache = Array.isArray(parsed) ? (parsed as ClientTelemetryEvent[]) : [];
      return [...this.devMetricsCache];
    } catch {
      this.devMetricsCache = [];
      return [];
    }
  }

  clearDevMetrics(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.devMetricsCache = [];
    try {
      localStorage.removeItem(DEV_PERF_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
  }

  getDevMetricsSummary(): DevPerfSummary {
    const events = this.getDevMetrics();
    const fpsValues: number[] = [];
    let lastMapLoadMs: number | null = null;

    for (const ev of events) {
      if (ev.message.startsWith('fps_sample:') || ev.message.startsWith('low_fps:')) {
        const val = Number(ev.message.split(':')[1]);
        if (Number.isFinite(val)) {
          fpsValues.push(val);
        }
      } else if (ev.message.startsWith('map_load_ms:')) {
        const val = Number(ev.message.split(':')[1]);
        if (Number.isFinite(val)) {
          lastMapLoadMs = val;
        }
      }
    }

    const avgFps =
      fpsValues.length > 0
        ? Math.round(fpsValues.reduce((sum, n) => sum + n, 0) / fpsValues.length)
        : null;
    const minFps = fpsValues.length > 0 ? Math.min(...fpsValues) : null;
    const lastUpdated = events.length > 0 ? events[events.length - 1].timestamp : null;

    return {
      count: events.length,
      avgFps,
      minFps,
      lastMapLoadMs,
      lastUpdated,
    };
  }

  exportDevMetricsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        summary: this.getDevMetricsSummary(),
        events: this.getDevMetrics(),
      },
      null,
      2,
    );
  }

  downloadDevMetricsJson(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const json = this.exportDevMetricsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leonida-perf-metrics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private isDevMetricsEnabled(): boolean {
    return isDevMode() && environment.enableTelemetry && isPlatformBrowser(this.platformId);
  }

  private persistDevMetric(event: ClientTelemetryEvent): void {
    const existing = this.getDevMetrics();
    this.devMetricsCache = [...existing, event].slice(-MAX_DEV_PERF_ENTRIES);
    if (this.persistTimer !== null) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        localStorage.setItem(DEV_PERF_STORAGE_KEY, JSON.stringify(this.devMetricsCache ?? []));
      } catch {
        // Ignore storage quota errors
      }
    }, 400);
  }

  private recordStartupPerfMetrics(): void {
    if (typeof performance === 'undefined') {
      return;
    }
    setTimeout(() => {
      const nav = performance.getEntriesByType?.('navigation')?.[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (nav && nav.domInteractive > 0) {
        this.capture({
          level: 'perf',
          source: 'rum',
          message: `dom_interactive_ms:${Math.round(nav.domInteractive)}`,
        });
      }
      const paints = performance.getEntriesByType?.('paint') ?? [];
      const fcp = paints.find((p) => p.name === 'first-contentful-paint');
      if (fcp) {
        this.capture({
          level: 'perf',
          source: 'rum',
          message: `fcp_ms:${Math.round(fcp.startTime)}`,
        });
      }
    }, 0);
  }

  private exposeDevConsoleHelpers(): void {
    const win = window as unknown as {
      __leonidaPerf?: {
        getMetrics: () => ClientTelemetryEvent[];
        summary: () => DevPerfSummary;
        clear: () => void;
        downloadJson: () => void;
      };
    };
    win.__leonidaPerf = {
      getMetrics: () => this.getDevMetrics(),
      summary: () => this.getDevMetricsSummary(),
      clear: () => this.clearDevMetrics(),
      downloadJson: () => this.downloadDevMetricsJson(),
    };
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 1500);
  }

  private flush(): void {
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.splice(0, 10);
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.http.post('/api/telemetry/client-error', { events: batch }).subscribe({
      error: () => {
        // Silently drop telemetry transport failures to avoid cascading errors
      },
    });
  }

  private detectDeviceType(): DeviceMode {
    if (!isPlatformBrowser(this.platformId)) {
      return 'desktop';
    }
    return window.innerWidth < 768 ? 'mobile' : 'desktop';
  }
}
