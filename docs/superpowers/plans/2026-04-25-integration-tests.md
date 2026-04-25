# Integration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the 8 test-coverage gaps in the existing Playwright e2e suite, fix the admin-worlds endpoint bug, and add the missing Playwright config so tests are runnable.

**Architecture:** Nine Playwright spec files in `backend/src/test/e2e/` (already exist, untracked). A new `playwright.config.js` at the project root ties them together. All changes are additions/fixes to existing files except `playwright.config.js` (new) and `package.json` (modified scripts).

**Tech Stack:** Playwright ^1.59.1, Node.js CommonJS. App must be running at `http://localhost:8080` with the Spring Boot `dev` profile before running any test.

---

## Prerequisites

Start the app (keep running for all tasks):
```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" spring-boot:run -Dspring-boot.run.profiles=dev
```

Dev-seed credentials: `admin` / `4711`, `user` / `user`.
Pardur (world_id=1): `guestCanRead/Edit/Delete=true`. Eldorheim (world_id=2): no guest access.

---

## File Map

| File | Change |
|------|--------|
| `playwright.config.js` | **Create** — Playwright configuration |
| `package.json` | **Modify** — add `test:e2e` and `test:unit` scripts |
| `backend/src/test/e2e/admin-worlds.spec.js` | **Fix** — `/api/admin/worlds` → `/api/worlds` |
| `backend/src/test/e2e/worlds-nav.spec.js` | **Add** — AL-B-006 guest delete tests |
| `backend/src/test/e2e/chronicle.spec.js` | **Add** — AL-B1-009 char filter, AL-B1-011/012 API date tests |
| `backend/src/test/e2e/wiki.spec.js` | **Add** — AL-B2-007 tooltip, AL-B2-012 lightbox, AL-B2-014/015 spoiler |
| `backend/src/test/e2e/map.spec.js` | **Add** — AL-B3-005 POI move, AL-B3-009 background upload |

---

## Task 1: Playwright config + package.json scripts

**Files:**
- Create: `playwright.config.js`
- Modify: `package.json`

- [ ] **Step 1: Create playwright.config.js**

```js
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'backend/src/test/e2e',
  use: {
    baseURL: 'http://localhost:8080',
  },
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
```

- [ ] **Step 2: Update package.json scripts**

Replace the `"scripts"` block in `package.json` with:
```json
"scripts": {
  "test:e2e":  "playwright test",
  "test:unit": "node backend/src/test/js/worldSort.test.js"
},
```

- [ ] **Step 3: Verify config is picked up**

```bash
npx playwright test --list
```

Expected: lists all spec files under `backend/src/test/e2e/` with their test names. No error about missing config.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.js package.json
git commit -m "test: add playwright.config.js and e2e/unit npm scripts"
```

---

## Task 2: Fix admin-worlds.spec.js endpoint bug

`WorldController` is mounted at `/api/worlds`, not `/api/admin/worlds`. All setup/teardown API calls in `admin-worlds.spec.js` use the wrong path and will return 404.

**Files:**
- Modify: `backend/src/test/e2e/admin-worlds.spec.js`

- [ ] **Step 1: Replace all occurrences of the wrong path**

In `backend/src/test/e2e/admin-worlds.spec.js`, replace every occurrence of `/api/admin/worlds` with `/api/worlds`. There are 7 occurrences (in `afterEach`/`beforeEach` blocks of tasks AL-C2-002 through AL-C2-005).

Specifically, find and replace:
- `apiCtx.post('/api/admin/worlds',` → `apiCtx.post('/api/worlds',`
- `apiCtx.delete(\`/api/admin/worlds/\${` → `apiCtx.delete(\`/api/worlds/\${`

- [ ] **Step 2: Run the world config tests**

```bash
npx playwright test admin-worlds.spec.js
```

Expected: all 13 tests pass. Previously the `beforeEach`/`afterEach` blocks would return 404, causing test setup failures. They should now succeed.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/e2e/admin-worlds.spec.js
git commit -m "fix(e2e): correct world API path in admin-worlds setup/teardown"
```

---

## Task 3: AL-B-006 — Guest delete permission

**Files:**
- Modify: `backend/src/test/e2e/worlds-nav.spec.js`

- [ ] **Step 1: Add ADMIN_HEADERS to the import in worlds-nav.spec.js**

Change the top `require` line from:
```js
const { loginAsAdmin, loginAsUser, setWorldPermissions } = require('./helpers');
```
to:
```js
const { loginAsAdmin, loginAsUser, setWorldPermissions, ADMIN_HEADERS } = require('./helpers');
```

- [ ] **Step 2: Append the AL-B-006 test block to worlds-nav.spec.js**

Add at the end of the file:
```js
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
      data: { title, type: 'WORLD' },
    });
    expect(res.ok()).toBeTruthy();
    const ev = await res.json();
    eventId = ev.id;

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
      data: { title, type: 'WORLD' },
    });
    const ev = await res.json();
    eventId = ev.id;

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
```

- [ ] **Step 3: Run the worlds-nav tests**

```bash
npx playwright test worlds-nav.spec.js
```

Expected: all existing tests pass plus the 2 new AL-B-006 tests.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/e2e/worlds-nav.spec.js
git commit -m "test(e2e): AL-B-006 guest delete permission tests"
```

