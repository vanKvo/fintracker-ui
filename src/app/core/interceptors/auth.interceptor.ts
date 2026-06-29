import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Auth interceptor — behaviour differs between build configurations:
 *
 * PRODUCTION: fetches the JWT access token via Amplify (silent refresh included)
 *   and attaches  Authorization: Bearer <token>.  API Gateway validates the JWT
 *   and injects X-Internal-User-Id before forwarding to backend services.
 *
 * DEVELOPMENT: attaches X-Internal-User-Id: <environment.devUserId> directly so
 *   requests reach the local Spring Boot ledger service without an API Gateway.
 *   If Amplify's token refresh fails (session expired), signOut() is called and
 *   the request is aborted with the original error.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  if (!environment.production) {
    return next(
      req.clone({ setHeaders: { 'X-Internal-User-Id': environment.devUserId } })
    );
  }

  const authService = inject(AuthService);
  return from(authService.getAccessToken()).pipe(
    switchMap((token) =>
      next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    ),
  );
};
