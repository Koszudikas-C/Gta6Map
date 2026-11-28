import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import {
  ClientTelemetryEvent,
  DeviceMode,
  MethodPerfSortKey,
  MethodPerfStats,
} from '../models/hud.models';

export const DEV_PERF_STORAGE_KEY = 'leonida_dev_perf_metrics';
const MAX_DEV_PERF_ENTRIES = 250;
const MAX_METHOD_SAMPLES = 120;
const DEFAULT_SLOW_THRESHOLD_MS = 12;
const SLOW_CAPTURE_COOLDOWN_MS = 2000;

interface InternalMethodStats {
  name: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  slowCount: number;
  slowThresholdMs: number;
  samples: number[];
  sampleIndex: number;
  lastSlowCaptureAt: number;
  lastMeta?: Record<string, unknown>;
  lastTimestamp: string;
}

export interface DevPerfMethodSummaryRow {
  name: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  totalMs: number;
}

export interface DevPerfSummary {
  count: number;
  avgFps: number | null;
  minFps: number | null;
  lastMapLoadMs: number | null;
  lastUpdated: string | null;
  trackedMethods: number;
  totalMethodCalls: number;
  totalSlowCalls: number;
  slowestMethods: DevPerfMethodSummaryRow[];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

@Injectable({ providedIn: 'root' })
export class TelemetryService implements OnDestroy {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly queue: ClientTelemetryEvent[] = [];
  private readonly methodStats = new Map<string, InternalMethodStats>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private longTaskObserver: PerformanceObserver | null = null;
  private devMetricsCache: ClientTelemetryEvent[] | null = null;
  private readonly buildVersion = '0.1.0-alpha';

  constructor() {
    if (this.isDevMetricsEnabled()) {
      this.exposeDevConsoleHelpers();
      this.recordStartupPerfMetrics();
      this.observeLongTasks();
    }
  }

  ngOnDestroy(): void {
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
  }

  recordTiming(
    name: string,
    durationMs: number,
    meta?: Record<string, unknown>,
    slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS,
  ): void {
    if (!this.isDevMetricsEnabled() || !Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    const now = this.nowMs();
    const timestamp = new Date().toISOString();
    let entry = this.methodStats.get(name);
    if (!entry) {
      entry = {
        name,
        count: 0,
        totalMs: 0,
        minMs: durationMs,
        maxMs: durationMs,
        lastMs: durationMs,
        slowCount: 0,
        slowThresholdMs,
        samples: [],
        sampleIndex: 0,
        lastSlowCaptureAt: -SLOW_CAPTURE_COOLDOWN_MS,
        lastTimestamp: timestamp,
      };
      this.methodStats.set(name, entry);
    }

    entry.count++;
    entry.totalMs += durationMs;
    if (durationMs < entry.minMs) {
      entry.minMs = durationMs;
    }
    if (durationMs > entry.maxMs) {
      entry.maxMs = durationMs;
    }
    entry.lastMs = durationMs;
    entry.slowThresholdMs = slowThresholdMs;
    entry.lastTimestamp = timestamp;
    if (meta) {
      entry.lastMeta = meta;
    }

    if (entry.samples.length < MAX_METHOD_SAMPLES) {
      entry.samples.push(durationMs);
    } else {
      entry.samples[entry.sampleIndex] = durationMs;
      entry.sampleIndex = (entry.sampleIndex + 1) % MAX_METHOD_SAMPLES;
    }

    if (durationMs >= slowThresholdMs) {
      entry.slowCount++;
      if (now - entry.lastSlowCaptureAt >= SLOW_CAPTURE_COOLDOWN_MS) {
        entry.lastSlowCaptureAt = now;
        this.capture({
          level: 'perf',
          source: 'rum',
          message: `slow_fn:${name}:${round3(durationMs)}ms`,
          meta: {
            fn: name,
            durationMs: round3(durationMs),
            thresholdMs: slowThresholdMs,
            ...(meta ?? {}),
          },
        });
      }
    }
  }

  measure<T>(
    name: string,
    fn: () => T,
    meta?: Record<string, unknown> | ((result: T) => Record<string, unknown>),
    slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS,
  ): T {
    if (!this.isDevMetricsEnabled()) {
      return fn();
    }
    const start = this.nowMs();
    let result!: T;
    let failed = false;
    try {
      result = fn();
      return result;
    } catch (err) {
      failed = true;
      throw err;
    } finally {
      const durationMs = Math.max(0, this.nowMs() - start);
      const resolvedMeta = failed
        ? { error: true }
        : typeof meta === 'function'
          ? meta(result)
          : meta;
      this.recordTiming(name, durationMs, resolvedMeta, slowThresholdMs);
    }
  }

  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown> | ((result: T) => Record<string, unknown>),
    slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS,
  ): Promise<T> {
    if (!this.isDevMetricsEnabled()) {
      return fn();
    }
    const start = this.nowMs();
    let result!: T;
    let failed = false;
    try {
      result = await fn();
      return result;
    } catch (err) {
      failed = true;
      throw err;
    } finally {
      const durationMs = Math.max(0, this.nowMs() - start);
      const resolvedMeta = failed
        ? { error: true }
        : typeof meta === 'function'
          ? meta(result)
          : meta;
      this.recordTiming(name, durationMs, resolvedMeta, slowThresholdMs);
    }
  }

