# URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add History API deep linking so every page has a shareable URL and browser back/forward works.

**Architecture:** Three pure helper functions (`buildUrl`, `parseUrl`, `pushUrl`) plus a central `navigateToUrl(parsed, push)` that both startup routing and the popstate listener call. User-action functions push URLs themselves; `navigateToUrl` sets state directly to avoid double-pushes.

**Tech Stack:** Vanilla JS, History API (`history.pushState`, `popstate`). No backend changes — Spring Boot catch-all already forwards all non-file paths to `index.html` (`WebMvcConfig.java:11`).

---

## URL Scheme

```
/                          → Marktplatz
/world/{id}/timeline       → Chronik for world {id}
/world/{id}/timeline/{eid} → Chronik with event {eid} open
/world/{id}/wiki           → Wiki list for world {id}
/world/{id}/wiki/{aid}     → Wiki article {aid}
/world/{id}/map            → Map for world {id}
```

## Files

- **Modify:** `backend/src/main/resources/static/js/app.js`
  - Task 1: add `buildUrl`, `parseUrl`, `pushUrl` (new section near top)
  - Task 2: add `navigateToUrl`
  - Task 3: update `selectSection`, `selectWorld`
  - Task 4: update `onTLCardClick`, `onUndatedClick`, click-outside listener, `openEventFromWiki`
  - Task 5: update `loadWikiArticle`, `closeWikiArticle`, `initWikiPage`, silent reload calls, `doLogout`
  - Task 6: update `init()`
  - Task 7: add `popstate` listener

---

### Task 1: URL Helper Functions

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add the `URL ROUTING` section after the `THEME / NAV` section**

  Find the line `function showPage(p) {` (currently line ~122) and insert the new section immediately **before** it:

  ```js
  /* ══════════════════════════════════════
     URL ROUTING
  ══════════════════════════════════════ */

  /**
   * Builds a pathname string for the given world, section, and optional sub-ID.
   * @param {number|null} worldId
   * @param {string} section  'timeline' | 'wiki' | 'map' | 'items'
   * @param {number|null} [subId]
   * @returns {string}
   */
  function buildUrl(worldId, section, subId) {
    if (!worldId || section === 'items') return '/';
    const base = `/world/${worldId}/${section}`;
    return subId ? `${base}/${subId}` : base;
  }

  /**
   * Parses window.location.pathname into a routing descriptor.
   * @returns {{ page: string, worldId: number|null, subId: number|null }}
   */
  function parseUrl() {
    const m = window.location.pathname.match(/^\/world\/(\d+)\/(timeline|wiki|map)(?:\/(\d+))?/);
    if (m) {
      return {
        page:    m[2],
        worldId: parseInt(m[1], 10),
        subId:   m[3] ? parseInt(m[3], 10) : null,
      };
    }
    return { page: 'items', worldId: null, subId: null };
  }

  /**
   * Pushes a new entry onto the browser history stack.
   * @param {string} path
   */
  function pushUrl(path) {
    history.pushState(null, '', path);
  }

  ```

