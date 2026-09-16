import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * Regression coverage for two bugs found by manually creating a second local user
 * (docs/bugs/...): the Dashboard rendered a fabricated demo dataset instead of a zero state for
 * an account with no real data, and Statements never called its real API at all, always showing
 * a hardcoded fixture list. Both are now fixed; this suite locks in the correct behavior across
 * every ledger-backed tab.
 *
 * Auth strategy: driving AWS's actual Cognito Hosted UI needs real test-user credentials this
 * suite has no way to own, so `AuthService`'s dev-only e2e override (see auth.service.ts) is
 * used to sign in as a fixture user id instead. That id is a freshly generated UUID per test —
 * never used before, so it is *guaranteed* to have zero rows in the shared local Postgres, no
 * seeding or cleanup required. Everything downstream of "who is signed in" is real: the auth
 * interceptor, the proxied Ledger API, RLS-scoped Postgres reads.
 *
 * Requires the local stack up: Postgres (see docs/instructions/setup_postgresql16_homebrew.md /
 * connect_ledger_to_shared_postgres.md) and the Ledger service reachable at :8081 (`mvn
 * spring-boot:run` or `docker compose up -d ledger`) — `ng serve`'s proxy.conf.json forwards
 * /api/v1/ledger there. `webServer` in playwright.config.ts starts `ng serve` itself if it isn't
 * already running.
 */

async function signInAsFreshUser(page: Page): Promise<string> {
  const freshUserId = randomUUID();
  await page.addInitScript(id => {
    (window as unknown as { __e2eAuthOverrideSub__?: string }).__e2eAuthOverrideSub__ = id;
  }, freshUserId);
  return freshUserId;
}

test.describe('a brand-new user with no ledger data', () => {
  test('Dashboard shows a zero state, not fabricated demo data', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/dashboard');

    await expect(page.getByText('Financial Overview')).toBeVisible();

    // The old bug (demo-data fallback) populated these with fabricated non-zero figures for
    // *any* empty result, indistinguishable from real data — asserting exact zeros only passes
    // once that fallback is gone.
    await expect(page.getByText('Total Balance').locator('..').getByText('$0.00')).toBeVisible();
    await expect(page.getByText('Monthly Income').locator('..').getByText('$0.00')).toBeVisible();
    await expect(page.getByText('Monthly Expenses').locator('..').getByText('$0.00')).toBeVisible();
    await expect(page.getByText('Linked Accounts').locator('..').getByText('0')).toBeVisible();

    await expect(page.getByText('No transactions yet')).toBeVisible();
    await expect(page.getByText('No upcoming bills')).toBeVisible();

    // No load-failure banners either — a genuinely empty ledger is a successful response, not
    // an error (see dashboard.ts's summaryLoadFailed/transactionsLoadFailed/billsLoadFailed).
    await expect(page.getByText("Couldn't load")).toHaveCount(0);
  });

  test('Transactions shows no rows', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/transactions');

    await expect(page.getByText('No transactions found matching the filters.')).toBeVisible();
  });

  test('Accounts shows the empty state', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/accounts');

    await expect(page.getByText('No linked accounts found.')).toBeVisible();
  });

  test('Statements shows no rows, not the hardcoded fixture list', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/statements');

    await expect(page.getByText('No statements yet')).toBeVisible();

    // The old bug: a hardcoded array of 5 fake statements (Chase Checking, Capital One, Amex
    // Platinum, ...) rendered unconditionally for every user, real API never called.
    await expect(page.getByText('Chase Checking')).toHaveCount(0);
    await expect(page.getByText('Capital One')).toHaveCount(0);
    await expect(page.getByText('Amex Platinum')).toHaveCount(0);
  });

  test('Budgets shows the "no budgets created yet" empty state', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/budgets');

    await expect(page.getByText('No budgets created yet')).toBeVisible();
  });
});
