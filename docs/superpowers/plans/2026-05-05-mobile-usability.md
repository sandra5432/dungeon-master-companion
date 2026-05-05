# Mobile Usability Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive CSS/JS layer that makes Timeline and Items fully usable at 375px viewport, adds a bottom tab bar + hamburger drawer, and shows graceful fallback notices for Map/Wiki/Ideas — without changing the desktop layout at all.

**Architecture:** All layout changes live in a new `@media (max-width: 768px)` block appended to `app.css`. New HTML elements (bottom nav, drawer, FABs, notices) are added to `index.html` and CSS-hidden on desktop. `core.js` and `timeline.js` each receive small targeted additions. No backend changes, no new files, no new dependencies.

> **Deferred (budget):** Task 5 (Timeline filter chips — requires editing `timeline.js`) and Task 13 (Wiki mobile article list — requires editing `wiki.js`) are deferred to a follow-up session. The app is fully functional on mobile without them — the sidebar filters remain desktop-only and the Wiki shows only the desktop-preferred notice without an article list fallback.

**Tech Stack:** Vanilla JS, HTML5, CSS3 (media queries, flexbox, CSS custom properties). Spring Boot serves static files from `backend/src/main/resources/static/`. Run the app with: `cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" spring-boot:run -Dspring-boot.run.profiles=dev`

**Verification method (used in every task):** Chrome → DevTools → Ctrl+Shift+M (Toggle Device Toolbar) → select "iPhone SE" preset (375 × 667). Reload the page at `http://localhost:8080`.

---

## Files modified

| File | Change |
|---|---|
| `backend/src/main/resources/static/index.html` | Add `#mobile-header`, `#mobile-bottom-nav`, `#mobile-drawer`, `#mob-sheet-backdrop`, FABs, desktop-preferred notices |
| `backend/src/main/resources/static/css/app.css` | Append one `@media (max-width: 768px)` block at the end of the file |
| `backend/src/main/resources/static/js/core.js` | Add `openDrawer()`, `closeDrawer()`, `mobOverridePage()`; update `showPage()` and `renderTopNavWorlds()` |
| `backend/src/main/resources/static/js/timeline.js` | Add `openDetailSheet()`, `closeDetailSheet()`, `renderMobTlFilters()`, `toggleMobUndated()`; update `renderUndated()` |
| `backend/src/main/resources/static/js/wiki.js` | Add `renderWikiMobileList()` |

---

## Task 1: Mobile navigation — HTML structure

**Files:**
- Modify: `backend/src/main/resources/static/index.html`

- [ ] **Step 1: Read the current `<body>` structure**

  Open `backend/src/main/resources/static/index.html`. Locate the closing `</body>` tag. Note the exact indentation used in the file.

- [ ] **Step 2: Add mobile header, bottom nav, drawer, and sheet backdrop just before `</body>`**

  Add the following block immediately before `</body>`:

  ```html
  <!-- ═══════════════════════════════════════════════
       MOBILE NAVIGATION (hidden on desktop via CSS)
  ════════════════════════════════════════════════ -->

  <!-- Simplified top header for mobile -->
  <header id="mobile-header">
    <span class="mob-header-title">⚔️ Pardur</span>
    <button class="mob-header-btn" onclick="openDrawer()" aria-label="Menü öffnen">☰</button>
  </header>

  <!-- Bottom tab bar -->
  <nav id="mobile-bottom-nav" aria-label="Hauptnavigation">
    <button class="mob-tab" data-page="timeline" onclick="showPage('timeline')">
      <span class="mob-tab-icon">📜</span>
      <span class="mob-tab-label">Timeline</span>
    </button>
    <button class="mob-tab" data-page="map" onclick="showPage('map')">
      <span class="mob-tab-icon">🗺️</span>
      <span class="mob-tab-label">Karte</span>
    </button>
    <button class="mob-tab" data-page="items" onclick="showPage('items')">
      <span class="mob-tab-icon">⚔️</span>
      <span class="mob-tab-label">Items</span>
    </button>
    <button class="mob-tab" data-page="ideas" onclick="showPage('ideas')">
      <span class="mob-tab-icon">💡</span>
      <span class="mob-tab-label">Ideen</span>
    </button>
    <button class="mob-tab" data-page="wiki" onclick="showPage('wiki')">
      <span class="mob-tab-icon">📖</span>
      <span class="mob-tab-label">Wiki</span>
    </button>
  </nav>

  <!-- Drawer backdrop (shared for drawer + detail sheet) -->
  <div id="mob-sheet-backdrop"></div>

  <!-- Slide-in drawer -->
  <aside id="mobile-drawer" aria-label="Seitenmenü">
    <div class="mob-drawer-header">
      <span class="mob-drawer-title">⚔️ Pardur</span>
      <button class="mob-drawer-close" onclick="closeDrawer()" aria-label="Menü schließen">✕</button>
    </div>
    <div class="mob-drawer-section">Seiten</div>
    <button class="mob-drawer-item" onclick="showPage('timeline'); closeDrawer()">📜 Timeline</button>
    <button class="mob-drawer-item" onclick="showPage('map'); closeDrawer()">🗺️ Karte</button>
    <button class="mob-drawer-item" onclick="showPage('items'); closeDrawer()">⚔️ Items</button>
    <button class="mob-drawer-item" onclick="showPage('ideas'); closeDrawer()">💡 Ideen</button>
    <button class="mob-drawer-item" onclick="showPage('wiki'); closeDrawer()">📖 Wiki</button>
    <div class="mob-drawer-section">Welten</div>
    <div id="mob-drawer-worlds"></div>
    <div class="mob-drawer-footer">
      <button class="mob-drawer-item" id="mob-drawer-user-btn" onclick="doLogout()">👤 Abmelden</button>
    </div>
  </aside>
  ```