  getMethodPerfStats(sortBy: MethodPerfSortKey = 'totalMs'): MethodPerfStats[] {
    const list: MethodPerfStats[] = [];
    for (const entry of this.methodStats.values()) {
      list.push(this.materializeMethodStats(entry));
    }
    return list.sort((a, b) => b[sortBy] - a[sortBy]);
  }

  getMethodPerfStat(name: string): MethodPerfStats | null {
    const entry = this.methodStats.get(name);
    return entry ? this.materializeMethodStats(entry) : null;
  }

  getSlowestMethods(limit = 15, sortBy: MethodPerfSortKey = 'maxMs'): MethodPerfStats[] {
    return this.getMethodPerfStats(sortBy).slice(0, Math.max(0, limit));
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
    this.methodStats.clear();
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

    let totalMethodCalls = 0;
    let totalSlowCalls = 0;
    for (const entry of this.methodStats.values()) {
      totalMethodCalls += entry.count;
      totalSlowCalls += entry.slowCount;
    }
    const slowestMethods = this.getSlowestMethods(5, 'maxMs').map((m) => ({
      name: m.name,
      count: m.count,
      avgMs: m.avgMs,
      p95Ms: m.p95Ms,
      maxMs: m.maxMs,
      totalMs: m.totalMs,
    }));

    return {
      count: events.length,
      avgFps,
      minFps,
      lastMapLoadMs,
      lastUpdated,
      trackedMethods: this.methodStats.size,
      totalMethodCalls,
      totalSlowCalls,
      slowestMethods,
    };
  }

  exportDevMetricsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        summary: this.getDevMetricsSummary(),
        methods: this.getMethodPerfStats('totalMs'),
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

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private materializeMethodStats(entry: InternalMethodStats): MethodPerfStats {
    const sorted = [...entry.samples].sort((a, b) => a - b);
    const avgMs = entry.count > 0 ? entry.totalMs / entry.count : 0;
    return {
      name: entry.name,
      count: entry.count,
      totalMs: round3(entry.totalMs),
      avgMs: round3(avgMs),
      minMs: round3(entry.minMs),
      maxMs: round3(entry.maxMs),
      p50Ms: round3(percentile(sorted, 0.5)),
      p95Ms: round3(percentile(sorted, 0.95)),
      p99Ms: round3(percentile(sorted, 0.99)),
      lastMs: round3(entry.lastMs),
      slowCount: entry.slowCount,
      slowThresholdMs: entry.slowThresholdMs,
      ...(entry.lastMeta ? { lastMeta: entry.lastMeta } : {}),
      lastTimestamp: entry.lastTimestamp,
    };
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
      if (fcp && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
        this.capture({
          level: 'perf',
          source: 'rum',
          message: `fcp_ms:${Math.round(fcp.startTime)}`,
        });
      }
    }, 0);
  }

  private observeLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }
    try {
      const supported = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] })
        .supportedEntryTypes;
      if (Array.isArray(supported) && !supported.includes('longtask')) {
        return;
      }
      this.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordTiming(
            'browser.longtask',
            entry.duration,
            {
              startTime: round3(entry.startTime),
              entryName: entry.name,
            },
            50,
          );
        }
      });
      this.longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      this.longTaskObserver = null;
    }
  }

  private exposeDevConsoleHelpers(): void {
    const win = window as unknown as {
      __leonidaPerf?: {
        getMetrics: () => ClientTelemetryEvent[];
        summary: () => DevPerfSummary;
        methods: (sortBy?: MethodPerfSortKey) => MethodPerfStats[];
        method: (name: string) => MethodPerfStats | null;
        slowest: (limit?: number, sortBy?: MethodPerfSortKey) => MethodPerfStats[];
        table: (limit?: number, sortBy?: MethodPerfSortKey) => MethodPerfStats[];
        clear: () => void;
        downloadJson: () => void;
      };
    };
    win.__leonidaPerf = {
      getMetrics: () => this.getDevMetrics(),
      summary: () => this.getDevMetricsSummary(),
      methods: (sortBy?: MethodPerfSortKey) => this.getMethodPerfStats(sortBy),
      method: (name: string) => this.getMethodPerfStat(name),
      slowest: (limit?: number, sortBy?: MethodPerfSortKey) => this.getSlowestMethods(limit, sortBy),
      table: (limit = 20, sortBy: MethodPerfSortKey = 'maxMs') => {
        const rows = this.getSlowestMethods(limit, sortBy);
        if (typeof console.table === 'function') {
          console.table(
            rows.map((r) => ({
              name: r.name,
              count: r.count,
              avgMs: r.avgMs,
              p95Ms: r.p95Ms,
              maxMs: r.maxMs,
              totalMs: r.totalMs,
              slowCount: r.slowCount,
            })),
          );
        }
        return rows;
      },
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
    if (!isPlatformBrowser(this.platformId) || !this.http) {
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
