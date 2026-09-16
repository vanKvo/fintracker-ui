import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Auth interceptor — behaviour differs per target, not just per build configuration:
 *
 * THE LEDGER (/api/v1/ledger), in local dev only: there is no API Gateway or authorizer in
 *   front of the local Spring Boot process, so it trusts X-Internal-User-Id directly. The value
 *   comes from AuthService.getCurrentUserId() — see that method for how it's resolved
 *   (devUserMap, or an e2e test override).
 *
 * EVERY OTHER BACKEND (e.g. /api/v1/identity), and the Ledger in production: these always sit
 *   behind a real Lambda REQUEST authorizer that verifies a real Cognito-issued JWT — dev or
 *   prod, there is no bypass — so they always get Authorization: Bearer <token> instead.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  const authService = inject(AuthService);

  if (!environment.production && req.url.includes('/api/v1/ledger')) {
    return from(authService.getCurrentUserId()).pipe(
      switchMap((userId) =>
        next(req.clone({ setHeaders: { 'X-Internal-User-Id': userId } }))
      ),
    );
  }

  return from(authService.getAccessToken()).pipe(
    switchMap((token) =>
      next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    ),
  );
};