- [ ] **Step 3: Verify the HTML is valid**

  Open the app in the browser. Open DevTools → Console. Confirm there are no parse errors. The new elements won't be visible yet (no CSS).

---

## Task 2: Mobile navigation — CSS

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Append the mobile media query block to the end of `app.css`**

  Add the following at the very end of the file (after the last existing rule):

  ```css
  /* ═══════════════════════════════════════════════════════════════
     MOBILE RESPONSIVE LAYER  ·  max-width: 768px
     All rules here are additive. Desktop layout is unchanged above 768px.
  ════════════════════════════════════════════════════════════════ */
  @media (max-width: 768px) {

    /* ── Hide desktop nav, show mobile header ── */
    nav { display: none !important; }

    #mobile-header {
      display: flex;
      position: sticky;
      top: 0;
      z-index: 200;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      height: 52px;
      background: var(--bg-s);
      border-bottom: 1px solid var(--bd-s);
    }

    .mob-header-title {
      font-weight: 700;
      font-size: 1rem;
      color: var(--t1);
    }

    .mob-header-btn {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: var(--t2);
      font-size: 1.2rem;
      cursor: pointer;
      border-radius: 8px;
    }

    /* ── Bottom tab bar ── */
    #mobile-bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 300;
      background: var(--bg-s);
      border-top: 1px solid var(--bd-s);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .mob-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-height: 52px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--t3);
      padding: 4px 2px;
    }

    .mob-tab.active { color: var(--gold); }
    .mob-tab-icon { font-size: 1.2rem; line-height: 1; }
    .mob-tab-label { font-size: 0.6rem; }

    /* Extra bottom padding on all pages so content isn't hidden by the tab bar */
    .page { padding-bottom: 64px !important; }

    /* ── Backdrop (drawer + detail sheet) ── */
    #mob-sheet-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 400;
    }

    #mob-sheet-backdrop.open { display: block; }

    /* ── Slide-in drawer ── */
    #mobile-drawer {
      position: fixed;
      top: 0;
      right: -100%;
      width: min(300px, 85vw);
      height: 100%;
      background: var(--bg-s);
      border-left: 1px solid var(--bd-s);
      z-index: 500;
      display: flex;
      flex-direction: column;
      transition: right 0.25s ease;
      overflow-y: auto;
    }

    #mobile-drawer.open { right: 0; }

    .mob-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px 0 16px;
      height: 52px;
      border-bottom: 1px solid var(--bd-s);
      flex-shrink: 0;
    }

    .mob-drawer-title { font-weight: 700; color: var(--t1); }

    .mob-drawer-close {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: var(--t3);
      font-size: 1.1rem;
      cursor: pointer;
      border-radius: 8px;
    }

    .mob-drawer-section {
      padding: 14px 16px 4px;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--t3);
    }

    .mob-drawer-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 0 16px;
      min-height: 48px;
      background: none;
      border: none;
      color: var(--t2);
      font-size: 0.9rem;
      cursor: pointer;
      border-radius: 0;
      line-height: 48px;
    }

    .mob-drawer-item:active { background: var(--bg-un); }

    #mob-drawer-worlds {
      padding: 8px 16px 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .mob-world-chip {
      background: var(--bg-un);
      border: 1px solid var(--bd-s);
      border-radius: 16px;
      padding: 0 12px;
      min-height: 36px;
      font-size: 0.82rem;
      color: var(--t2);
      cursor: pointer;
    }

    .mob-world-chip.active {
      border-color: var(--gold);
      color: var(--gold);
    }

    .mob-drawer-footer {
      margin-top: auto;
      border-top: 1px solid var(--bd-s);
      padding: 6px 0;
    }

  } /* end @media (max-width: 768px) */
  ```