- [ ] **Step 2: Verify the app still loads**

  Start the app and open it in the browser. The page should load without console errors. Navigation should still work (URL won't change yet — that's expected).

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): add buildUrl, parseUrl, pushUrl helpers"
  ```

---

### Task 2: navigateToUrl

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add `navigateToUrl` immediately after `pushUrl`**

  ```js
  /**
   * Navigates the app to the state described by a parsed URL.
   * Sets world/page state directly (does not go through selectWorld) to avoid
   * double-pushes. When push=true, updates the browser URL.
   *
   * @param {{ page: string, worldId: number|null, subId: number|null }} parsed
   * @param {boolean} push  true when user-initiated; false on startup / popstate
   */
  async function navigateToUrl({ page, worldId, subId }, push) {
    console.debug('[navigateToUrl] →', { page, worldId, subId, push });

    if (page === 'items') {
      if (push) pushUrl('/');
      showPage('items');
      console.debug('[navigateToUrl] ← items');
      return;
    }

    const world = worldId ? state.worlds.find(w => w.id === worldId) : null;
    if (!world) {
      // Unknown world — fall back to Marktplatz
      if (push) pushUrl('/');
      showPage('items');
      console.debug('[navigateToUrl] ← unknown world, fallback to items');
      return;
    }

    // Update world state without triggering selectWorld's own URL push
    const worldChanged = state.ui.activeWorldId !== worldId;
    if (worldChanged) {
      state.ui.activeWorldId     = worldId;
      state.ui.wikiActiveWorldId = worldId;
      localStorage.setItem('activeWorldId', worldId);
      state.events  = [];
      state.undated = [];
      state.ui.activeTags  = new Set();
      state.ui.activeChars = new Set();
      state.ui.activeTypes = new Set();
    }

    if (page === 'timeline') {
      // Fetch events when switching world or when events not yet loaded
      if (worldChanged || !state.events.length) {
        try {
          const [ev, und] = await Promise.all([
            api('GET', `/worlds/${worldId}/events`),
            api('GET', `/worlds/${worldId}/events/unpositioned`),
          ]);
          state.events  = ev  || [];
          state.undated = und || [];
        } catch (e) { console.error('[navigateToUrl] load events failed', e); }
      }
      if (push) pushUrl(buildUrl(worldId, 'timeline', subId));
      showPage('timeline');
      if (subId) {
        const inTl      = state.events.find(e => e.id === subId);
        const inUndated = !inTl && state.undated.find(e => e.id === subId);
        if (inTl)      { populateDetail(subId, 'tl');      openDetailPanel(); }
        else if (inUndated) { populateDetail(subId, 'undated'); openDetailPanel(); }
        // Event not found (deleted) — stay on timeline without opening detail
      }

    } else if (page === 'wiki') {
      if (push) pushUrl(buildUrl(worldId, 'wiki', subId));
      showPage('wiki');  // calls initWikiPage() inside
      if (subId) await loadWikiArticle(subId, true);  // silent — URL already pushed above

    } else if (page === 'map') {
      if (push) pushUrl(buildUrl(worldId, 'map'));
      showPage('map');  // calls initMapPage() inside
    }

    renderTopNavWorlds();
    console.debug('[navigateToUrl] ← done', page);
  }
  ```

- [ ] **Step 2: Verify**

  Start the app. Open the browser console. No errors. The app still functions normally (routing is not wired yet).

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): add navigateToUrl"
  ```

---

### Task 3: Push URL on World and Section Navigation

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Update `selectSection`**

  Find:
  ```js
  function selectSection(section) {
    showPage(section);
  }
  ```
  Replace with:
  ```js
  function selectSection(section) {
    pushUrl(buildUrl(state.ui.activeWorldId, section));
    showPage(section);
  }
  ```

- [ ] **Step 2: Update `selectWorld` — add `pushUrl` after `section` is determined**

  Find this block inside `selectWorld`:
  ```js
    const section = ['timeline', 'wiki', 'map'].includes(state.ui.currentPage)
      ? state.ui.currentPage : 'timeline';

    // Switch the visible page (showPage is not called here to avoid double data loads)
  ```
  Replace with:
  ```js
    const section = ['timeline', 'wiki', 'map'].includes(state.ui.currentPage)
      ? state.ui.currentPage : 'timeline';

    pushUrl(buildUrl(worldId, section));

    // Switch the visible page (showPage is not called here to avoid double data loads)
  ```

