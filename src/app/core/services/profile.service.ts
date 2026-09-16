import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionTier: string;
  settings: {
    currency: string;
    timezone: string;
    notificationPrefs: {
      channel: string;
      budgetAlerts: boolean;
      statementProcessed: boolean;
    };
  };
}

/**
 * Talks to the user-profile Lambda service's GET /profile (see
 * services/fintracker-user-profile/app/identity/handlers.py:get_profile_handler) — the
 * authoritative source for the signed-in user's name/email/settings. Always sent with a real
 * Authorization: Bearer token (see auth.interceptor.ts): this service runs its own Lambda
 * REQUEST authorizer even in local dev, unlike the Ledger's dev-only X-Internal-User-Id bypass.
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private apiUrl = '/api/v1/identity/profile';

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl);
  }
}
