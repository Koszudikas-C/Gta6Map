import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ClientTelemetryEvent, DeviceMode } from '../models/hud.models';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly queue: ClientTelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly buildVersion = '0.1.0-alpha';

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

    this.queue.push(event);
    this.scheduleFlush();
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