- [ ] **Step 2: Verify in browser at 375px**

  Reload at 375px. You should see:
  - Desktop nav bar is gone
  - A slim header row at top with "⚔️ Pardur" and ☰
  - A bottom bar with 5 tab buttons
  - No visual regressions at 1024px+ (switch device toolbar off to check)

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/index.html backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): add mobile header, bottom tab bar, and drawer HTML+CSS"
  ```

---

## Task 3: Mobile navigation — JS behavior

**Files:**
- Modify: `backend/src/main/resources/static/js/core.js`

- [ ] **Step 1: Add `openDrawer()` and `closeDrawer()`**

  In `core.js`, find the block of utility functions near `doLogout()`. Add these two functions after `doLogout()`:

  ```javascript
  /**
   * Opens the mobile slide-in drawer and updates user info display.
   */
  function openDrawer() {
    console.debug('[openDrawer] →');
    document.getElementById('mobile-drawer').classList.add('open');
    const backdrop = document.getElementById('mob-sheet-backdrop');
    backdrop.classList.add('open');
    backdrop.onclick = closeDrawer;
    const userBtn = document.getElementById('mob-drawer-user-btn');
    if (userBtn && state.auth.username) {
      userBtn.textContent = `👤 ${state.auth.username} · Abmelden`;
    }
    console.debug('[openDrawer] ← done');
  }

  /**
   * Closes the mobile slide-in drawer.
   */
  function closeDrawer() {
    console.debug('[closeDrawer] →');
    document.getElementById('mobile-drawer').classList.remove('open');
    document.getElementById('mob-sheet-backdrop').classList.remove('open');
    console.debug('[closeDrawer] ← done');
  }

  /**
   * Dismisses the desktop-preferred notice for a page, revealing its full content.
   * @param {string} pageId - The page id suffix (e.g. 'map', 'ideas', 'wiki')
   */
  function mobOverridePage(pageId) {
    console.debug('[mobOverridePage] →', pageId);
    const el = document.getElementById('page-' + pageId);
    if (el) el.classList.add('mob-override');
    console.debug('[mobOverridePage] ← done');
  }
  ```

- [ ] **Step 2: Update `showPage()` to sync the bottom tab bar**

  In `core.js`, find the `showPage(p)` function. After the line that removes `.active` from all `.nav-link` elements and adds it back to the matching `nav-{p}` element, add the following block (inside the same function, right after the existing active-link logic):

  ```javascript
  // Sync mobile bottom tab bar
  document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'));
  const mobTab = document.querySelector(`#mobile-bottom-nav [data-page="${p}"]`);
  if (mobTab) mobTab.classList.add('active');
  ```

- [ ] **Step 3: Update `renderTopNavWorlds()` to also populate the drawer world chips**

  In `core.js`, find `renderTopNavWorlds()`. At the end of the function body (after it finishes writing to `#nav-links`), add:

  ```javascript
  // Populate mobile drawer world chips
  const mobWorldsEl = document.getElementById('mob-drawer-worlds');
  if (mobWorldsEl) {
    mobWorldsEl.innerHTML = '';
    (state.worlds || []).forEach(w => {
      const chip = document.createElement('button');
      chip.className = 'mob-world-chip' + (w.id === state.ui.activeWorldId ? ' active' : '');
      chip.textContent = w.name;
      chip.onclick = () => { selectWorld(w.id); closeDrawer(); };
      mobWorldsEl.appendChild(chip);
    });
  }
  ```

- [ ] **Step 4: Verify in browser at 375px**

  - Tap ☰ → drawer slides in from the right, backdrop darkens
  - Tap backdrop or ✕ → drawer closes
  - Tap a bottom tab → page changes, that tab highlights in gold
  - Switch DevTools off → desktop nav reappears, bottom bar/drawer are hidden

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/resources/static/js/core.js
  git commit -m "feat(mobile): wire drawer open/close and bottom tab active state"
  ```

---

## Task 4: Timeline — mobile layout CSS

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add timeline layout rules inside the existing `@media (max-width: 768px)` block**

  Open `app.css`. Find the line `} /* end @media (max-width: 768px) */` at the bottom. Insert the following rules **before** that closing `}`:

  ```css
  /* ── Timeline layout ── */

  /* Collapse the 3-column grid to a single block */
  #page-timeline.active {
    display: block !important;
  }

  /* Hide both sidebars; their content is surfaced via mobile UI below */
  #page-timeline .sidebar-left,
  #page-timeline .sidebar-right {
    display: none !important;
  }

  /* Adjust center column padding for mobile */
  #page-timeline .tl-center {
    padding: 12px 12px 80px !important;
  }

  /* Mobile filter chip row (new element added in Task 5) */
  #mob-tl-filter-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 10px;
    margin-bottom: 4px;
  }

  #mob-tl-filter-row::-webkit-scrollbar { display: none; }

  .mob-tl-chip {
    flex-shrink: 0;
    background: var(--bg-un);
    border: 1px solid var(--bd-s);
    border-radius: 16px;
    padding: 0 12px;
    min-height: 36px;
    font-size: 0.8rem;
    color: var(--t2);
    cursor: pointer;
    white-space: nowrap;
  }

  .mob-tl-chip.active {
    border-color: var(--gold);
    color: var(--gold);
  }

  /* Mobile undated events toggle chip */
  #mob-undated-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-un);
    border: 1px solid var(--bd-s);
    border-radius: 8px;
    padding: 0 12px;
    min-height: 40px;
    font-size: 0.82rem;
    color: var(--t2);
    cursor: pointer;
    width: 100%;
    margin-bottom: 8px;
  }

  #mob-undated-section {
    margin-bottom: 12px;
    border: 1px solid var(--bd-s);
    border-radius: 8px;
    overflow: hidden;
  }
  ```

- [ ] **Step 2: Verify in browser at 375px**

  Navigate to the Timeline page. You should see:
  - No left or right sidebars — only the event list fills the screen
  - No horizontal overflow
  - At 1024px+: the 3-column layout is exactly as before

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): collapse timeline 3-column grid on mobile"
  ```

