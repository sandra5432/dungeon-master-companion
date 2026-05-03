# Ideenkammer Deep Links — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-based deep linking to the Ideenkammer so `/ideas` shows the board and `/ideas/{id}` opens the board with a specific idea's detail panel already open — shareable and bookmark-friendly.

**Architecture:** Extend the existing pathname-based SPA router in `core.js` with an ideas-specific URL pattern. Remove the implicit `initIdeasPage()` call from `showPage()` so callers control the loading sequence (needed for the `navigateToUrl` ideas case to await data before opening the detail panel). Update `openIdeaDetail` / `closeIdeaDetail` in `ideas.js` to push the URL on user interaction.

**Tech Stack:** Vanilla JS, `history.pushState`, Playwright for e2e tests. No backend changes needed — `WebMvcConfig` already falls back to `index.html` for all non-API paths.

**User preference:** Add explanatory JSDoc/comments to every new or modified function.

---

## Files

| File | Change |
|------|--------|
| `e2e/d-ideenkammer.spec.js` | Add AL-D-010 deep link test suite |
| `backend/src/main/resources/static/js/core.js` | `parseUrl()`, `showPage()`, `navigateToUrl()`, new `selectIdeas()` |
| `backend/src/main/resources/static/js/ideas.js` | `openIdeaDetail()`, `closeIdeaDetail()` |
| `backend/src/main/resources/static/index.html` | Nav button `onclick` |

---

## Task 1 — Write failing e2e tests

**Files:**
- Modify: `e2e/d-ideenkammer.spec.js`

- [ ] **Step 1: Append the AL-D-010 describe block to `e2e/d-ideenkammer.spec.js`**

Add at the very end of the file:

```js
// ── AL-D-010: Deep Links ──────────────────────────────────────────────────────

test.describe('AL-D-010 — Deep Links', () => {
  let testIdeaId;

  test.beforeEach(async ({ request: apiCtx }) => {
    const idea = await createTestIdea(apiCtx, WORLD_ID, { title: 'DeepLink-Test-Idee' });
    testIdeaId = idea.id;
  });

  test.afterEach(async ({ request: apiCtx }) => {
    if (testIdeaId) await deleteTestIdea(apiCtx, WORLD_ID, testIdeaId);
  });

  test('navigating to /ideas directly shows the board for logged-in user', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.goto('/ideas');
    await expect(page.locator('#page-ideas')).toHaveClass(/active/, { timeout: 5000 });
    await expect(page.locator('#ideas-cards-draft')).toBeVisible();
  });

  test('navigating to /ideas/{id} opens board with detail panel', async ({ page }) => {
    await page.goto('/');
    await loginAsAdmin(page);
    await page.goto(`/ideas/${testIdeaId}`);
    await expect(page.locator('#page-ideas')).toHaveClass(/active/, { timeout: 5000 });
    await expect(page.locator('#ideas-detail-panel')).toHaveClass(/open/, { timeout: 5000 });
  });

  test('clicking a card updates the URL to /ideas/{id}', async ({ page }) => {
    await goToIdeasPage(page);
    const card = page.locator('#ideas-cards-draft .icard').filter({ hasText: 'DeepLink-Test-Idee' });
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/ideas/${testIdeaId}`), { timeout: 3000 });
  });

  test('closing the detail panel resets URL to /ideas', async ({ page }) => {
    await goToIdeasPage(page);
    const card = page.locator('#ideas-cards-draft .icard').filter({ hasText: 'DeepLink-Test-Idee' });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/ideas/${testIdeaId}`), { timeout: 3000 });
    await page.locator('.idp-close').click();
    await expect(page).toHaveURL('/ideas', { timeout: 3000 });
  });

  test('browser back from /ideas/{id} closes detail and returns to /ideas', async ({ page }) => {
    await goToIdeasPage(page);
    const card = page.locator('#ideas-cards-draft .icard').filter({ hasText: 'DeepLink-Test-Idee' });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/ideas/${testIdeaId}`), { timeout: 3000 });
    await page.goBack();
    await expect(page).toHaveURL('/ideas', { timeout: 3000 });
    await expect(page.locator('#ideas-detail-panel')).not.toHaveClass(/open/, { timeout: 3000 });
  });

  test('guest navigating to /ideas sees the items page, not ideas', async ({ page }) => {
    await page.goto('/ideas');
    await expect(page.locator('#page-ideas')).not.toHaveClass(/active/);
    await expect(page.locator('#page-items')).toHaveClass(/active/, { timeout: 3000 });
  });

});
```

- [ ] **Step 2: Run the new tests and confirm they all fail**

```
npx playwright test e2e/d-ideenkammer.spec.js --grep "AL-D-010"
```

Expected: all 6 tests FAIL (URL does not change, detail panel does not open on direct navigation).

---

## Task 2 — Extend `parseUrl()` in `core.js`

**Files:**
- Modify: `backend/src/main/resources/static/js/core.js`

- [ ] **Step 1: Replace `parseUrl()` with the extended version**

Find the existing `parseUrl` function (around line 152) and replace it entirely:

```js
/**
 * Parses window.location.pathname into a routing descriptor used by navigateToUrl().
 *
 * Supported patterns:
 *   /ideas          → { page: 'ideas', worldId: null, subId: null }
 *   /ideas/{id}     → { page: 'ideas', worldId: null, subId: id }
 *   /world/{w}/timeline/{id}  → { page: 'timeline', worldId: w, subId: id }
 *   /world/{w}/wiki/{id}      → { page: 'wiki',     worldId: w, subId: id }
 *   /world/{w}/map            → { page: 'map',      worldId: w, subId: null }
 *   anything else             → { page: 'items',    worldId: null, subId: null }
 *
 * @returns {{ page: string, worldId: number|null, subId: number|null }}
 */
