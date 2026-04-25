// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, ADMIN_HEADERS } = require('./helpers');

/**
 * AL-C2: Weltverwaltung features.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

async function openWorldsConfig(page) {
  await page.goto('/');
  await loginAsAdmin(page);
  await page.locator('#btn-config').click();
  await expect(page.locator('#page-config')).toBeVisible({ timeout: 5000 });
}

// ── AL-C2-001: Weltenliste anzeigen ──────────────────────────────────────────

test.describe('AL-C2-001 — Weltenliste anzeigen', () => {

  test('world config page is accessible for admin via config icon', async ({ page }) => {
    await openWorldsConfig(page);
    await expect(page.locator('#config-worlds-table, #config-worlds-body').first()).toBeVisible({ timeout: 5000 });
  });

  test('seeded worlds Pardur, Eldorheim, and Regeln appear in the list', async ({ page }) => {
    await openWorldsConfig(page);
    await expect(page.locator('#config-worlds-body').filter({ hasText: 'Pardur' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#config-worlds-body').filter({ hasText: 'Eldorheim' })).toBeVisible();
    await expect(page.locator('#config-worlds-body').filter({ hasText: 'Regeln' })).toBeVisible();
  });

  test('world config page is NOT accessible without login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-config')).toBeHidden({ timeout: 5000 });
  });

});

// ── AL-C2-002: Welt erstellen ─────────────────────────────────────────────────

test.describe('AL-C2-002 — Welt erstellen', () => {
  const newWorldName = `E2E-Welt-${Date.now()}`;
  let createdWorldId;

  test.afterEach(async ({ request: apiCtx }) => {
    if (createdWorldId) {
      await apiCtx.delete(`/api/worlds/${createdWorldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      createdWorldId = null;
    } else {
      // Try to find and delete by name
      const res = await apiCtx.get('/api/worlds', { headers: ADMIN_HEADERS });
      if (!res.ok()) return;
      const worlds = await res.json();
      const w = worlds.find(x => x.name === newWorldName);
      if (w) await apiCtx.delete(`/api/worlds/${w.id}`, { headers: ADMIN_HEADERS }).catch(() => {});
    }
  });

  test('admin can open the create world modal', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('button:has-text("+ Welt hinzufügen"), button:has-text("Welt hinzufügen")').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-n')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

  test('admin can create a new world and it appears in the list', async ({ page, request: apiCtx }) => {
    await openWorldsConfig(page);
    await page.locator('button:has-text("+ Welt hinzufügen"), button:has-text("Welt hinzufügen")').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fw-n').fill(newWorldName);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#config-worlds-body').filter({ hasText: newWorldName })).toBeVisible({ timeout: 5000 });

    // Store id for cleanup
    const res = await apiCtx.get('/api/worlds', { headers: ADMIN_HEADERS });
    const worlds = await res.json();
    const w = worlds.find(x => x.name === newWorldName);
    createdWorldId = w?.id;
  });

  test('saving without a world name shows an error', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('button:has-text("+ Welt hinzufügen"), button:has-text("Welt hinzufügen")').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fw-n').fill('');
    await page.locator('#m-save').click();
    // Modal stays open on validation error
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

});

// ── AL-C2-003: Welt bearbeiten ────────────────────────────────────────────────

test.describe('AL-C2-003 — Welt bearbeiten', () => {
  let worldId;
  const editWorldName = `E2E-Edit-${Date.now()}`;
  const updatedName = `E2E-Upd-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds', {
      headers: ADMIN_HEADERS,
      data: { name: editWorldName },
    });
    worldId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (worldId) await apiCtx.delete(`/api/worlds/${worldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can open the edit modal for a world', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: editWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-n')).toHaveValue(editWorldName);
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

  test('admin can change the world name', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: editWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#fw-n').fill(updatedName);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#config-worlds-body').filter({ hasText: updatedName })).toBeVisible({ timeout: 5000 });
  });

  test('admin can set a sortOrder/sequence value', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: editWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-seq')).toBeVisible();
    await page.locator('#fw-seq').fill('5');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
  });

});

// ── AL-C2-004: Weltberechtigungen konfigurieren ───────────────────────────────

test.describe('AL-C2-004 — Weltberechtigungen konfigurieren', () => {
  let worldId;
  const permWorldName = `E2E-Perm-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds', {
      headers: ADMIN_HEADERS,
      data: { name: permWorldName },
    });
    worldId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (worldId) await apiCtx.delete(`/api/worlds/${worldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('permission checkboxes are visible in the world edit modal', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: permWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-guest-read')).toBeVisible();
    await expect(page.locator('#fw-guest-edit')).toBeVisible();
    await expect(page.locator('#fw-guest-delete')).toBeVisible();
    await expect(page.locator('#fw-user-read')).toBeVisible();
    await expect(page.locator('#fw-user-edit')).toBeVisible();
    await expect(page.locator('#fw-user-delete')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

  test('admin can toggle guest read permission and save', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: permWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    // Toggle guestCanRead
    const checkbox = page.locator('#fw-guest-read');
    const wasChecked = await checkbox.isChecked();
    if (wasChecked) {
      await checkbox.uncheck();
    } else {
      await checkbox.check();
    }
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
  });

  test('feature section checkboxes are visible (Chronik, Wiki, Karte)', async ({ page }) => {
    await openWorldsConfig(page);
    await page.locator('#config-worlds-body tr').filter({ hasText: permWorldName }).locator('button').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fw-chronicle, #fw-timeline')).toBeVisible();
    await expect(page.locator('#fw-wiki')).toBeVisible();
    await expect(page.locator('#fw-map')).toBeVisible();
    await page.locator('.m-close, button:has-text("Abbrechen")').first().click();
  });

});

// ── AL-C2-005: Welt löschen ───────────────────────────────────────────────────

test.describe('AL-C2-005 — Welt löschen', () => {
  let worldId;
  const delWorldName = `E2E-Del-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds', {
      headers: ADMIN_HEADERS,
      data: { name: delWorldName },
    });
    worldId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (worldId) await apiCtx.delete(`/api/worlds/${worldId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can delete a world and it disappears from the list', async ({ page }) => {
    await openWorldsConfig(page);
    const row = page.locator('#config-worlds-body tr').filter({ hasText: delWorldName });
    // Click the delete button (last action button in the row)
    await row.locator('button.act-btn.del, button[title="Löschen"]').last().click();
    // Confirm if modal appears
    const modal = page.locator('#modal');
    if (await modal.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.locator('#m-save').click();
    }
    await expect(page.locator('#config-worlds-body').filter({ hasText: delWorldName })).toBeHidden({ timeout: 5000 });
    worldId = null;
  });

});

// ── AL-C2-006: Wiki-Export pro Welt ──────────────────────────────────────────

test.describe('AL-C2-006 — Wiki-Export pro Welt', () => {

  test('GET /api/export/worlds/1/wiki returns 200 with application/zip', async ({ request: apiCtx }) => {
    const res = await apiCtx.get('/api/export/worlds/1/wiki', { headers: ADMIN_HEADERS });
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toContain('zip');
  });

  test('wiki export is not accessible without authentication', async ({ request: apiCtx }) => {
    const res = await apiCtx.get('/api/export/worlds/1/wiki');
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });

});
