// @ts-check
const { test, expect, request } = require('@playwright/test');

/**
 * Verifies that the POI delete button respects the world's guestCanDelete flag.
 *
 * Requires the app running on http://localhost:8080 with the dev profile.
 * Pardur (world id=1) permissions are changed via API (as admin) before each test.
 */

const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Basic ' + Buffer.from('admin:4711').toString('base64'),
};

async function setGuestPermissions(apiCtx, worldId, { canRead, canEdit, canDelete }) {
  const listRes = await apiCtx.get('/api/worlds', { headers: ADMIN_HEADERS });
  const worlds = await listRes.json();
  const world = worlds.find(w => w.id === worldId);
  if (!world) throw new Error(`World ${worldId} not found`);
  const res = await apiCtx.put(`/api/worlds/${worldId}`, {
    headers: ADMIN_HEADERS,
    data: {
      name: world.name,
      description: world.description ?? '',
      sortOrder: world.sortOrder ?? 0,
      milesPerCell: world.milesPerCell ?? 5,
      chronicleEnabled: world.chronicleEnabled ?? true,
      wikiEnabled: world.wikiEnabled ?? true,
      mapEnabled: world.mapEnabled ?? true,
      guestCanRead: canRead,
      guestCanEdit: canEdit,
      guestCanDelete: canDelete,
      userCanRead: true,
      userCanEdit: true,
      userCanDelete: true,
    },
  });
  if (!res.ok()) throw new Error(`setGuestPermissions failed: ${res.status()} ${await res.text()}`);
}

async function seedPoi(apiCtx, worldId) {
  const res = await apiCtx.post(`/api/worlds/${worldId}/map/pois`, {
    headers: { 'Content-Type': 'application/json' },
    data: { poiTypeId: 1, xPct: 30.0, yPct: 30.0 },
  });
  return await res.json();
}

test.describe('Guest POI delete button — permission-gated', () => {

  test('delete button is hidden when guestCanDelete=false', async ({ page, request: apiCtx }) => {
    // Arrange: edit+view allowed, delete revoked
    await setGuestPermissions(apiCtx, 1, { canRead: true, canEdit: true, canDelete: false });
    const poi = await seedPoi(apiCtx, 1);

    // Navigate as guest to Pardur map
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-map').click();
    await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });

    // Switch to edit mode, then click the seeded POI to open its dialog
    await page.locator('#map-tool-edit').click();
    await page.locator(`.map-poi[data-poi-id="${poi.id}"]`).click();
    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });

    // Delete button must NOT be visible
    await expect(page.locator('#poi-delete-btn')).toBeHidden();
  });

  test('delete button is visible when guestCanDelete=true', async ({ page, request: apiCtx }) => {
    // Arrange: full guest access
    await setGuestPermissions(apiCtx, 1, { canRead: true, canEdit: true, canDelete: true });
    const poi = await seedPoi(apiCtx, 1);

    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-map').click();
    await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });

    await page.locator('#map-tool-edit').click();
    await page.locator(`.map-poi[data-poi-id="${poi.id}"]`).click();
    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });

    // Delete button MUST be visible
    await expect(page.locator('#poi-delete-btn')).toBeVisible();
  });
});