- [ ] **Step 3: Manual verify**

  Start the app. Click between worlds in the top nav — the URL should update to `/world/2/timeline` (or wiki/map depending on current section). Click the sub-tabs (Chronik, Wiki, Karte) — URL updates. Click Marktplatz — URL resets to `/`.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): push URL on world and section navigation"
  ```

---

### Task 4: Push URL on Detail Panel Open / Close

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Update `onTLCardClick`**

  Find:
  ```js
  function onTLCardClick(e, id) {
    e.stopPropagation();
    if (state.ui.detailId === id && state.ui.detailSource === 'tl') { closeDetail(); return; }
    populateDetail(id, 'tl');
    openDetailPanel();
  }
  ```
  Replace with:
  ```js
  function onTLCardClick(e, id) {
    e.stopPropagation();
    if (state.ui.detailId === id && state.ui.detailSource === 'tl') {
      closeDetail();
      pushUrl(buildUrl(state.ui.activeWorldId, 'timeline'));
      return;
    }
    populateDetail(id, 'tl');
    openDetailPanel();
    pushUrl(buildUrl(state.ui.activeWorldId, 'timeline', id));
  }
  ```

- [ ] **Step 2: Update `onUndatedClick`**

  Find:
  ```js
    if (state.ui.detailId === id && state.ui.detailSource === 'undated') { closeDetail(); return; }
    populateDetail(id, 'undated');
    openDetailPanel();
  ```
  Replace with:
  ```js
    if (state.ui.detailId === id && state.ui.detailSource === 'undated') {
      closeDetail();
      pushUrl(buildUrl(state.ui.activeWorldId, 'timeline'));
      return;
    }
    populateDetail(id, 'undated');
    openDetailPanel();
    pushUrl(buildUrl(state.ui.activeWorldId, 'timeline', id));
  ```

- [ ] **Step 3: Update the click-outside-panel listener**

  Find:
  ```js
  document.addEventListener('click', e => {
    const panel = document.getElementById('detail-panel');
    if (!panel || !panel.classList.contains('open')) return;
    if (panel.contains(e.target)) return;
    if (e.target.closest('.event-card') || e.target.closest('.undated-card')) return;
    closeDetail();
  });
  ```
  Replace with:
  ```js
  document.addEventListener('click', e => {
    const panel = document.getElementById('detail-panel');
    if (!panel || !panel.classList.contains('open')) return;
    if (panel.contains(e.target)) return;
    if (e.target.closest('.event-card') || e.target.closest('.undated-card')) return;
    closeDetail();
    pushUrl(buildUrl(state.ui.activeWorldId, 'timeline'));
  });
  ```

- [ ] **Step 4: Update `openEventFromWiki`**

  Find:
  ```js
  async function openEventFromWiki(eventId, worldId) {
    if (state.ui.activeWorldId !== worldId) {
      await selectWorld(worldId);
    }
    showPage('timeline');
    populateDetail(eventId, 'tl');
    openDetailPanel();
  }
  ```
  Replace with:
  ```js
  async function openEventFromWiki(eventId, worldId) {
    if (state.ui.activeWorldId !== worldId) {
      await selectWorld(worldId);
    }
    showPage('timeline');
    populateDetail(eventId, 'tl');
    openDetailPanel();
    pushUrl(buildUrl(worldId, 'timeline', eventId));
  }
  ```

- [ ] **Step 5: Manual verify**

  Click a timeline event card — URL becomes `/world/2/timeline/7`. Click it again to close — URL becomes `/world/2/timeline`. Click outside the panel — URL becomes `/world/2/timeline`. Clicking an event from a wiki article opens the event and URL includes the event ID.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): push URL on detail panel open/close"
  ```

---

### Task 5: Push URL on Wiki Navigation

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add `silent` parameter to `loadWikiArticle`**

  Find:
  ```js
  async function loadWikiArticle(id) {
    try {
      const entry = await api('GET', `/wiki/${id}`);
      renderWikiArticle(entry);
    } catch(e) { alert('Fehler: ' + e.message); }
  }
  ```
  Replace with:
  ```js
  async function loadWikiArticle(id, silent = false) {
    try {
      const entry = await api('GET', `/wiki/${id}`);
      renderWikiArticle(entry);
      if (!silent) pushUrl(buildUrl(state.ui.wikiActiveWorldId, 'wiki', id));
    } catch(e) { alert('Fehler: ' + e.message); }
  }
  ```

- [ ] **Step 2: Add `silent` parameter to `closeWikiArticle`**

  Find:
  ```js
  function closeWikiArticle() {
    const panel = document.getElementById('wiki-article-panel');
    if (panel) panel.style.display = 'none';
  }
  ```
  Replace with:
  ```js
  function closeWikiArticle(silent = false) {
    const panel = document.getElementById('wiki-article-panel');
    if (panel) panel.style.display = 'none';
    if (!silent) pushUrl(buildUrl(state.ui.wikiActiveWorldId, 'wiki'));
  }
  ```

- [ ] **Step 3: Update `initWikiPage` — pass `silent = true` to closeWikiArticle**

  Find (in `initWikiPage`):
  ```js
    // Close any open article before loading — prevents stale content from a previous world
    // flashing on screen. This runs synchronously before the first await so no repaint occurs.
    closeWikiArticle();
    const editorPanel = document.getElementById('wiki-editor-panel');
    if (editorPanel) editorPanel.style.display = 'none';
  ```
  Replace with:
  ```js
    // Close any open article before loading — prevents stale content from a previous world
    // flashing on screen. This runs synchronously before the first await so no repaint occurs.
    closeWikiArticle(true);
    const editorPanel = document.getElementById('wiki-editor-panel');
    if (editorPanel) editorPanel.style.display = 'none';
  ```

- [ ] **Step 4: Update silent reloads after spoiler and save operations**

  In `addWikiSpoilerReader`, find:
  ```js
      loadWikiArticle(entryId);
  ```
  Replace with:
  ```js
      loadWikiArticle(entryId, true);
  ```

  In `removeWikiSpoilerReader`, find:
  ```js
      loadWikiArticle(entryId);
  ```
  Replace with:
  ```js
      loadWikiArticle(entryId, true);
  ```

  Find the `loadWikiArticle` call after saving a wiki entry (in the save handler that calls it with `saved.id`):
  ```js
      await loadWikiArticle(saved.id);
  ```
  Replace with:
  ```js
      await loadWikiArticle(saved.id, true);
  ```