---

## Task 5: Timeline — filter chips and undated chip

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/js/timeline.js`

- [ ] **Step 1: Add mobile filter row and undated chip HTML inside `.tl-center`**

  In `index.html`, find `<div class="tl-center">` (inside `#page-timeline`). Add these two elements as the **first children** of `.tl-center`, before whatever is currently the first child:

  ```html
  <!-- Mobile-only: type filter chips -->
  <div id="mob-tl-filter-row"></div>
  <!-- Mobile-only: undated events toggle -->
  <button id="mob-undated-chip" style="display:none" onclick="toggleMobUndated()">
    📅 Undatiert (<span id="mob-undated-count">0</span>)
  </button>
  <div id="mob-undated-section" style="display:none">
    <div id="mob-undated-list"></div>
  </div>
  ```

- [ ] **Step 2: Add `renderMobTlFilters()` to `timeline.js`**

  In `timeline.js`, find the `renderTimeline()` function. Before its closing `}`, add a call to `renderMobTlFilters()`. Then add the function itself anywhere in `timeline.js` (after `renderTimeline()` is fine):

  Inside `renderTimeline()`, before the closing `}`, add:
  ```javascript
  renderMobTlFilters();
  ```

  Then add the new function:

  ```javascript
  /**
   * Renders horizontally-scrollable type-filter chips in the mobile filter row.
   * Reads: state.ui.activeTypes, state.events (to derive distinct types present)
   * Writes: #mob-tl-filter-row
   */
  function renderMobTlFilters() {
    console.debug('[renderMobTlFilters] →');
    const row = document.getElementById('mob-tl-filter-row');
    if (!row) return;
    // Collect distinct event types from loaded events
    const allTypes = [...new Set((state.events || []).map(e => e.type).filter(Boolean))].sort();
    row.innerHTML = '';
    // "All" chip
    const allChip = document.createElement('button');
    allChip.className = 'mob-tl-chip' + (state.ui.activeTypes.size === 0 ? ' active' : '');
    allChip.textContent = 'Alle';
    allChip.onclick = () => {
      state.ui.activeTypes.clear();
      renderTimeline();
    };
    row.appendChild(allChip);
    // One chip per type
    allTypes.forEach(type => {
      const chip = document.createElement('button');
      chip.className = 'mob-tl-chip' + (state.ui.activeTypes.has(type) ? ' active' : '');
      chip.textContent = type;
      chip.onclick = () => {
        if (state.ui.activeTypes.has(type)) {
          state.ui.activeTypes.delete(type);
        } else {
          state.ui.activeTypes.add(type);
        }
        renderTimeline();
      };
      row.appendChild(chip);
    });
    console.debug('[renderMobTlFilters] ← types:', allTypes.length);
  }
  ```

- [ ] **Step 3: Add `toggleMobUndated()` and update `renderUndated()` to sync the mobile chip**

  In `timeline.js`, find `renderUndated()`. At the end of the function, add:

  ```javascript
  // Sync mobile undated chip count and visibility
  const mobChip = document.getElementById('mob-undated-chip');
  const mobList = document.getElementById('mob-undated-list');
  const mobCount = document.getElementById('mob-undated-count');
  if (mobChip) {
    const count = (state.undated || []).length;
    mobChip.style.display = count > 0 ? 'flex' : 'none';
    if (mobCount) mobCount.textContent = count;
  }
  if (mobList) {
    // Reuse the same HTML that renderUndated() builds for #undated-list
    mobList.innerHTML = document.getElementById('undated-list')
      ? document.getElementById('undated-list').innerHTML
      : '';
  }
  ```

  Then add the toggle function:

  ```javascript
  /**
   * Toggles the mobile undated-events section open/closed.
   */
  function toggleMobUndated() {
    console.debug('[toggleMobUndated] →');
    const section = document.getElementById('mob-undated-section');
    if (!section) return;
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    console.debug('[toggleMobUndated] ←', isOpen ? 'closed' : 'opened');
  }
  ```

- [ ] **Step 4: Verify in browser at 375px**

  - Timeline shows a horizontal row of type-filter chips at the top ("Alle", then one per event type)
  - Tapping a chip filters the event list
  - If undated events exist, the "📅 Undatiert (N)" chip appears; tapping it expands the list inline
  - At 1024px+: these elements are not visible (they have `display:none` default style on `#mob-undated-chip` and `#mob-undated-section`; `#mob-tl-filter-row` is empty on desktop because Task 4 CSS only applies at ≤768px)

  > **Note:** `#mob-tl-filter-row` is always in the DOM but only styled as a flex row inside the media query. On desktop it renders as an empty block with no height — harmless.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/resources/static/index.html backend/src/main/resources/static/js/timeline.js
  git commit -m "feat(mobile): timeline filter chips and undated events chip"
  ```

---

## Task 6: Timeline — detail bottom sheet

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`
- Modify: `backend/src/main/resources/static/js/timeline.js`