function parseUrl() {
  // Ideas deep links: /ideas or /ideas/{id}
  const mi = window.location.pathname.match(/^\/ideas(?:\/(\d+))?/);
  if (mi) return { page: 'ideas', worldId: null, subId: mi[1] ? parseInt(mi[1], 10) : null };

  // World-scoped pages: timeline, wiki, map
  const m = window.location.pathname.match(/^\/world\/(\d+)\/(timeline|wiki|map)(?:\/(\d+))?/);
  if (m) {
    return {
      page:    m[2],
      worldId: parseInt(m[1], 10),
      subId:   m[3] ? parseInt(m[3], 10) : null,
    };
  }

  // Default: Marktplatz (items)
  return { page: 'items', worldId: null, subId: null };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/static/js/core.js
git commit -m "feat(routing): extend parseUrl to recognise /ideas and /ideas/{id}"
```

---

## Task 3 — Add `selectIdeas()`, clean up `showPage()`, update nav button

These three changes must land in one commit because they are coupled: removing `initIdeasPage()` from `showPage` breaks the nav button unless `selectIdeas()` is already in place and wired up.

**Files:**
- Modify: `backend/src/main/resources/static/js/core.js`
- Modify: `backend/src/main/resources/static/index.html`

- [ ] **Step 1: Remove `initIdeasPage()` from `showPage()` in `core.js`**

Find the block near line 294–295:

```js
  if (p === 'map')    initMapPage();
  if (p === 'ideas')  initIdeasPage();
```

Remove only the `ideas` line, leaving the rest intact:

```js
  if (p === 'map')    initMapPage();
  // initIdeasPage is NOT called here — callers of showPage('ideas') are responsible
  // for calling initIdeasPage() themselves so they can await it before opening a detail panel.
```

- [ ] **Step 2: Add `selectIdeas()` to `core.js` — place it directly after `selectSection()`**

`selectSection` ends around line 476. Add the new function immediately after:

```js
/**
 * Navigates to the Ideenkammer and updates the browser URL to /ideas.
 * Analogous to selectSection() for timeline/wiki/map.
 * Called from the nav button; data loading is handled by initIdeasPage() (fire-and-forget).
 */
function selectIdeas() {
  pushUrl('/ideas');
  showPage('ideas');
  initIdeasPage(); // unawaited — the board renders when data arrives, same as before
}
```

- [ ] **Step 3: Update the nav button `onclick` in `index.html`**

Find:
```html
<button class="nav-link user-action-only" id="nav-ideas" onclick="showPage('ideas')" style="display:none">Ideenkammer</button>
```

Replace with:
```html
<button class="nav-link user-action-only" id="nav-ideas" onclick="selectIdeas()" style="display:none">Ideenkammer</button>
```

- [ ] **Step 4: Commit all three files together**

```bash
git add backend/src/main/resources/static/js/core.js backend/src/main/resources/static/index.html
git commit -m "feat(routing): add selectIdeas(), move initIdeasPage out of showPage, wire nav button"
```

---

## Task 4 — Add ideas case to `navigateToUrl()` in `core.js`

**Files:**
- Modify: `backend/src/main/resources/static/js/core.js`

- [ ] **Step 1: Add the ideas case inside `navigateToUrl()`, immediately after the items early-return**

Find this block (around line 183–188):

```js
  if (page === 'items') {
    if (push) pushUrl('/');
    showPage('items');
    console.debug('[navigateToUrl] ← items');
    return;
  }
```

Insert the ideas case directly after it:

```js
  // Ideas page is world-agnostic, so it is handled before the world-resolution logic below.
  if (page === 'ideas') {
    // Only logged-in users may access the Ideenkammer.
    if (!state.auth.loggedIn) {
      if (push) pushUrl('/');
      showPage('items');
      console.debug('[navigateToUrl] ← ideas, not logged in, fallback to items');
      return;
    }
    // Update the URL (push=false on startup / popstate, so the URL is already correct then).
    if (push) pushUrl(subId ? `/ideas/${subId}` : '/ideas');
    showPage('ideas');         // sets up the DOM (page visibility, nav active state)
    await initIdeasPage();     // loads ideas list; must complete before opening a detail panel
    if (subId) await openIdeaDetail(subId, false); // false = URL was already set above
    renderTopNavWorlds();
    console.debug('[navigateToUrl] ← ideas');
    return;
  }
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/static/js/core.js
git commit -m "feat(routing): handle /ideas and /ideas/{id} in navigateToUrl"
```

---

## Task 5 — URL push in `openIdeaDetail()` and `closeIdeaDetail()` in `ideas.js`

**Files:**
- Modify: `backend/src/main/resources/static/js/ideas.js`

- [ ] **Step 1: Replace the `openIdeaDetail` signature and add the URL push**

Find:
```js
async function openIdeaDetail(id) {
  console.debug('[openIdeaDetail] →', id);
  state.ideas.detailId = id;
```

Replace with:
```js
/**
 * Opens the detail panel and loads all content for the given idea.
 *
 * @param {number}  id    Idea ID to open.
 * @param {boolean} push  Whether to update the browser URL to /ideas/{id}.
 *                        Pass false when called from navigateToUrl (URL is already set).
 *                        Defaults to true for normal user-initiated clicks.
 */
async function openIdeaDetail(id, push = true) {
  console.debug('[openIdeaDetail] →', id);
  // Update the URL so the open idea can be bookmarked or shared.
  // Guard on currentPage so switching away from ideas does not clobber an unrelated URL.
  if (push && state.ui.currentPage === 'ideas') pushUrl('/ideas/' + id);
  state.ideas.detailId = id;
```

- [ ] **Step 2: Update `closeIdeaDetail()` to restore the base /ideas URL**

Find:
```js
function closeIdeaDetail() {
  console.debug('[closeIdeaDetail] →');
  state.ideas.detailId = null;
```

Replace with:
```js
/**
 * Closes the detail panel and clears the selected idea from state.
 * Restores the URL to /ideas when called while on the ideas page,
 * so the address bar no longer points at a specific idea.
 */
function closeIdeaDetail() {
  console.debug('[closeIdeaDetail] →');
  // Only push /ideas when we are actually on the ideas page.
  // closeIdeaDetail() is also called from selectWorld() during world switches,
  // where pushing /ideas would overwrite the world URL being set.
  if (state.ui.currentPage === 'ideas') pushUrl('/ideas');
  state.ideas.detailId = null;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/static/js/ideas.js
git commit -m "feat(ideas): push /ideas/{id} URL on detail open, /ideas on close"
```

---

## Task 6 — Run e2e tests and verify

- [ ] **Step 1: Start the app if not already running**

```
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" spring-boot:run -Dspring-boot.run.profiles=dev
```

- [ ] **Step 2: Run the full ideenkammer suite**

```
npx playwright test e2e/d-ideenkammer.spec.js
```

Expected: all tests PASS, including the new AL-D-010 block.

- [ ] **Step 3: If any AL-D-010 test fails, diagnose and fix**

Common issues:
- `navigating to /ideas/{id}` fails → check that `navigateToUrl` awaits `initIdeasPage()` before `openIdeaDetail`
- URL not updating on card click → check that `openIdeaDetail` is called without `push=false` from the card onclick wiring in `renderIdeasColumns()`
- URL not resetting on close → check `state.ui.currentPage` value when `closeIdeaDetail` runs; confirm it is `'ideas'` at that point
- Browser back test fails → the `popstate` handler in `users.js` calls `navigateToUrl(parseUrl(), false)`; confirm `parseUrl()` now returns `{ page: 'ideas', subId: null }` for `/ideas`

- [ ] **Step 4: Commit the test file**

```bash
git add e2e/d-ideenkammer.spec.js
git commit -m "test(ideas): add AL-D-010 deep link e2e tests"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `/ideas` → board | Task 2, 3, 4 |
| `/ideas/{id}` → board + detail open | Task 2, 4, 5 |
| Card click → URL `/ideas/{id}` | Task 5 (`openIdeaDetail`) |
| Close panel → URL `/ideas` | Task 5 (`closeIdeaDetail`) |
| Browser back/forward | Task 2 + 4 (popstate uses `parseUrl` + `navigateToUrl`) |
| Auth guard for guests | Task 4 |
| `initIdeasPage()` out of `showPage` | Task 3 |
| `selectIdeas()` for nav button | Task 3 |
| No backend changes needed | ✓ (not touched) |
| JSDoc on all new/modified functions | All tasks include JSDoc |

**Placeholder scan:** No TBDs, no "add appropriate handling", all code is complete.

**Type consistency:**
- `openIdeaDetail(id, push = true)` — signature used consistently in Task 4 (`openIdeaDetail(subId, false)`) and Task 5 (definition).
- `closeIdeaDetail()` — unchanged signature; internal guard added.
- `selectIdeas()` — defined in Task 3, referenced in Task 3 (index.html).