---

## Task 4: AL-B1-009, AL-B1-011, AL-B1-012 — Chronik filter + API date tests

**Files:**
- Modify: `backend/src/test/e2e/chronicle.spec.js`

- [ ] **Step 1: Append AL-B1-009 character filter test block**

Add after the last `test.describe` block in `chronicle.spec.js`:

```js
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
```

- [ ] **Step 2: Append AL-B1-011/012 API date tests**

```js
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
```

- [ ] **Step 3: Run the chronicle tests**

```bash
npx playwright test chronicle.spec.js
```

Expected: all existing tests pass plus 4 new tests (2 char filter, 2 date API).

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/e2e/chronicle.spec.js
git commit -m "test(e2e): AL-B1-009 character filter, AL-B1-011/012 date API tests"
```

---

## Task 5: AL-B2-007 — Wiki hover tooltip

**Files:**
- Modify: `backend/src/test/e2e/wiki.spec.js`

- [ ] **Step 1: Append the hover tooltip test block**

Add at the end of `wiki.spec.js`:

```js
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
```

- [ ] **Step 2: Run the wiki tests**

```bash
npx playwright test wiki.spec.js
```

Expected: all existing tests pass plus 2 new AL-B2-007 tests.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/e2e/wiki.spec.js
git commit -m "test(e2e): AL-B2-007 wiki hover tooltip tests"
```

---

## Task 6: AL-B2-012 — Bild-Lightbox

**Files:**
- Modify: `backend/src/test/e2e/wiki.spec.js`

- [ ] **Step 1: Add USER_HEADERS to the wiki.spec.js import**

Change the `require` at the top of `wiki.spec.js` from:
```js
const { loginAsAdmin, goToPardurWiki, ADMIN_HEADERS } = require('./helpers');
```
to:
```js
const { loginAsAdmin, goToPardurWiki, ADMIN_HEADERS, USER_HEADERS } = require('./helpers');
```

- [ ] **Step 2: Append the lightbox test block**

Add at the end of `wiki.spec.js`:

```js
// ── AL-B2-012: Bild-Lightbox ──────────────────────────────────────────────────

test.describe('AL-B2-012 — Bild-Lightbox', () => {
  // Minimal 1×1 white pixel WebP (VP8L lossless)
  const MINIMAL_WEBP = Buffer.from(
    'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JYgCdAEO/gHOAADN3wAA7+aAAA==',
    'base64'
  );
  let entryId;

  test.beforeEach(async ({ request: apiCtx }) => {
    // Create a wiki entry via API
    const res = await apiCtx.post('/api/wiki', {
      headers: ADMIN_HEADERS,
      data: { title: `LightboxTest-${Date.now()}`, type: 'TERM', worldId: 1, body: '' },
    });
    entryId = (await res.json()).id;

    // Upload the minimal WebP image (requires USER role minimum)
    await apiCtx.post(`/api/wiki/${entryId}/images`, {
      headers: { Authorization: ADMIN_HEADERS.Authorization },
      multipart: {
        file: { name: 'test.webp', mimeType: 'image/webp', buffer: MINIMAL_WEBP },
        caption: 'Testbild',
      },
    });
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
```