- [ ] **Step 1: Read how `#detail-panel` is currently shown/hidden**

  In `timeline.js`, search for `detail-panel` to find the exact open/close logic. Note the function that populates the panel content (it likely sets `innerHTML` or fills named fields). You will wrap this in Task 6 Step 3.

- [ ] **Step 2: Add bottom sheet CSS for `#detail-panel` inside the media query**

  In `app.css`, inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Timeline detail panel → bottom sheet on mobile ── */
  #detail-panel {
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-height: 65vh !important;
    border-radius: 16px 16px 0 0 !important;
    border-left: none !important;
    border-top: 1px solid var(--bd-s) !important;
    overflow-y: auto !important;
    /* Slide-up animation: hidden below screen by default */
    transform: translateY(100%);
    transition: transform 0.28s ease;
    /* Must be visible in DOM for transform to work — display:block always on mobile */
    display: block !important;
  }

  /* When .open is added, slide into view */
  #detail-panel.open {
    transform: translateY(0);
  }

  /* Drag handle pill at top of sheet */
  #detail-panel::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    background: var(--bd-s);
    border-radius: 2px;
    margin: 10px auto 0;
  }
  ```

- [ ] **Step 3: Add `openDetailSheet()` and `closeDetailSheet()` to `timeline.js`**

  In `timeline.js`, find the existing `openDetailPanel()` function (which adds `.open` to `#detail-panel`). Add these two new functions after it:

  ```javascript
  /**
   * Opens the detail panel as a bottom sheet on mobile, or normally on desktop.
   * Populates the panel with the given event then activates the backdrop.
   * @param {number|string} eventId - ID of the event to display
   */
  function openDetailSheet(eventId) {
    console.debug('[openDetailSheet] →', eventId);
    // Reuse the existing open logic (populates + adds .open class)
    openDetailPanel(eventId);
    // On mobile: also show the backdrop and wire its click to close
    if (window.innerWidth <= 768) {
      const backdrop = document.getElementById('mob-sheet-backdrop');
      if (backdrop) {
        backdrop.classList.add('open');
        backdrop.onclick = closeDetailSheet;
      }
    }
    console.debug('[openDetailSheet] ← done');
  }

  /**
   * Closes the detail bottom sheet and hides the backdrop.
   */
  function closeDetailSheet() {
    console.debug('[closeDetailSheet] →');
    closeDetail();
    const backdrop = document.getElementById('mob-sheet-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.onclick = null;
    }
    console.debug('[closeDetailSheet] ← done');
  }
  ```

  > **Note:** `openDetailPanel(eventId)` is the existing function. If it does not take an `eventId` parameter and instead reads from state, check the surrounding code — you may need to set the relevant state field before calling it. Read the function body before implementing.

- [ ] **Step 4: Wire event card clicks to `openDetailSheet()`**

  In `timeline.js`, find where individual event cards/items get their `onclick` handler (inside `renderTimeline()`). Change any direct call to `openDetailPanel()` in that click handler to call `openDetailSheet(event.id)` instead. Example — if you see:

  ```javascript
  el.onclick = () => openDetailPanel();  // existing
  ```

  Change to:

  ```javascript
  el.onclick = () => openDetailSheet(event.id);  // updated
  ```

- [ ] **Step 5: Verify in browser at 375px**

  - Tap a timeline event card → the detail panel slides up from the bottom
  - Tap the dark backdrop → panel slides back down
  - At 1024px+: clicking an event opens the fixed right-side detail panel exactly as before

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/resources/static/css/app.css backend/src/main/resources/static/js/timeline.js
  git commit -m "feat(mobile): timeline detail panel as bottom sheet"
  ```

---

## Task 7: Timeline — FAB for new event

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add FAB HTML inside `#page-timeline`**

  In `index.html`, inside `#page-timeline`, add the FAB as the **last child** of the page div (after the sidebars and center column):

  ```html
  <!-- Mobile FAB: create new timeline event -->
  <button class="mob-fab" id="tl-fab" onclick="openTLModal(null)" aria-label="Neues Ereignis">+</button>
  ```

- [ ] **Step 2: Add FAB CSS inside the media query in `app.css`**

  Inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Floating Action Button (FAB) ── */
  .mob-fab {
    position: fixed;
    bottom: 72px; /* above bottom nav bar */
    right: 16px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--gold);
    color: #000;
    font-size: 1.6rem;
    line-height: 1;
    border: none;
    cursor: pointer;
    z-index: 250;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  /* FABs are hidden on desktop (default display:none overridden in media query) */
  ```

  Also add a default `display:none` for `.mob-fab` **outside** the media query (in the main CSS section, or just above the `@media` block) so FABs don't appear on desktop:

  Find the start of the `@media (max-width: 768px)` block and add just before it:

  ```css
  /* Mobile-only elements: hidden on desktop */
  #mobile-header,
  #mobile-bottom-nav,
  #mobile-drawer,
  #mob-sheet-backdrop,
  .mob-fab,
  #mob-tl-filter-row,
  #mob-undated-chip,
  #mob-undated-section,
  .desktop-notice { display: none; }
  ```

- [ ] **Step 3: Verify in browser at 375px**

  - A gold circular `+` button floats above the bottom nav bar on the Timeline page
  - Tapping it opens the new-event modal (which slides up as a bottom sheet after Task 10)
  - At 1024px+: the FAB is not visible

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/main/resources/static/index.html backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): timeline FAB for new event"
  ```

