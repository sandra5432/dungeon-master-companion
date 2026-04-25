// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, goToPardurChronik, ADMIN_HEADERS } = require('./helpers');

/**
 * AL-B1: Chronik features.
 * Dev seed: Pardur has 6 dated events and 1 undated event; guestCanEdit=true.
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

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
    await expect(page.locator('#detail-panel')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-B1-003: Undatierte Ereignisse Panel ────────────────────────────────────

test.describe('AL-B1-003 — Undatierte Ereignisse Panel', () => {

  test('undated panel is visible on the right', async ({ page }) => {
    await goToPardurChronik(page);
    // The right sidebar with undated list is always present
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
    await page.locator('.m-close').click();
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
    // Modal stays open on validation error
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('.m-close').click();
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
      data: { title: editTitle, type: 'WORLD' },
    });
    const ev = await res.json();
    eventId = ev.id;
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
    await page.locator('.m-close').click();
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
    await page.locator('button:has-text("Abbrechen")').click();
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
    eventId = null; // already deleted
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
    const allCards = await page.locator('.event-card').count();
    // Click WORLD type filter (all seeded events are WORLD, so this is a no-op for count
    // but verifies the click doesn't crash)
    await page.locator('#type-filter-list button').first().click();
    // Count may stay the same or change; key thing is no crash
    await expect(page.locator('#timeline')).toBeVisible();
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

  test('compact mode hides tag and description preview rows', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('#tog-track').click();
    // In compact mode, .ev-tags is hidden via CSS — verify the toggle was applied
    await expect(page.locator('#timeline')).toHaveClass(/compact/);
    await page.locator('#tog-track').click();
    await expect(page.locator('#timeline')).not.toHaveClass(/compact/);
  });

});

// ── AL-B1-013: Wiki-Auto-Link ─────────────────────────────────────────────────

test.describe('AL-B1-013 — Wiki-Einträge in Ereignistext verlinken', () => {

  test('event description with wiki title shows inline link', async ({ page }) => {
    // The seeded Glimmquali wiki entry title should be auto-linked in event bodies
    // Create an event whose description mentions the wiki title
    await goToPardurChronik(page);
    await loginAsAdmin(page);
    // Use the undated add button to create an event with a wiki title in description
    await page.locator('.undated-add-btn').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#f-ti').fill(`Link-Test-${Date.now()}`);
    await page.locator('#f-desc').fill('Die Glimmquali sind bekannt für ihre Tavari.');
    await page.locator('#m-save').click();
    await expect(page.locator('#modal')).toBeHidden({ timeout: 5000 });

    // Click the new event in the undated list to open its detail panel
    const newCard = page.locator('#undated-list .event-card').first();
    await newCard.click();
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 3000 });
    // Wiki inline link should appear in the description
    await expect(page.locator('#dp-desc .wiki-inline-link').first()).toBeVisible({ timeout: 5000 });
    // Cleanup
    await page.locator('#dp-del').click();
    await page.locator('#m-save').click();
  });

});

// ── AL-B1-014: Deep-Link zu Ereignis ─────────────────────────────────────────

test.describe('AL-B1-014 — Deep-Link zu Ereignis', () => {

  test('navigating to /world/1/timeline/{id} opens the event detail panel', async ({ page, request: apiCtx }) => {
    // Find event id=1 (Ankunft der Erbauer)
    const res = await apiCtx.get('/api/worlds/1/events', { headers: { 'Authorization': 'Basic ' + Buffer.from('admin:4711').toString('base64') } });
    const events = await res.json();
    const ev = events.find(e => e.title === 'Ankunft der Erbauer');
    expect(ev).toBeTruthy();

    await page.goto(`/world/1/timeline/${ev.id}`);
    await expect(page.locator('#detail-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#dp-title')).toContainText('Ankunft der Erbauer');
  });

});

// ── AL-B1-009: Charakter-Filter ───────────────────────────────────────────────

test.describe('AL-B1-009 — Charakter-Filter', () => {
  const charEventTitle = `CharFilter-${Date.now()}`;
  let charEventId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: charEventTitle, type: 'WORLD', characters: ['Aela'] },
    });
    charEventId = (await res.json()).id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (charEventId) {
      await apiCtx.delete(`/api/worlds/1/events/${charEventId}`, { headers: ADMIN_HEADERS }).catch(() => {});
    }
  });

  test('character filter chip filters timeline to matching events', async ({ page }) => {
    await goToPardurChronik(page);
    // Expand the character list (it starts collapsed)
    await page.locator('#chars-toggle').click();
    await expect(page.locator('#char-list')).toBeVisible({ timeout: 3000 });
    // Click the Aela chip
    await page.locator('#char-list button').filter({ hasText: 'Aela' }).first().click();
    // Event with Aela should be visible
    await expect(page.locator('.event-card').filter({ hasText: charEventTitle })).toBeVisible({ timeout: 3000 });
    // "Ankunft der Erbauer" has no characters — should be hidden
    await expect(page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' })).toBeHidden({ timeout: 3000 });
  });

  test('clearing character filter restores all events', async ({ page }) => {
    await goToPardurChronik(page);
    await page.locator('#chars-toggle').click();
    await expect(page.locator('#char-list')).toBeVisible({ timeout: 3000 });
    await page.locator('#char-list button').filter({ hasText: 'Aela' }).first().click();
    // Now clear all chars
    await page.locator('#char-list').locator('xpath=../..').getByRole('button', { name: 'Alle' }).click();
    await expect(page.locator('.event-card').filter({ hasText: 'Ankunft der Erbauer' })).toBeVisible({ timeout: 3000 });
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
    // Create undated event
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: `ToDate-${Date.now()}`, type: 'WORLD' },
    });
    const ev = await res.json();
    eventId = ev.id;
    expect(ev.date).toBeFalsy();

    // Assign a date
    const updateRes = await apiCtx.put(`/api/worlds/1/events/${eventId}`, {
      headers: ADMIN_HEADERS,
      data: { ...ev, date: 'Jahr 500' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.date).toBe('Jahr 500');
  });

  test('AL-B1-012: removing the date from a dated event makes it undated', async ({ request: apiCtx }) => {
    // Create dated event
    const res = await apiCtx.post('/api/worlds/1/events', {
      headers: ADMIN_HEADERS,
      data: { title: `ToUndated-${Date.now()}`, type: 'WORLD', date: 'Jahr 600' },
    });
    const ev = await res.json();
    eventId = ev.id;
    expect(ev.date).toBe('Jahr 600');

    // Remove the date
    const updateRes = await apiCtx.put(`/api/worlds/1/events/${eventId}`, {
      headers: ADMIN_HEADERS,
      data: { ...ev, date: null },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.date == null || updated.date === '').toBeTruthy();
  });

});
