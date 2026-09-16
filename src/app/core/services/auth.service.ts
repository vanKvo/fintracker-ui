import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private readonly router: Router) {
    this.checkSession();
    this.listenToHubEvents();
  }

  /** Trigger Cognito Hosted UI redirect with PKCE. */
  signIn(): void {
    signInWithRedirect();
  }

  /**
   * Global sign-out: revokes the refresh token at Cognito (invalidates all
   * devices) then navigates to the login page.
   */
  async signOut(): Promise<void> {
    try {
      await signOut({ global: true });
    } finally {
      this.isAuthenticatedSubject.next(false);
      this.router.navigate(['/auth/login']);
    }
  }

  /**
   * Returns the raw JWT access token string for the current session.
   * Amplify silently refreshes the access token via the refresh token when
   * it has expired. Throws AuthError if there is no valid session.
   */
  async getAccessToken(): Promise<string> {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (!token) throw new Error('No access token in session');
    return token;
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.e2eOverrideSub() !== null) return true;
    try {
      const session = await fetchAuthSession();
      return !!session.tokens;
    } catch {
      return false;
    }
  }

  /** Returns the Cognito sub of the signed-in user. */
  async getCurrentUserSub(): Promise<string> {
    const override = this.e2eOverrideSub();
    if (override !== null) return override;
    const user = await getCurrentUser();
    return user.userId;
  }

  /**
   * E2E test hook only — lets Playwright simulate "signed in as sub X" without driving AWS's
   * real Cognito Hosted UI (an external page needing real test-user credentials Playwright
   * can't reasonably own). Inert in production: `environment.production` is `true` there, so
   * this always returns null regardless of what a page script sets. Set via
   * `page.addInitScript()` before navigation — see fintracker-ui/e2e/.
   */
  private e2eOverrideSub(): string | null {
    if (environment.production) return null;
    return (globalThis as { __e2eAuthOverrideSub__?: string }).__e2eAuthOverrideSub__ ?? null;
  }

  /**
   * The identity value this environment actually authenticates requests
   * with — the devUserMap-resolved internal UUID in development, or the
   * real Cognito sub in production. This is the single source of truth
   * `authInterceptor` reads for X-Internal-User-Id, so every request (and
   * anything embedding an identity value outside the interceptor's reach —
   * e.g. StatementService.uploadToS3's S3 metadata headers, which must
   * match what the Ledger signed into the presigned URL) agrees on it.
   */
  async getCurrentUserId(): Promise<string> {
    // The e2e override supplies the resolved internal_user_id directly — it's a fixture id
    // generated per test run, not a real Cognito sub, so there is nothing to translate via
    // devUserMap here.
    const override = this.e2eOverrideSub();
    if (override !== null) return override;
    if (environment.production) return this.getCurrentUserSub();
    const sub = await this.getCurrentUserSub();
    return environment.devUserMap[sub] ?? environment.devUserId;
  }

  private async checkSession(): Promise<void> {
    const authenticated = await this.isAuthenticated();
    this.isAuthenticatedSubject.next(authenticated);
  }

  private listenToHubEvents(): void {
    Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          this.isAuthenticatedSubject.next(true);
          break;
        case 'signedOut':
        case 'tokenRefresh_failure':
          this.isAuthenticatedSubject.next(false);
          this.router.navigate(['/auth/login']);
          break;
      }
    });
  }
}