---

## Task 8: Items — mobile layout CSS

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add items page mobile rules inside the media query**

  Inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Items page layout ── */

  /* Stack the 4-column toolbar to a single column */
  #page-items .toolbar {
    grid-template-columns: 1fr !important;
    gap: 8px !important;
  }

  /* Full-width search input, minimum 48px tall */
  #page-items .toolbar input,
  #page-items .toolbar select {
    width: 100%;
    min-height: 48px;
    font-size: 0.9rem;
  }

  /* Reshape the items table into stacked cards */
  #page-items table.it thead {
    display: none; /* hide column headers */
  }

  #page-items table.it,
  #page-items table.it tbody,
  #page-items table.it tr {
    display: block;
    width: 100%;
  }

  #page-items table.it tr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-un);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 6px;
    border: 1px solid var(--bd-s);
    gap: 8px;
  }

  #page-items table.it td {
    display: inline;
    border: none;
    padding: 0;
    font-size: 0.85rem;
  }

  /* Name cell: takes remaining space, bold */
  #page-items table.it td:first-child {
    flex: 1;
    font-weight: 600;
    color: var(--t1);
    display: block;
  }

  /* Price cell: right-aligned, accent color */
  #page-items table.it td.col-price {
    color: var(--gold);
    font-weight: 700;
    white-space: nowrap;
  }

  /* Action buttons: always visible on mobile (no hover needed) */
  #page-items .act-btns {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  ```

- [ ] **Step 2: Verify in browser at 375px**

  - Items toolbar stacks vertically: search input full-width, then dropdowns full-width
  - Items table renders as a list of cards (name + price + action buttons per row)
  - No horizontal scroll
  - At 1024px+: the multi-column toolbar and table are unchanged

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): items table → card layout and stacked toolbar"
  ```

---

## Task 9: Items — FAB for add item

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add FAB HTML inside `#page-items`**

  In `index.html`, inside `#page-items`, add the FAB as the last child:

  ```html
  <!-- Mobile FAB: add item (admin only, visibility controlled by applyAuthUI) -->
  <button class="mob-fab admin-only" id="items-fab" onclick="openAddModal()" aria-label="Item hinzufügen">+</button>
  ```

  > The `admin-only` class is already handled by the existing `applyAuthUI()` function in `core.js` — it hides this button for non-admin users automatically.

- [ ] **Step 2: Verify in browser at 375px (logged in as admin)**

  - A gold `+` FAB appears on the Items page
  - Tapping it opens the add-item modal
  - Log in as a non-admin user: the FAB is not visible
  - At 1024px+: the FAB is hidden

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/index.html
  git commit -m "feat(mobile): items FAB for add item (admin only)"
  ```

---

## Task 10: Modals and forms — mobile CSS

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add modal sheet and form rules inside the media query**

  Inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Modals → bottom sheet on mobile ── */

  /* The modal dialog itself slides up from the bottom */
  .modal-bg.open > .modal {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    transform: none !important;
    width: 100% !important;
    max-width: 100% !important;
    max-height: 90vh !important;
    border-radius: 16px 16px 0 0 !important;
    overflow-y: auto !important;
    margin: 0 !important;
  }

  /* The overlay is full-screen as before — no change needed */

  /* Drag handle pill */
  .modal-bg.open > .modal::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    background: var(--bd-s);
    border-radius: 2px;
    margin: 10px auto 4px;
  }

  /* Close button: larger tap target */
  .m-close {
    width: 44px !important;
    height: 44px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Form grids: single column */
  .f-grid {
    grid-template-columns: 1fr !important;
  }

  /* All form inputs: minimum 48px tall */
  .f-grp input,
  .f-grp select,
  .f-grp textarea {
    min-height: 48px !important;
    font-size: 0.9rem !important;
  }
  ```

- [ ] **Step 2: Verify in browser at 375px**

  - Open the new-event modal (tap FAB or a timeline entry's edit button)
  - Modal slides up from the bottom as a sheet covering ~90% of the screen
  - Form fields are single-column and 48px tall
  - Close button (✕) is large enough to tap comfortably
  - At 1024px+: modals are centered overlays exactly as before

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): modals slide up as bottom sheets, forms single-column"
  ```

---

## Task 11: Global touch targets and typography

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add global touch target rules inside the media query**

  Inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Global touch targets and typography ── */

  /* Minimum font size: nothing below 14px on mobile */
  body { font-size: max(0.875rem, 14px) !important; }

  /* Generic icon/action buttons: ensure 44×44px tap target */
  button, [role="button"] {
    min-height: 36px;
    min-width: 36px;
  }

  /* Collapse/toggle buttons that are currently 22–28px */
  .collapse-btn,
  .icon-btn,
  [class*="close"],
  [class*="btn-icon"] {
    min-width: 44px !important;
    min-height: 44px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Filter/tag chips: minimum 36px height */
  .tag-chip,
  .type-chip,
  .filter-chip,
  .chip {
    min-height: 36px !important;
    padding: 0 12px !important;
    display: inline-flex !important;
    align-items: center !important;
  }

  /* Checkboxes in forms: larger */
  input[type="checkbox"] {
    width: 20px !important;
    height: 20px !important;
    cursor: pointer;
  }

  /* Inputs and selects everywhere */
  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea {
    min-height: 44px;
  }
  ```

  > **Note:** Some of these selectors (`.tag-chip`, `.collapse-btn`, etc.) may not match existing class names exactly. After applying, check the items page and timeline filters in DevTools to confirm the chip heights. Adjust selectors to match actual class names if needed — search `app.css` for the actual class names used for filter chips and small buttons.

