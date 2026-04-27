// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, loginAsUser, setWorldPermissions, ADMIN_HEADERS } = require('./helpers');

/**
 * AL-B (Allgemein): World navigation and permission flag tests.
 * Dev seed: Pardur (world_id=1) guest read+edit+delete, Eldorheim (world_id=2) no guest access.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

// ── AL-B-001 / AL-B-002: Welten-Seitenleiste & Welt auswählen ────────────────

test.describe('AL-B-001/002 — Worlds navigation', () => {

  test('world buttons are visible in the nav bar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
  });

  test('clicking a world button makes its section tabs visible', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await expect(page.locator('#section-tabs')).toBeVisible({ timeout: 5000 });
  });

  test('Eldorheim is not visible to guests (guestCanRead=false)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Eldorheim/i })).toBeHidden({ timeout: 5000 });
  });

  test('Eldorheim is visible to logged-in users', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await expect(page.getByRole('button', { name: /Eldorheim/i })).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B-003: Welt-Bereichs-Tabs wechseln ────────────────────────────────────

test.describe('AL-B-003 — Section tab navigation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await expect(page.locator('#section-tabs')).toBeVisible({ timeout: 5000 });
  });

  test('Chronik tab shows timeline page', async ({ page }) => {
    await page.locator('#tab-timeline').click();
    await expect(page.locator('#page-timeline')).toBeVisible();
  });

  test('Wiki tab shows wiki page', async ({ page }) => {
    await page.locator('#tab-wiki').click();
    await expect(page.locator('#page-wiki')).toBeVisible();
  });

  test('Karte tab shows map page', async ({ page }) => {
    await page.locator('#tab-map').click();
    await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });
  });

  test('active tab class is set on the selected tab', async ({ page }) => {
    await page.locator('#tab-wiki').click();
    await expect(page.locator('#tab-wiki')).toHaveClass(/active/);
    await expect(page.locator('#tab-timeline')).not.toHaveClass(/active/);
  });

});

// ── AL-B-004: Gastzugriff Lesen (konfigurierbar) ─────────────────────────────

test.describe('AL-B-004 — Guest read access (configurable)', () => {

  test('guest can see Pardur content when guestCanRead=true', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-timeline').click();
    await expect(page.locator('#timeline')).toBeVisible({ timeout: 5000 });
  });

  test('guest cannot see a world when guestCanRead=false', async ({ page, request: apiCtx }) => {
    // Temporarily disable guest read on Pardur, test, then restore
    await setWorldPermissions(apiCtx, 1, {
      guestCanRead: false, guestCanEdit: false, guestCanDelete: false,
      userCanRead: true, userCanEdit: true, userCanDelete: true,
    });
    try {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Pardur/i })).toBeHidden({ timeout: 5000 });
    } finally {
      await setWorldPermissions(apiCtx, 1, {
        guestCanRead: true, guestCanEdit: true, guestCanDelete: true,
        userCanRead: true, userCanEdit: true, userCanDelete: true,
      });
    }
  });

});

// ── AL-B-005: Gastzugriff Schreiben (konfigurierbar) ─────────────────────────

test.describe('AL-B-005 — Guest write access (configurable)', () => {

  test('guest sees "Seil anklicken" hint when guestCanEdit=true (Pardur)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-timeline').click();
    await expect(page.locator('#tl-hint')).toBeVisible({ timeout: 5000 });
  });

  test('guest does NOT see write hint when guestCanEdit=false', async ({ page, request: apiCtx }) => {
    await setWorldPermissions(apiCtx, 1, {
      guestCanRead: true, guestCanEdit: false, guestCanDelete: false,
      userCanRead: true, userCanEdit: true, userCanDelete: true,
    });
    try {
      await page.goto('/');
      await page.getByRole('button', { name: /Pardur/i }).first().click();
      await page.locator('#tab-timeline').click();
      await expect(page.locator('#tl-hint')).toBeHidden({ timeout: 5000 });
    } finally {
      await setWorldPermissions(apiCtx, 1, {
        guestCanRead: true, guestCanEdit: true, guestCanDelete: true,
        userCanRead: true, userCanEdit: true, userCanDelete: true,
      });
    }
  });

});

// ── AL-B-007/008/009: Nutzerzugriff (konfigurierbar) ─────────────────────────

test.describe('AL-B-007/008/009 — User write/edit/delete access (configurable)', () => {

  test('logged-in user can write when userCanEdit=true (default)', async ({ page }) => {
    await page.goto('/');
    await loginAsUser(page);
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-timeline').click();
    // Write hint visible for user when userCanEdit=true
    await expect(page.locator('#tl-hint')).toBeVisible({ timeout: 5000 });
  });

  test('logged-in user loses write access when userCanEdit=false', async ({ page, request: apiCtx }) => {
    await setWorldPermissions(apiCtx, 1, {
      guestCanRead: true, guestCanEdit: true, guestCanDelete: true,
      userCanRead: true, userCanEdit: false, userCanDelete: false,
    });
    try {
      await page.goto('/');
      await loginAsUser(page);
      await page.getByRole('button', { name: /Pardur/i }).first().click();
      await page.locator('#tab-timeline').click();
      await expect(page.locator('#tl-hint')).toBeHidden({ timeout: 5000 });
    } finally {
      await setWorldPermissions(apiCtx, 1, {
        guestCanRead: true, guestCanEdit: true, guestCanDelete: true,
        userCanRead: true, userCanEdit: true, userCanDelete: true,
      });
    }
  });

});

// ── AL-B-006: Gastzugriff Löschen (konfigurierbar) ───────────────────────────

test.describe('AL-B-006 — Guest delete access (configurable)', () => {
  let eventId;

  test.afterEach(async ({ request: apiCtx }) => {
    if (eventId) {
      await apiCtx.delete(`/api/worlds/1/events/${eventId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      eventId = null;
    }
  });

  test('guest can delete own event when guestCanDelete=true', async ({ page, request: apiCtx }) => {
    const title = `GuestDel-${Date.now()}`;
    const res = await apiCtx.post('/api/worlds/1/events', {
      data: { title, type: 'WORLD', dateLabel: 'Jahr 999' },
    });
    expect(res.ok()).toBeTruthy();
    const ev = await res.json();
    eventId = ev.id;
    await apiCtx.patch(`/api/worlds/1/events/${eventId}/assign-position`, {
      data: { afterEventId: null },
    });

    await page.goto('/');
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-timeline').click();
    await page.locator('.event-card').filter({ hasText: title }).click();
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#dp-del')).toBeVisible({ timeout: 2000 });
    await page.locator('#dp-del').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#m-save').click();
    await expect(page.locator('.event-card').filter({ hasText: title })).toBeHidden({ timeout: 5000 });
    eventId = null;
  });

  test('guest delete button is hidden when guestCanDelete=false', async ({ page, request: apiCtx }) => {
    const title = `GuestDelHide-${Date.now()}`;
    const res = await apiCtx.post('/api/worlds/1/events', {
      data: { title, type: 'WORLD', dateLabel: 'Jahr 999' },
    });
    const ev = await res.json();
    eventId = ev.id;
    await apiCtx.patch(`/api/worlds/1/events/${eventId}/assign-position`, {
      data: { afterEventId: null },
    });

    await setWorldPermissions(apiCtx, 1, {
      guestCanRead: true, guestCanEdit: true, guestCanDelete: false,
      userCanRead: true, userCanEdit: true, userCanDelete: true,
    });
    try {
      await page.goto('/');
      await page.getByRole('button', { name: /Pardur/i }).first().click();
      await page.locator('#tab-timeline').click();
      await page.locator('.event-card').filter({ hasText: title }).click();
      await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('#dp-del')).toBeHidden({ timeout: 2000 });
    } finally {
      await setWorldPermissions(apiCtx, 1, {
        guestCanRead: true, guestCanEdit: true, guestCanDelete: true,
        userCanRead: true, userCanEdit: true, userCanDelete: true,
      });
    }
  });

});
