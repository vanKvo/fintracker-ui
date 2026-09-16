export interface AppEnvironment {
  production: boolean;
  cognito: {
    /** Cognito User Pool ID — format: <region>_<id>, e.g. us-east-1_AbCdEfGhI */
    userPoolId: string;
    /** Cognito App Client ID (public client, no secret) */
    userPoolClientId: string;
    /** Cognito domain prefix, e.g. "fintracker-dev.auth.us-east-1.amazoncognito.com" */
    oauthDomain: string;
    /** Full URL Cognito redirects to after login — must be registered in the App Client */
    redirectSignIn: string;
    /** Full URL Cognito redirects to after logout */
    redirectSignOut: string;
  };
  /**
   * Dev-only: fixed internal UUID injected as X-Internal-User-Id when running against
   * the local Spring Boot ledger (no API Gateway in the dev proxy path).
   * Ignored in production builds.
   */
  devUserId: string;
  /**
   * Dev-only: maps a real Cognito `sub` (from the signed-in Amplify session) to a
   * distinct internal UUID, so multiple local Cognito accounts can each see their
   * own seeded data instead of all collapsing onto devUserId. A sub not present
   * here falls back to devUserId. Ignored in production builds — this is a
   * stand-in for the sub→UUID resolution API Gateway performs for real.
   */
  devUserMap: Record<string, string>;
}