- [ ] **Step 2: Verify in browser at 375px**

  Use Chrome DevTools → inspect individual buttons and chips. Check their computed height via the box model view. Most interactive elements should be ≥ 36px tall.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): global touch target and typography minimums"
  ```

---

## Task 12: Desktop-preferred notices — Map and Ideas

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add desktop-preferred notice HTML inside `#page-map`**

  In `index.html`, inside `#page-map`, add the notice as the **first child**:

  ```html
  <!-- Mobile: desktop-preferred notice -->
  <div class="desktop-notice" data-page="map">
    <div class="desktop-notice-icon">🗺️</div>
    <h3 class="desktop-notice-title">Desktop empfohlen</h3>
    <p class="desktop-notice-msg">Die interaktive Karte benötigt mehr Platz und Maus-Steuerung. Drehe das Gerät ins Querformat oder öffne die App auf einem größeren Bildschirm.</p>
    <div class="desktop-notice-actions">
      <button class="desktop-notice-btn" onclick="screen.orientation.lock('landscape').catch(()=>{})">↻ Querformat</button>
      <button class="desktop-notice-btn desktop-notice-btn--primary" onclick="mobOverridePage('map')">Trotzdem öffnen</button>
    </div>
  </div>
  ```

- [ ] **Step 2: Add the same for `#page-ideas`**

  In `index.html`, inside `#page-ideas`, add as the **first child**:

  ```html
  <!-- Mobile: desktop-preferred notice -->
  <div class="desktop-notice" data-page="ideas">
    <div class="desktop-notice-icon">💡</div>
    <h3 class="desktop-notice-title">Desktop empfohlen</h3>
    <p class="desktop-notice-msg">Das Ideen-Board nutzt Drag &amp; Drop, das auf Touch-Geräten nicht unterstützt wird.</p>
    <div class="desktop-notice-actions">
      <button class="desktop-notice-btn desktop-notice-btn--primary" onclick="mobOverridePage('ideas')">Trotzdem öffnen</button>
    </div>
  </div>
  ```

- [ ] **Step 3: Add notice CSS inside the media query**

  Inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Desktop-preferred notices ── */

  /* Show notice, hide page content (all direct children except the notice) */
  .desktop-notice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 24px;
    gap: 12px;
    min-height: 50vh;
  }

  /* Hide all other content inside a page that has a notice (not overridden) */
  #page-map > *:not(.desktop-notice),
  #page-ideas > *:not(.desktop-notice) {
    display: none !important;
  }

  /* When user taps "open anyway": show everything, hide notice */
  #page-map.mob-override > *:not(.desktop-notice) { display: block !important; }
  #page-map.mob-override > .desktop-notice { display: none !important; }
  #page-ideas.mob-override > *:not(.desktop-notice) { display: block !important; }
  #page-ideas.mob-override > .desktop-notice { display: none !important; }

  .desktop-notice-icon { font-size: 3rem; line-height: 1; opacity: 0.7; }
  .desktop-notice-title { font-size: 1rem; color: var(--t1); margin: 0; }
  .desktop-notice-msg { font-size: 0.85rem; color: var(--t3); line-height: 1.6; max-width: 280px; }
  .desktop-notice-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }

  .desktop-notice-btn {
    background: var(--bg-un);
    border: 1px solid var(--bd-s);
    border-radius: 8px;
    padding: 0 16px;
    min-height: 44px;
    font-size: 0.85rem;
    color: var(--t2);
    cursor: pointer;
  }

  .desktop-notice-btn--primary {
    border-color: var(--gold);
    color: var(--gold);
  }
  ```

- [ ] **Step 4: Verify in browser at 375px**

  - Navigate to Map → see the notice with map icon, explanation, and two buttons
  - Tap "Trotzdem öffnen" → notice disappears, map renders (even if not touch-optimized)
  - Navigate to Ideas → see the notice
  - At 1024px+: Map and Ideas render normally with no notice

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/resources/static/index.html backend/src/main/resources/static/css/app.css
  git commit -m "feat(mobile): desktop-preferred notices for Map and Ideas"
  ```

---

