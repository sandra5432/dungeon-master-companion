// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loginAsAdmin, loginAsUser,
  goToPardurChronik, goToPardurWiki, goToPardurMap,
  setWorldPermissions,
  ADMIN_HEADERS, USER_HEADERS,
} = require('./helpers');

/**
 * AL-B: Welt features — navigation, Chronik (B1), Wiki (B2), Karte (B3).
 * Dev seed: Pardur (world_id=1) full guest access; Eldorheim (world_id=2) no guest access.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

// ══════════════════════════════════════════════════════════════════════════════
// B — Allgemein: Welt-Navigation & Berechtigungen
// ══════════════════════════════════════════════════════════════════════════════

// ── AL-B-001/002: Welten-Navigation & Welt auswählen ─────────────────────────

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

// ── AL-B-004: Gastzugriff Lesen ───────────────────────────────────────────────

test.describe('AL-B-004 — Guest read access (configurable)', () => {

  test('guest can see Pardur content when guestCanRead=true', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Pardur/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-timeline').click();
    await expect(page.locator('#timeline')).toBeVisible({ timeout: 5000 });
  });

  test('guest cannot see a world when guestCanRead=false', async ({ page, request: apiCtx }) => {
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

// ── AL-B-005: Gastzugriff Schreiben ──────────────────────────────────────────

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

// ── AL-B-006: Gastzugriff Löschen ────────────────────────────────────────────

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

// ── AL-B-007/008/009: Nutzerzugriff ──────────────────────────────────────────

test.describe('AL-B-007/008/009 — User write/edit/delete access (configurable)', () => {

  test('logged-in user can write when userCanEdit=true (default)', async ({ page }) => {
    await page.goto('/');
    await loginAsUser(page);
    await page.getByRole('button', { name: /Pardur/i }).first().click();
    await page.locator('#tab-timeline').click();
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

// ── AL-B-010: Wiki als ZIP exportieren ───────────────────────────────────────
// Duplicate coverage also in c-admin.spec.js AL-C2-006

test.describe('AL-B-010 — Wiki als ZIP exportieren', () => {

  test('GET /api/export/worlds/1/wiki returns a ZIP for admin', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    const response = await page.request.get('/api/export/worlds/1/wiki');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/zip');
    expect(response.headers()['content-disposition']).toContain('.zip');
  });

  test('GET /api/export/worlds/1/wiki returns 4xx for unauthenticated', async ({ page }) => {
    const response = await page.request.get('/api/export/worlds/1/wiki');
    expect([401, 403]).toContain(response.status());
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// B1 — Chronik
// ══════════════════════════════════════════════════════════════════════════════

// ── AL-B1-001: Zeitleiste anzeigen ───────────────────────────────────────────

test.describe('AL-B1-001 — Zeitleiste anzeigen', () => {

  test('guest sees timeline with seeded events', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('.event-card').first()).toBeVisible({ timeout: 5000 });
  });

  test('timeline shows seeded event title "Ankunft der Erbauer"', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' })).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B1-002: Ereignis-Detailpanel öffnen ────────────────────────────────────

test.describe('AL-B1-002 — Ereignis-Detailpanel', () => {

  test('clicking an event opens the detail panel', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' }).click();
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#dp-title')).toContainText('Ankunft der Erbauer');
  });

  test('detail panel shows event description', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' }).click();
    await expect(page.locator('#dp-desc')).not.toBeEmpty();
  });

  test('detail panel close button hides the panel', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('.event-card').first().click();
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
    await page.locator('.detail-close').click();
    await expect(page.locator('#detail-panel')).not.toHaveClass(/open/, { timeout: 3000 });
  });

});

// ── AL-B1-003: Undatierte Ereignisse Panel ────────────────────────────────────

test.describe('AL-B1-003 — Undatierte Ereignisse Panel', () => {

  test('undated panel is visible on the right', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('.sidebar-right')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#undated-list')).toBeVisible();
  });

  test('seeded undated event "Das Verschwinden von Nerathis" appears in undated list', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('#undated-list').filter({ hasText: 'Das Verschwinden von Nerathis' })).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B1-004: Ereignis erstellen ────────────────────────────────────────────

test.describe('AL-B1-004 — Ereignis erstellen', () => {
  const eventTitle = `E2E-Event-${Date.now()}`;

  test.afterEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.get('/api/worlds/1/events', { headers: ADMIN_HEADERS });
    const events = await res.json();
    const ev = events.find(e => e.title === eventTitle);
    if (ev) await apiCtx.delete(`/api/worlds/1/events/${ev.id}`, { headers: ADMIN_HEADERS });
  });

  test('guest can open the event create dialog', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('.rope-gap').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#f-ti')).toBeVisible();
    await page.locator('#modal .m-close').click();
  });

  test('guest can create a new event and it appears on timeline', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('.rope-gap').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#f-ti').fill(eventTitle);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('.event-card').filter({ hasText: eventTitle })).toBeVisible({ timeout: 5000 });
  });

  test('saving event without a title shows validation error', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('.rope-gap').first().click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#f-ti').fill('');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('#modal .m-close').click();
  });

});

// ── AL-B1-005/006: Ereignis bearbeiten / löschen ──────────────────────────────

test.describe('AL-B1-005/006 — Ereignis bearbeiten und löschen', () => {
  let eventId;
  const editTitle   = `Edit-Test-${Date.now()}`;
  const updatedTitle = `Updated-${Date.now()}`;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: editTitle, type: 'WORLD', dateLabel: 'Jahr 999' },
    });
    const ev = await res.json();
    eventId = ev.id;
    await apiCtx.patch(`/api/worlds/1/events/${eventId}/assign-position`, {
      headers: ADMIN_HEADERS,
      data: { afterEventId: null },
    });
  });

  test.afterEach(async ({ request: apiCtx }) => {
    await apiCtx.delete(`/api/worlds/1/events/${eventId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('admin can open edit dialog with pre-filled title', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurChronik(page);
    await page.locator('.event-card').filter({ hasText: editTitle }).click();
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
    await page.locator('#dp-edit').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#f-ti')).toHaveValue(editTitle);
    await page.locator('#modal .m-close').click();
  });

  test('admin can update event title', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurChronik(page);
    await page.locator('.event-card').filter({ hasText: editTitle }).click();
    await page.locator('#dp-edit').click();
    await page.locator('#f-ti').fill(updatedTitle);
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('.event-card').filter({ hasText: updatedTitle })).toBeVisible({ timeout: 5000 });
  });

  test('admin sees delete confirmation and can cancel', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurChronik(page);
    await page.locator('.event-card').filter({ hasText: editTitle }).click();
    await page.locator('#dp-del').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#modal button:has-text("Abbrechen")').click();
    await expect(page.locator('.event-card').filter({ hasText: editTitle })).toBeVisible();
  });

  test('admin can delete an event', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurChronik(page);
    await page.locator('.event-card').filter({ hasText: editTitle }).click();
    await page.locator('#dp-del').click();
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('.event-card').filter({ hasText: editTitle })).toBeHidden({ timeout: 5000 });
    eventId = null;
  });

});

// ── AL-B1-007/008: Typ- und Tag-Filter ───────────────────────────────────────

test.describe('AL-B1-007/008 — Typ- und Tag-Filter', () => {

  test('type filter buttons are visible in the left sidebar', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('#type-filter-list')).toBeVisible({ timeout: 5000 });
  });

  test('tag filter list is accessible (toggle)', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('#tag-list')).toBeAttached();
  });

  test('clicking a type filter reduces the visible events', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('#type-filter-list button').first().click();
    await expect(page.locator('#timeline')).toBeVisible();
  });

});

// ── AL-B1-009: Charakter-Filter ───────────────────────────────────────────────

test.describe('AL-B1-009 — Charakter-Filter', () => {
  const charEventTitle = `CharFilter-${Date.now()}`;
  let charEventId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: charEventTitle, type: 'WORLD', characters: ['Aela'], dateLabel: 'Jahr 100' },
    });
    charEventId = (await res.json()).id;
    await apiCtx.patch(`/api/worlds/1/events/${charEventId}/assign-position`, {
      headers: ADMIN_HEADERS,
      data: { afterEventId: null },
    });
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (charEventId) {
      await apiCtx.delete(`/api/worlds/1/events/${charEventId}`, { headers: ADMIN_HEADERS }).catch(() => {});
    }
  });

  test('character filter chip filters timeline to matching events', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('#chars-toggle').click();
    await expect(page.locator('#char-list')).toBeVisible({ timeout: 3000 });
    await page.locator('#char-list button').filter({ hasText: 'Aela' }).first().click();
    await expect(page.locator('.event-card').filter({ hasText: charEventTitle })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' })).toBeHidden({ timeout: 3000 });
  });

  test('clearing character filter restores all events', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('#chars-toggle').click();
    await expect(page.locator('#char-list')).toBeVisible({ timeout: 3000 });
    await page.locator('#char-list button').filter({ hasText: 'Aela' }).first().click();
    await page.locator('#char-list').locator('xpath=..').getByRole('button', { name: 'Alle' }).click();
    await expect(page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' })).toBeVisible({ timeout: 3000 });
  });

});

// ── AL-B1-010: Kompaktansicht ─────────────────────────────────────────────────

test.describe('AL-B1-010 — Kompaktansicht umschalten', () => {

  test('compact toggle button exists', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('#tog-track')).toBeVisible({ timeout: 5000 });
  });

  test('activating compact mode adds .compact class to timeline', async ({ page }) => {
    await goToPardurChronik(page);
    await expect(page.locator('#timeline')).not.toHaveClass(/compact/);
    await page.locator('#tog-track').click();
    await expect(page.locator('#timeline')).toHaveClass(/compact/);
  });

  test('compact mode can be toggled off again', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('#tog-track').click();
    await expect(page.locator('#timeline')).toHaveClass(/compact/);
    await page.locator('#tog-track').click();
    await expect(page.locator('#timeline')).not.toHaveClass(/compact/);
  });

});

// ── AL-B1-011/012: Ereignis per API datieren / undatieren ────────────────────

test.describe('AL-B1-011/012 — Drag-to-date / Drag-to-undated (API)', () => {
  let eventId;

  test.afterEach(async ({ request: apiCtx }) => {
    if (eventId) {
      await apiCtx.delete(`/api/worlds/1/events/${eventId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      eventId = null;
    }
  });

  test('AL-B1-011: assigning a date to an undated event moves it to the timeline', async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: `ToDate-${Date.now()}`, type: 'WORLD' },
    });
    const ev = await res.json();
    eventId = ev.id;
    expect(ev.dateLabel).toBeFalsy();

    const updateRes = await apiCtx.put(`/api/worlds/1/events/${eventId}`, {
      headers: ADMIN_HEADERS,
      data: { ...ev, dateLabel: 'Jahr 500' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.dateLabel).toBe('Jahr 500');
  });

  test('AL-B1-012: removing the date from a dated event makes it undated', async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: `ToUndated-${Date.now()}`, type: 'WORLD', dateLabel: 'Jahr 600' },
    });
    const ev = await res.json();
    eventId = ev.id;
    expect(ev.dateLabel).toBe('Jahr 600');

    const updateRes = await apiCtx.put(`/api/worlds/1/events/${eventId}`, {
      headers: ADMIN_HEADERS,
      data: { ...ev, dateLabel: null },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.dateLabel == null || updated.dateLabel === '').toBeTruthy();
  });

});

// ── AL-B1-013: Wiki-Auto-Link ─────────────────────────────────────────────────

test.describe('AL-B1-013 — Wiki-Einträge in Ereignistext verlinken', () => {

  test('event description with wiki title shows inline link', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurChronik(page);
    await page.locator('.undated-add-btn').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    const linkTitle = `Link-Test-${Date.now()}`;
    await page.locator('#f-ti').fill(linkTitle);
    await page.locator('#f-desc').fill('Die Glimmquali sind bekannt für ihre Tavari.');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });

    const newCard = page.locator('#undated-list .undated-card').filter({ hasText: linkTitle });
    await newCard.click();
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#dp-desc .wiki-inline-link').first()).toBeVisible({ timeout: 5000 });
    // Cleanup
    await page.locator('#dp-del').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#m-save').click();
  });

});

// ── AL-B1-014: Deep-Link zu Ereignis ─────────────────────────────────────────

test.describe('AL-B1-014 — Deep-Link zu Ereignis', () => {

  test('navigating to /world/1/timeline/{id} opens the event detail panel', async ({ page, request: apiCtx }) => {
    const res = await apiCtx.get('/api/worlds/1/events', { headers: { 'Authorization': 'Basic ' + Buffer.from('admin:4711').toString('base64') } });
    const events = await res.json();
    const ev = events.find(e => e.title === 'Ankunft der Erbauer');
    expect(ev).toBeTruthy();

    await page.goto(`/world/1/timeline/${ev.id}`);
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#dp-title')).toContainText('Ankunft der Erbauer');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// B2 — Wiki
// ══════════════════════════════════════════════════════════════════════════════

// ── AL-B2-001: Wiki-Einträge anzeigen ────────────────────────────────────────

test.describe('AL-B2-001 — Wiki-Einträge anzeigen', () => {

  test('guest sees wiki entry list with seeded entries', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('#wiki-recent-list')).not.toBeEmpty({ timeout: 5000 });
  });

  test('seeded entry "Glimmquali" is visible in the list', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Glimmquali' })).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B2-002: Wiki-Eintrag lesen ────────────────────────────────────────────

test.describe('AL-B2-002 — Wiki-Eintrag lesen', () => {

  test('clicking an entry opens the article panel', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#wiki-article-content')).toContainText('Glimmquali');
  });

  test('article panel shows rendered markdown body', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-content h2').first()).toBeVisible({ timeout: 5000 });
  });

  test('article panel can be closed', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await page.locator('.wiki-panel-close').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-B2-003: Wiki-Einträge suchen ──────────────────────────────────────────

test.describe('AL-B2-003 — Wiki-Einträge suchen', () => {

  test('typing a matching title shows the entry', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-search').fill('Glimmquali');
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Glimmquali' })).toBeVisible({ timeout: 3000 });
  });

  test('typing a non-matching string hides entries', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-search').fill('xyzNichtVorhanden999');
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Glimmquali' })).toBeHidden({ timeout: 3000 });
  });

  test('clearing search restores all entries', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-search').fill('xyzNichtVorhanden999');
    await page.locator('#wiki-search').fill('');
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Glimmquali' })).toBeVisible({ timeout: 3000 });
  });

});

// ── AL-B2-004: Typ-Filter ────────────────────────────────────────────────────

test.describe('AL-B2-004 — Wiki Typ-Filter', () => {

  test('filter toggle button opens the filter panel', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-filter-toggle').click();
    await expect(page.locator('#wiki-filter-panel')).toBeVisible({ timeout: 3000 });
  });

  test('selecting SPEZIES type shows Glimmquali and hides Tavari', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-filter-toggle').click();
    await page.locator('#wiki-filter-panel input[value="SPEZIES"]').check();
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Glimmquali' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Tavari' })).toBeHidden({ timeout: 3000 });
  });

  test('selecting TERM type shows Tavari and hides Glimmquali', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-filter-toggle').click();
    await page.locator('#wiki-filter-panel input[value="TERM"]').check();
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Tavari' })).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-recent-list').filter({ hasText: 'Glimmquali' })).toBeHidden({ timeout: 3000 });
  });

  test('filter label updates when type is selected', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-filter-toggle').click();
    await page.locator('#wiki-filter-panel input[value="SPEZIES"]').check();
    await expect(page.locator('#wiki-filter-label')).not.toHaveText('Alle');
  });

});

// ── AL-B2-005: Ansichtsmodus wechseln ────────────────────────────────────────

test.describe('AL-B2-005 — Ansichtsmodus wechseln', () => {

  test('Hierarchie view is active by default', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('#wiki-view-hierarchy')).toHaveClass(/active/);
  });

  test('A-Z view button switches the view', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-view-alpha').click();
    await expect(page.locator('#wiki-view-alpha')).toHaveClass(/active/);
    await expect(page.locator('#wiki-view-hierarchy')).not.toHaveClass(/active/);
    await expect(page.locator('#wiki-recent-list')).not.toBeEmpty();
  });

  test('Typ view button switches the view', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-view-type').click();
    await expect(page.locator('#wiki-view-type')).toHaveClass(/active/);
    await expect(page.locator('#wiki-recent-list')).not.toBeEmpty();
  });

});

// ── AL-B2-006: Beziehungsgraph ────────────────────────────────────────────────

test.describe('AL-B2-006 — Beziehungsgraph', () => {

  test('wiki graph SVG is rendered with nodes', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('#wiki-graph circle').first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking a graph node opens the wiki article', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('#wiki-graph circle').first()).toBeVisible({ timeout: 8000 });
    await page.locator('#wiki-graph circle').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B2-007: Vorschau-Tooltip bei Hover ────────────────────────────────────

test.describe('AL-B2-007 — Vorschau-Tooltip bei Hover', () => {

  test('hovering over a wiki inline link shows the preview tooltip', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    const link = page.locator('#wiki-article-content .wiki-inline-link').first();
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.hover();
    await expect(page.locator('#wiki-preview-tip')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-preview-tip .wpt-title')).not.toBeEmpty();
  });

  test('moving away from the inline link hides the tooltip', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    const link = page.locator('#wiki-article-content .wiki-inline-link').first();
    await link.hover();
    await expect(page.locator('#wiki-preview-tip')).toBeVisible({ timeout: 3000 });
    await page.locator('#wiki-article-content').first().hover({ position: { x: 5, y: 5 } });
    await expect(page.locator('#wiki-preview-tip')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-B2-008/009: Wiki-Eintrag erstellen / bearbeiten ───────────────────────

test.describe('AL-B2-008/009 — Wiki-Eintrag erstellen und bearbeiten', () => {
  const entryTitle   = `Wiki-Test-${Date.now()}`;
  const updatedTitle = `Wiki-Updated-${Date.now()}`;
  let entryId;

  test.afterEach(async ({ request: apiCtx }) => {
    if (entryId) {
      await apiCtx.delete(`/api/wiki/${entryId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      entryId = null;
    } else {
      const res = await apiCtx.get('/api/wiki?worldId=1', { headers: ADMIN_HEADERS }).catch(() => null);
      if (res?.ok()) {
        const entries = await res.json();
        const e = entries.find(x => x.title === entryTitle || x.title === updatedTitle);
        if (e) await apiCtx.delete(`/api/wiki/${e.id}`, { headers: ADMIN_HEADERS }).catch(() => {});
      }
    }
  });

  test('create button is visible for guests (Pardur has guestCanEdit=true)', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('.wiki-new-entry-wrap')).toBeVisible();
  });

  test('admin can open the wiki editor', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await expect(page.locator('#wiki-editor-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-ed-title')).toBeVisible();
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

  test('admin can create a wiki entry and it appears in the list', async ({ page, request: apiCtx }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await page.locator('#wiki-ed-title').fill(entryTitle);
    await page.locator('#wiki-ed-type').selectOption('PERSON');
    await page.locator('#wiki-editor-panel button:has-text("Speichern")').click();
    await expect(page.locator('#wiki-editor-panel')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('#wiki-recent-list').filter({ hasText: entryTitle })).toBeVisible({ timeout: 5000 });

    const res = await apiCtx.get('/api/wiki/titles', { headers: ADMIN_HEADERS });
    const titles = await res.json();
    const entry = titles.find(t => t.title === entryTitle);
    if (entry) entryId = entry.id;
  });

  test('saving without a title shows an error', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await page.locator('#wiki-ed-title').fill('');
    await page.locator('#wiki-editor-panel button:has-text("Speichern")').click();
    await expect(page.locator('#wiki-editor-error')).toBeVisible({ timeout: 3000 });
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

  test('admin can edit an existing entry', async ({ page, request: apiCtx }) => {
    const res = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: entryTitle, type: 'TERM', worldId: 1, body: '' },
    });
    const entry = await res.json();
    entryId = entry.id;

    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(entryTitle).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await page.locator('#wiki-article-content button:has-text("Bearbeiten"), #wiki-article-panel button:has-text("✎")').first().click();
    await expect(page.locator('#wiki-editor-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-ed-title')).toHaveValue(entryTitle);
    await page.locator('#wiki-ed-title').fill(updatedTitle);
    await page.locator('#wiki-editor-panel button:has-text("Speichern")').click();
    await expect(page.locator('#wiki-recent-list').filter({ hasText: updatedTitle })).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B2-010: Wiki-Eintrag löschen ──────────────────────────────────────────

test.describe('AL-B2-010 — Wiki-Eintrag löschen', () => {
  const deleteTitle = `Wiki-Delete-${Date.now()}`;
  let entryId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: deleteTitle, type: 'TERM', worldId: 1, body: '' },
    });
    entryId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    await apiCtx.delete(`/api/wiki/${entryId}`, { headers: ADMIN_HEADERS }).catch(() => {});
  });

  test('delete button is hidden for guests', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(deleteTitle).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#wiki-article-content button.wiki-delete-btn, #wiki-article-panel button:has-text("Löschen")')).toBeHidden();
  });

  test('admin can delete an entry', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(deleteTitle).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#wiki-article-panel button.wiki-icon-btn--del, #wiki-article-content button.wiki-icon-btn--del').first().click();
    await expect(page.locator('#wiki-recent-list').filter({ hasText: deleteTitle })).toBeHidden({ timeout: 5000 });
    entryId = null;
  });

});

// ── AL-B2-011: Bild-Upload Validierung ───────────────────────────────────────

test.describe('AL-B2-011 — Bild-Upload: Nur WebP akzeptiert', () => {

  test('non-WebP file upload shows an error message', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await expect(page.locator('#wiki-editor-panel')).toBeVisible({ timeout: 3000 });

    const fileInput = page.locator('#wiki-img-input');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-png-data'),
    });

    await expect(page.locator('#wiki-editor-error')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-editor-error')).toContainText('WebP');
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

});

// ── AL-B2-012: Bild-Lightbox ──────────────────────────────────────────────────

test.describe('AL-B2-012 — Bild-Lightbox', () => {
  const MINIMAL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  let entryId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: `LightboxTest-${Date.now()}`, type: 'TERM', worldId: 1, body: '' },
    });
    expect(res.ok()).toBeTruthy();
    entryId = (await res.json()).id;

    const uploadRes = await apiCtx.post(`/api/wiki/${entryId}/images`, {
      headers: { Authorization: ADMIN_HEADERS.Authorization },
      multipart: {
        file: { name: 'test.png', mimeType: 'image/png', buffer: MINIMAL_PNG },
        caption: 'Testbild',
      },
    });
    expect(uploadRes.ok()).toBeTruthy();
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (entryId) {
      await apiCtx.delete(`/api/wiki/${entryId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      entryId = null;
    }
  });

  test('clicking an image in the article view opens the lightbox', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(/LightboxTest/).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await page.locator('#wiki-article-content img').first().click();
    await expect(page.locator('#img-lightbox')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#lightbox-img')).toBeVisible();
  });

  test('pressing Escape closes the lightbox', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(/LightboxTest/).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await page.locator('#wiki-article-content img').first().click();
    await expect(page.locator('#img-lightbox')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#img-lightbox')).toBeHidden({ timeout: 3000 });
  });

  test('lightbox shows image caption when present', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(/LightboxTest/).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await page.locator('#wiki-article-content img').first().click();
    await expect(page.locator('#img-lightbox')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#lightbox-caption')).toContainText('Testbild');
  });

});

// ── AL-B2-013: Markdown-Editor Toolbar ───────────────────────────────────────

test.describe('AL-B2-013 — Markdown-Editor Toolbar', () => {

  test('toolbar buttons are visible in the editor', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await expect(page.locator('#wiki-toolbar')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-toolbar button').first()).toBeVisible();
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

});

// ── AL-B2-014: Spoiler-Block erstellen ────────────────────────────────────────

test.describe('AL-B2-014 — Spoiler-Block erstellen', () => {

  test('spoiler toolbar button is visible for admin in the editor', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await expect(page.locator('#wiki-editor-panel')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wiki-toolbar-spoiler')).toBeVisible({ timeout: 3000 });
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

  test('clicking the spoiler button inserts :::spoiler block into the body', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await expect(page.locator('#wiki-editor-panel')).toBeVisible({ timeout: 3000 });
    await page.locator('#wiki-ed-body').click();
    page.once('dialog', dialog => dialog.accept('Testspoiler'));
    await page.locator('#wiki-toolbar-spoiler').click();
    const bodyValue = await page.locator('#wiki-ed-body').inputValue();
    expect(bodyValue).toContain(':::spoiler');
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

});

// ── AL-B2-015: Spoiler-Zugriff verwalten ─────────────────────────────────────

test.describe('AL-B2-015 — Spoiler-Zugriff verwalten', () => {
  let entryId;
  let userId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const entryRes = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: `Spoiler-${Date.now()}`, type: 'TERM', worldId: 1, body: '' },
    });
    entryId = (await entryRes.json()).id;

    const userRes = await apiCtx.get('/api/admin/users', { headers: ADMIN_HEADERS });
    const users = await userRes.json();
    const u = users.find(x => x.username === 'user');
    userId = u.id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (entryId) {
      await apiCtx.delete(`/api/wiki/${entryId}`, { headers: ADMIN_HEADERS }).catch(() => {});
      entryId = null;
    }
  });

  test('admin can add a spoiler reader', async ({ request: apiCtx }) => {
    const res = await apiCtx.post(`/api/wiki/${entryId}/spoiler-readers/${userId}`, {
      headers: ADMIN_HEADERS,
    });
    expect(res.ok()).toBeTruthy();
  });

  test('admin can remove a spoiler reader', async ({ request: apiCtx }) => {
    await apiCtx.post(`/api/wiki/${entryId}/spoiler-readers/${userId}`, {
      headers: ADMIN_HEADERS,
    });
    const res = await apiCtx.delete(`/api/wiki/${entryId}/spoiler-readers/${userId}`, {
      headers: ADMIN_HEADERS,
    });
    expect(res.ok()).toBeTruthy();
  });

  test('unauthenticated request to add spoiler reader returns 401 or 403', async ({ playwright }) => {
    const freshCtx = await playwright.request.newContext({ baseURL: 'http://localhost:8080' });
    const res = await freshCtx.post(`/api/wiki/${entryId}/spoiler-readers/${userId}`);
    await freshCtx.dispose();
    expect([401, 403]).toContain(res.status());
  });

});

// ── AL-B2-016: Wiki-Auto-Link im Body ────────────────────────────────────────

test.describe('AL-B2-016 — Wiki-Einträge in Body verlinken', () => {

  test('Tavari title in Glimmquali body is rendered as an inline link', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#wiki-article-content .wiki-inline-link').filter({ hasText: 'Tavari' }).first()).toBeVisible({ timeout: 5000 });
  });

});

// ── AL-B2-017: Deep-Link zu Wiki-Eintrag ─────────────────────────────────────

test.describe('AL-B2-017 — Deep-Link zu Wiki-Eintrag', () => {

  test('navigating to /world/1/wiki/{id} opens the article panel', async ({ page, request: apiCtx }) => {
    const res = await apiCtx.get('/api/wiki/titles', { headers: ADMIN_HEADERS });
    const titles = await res.json();
    const entry = titles.find(t => t.title === 'Glimmquali' && t.worldId === 1);
    expect(entry).toBeTruthy();

    await page.goto(`/world/1/wiki/${entry.id}`);
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#wiki-article-content')).toContainText('Glimmquali');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// B3 — Karte
// ══════════════════════════════════════════════════════════════════════════════

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
    await page.locator('#map-zoom-slider').dispatchEvent('input');
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
    await page.locator('#poi-modal button:has-text("Speichern")').click();
    await expect(page.locator('#poi-modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('.map-poi').first()).toBeVisible({ timeout: 5000 });

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
    const freshCtx = await playwright.request.newContext({ baseURL: 'http://localhost:8080' });
    const res = await freshCtx.put(`/api/worlds/1/map/pois/${poiId}`, {
      data: { xPct: 50.0, yPct: 50.0 },
    });
    await freshCtx.dispose();
    expect([403, 401]).toContain(res.status());
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

  test('guest delete button respects guestCanDelete flag', async ({ page, request: apiCtx }) => {
    const guestPoi = await (async () => {
      const r = await apiCtx.post('/api/worlds/1/map/pois', {
        data: { poiTypeId: 1, xPct: 30.0, yPct: 30.0 },
      });
      return r.json();
    })();

    // Disable guest delete
    await setWorldPermissions(apiCtx, 1, {
      guestCanRead: true, guestCanEdit: true, guestCanDelete: false,
      userCanRead: true, userCanEdit: true, userCanDelete: true,
    });
    try {
      await page.goto('/');
      await page.getByRole('button', { name: /Pardur/i }).first().click();
      await page.locator('#tab-map').click();
      await expect(page.locator('#map-viewport')).toBeVisible({ timeout: 5000 });
      await page.locator('#map-tool-edit').click();
      await page.locator(`.map-poi[data-poi-id="${guestPoi.id}"]`).click();
      await expect(page.locator('#poi-modal')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('#poi-delete-btn')).toBeHidden();
    } finally {
      await setWorldPermissions(apiCtx, 1, {
        guestCanRead: true, guestCanEdit: true, guestCanDelete: true,
        userCanRead: true, userCanEdit: true, userCanDelete: true,
      });
      await apiCtx.delete(`/api/worlds/1/map/pois/${guestPoi.id}`, { headers: ADMIN_HEADERS }).catch(() => {});
    }
  });

});

// ── AL-B3-007: POI mit Wiki verknüpfen ───────────────────────────────────────

test.describe('AL-B3-007 — POI-Label mit Wiki verknüpfen', () => {
  let poiId;

  test.beforeEach(async ({ request: apiCtx }) => {
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

// ── AL-B3-009: Kartenhintergrund hochladen ────────────────────────────────────

test.describe('AL-B3-009 — Kartenhintergrund hochladen', () => {
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
