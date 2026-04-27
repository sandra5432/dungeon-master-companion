// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, goToPardurMap, ADMIN_HEADERS } = require('./helpers');

/**
 * AL-B3: Karte features.
 * Dev seed: Pardur map has no background; 5 POI types seeded; guestCanEdit=true.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

// ── AL-B3-001: Karte anzeigen ────────────────────────────────────────────────

test.describe('AL-B3-001 — Karte anzeigen', () => {

  test('guest sees the map viewport', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });
  });

  test('map canvas wrap is present', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('#map-canvas-wrap')).toBeVisible();
  });

});

// ── AL-B3-002: Karte zoomen ───────────────────────────────────────────────────

test.describe('AL-B3-002 — Karte zoomen', () => {

  test('zoom slider is visible', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('#map-zoom-slider')).toBeVisible();
  });

  test('changing zoom slider updates zoom value label', async ({ page }) => {
    await goToPardurMap(page);
    await page.locator('#map-zoom-slider').fill('200');
    await expect(page.locator('#map-zoom-val')).toContainText('200%');
  });

});

// ── AL-B3-003: POI platzieren ─────────────────────────────────────────────────

test.describe('AL-B3-003 — POI auf Karte platzieren', () => {
  let poiId;

  test.afterEach(async ({ request: apiCtx }) => {
    if (poiId) {
      await apiCtx.delete(`/api/worlds/1/map/pois/${poiId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      poiId = null;
    }
  });

  test('POI type buttons are visible in the sidebar', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('#map-poi-type-list .poi-type-btn').first()).toBeVisible({ timeout: 5000 });
  });

  test('guest can place a POI by selecting type and clicking map', async ({ page, request: apiCtx }) => {
    await goToPardurMap(page);
    await page.locator('#map-poi-type-list .poi-type-btn').first().click();

    const wrap = page.locator('#map-canvas-wrap');
    const box  = await wrap.boundingBox();
    await wrap.click({ position: { x: box.width / 3, y: box.height / 3 } });

    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });

    // Save without label
    await page.locator('#poi-modal button:has-text("Speichern")').click();
    await expect(page.locator('#poi-modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('.map-poi').first()).toBeVisible({ timeout: 5000 });

    // Store id for cleanup
    const res = await apiCtx.get('/api/worlds/1/map/pois', { headers: ADMIN_HEADERS });
    const pois = await res.json();
    poiId = pois[pois.length - 1]?.id;
  });

  test('POI modal shows label input and cancel works', async ({ page }) => {
    await goToPardurMap(page);
    await page.locator('#map-poi-type-list .poi-type-btn').first().click();

    const wrap = page.locator('#map-canvas-wrap');
    const box  = await wrap.boundingBox();
    await wrap.click({ position: { x: box.width / 2, y: box.height / 4 } });

    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#poi-label-inp')).toBeVisible();
    await page.locator('#poi-modal button:has-text("Abbrechen")').click();
    await expect(page.locator('#poi-modal')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-B3-004: POI bearbeiten ─────────────────────────────────────────────────

test.describe('AL-B3-004 — POI-Label bearbeiten', () => {
  let poiId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/map/pois', {
      headers: ADMIN_HEADERS,
      data: { poiTypeId: 1, xPct: 40.0, yPct: 40.0, label: 'TestOrt' },
    });
    poiId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    await apiCtx.delete(`/api/worlds/1/map/pois/${poiId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can open POI edit modal and change label', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurMap(page);
    await page.locator('#map-tool-edit').click();
    await page.locator(`.map-poi[data-poi-id="${poiId}"]`).click();
    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#poi-label-inp')).toHaveValue('TestOrt');
    await page.locator('#poi-label-inp').fill('NeuOrt');
    await page.locator('#poi-modal button:has-text("Speichern")').click();
    await expect(page.locator('#poi-modal')).toBeHidden({ timeout: 5000 });
  });

});

// ── AL-B3-006: POI löschen ───────────────────────────────────────────────────

test.describe('AL-B3-006 — POI löschen', () => {
  let poiId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/map/pois', {
      headers: ADMIN_HEADERS,
      data: { poiTypeId: 2, xPct: 60.0, yPct: 60.0 },
    });
    poiId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    await apiCtx.delete(`/api/worlds/1/map/pois/${poiId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can delete a POI', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurMap(page);
    await page.locator('#map-tool-edit').click();
    await page.locator(`.map-poi[data-poi-id="${poiId}"]`).click();
    await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#poi-delete-btn').click();
    await expect(page.locator('#poi-modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator(`.map-poi[data-poi-id="${poiId}"]`)).toBeHidden({ timeout: 5000 });
    poiId = null;
  });

});

// ── AL-B3-007: POI mit Wiki verknüpfen ───────────────────────────────────────

test.describe('AL-B3-007 — POI-Label mit Wiki verknüpfen', () => {
  let poiId;

  test.beforeEach(async ({ request: apiCtx }) => {
    // "Glimmquali" matches a seeded wiki entry — placing a POI with that label should link it
    const res = await apiCtx.post('/api/worlds/1/map/pois', {
      headers: ADMIN_HEADERS,
      data: { poiTypeId: 1, xPct: 70.0, yPct: 70.0, label: 'Glimmquali' },
    });
    poiId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    await apiCtx.delete(`/api/worlds/1/map/pois/${poiId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('POI with matching wiki title label shows wiki-linked style', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator(`.map-poi[data-poi-id="${poiId}"] .map-poi-label.wiki-linked, .map-poi[data-poi-id="${poiId}"] .wiki-linked`)).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B3-008: Distanz-Lineal ────────────────────────────────────────────────

test.describe('AL-B3-008 — Distanz-Lineal', () => {

  test('ruler tool button is visible', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('#map-tool-ruler')).toBeVisible({ timeout: 5000 });
  });

  test('clicking ruler tool activates it', async ({ page }) => {
    await goToPardurMap(page);
    await page.locator('#map-tool-ruler').click();
    await expect(page.locator('#map-tool-ruler')).toHaveClass(/active/);
  });

});

// ── AL-B3-010: Kartenhintergrund skalieren ────────────────────────────────────

test.describe('AL-B3-010 — Kartenhintergrund skalieren', () => {

  test('scale slider is visible for admin', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurMap(page);
    await expect(page.locator('.map-admin-area')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#map-bg-scale')).toBeVisible();
  });

  test('scale control is hidden for guests', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('.map-admin-area')).toBeHidden();
  });

});

// ── AL-B3-011: POI-Typen verwalten ───────────────────────────────────────────

test.describe('AL-B3-011 — POI-Typen verwalten', () => {

  test('"+ POI-Typ" button is visible for admin', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurMap(page);
    await expect(page.locator('button:has-text("＋ POI-Typ")')).toBeVisible({ timeout: 5000 });
  });

  test('"+ POI-Typ" button is hidden for guests', async ({ page }) => {
    await goToPardurMap(page);
    await expect(page.locator('button:has-text("＋ POI-Typ")')).toBeHidden();
  });

  test('clicking "+ POI-Typ" opens the POI type manager modal', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurMap(page);
    await page.locator('button:has-text("＋ POI-Typ")').click();
    await expect(page.locator('#poi-type-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#poi-type-modal .modal-close, #poi-type-modal button:has-text("Abbrechen")').first().click();
  });

});

// ── AL-B3-005: POI per Drag & Drop verschieben (API) ─────────────────────────

test.describe('AL-B3-005 — POI verschieben (API)', () => {
  let poiId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/map/pois', {
      headers: ADMIN_HEADERS,
      data: { poiTypeId: 1, xPct: 20.0, yPct: 20.0, label: 'MoveTest' },
    });
    poiId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (poiId) {
      await apiCtx.delete(`/api/worlds/1/map/pois/${poiId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      poiId = null;
    }
  });

  test('PUT with new coordinates updates POI position', async ({ request: apiCtx }) => {
    const res = await apiCtx.put(`/api/worlds/1/map/pois/${poiId}`, {
      headers: ADMIN_HEADERS,
      data: { xPct: 75.0, yPct: 80.0 },
    });
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.xPct).toBeCloseTo(75.0, 1);
    expect(updated.yPct).toBeCloseTo(80.0, 1);
  });

  test('guest cannot move a POI when not the creator', async ({ playwright }) => {
    // The shared apiCtx carries an admin session cookie from beforeEach — use a fresh context instead
    const freshCtx = await playwright.request.newContext({ baseURL: 'http://localhost:8080' });
    const res = await freshCtx.put(`/api/worlds/1/map/pois/${poiId}`, {
      data: { xPct: 50.0, yPct: 50.0 },
    });
    await freshCtx.dispose();
    // POI was created by admin; guest (no auth) has no ownership → 403
    expect([403, 401]).toContain(res.status());
  });

});

// ── AL-B3-009: Kartenhintergrund hochladen ────────────────────────────────────

test.describe('AL-B3-009 — Kartenhintergrund hochladen', () => {
  // Minimal 1×1 white pixel WebP (VP8L lossless)
  const MINIMAL_WEBP = Buffer.from(
    'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JYgCdAEO/gHOAADN3wAA7+aAAA==',
    'base64'
  );

  test('admin can upload a WebP map background', async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/map/background', {
      headers: { Authorization: ADMIN_HEADERS.Authorization },
      multipart: {
        file: { name: 'map.webp', mimeType: 'image/webp', buffer: MINIMAL_WEBP },
      },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('unauthenticated request to upload background returns 401 or 403', async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/map/background', {
      multipart: {
        file: { name: 'map.webp', mimeType: 'image/webp', buffer: MINIMAL_WEBP },
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('admin can see the Hintergrund button in the map admin area', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurMap(page);
    await expect(page.locator('button:has-text("🖼 Hintergrund"), button:has-text("Hintergrund")')).toBeVisible({ timeout: 5000 });
  });

});
