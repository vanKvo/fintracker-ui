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
    try {
      const session = await fetchAuthSession();
      return !!session.tokens;
    } catch {
      return false;
    }
  }

  /** Returns the Cognito sub of the signed-in user. */
  async getCurrentUserSub(): Promise<string> {
    const user = await getCurrentUser();
    return user.userId;
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
