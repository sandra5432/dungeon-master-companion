// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Full end-to-end integration test: guest places a POI on the map in a world
 * with guestCanEdit=true (Pardur in the dev H2 seed).
 *
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

test.describe('Guest POI creation — Pardur (guestCanEdit=true)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-map').click();
    // Wait for the map viewport to be present
    await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });
  });

  test('POI type buttons are enabled for guest', async ({ page }) => {
    const firstPoiBtn = page.locator('.poi-type-btn').first();
    await expect(firstPoiBtn).toBeVisible();
    await expect(firstPoiBtn).not.toBeDisabled();
  });

  test('guest can place a POI on the map and it is saved', async ({ page }) => {
    // Select the first POI type — this arms the placement tool
    await page.locator('.poi-type-btn').first().click();

    // Click on the map canvas wrap to place the POI
    const wrap = page.locator('#map-canvas-wrap');
    const box = await wrap.boundingBox();
    await wrap.click({ position: { x: box.width / 2, y: box.height / 2 } });

    // The POI dialog should open
    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });

    // Save without filling in a label (label is optional)
    await page.locator('#poi-modal button:has-text("Speichern")').click();

    // Modal closes and a POI marker appears on the map
    await expect(page.locator('#poi-modal')).toBeHidden({ timeout: 3000 });
    await expect(page.locator('.map-poi').first()).toBeVisible({ timeout: 5000 });
  });
});
