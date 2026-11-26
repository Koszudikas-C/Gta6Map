import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TelemetryService } from '../services/telemetry.service';

export const telemetryInterceptor: HttpInterceptorFn = (req, next) => {
  const telemetry = inject(TelemetryService);

  if (req.url.includes('/api/telemetry/client-error')) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status >= 400) {
        telemetry.capture({
          level: 'error',
          source: 'http',
          message: `HTTP ${error.status} on ${req.method} ${req.urlWithParams}`,
        });
      }
      return throwError(() => error);
    })
  );
};