- [ ] **Step 3: Run the wiki tests**

```bash
npx playwright test wiki.spec.js
```

Expected: all previously passing tests plus 3 new AL-B2-012 tests.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/e2e/wiki.spec.js
git commit -m "test(e2e): AL-B2-012 image lightbox tests"
```

---

## Task 7: AL-B2-014, AL-B2-015 — Spoiler-Blöcke

**Files:**
- Modify: `backend/src/test/e2e/wiki.spec.js`

- [ ] **Step 1: Append the spoiler test blocks**

Add at the end of `wiki.spec.js`:

```js
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

  test('unauthenticated request to add spoiler reader returns 401 or 403', async ({ request: apiCtx }) => {
    const res = await apiCtx.post(`/api/wiki/${entryId}/spoiler-readers/${userId}`);
    expect([401, 403]).toContain(res.status());
  });

});
```

- [ ] **Step 2: Run the wiki tests**

```bash
npx playwright test wiki.spec.js
```

Expected: all previous tests plus 5 new AL-B2-014/015 tests.

**Note:** If the AL-B2-014 tests for the spoiler button fail because `#wiki-toolbar-spoiler` remains hidden, it means the spoiler toolbar feature is not yet wired to the auth state in `app.js`. The test failure pinpoints the gap — fix `app.js` to show `#wiki-toolbar-spoiler` when the user has write access, or mark these tests as pending until the feature is implemented.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/e2e/wiki.spec.js
git commit -m "test(e2e): AL-B2-014/015 spoiler block and reader access tests"
```

---

## Task 8: AL-B3-005 — POI verschieben (API)

**Files:**
- Modify: `backend/src/test/e2e/map.spec.js`

- [ ] **Step 1: Append the POI move test block**

Add at the end of `map.spec.js`:

```js
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

  test('guest cannot move a POI when not the creator', async ({ request: apiCtx }) => {
    // POI was created by admin; guest (no auth) should get 403
    const res = await apiCtx.put(`/api/worlds/1/map/pois/${poiId}`, {
      data: { xPct: 50.0, yPct: 50.0 },
    });
    expect([403, 401]).toContain(res.status());
  });

});
```

- [ ] **Step 2: Run the map tests**

```bash
npx playwright test map.spec.js
```

Expected: all existing tests pass plus 2 new AL-B3-005 tests.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/e2e/map.spec.js
git commit -m "test(e2e): AL-B3-005 POI position update API tests"
```

---

## Task 9: AL-B3-009 — Kartenhintergrund hochladen

**Files:**
- Modify: `backend/src/test/e2e/map.spec.js`

- [ ] **Step 1: Append the background upload test block**

Add at the end of `map.spec.js`:

```js
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
```

- [ ] **Step 2: Run the map tests**

```bash
npx playwright test map.spec.js
```

Expected: all existing tests pass plus 3 new AL-B3-009 tests.

- [ ] **Step 3: Run the full e2e suite**

```bash
npx playwright test
```

Expected: all tests pass. The summary line should show 0 failed tests.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/e2e/map.spec.js
git commit -m "test(e2e): AL-B3-009 map background upload tests"
```

---

## Final: Commit all untracked spec files

All nine spec files and the helpers were previously untracked. After this plan they are all modified/committed. Make sure they are staged and committed if not already:

```bash
git add backend/src/test/e2e/
git add backend/src/test/js/
git status
```

Any still-untracked spec file that was not touched by this plan (e.g. `general.spec.js`, `items.spec.js`) should be committed as-is:

```bash
git add backend/src/test/e2e/general.spec.js \
        backend/src/test/e2e/items.spec.js
git commit -m "test(e2e): add all existing e2e spec files"
```
