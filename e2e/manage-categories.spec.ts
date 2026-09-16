import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * REQ-TS-01: end-to-end coverage for the Settings > Categories tab — create, rename, and delete
 * a custom category through the real Ledger API (Testcontainers-free; this runs against the
 * actual local Postgres/Ledger stack, same requirement as fresh-user-empty-state.spec.ts).
 *
 * Auth strategy: see fresh-user-empty-state.spec.ts's comment — a fresh random user id per test
 * via AuthService's dev-only e2e override, so each test starts with zero custom categories and
 * needs no seeding or cleanup.
 */
async function signInAsFreshUser(page: Page): Promise<string> {
  const freshUserId = randomUUID();
  await page.addInitScript(id => {
    (window as unknown as { __e2eAuthOverrideSub__?: string }).__e2eAuthOverrideSub__ = id;
  }, freshUserId);
  return freshUserId;
}

test.describe('Settings > Categories', () => {
  test('a user can create, rename, and delete a custom category', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Categories' }).click();

    // System categories are always present and read-only.
    await expect(page.getByText('Groceries', { exact: true })).toBeVisible();
    await expect(page.getByText("You haven't created any custom categories yet.")).toBeVisible();

    // Create.
    const categoryList = page.locator('.category-list');
    await page.getByLabel('New category name').fill('Freelance Work');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(categoryList.getByText('Freelance Work')).toBeVisible();
    await expect(page.getByText('was added.')).toBeVisible();

    // Rename.
    await page.getByRole('button', { name: 'Rename' }).click();
    const editInput = page.locator('.category-row input[matinput]');
    await editInput.fill('Side Hustle Income');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(categoryList.getByText('Side Hustle Income')).toBeVisible();
    await expect(categoryList.getByText('Freelance Work')).not.toBeVisible();

    // Delete — unused, so a plain confirmation with no reassignment picker.
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Delete "Side Hustle Income"?')).toBeVisible();
    await expect(page.getByText("This category isn't used by any transactions yet.")).toBeVisible();
    await page.getByRole('button', { name: 'Delete Category' }).click();

    await expect(page.getByText('was deleted.')).toBeVisible();
    await expect(page.getByText("You haven't created any custom categories yet.")).toBeVisible();
  });

  test('creating a category that collides with a system category shows a clear error', async ({ page }) => {
    await signInAsFreshUser(page);
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Categories' }).click();

    await page.getByLabel('New category name').fill('Groceries');
    await page.getByRole('button', { name: 'Add' }).click();

    // The backend's RFC 9457 detail message, not a raw error — never a stack trace or exception
    // class name (same convention proven server-side in CategoryControllerIT).
    await expect(page.getByText(/already exists/i)).toBeVisible();
    await expect(page.getByText(/Exception/)).not.toBeVisible();
  });
});
