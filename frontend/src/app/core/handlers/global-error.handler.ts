import { ErrorHandler, Injectable, inject } from '@angular/core';
import { TelemetryService } from '../services/telemetry.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly telemetry = inject(TelemetryService);

  handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const isWebGL = /webgl|context lost|shader|gpu/i.test(err.message);

    this.telemetry.capture({
      level: 'error',
      source: isWebGL ? 'webgl' : 'js',
      message: err.message,
      stack: err.stack,
    });

    console.error('[Leonida GlobalErrorHandler]', err);
  }
}