- [ ] **Step 5: Push URL on logout**

  In `doLogout`, find:
  ```js
    applyAuthUI();
    await loadWikiTitles();
  ```
  Replace with:
  ```js
    applyAuthUI();
    pushUrl('/');
    await loadWikiTitles();
  ```

- [ ] **Step 6: Manual verify**

  Open the wiki page. Click a wiki entry — URL becomes `/world/2/wiki/45`. Click the ✕ close button on the article — URL becomes `/world/2/wiki`. Navigate to another wiki entry from inside an article (breadcrumb or linked entry) — URL updates to the new article's URL. Log out — URL resets to `/`.

- [ ] **Step 7: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): push URL on wiki article open/close, logout"
  ```

---

### Task 6: Startup Routing in init()

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Replace the final `showPage('timeline')` call in `init()` with `navigateToUrl`**

  Find (inside the `try` block of `init()`):
  ```js
      renderTopNavWorlds();
      renderTimeline();
      renderItems();
      renderItemTagFilter();
      applyAuthUI();
      loadPoiTypes();
      showPage('timeline');
      loadWikiTitles();
      if (state.auth.mustChangePassword) showPasswordChangeOverlay();
  ```
  Replace with:
  ```js
      renderTopNavWorlds();
      renderTimeline();
      renderItems();
      renderItemTagFilter();
      applyAuthUI();
      loadPoiTypes();
      await navigateToUrl(parseUrl(), false);
      loadWikiTitles();
      if (state.auth.mustChangePassword) showPasswordChangeOverlay();
  ```

- [ ] **Step 2: Manual verify — direct URL navigation**

  With the app running:
  1. Navigate to `/` — Marktplatz opens
  2. Navigate to `/world/2/timeline` — Chronik for world 2 opens
  3. Navigate to `/world/2/timeline/7` (use a real event ID) — Chronik opens with event 7's detail panel open
  4. Navigate to `/world/2/wiki` — Wiki list for world 2 opens
  5. Navigate to `/world/2/wiki/45` (use a real article ID) — Wiki opens with that article displayed
  6. Navigate to `/world/2/map` — Map for world 2 opens
  7. Navigate to `/world/999/wiki` (invalid world) — falls back to Marktplatz

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): restore URL state on startup"
  ```

---

### Task 7: Browser Back / Forward (popstate)

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Register the `popstate` listener**

  Find:
  ```js
  document.addEventListener('DOMContentLoaded', () => { init(); wireUndatedDropZone(); });
  ```
  Replace with:
  ```js
  document.addEventListener('DOMContentLoaded', () => { init(); wireUndatedDropZone(); });
  window.addEventListener('popstate', () => { navigateToUrl(parseUrl(), false); });
  ```

- [ ] **Step 2: Manual verify — back/forward**

  1. Open the app at `/`
  2. Click a world → `/world/2/timeline`
  3. Click the Wiki sub-tab → `/world/2/wiki`
  4. Click a wiki article → `/world/2/wiki/45`
  5. Press browser back → `/world/2/wiki` (article closes, wiki list shows)
  6. Press browser back → `/world/2/timeline` (Chronik shows)
  7. Press browser back → `/` (Marktplatz shows)
  8. Press browser forward → `/world/2/timeline`
  9. Open a timeline event, press back → event closes, URL back to `/world/2/timeline`

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/js/app.js
  git commit -m "feat(routing): browser back/forward via popstate"
  ```

---

## Self-Review

**Spec coverage check:**
- ✅ `/` → Marktplatz (Task 3 + 6)
- ✅ `/world/{id}/timeline` → Chronik (Tasks 3, 4, 6)
- ✅ `/world/{id}/timeline/{eid}` → event open (Tasks 4, 6)
- ✅ `/world/{id}/wiki` → wiki list (Tasks 3, 5, 6)
- ✅ `/world/{id}/wiki/{aid}` → article open (Tasks 5, 6)
- ✅ `/world/{id}/map` → map (Tasks 3, 6)
- ✅ Browser back/forward (Task 7)
- ✅ Direct URL navigation (Task 6)
- ✅ Invalid world/article fallback (navigateToUrl in Task 2)
- ✅ Logout resets URL (Task 5)

**Type consistency:** `buildUrl(worldId, section, subId?)` used consistently. `loadWikiArticle(id, silent?)` and `closeWikiArticle(silent?)` — `silent` defaults to `false` everywhere user-facing, `true` only for internal reloads.

**Undated events and URLs:** Undated events use the same `/world/{id}/timeline/{eid}` scheme. `navigateToUrl` searches both `state.events` and `state.undated` by ID.
