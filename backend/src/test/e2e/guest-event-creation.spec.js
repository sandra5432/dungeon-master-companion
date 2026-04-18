// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Full end-to-end integration test: guest creates a timeline event in a world
 * that has guestCanEdit=true (Pardur in the dev H2 seed).
 *
 * Requires the app to be running on http://localhost:8080 with the dev profile.
 * Run: npx playwright test --project=chromium (from pardur-app/)
 */

test.describe('Guest event creation — Pardur (guestCanEdit=true)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for worlds to load and Pardur tab to appear
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
    // Select Pardur (may already be selected, click to be sure)
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    // Switch to timeline section
    await page.getByRole('button', { name: /Chronik/i }).click();
  });

  test('rope gap "Hier eintragen" is visible for guest', async ({ page }) => {
    await expect(page.locator('.rope-gap-hint').first()).toBeVisible();
  });

  test('clicking rope gap opens the event create dialog', async ({ page }) => {
    await page.locator('.rope-gap').first().click();
    // The timeline modal should appear
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    // It should contain the event title input
    await expect(page.locator('#f-ti')).toBeVisible();
  });

  test('guest can fill dialog and save a new timeline event', async ({ page }) => {
    const eventTitle = `Gasteintrag ${Date.now()}`;

    await page.locator('.rope-gap').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });

    // Fill in the event title
    await page.locator('#f-ti').fill(eventTitle);

    // Submit
    await page.locator('#m-save').click();

    // Modal should close
    await expect(page.locator('#modal')).toBeHidden({ timeout: 3000 });

    // The new event should appear on the timeline
    await expect(page.locator('.event-card').filter({ hasText: eventTitle })).toBeVisible({ timeout: 3000 });
  });
});

test('Guest cannot see rope gap in Eldorheim (guestCanEdit=false)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Eldorheim/i })).toBeHidden({ timeout: 5000 });
  // Eldorheim is not readable by guests — the tab should not be present at all
});
