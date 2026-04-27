// @ts-check
const { test, expect } = require('@playwright/test');
const { loginAsAdmin, goToPardurWiki, ADMIN_HEADERS, USER_HEADERS } = require('./helpers');

/**
 * AL-B2: Wiki features.
 * Dev seed: Pardur has "Glimmquali" (SPEZIES) and "Tavari" (TERM).
 * Requires the app running on http://localhost:8080 with the dev profile.
 */

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

// ── AL-B2-004: Typ-Filter (Checkboxen in Dropdown) ───────────────────────────

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
    // Wait for D3 graph to render nodes
    await expect(page.locator('#wiki-graph circle').first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking a graph node opens the wiki article', async ({ page }) => {
    await goToPardurWiki(page);
    await expect(page.locator('#wiki-graph circle').first()).toBeVisible({ timeout: 8000 });
    await page.locator('#wiki-graph circle').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
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
      // Try to find by title
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

  test('create button is visible for admin', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await expect(page.locator('.wiki-new-entry-wrap')).toBeVisible({ timeout: 5000 });
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

    // Store ID for cleanup
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
    // Create entry via API first
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
    // Find and click edit button in article panel
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
    // No delete button visible for guests
    await expect(page.locator('#wiki-article-content button.wiki-delete-btn, #wiki-article-panel button:has-text("Löschen")')).toBeHidden();
  });

  test('admin can delete an entry', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText(deleteTitle).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    // The delete button has class wiki-icon-btn--del and triggers a native confirm() dialog
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

    // Upload a fake PNG file (invalid type)
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

// ── AL-B2-016: Wiki-Auto-Link im Body ────────────────────────────────────────

test.describe('AL-B2-016 — Wiki-Einträge in Body verlinken', () => {

  test('Tavari title in Glimmquali body is rendered as an inline link', async ({ page }) => {
    await goToPardurWiki(page);
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    // Tavari appears multiple times in Glimmquali body; use .first() to avoid strict-mode violation
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

// ── AL-B2-018: Wiki ZIP Export ────────────────────────────────────────────────

test.describe('AL-B2-018 — Wiki als ZIP exportieren', () => {

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

// ── AL-B2-007: Vorschau-Tooltip bei Hover ────────────────────────────────────

test.describe('AL-B2-007 — Vorschau-Tooltip bei Hover', () => {

  test('hovering over a wiki inline link shows the preview tooltip', async ({ page }) => {
    await goToPardurWiki(page);
    // Open Glimmquali — its body contains "Tavari" which is auto-linked
    await page.locator('#wiki-recent-list').getByText('Glimmquali').first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    // Hover over the first inline link in the article body
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
    // Move away from the link to the article title (no link)
    await page.locator('#wiki-article-content').first().hover({ position: { x: 5, y: 5 } });
    await expect(page.locator('#wiki-preview-tip')).toBeHidden({ timeout: 3000 });
  });

});

// ── AL-B2-012: Bild-Lightbox ──────────────────────────────────────────────────

test.describe('AL-B2-012 — Bild-Lightbox', () => {
  // Minimal 1×1 red pixel PNG — Java ImageIO reads this natively without plugins
  const MINIMAL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  let entryId;

  test.beforeEach(async ({ request: apiCtx }) => {
    // Create a wiki entry via API
    const res = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: `LightboxTest-${Date.now()}`, type: 'TERM', worldId: 1, body: '' },
    });
    expect(res.ok()).toBeTruthy();
    entryId = (await res.json()).id;

    // Upload a minimal PNG image with a caption
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
    // Open the article
    await page.locator('#wiki-recent-list').getByText(/LightboxTest/).first().click();
    await expect(page.locator('#wiki-article-panel')).toBeVisible({ timeout: 5000 });
    // Click the first image
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

// ── AL-B2-014: Spoiler-Block erstellen ────────────────────────────────────────

test.describe('AL-B2-014 — Spoiler-Block erstellen', () => {

  test('spoiler toolbar button is visible for admin in the editor', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await goToPardurWiki(page);
    await page.locator('.wiki-new-btn').click();
    await expect(page.locator('#wiki-editor-panel')).toBeVisible({ timeout: 3000 });
    // The spoiler button is shown only for logged-in users with write access
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
    // wikiToolbar('spoiler') opens a native prompt() dialog — accept it with a name
    page.once('dialog', dialog => dialog.accept('Testspoiler'));
    await page.locator('#wiki-toolbar-spoiler').click();
    const bodyValue = await page.locator('#wiki-ed-body').inputValue();
    expect(bodyValue).toContain(':::spoiler');
    await page.locator('#wiki-editor-panel .wiki-panel-close').click();
  });

});

// ── AL-B2-015: Spoiler-Zugriff verwalten (API) ────────────────────────────────

test.describe('AL-B2-015 — Spoiler-Zugriff verwalten', () => {
  let entryId;
  let userId;

  test.beforeEach(async ({ request: apiCtx }) => {
    // Create a wiki entry
    const entryRes = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: `Spoiler-${Date.now()}`, type: 'TERM', worldId: 1, body: '' },
    });
    entryId = (await entryRes.json()).id;

    // Get seeded user ID
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
    // Add first
    await apiCtx.post(`/api/wiki/${entryId}/spoiler-readers/${userId}`, {
      headers: ADMIN_HEADERS,
    });
    // Then remove
    const res = await apiCtx.delete(`/api/wiki/${entryId}/spoiler-readers/${userId}`, {
      headers: ADMIN_HEADERS,
    });
    expect(res.ok()).toBeTruthy();
  });

  test('unauthenticated request to add spoiler reader returns 401 or 403', async ({ playwright }) => {
    // The shared apiCtx carries an admin session cookie from beforeEach — use a fresh context instead
    const freshCtx = await playwright.request.newContext({ baseURL: 'http://localhost:8080' });
    const res = await freshCtx.post(`/api/wiki/${entryId}/spoiler-readers/${userId}`);
    await freshCtx.dispose();
    expect([401, 403]).toContain(res.status());
  });

});