## Task 13: Wiki — desktop notice + mobile article list

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/css/app.css`
- Modify: `backend/src/main/resources/static/js/wiki.js`

- [ ] **Step 1: Add desktop notice and mobile article list HTML inside `#page-wiki`**

  In `index.html`, inside `#page-wiki`, add as the **first children**:

  ```html
  <!-- Mobile: desktop-preferred notice -->
  <div class="desktop-notice" data-page="wiki">
    <div class="desktop-notice-icon">📖</div>
    <h3 class="desktop-notice-title">Wiki — Desktop empfohlen</h3>
    <p class="desktop-notice-msg">Der Wiki-Graph und Artikel-Editor sind für größere Bildschirme optimiert.</p>
    <div class="desktop-notice-actions">
      <button class="desktop-notice-btn desktop-notice-btn--primary" onclick="mobOverridePage('wiki')">Trotzdem öffnen</button>
    </div>
  </div>
  <!-- Mobile: flat article list (shown below the notice without overriding) -->
  <div id="mob-wiki-list" class="mob-wiki-list"></div>
  ```

- [ ] **Step 2: Add wiki mobile CSS inside the media query**

  Inside `@media (max-width: 768px)`, before the closing `}`, add:

  ```css
  /* ── Wiki page ── */

  /* Hide wiki graph/editor; show notice and article list */
  #page-wiki > *:not(.desktop-notice):not(#mob-wiki-list) {
    display: none !important;
  }

  #page-wiki.mob-override > *:not(.desktop-notice) { display: block !important; }
  #page-wiki.mob-override > .desktop-notice { display: none !important; }
  #page-wiki.mob-override #mob-wiki-list { display: none !important; }

  /* Mobile article list */
  .mob-wiki-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px 0 80px;
  }

  .mob-wiki-entry {
    padding: 12px 16px;
    background: var(--bg-un);
    border-bottom: 1px solid var(--bd-s);
    cursor: pointer;
    min-height: 56px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
  }

  .mob-wiki-entry:active { background: var(--bg-s); }

  .mob-wiki-entry-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--t1);
  }

  .mob-wiki-entry-type {
    font-size: 0.72rem;
    color: var(--t3);
  }
  ```

- [ ] **Step 3: Add `renderWikiMobileList()` to `wiki.js`**

  In `wiki.js`, find where wiki entries are loaded into `state.wikiAllEntries` (look for where the API response is stored). After that assignment (or at the end of the load function), add a call to `renderWikiMobileList()`. Then add the function itself:

  ```javascript
  /**
   * Renders a flat, read-only article list for the mobile wiki fallback.
   * Reads: state.wikiAllEntries
   * Writes: #mob-wiki-list
   */
  function renderWikiMobileList() {
    console.debug('[renderWikiMobileList] →');
    const container = document.getElementById('mob-wiki-list');
    if (!container) return;
    const entries = state.wikiAllEntries || [];
    if (entries.length === 0) {
      container.innerHTML = '<p style="padding:16px;color:var(--t3);font-size:0.85rem">Keine Artikel vorhanden.</p>';
      console.debug('[renderWikiMobileList] ← empty');
      return;
    }
    container.innerHTML = entries
      .slice()
      .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'))
      .map(e => `
        <div class="mob-wiki-entry" onclick="openWikiEntry(${e.id})">
          <div class="mob-wiki-entry-title">${escHtml(e.title || 'Unbenannt')}</div>
          <div class="mob-wiki-entry-type">${escHtml(e.type || '')}</div>
        </div>
      `)
      .join('');
    console.debug('[renderWikiMobileList] ← entries:', entries.length);
  }
  ```

  > **Note:** `escHtml()` is the existing XSS-escape utility in `core.js` — do not reimplement it. `openWikiEntry(id)` is the existing function that opens a wiki article — search for it in `wiki.js` to confirm the exact name. If it is named differently, update the `onclick` accordingly.

- [ ] **Step 4: Verify in browser at 375px**

  - Navigate to Wiki → see the desktop-preferred notice + below it a scrollable alphabetical list of all articles
  - Tap an article → it opens (in whatever form the existing `openWikiEntry()` provides)
  - Tap "Trotzdem öffnen" → notice and article list disappear, full wiki graph appears
  - At 1024px+: the article list and notice are hidden, wiki renders normally

- [ ] **Step 5: Final smoke test at 375px — check all pages**

  Go through each page at 375px and confirm:
  - [ ] Desktop nav hidden, mobile header visible
  - [ ] Bottom tab bar navigates between all pages
  - [ ] Hamburger opens/closes drawer; world chips switch worlds
  - [ ] Timeline: card list, filter chips, bottom sheet detail, FAB
  - [ ] Items: card list, stacked toolbar, admin FAB
  - [ ] Map: desktop notice + "open anyway" works
  - [ ] Ideas: desktop notice + "open anyway" works
  - [ ] Wiki: notice + article list + "open anyway" works
  - [ ] All modals slide up as bottom sheets
  - [ ] No page has horizontal overflow at 375px
  - Switch device toolbar off → everything looks exactly as before on desktop

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/resources/static/index.html backend/src/main/resources/static/css/app.css backend/src/main/resources/static/js/wiki.js
  git commit -m "feat(mobile): wiki desktop notice and mobile article list"
  ```
