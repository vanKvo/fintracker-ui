import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a real `ng serve` (proxied to the local Ledger at :8081 per proxy.conf.json) and
 * the real local Postgres/DynamoDB — not a mocked backend. Only authentication is faked (see
 * e2e/fixtures/auth.ts): driving AWS's actual Cognito Hosted UI needs real test-user credentials
 * this suite has no way to own, so the app's dev-only e2e auth hook is used instead. Everything
 * downstream of "who is signed in" — routing, the auth interceptor, the Ledger, RLS-scoped
 * Postgres reads — is exercised for real.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
