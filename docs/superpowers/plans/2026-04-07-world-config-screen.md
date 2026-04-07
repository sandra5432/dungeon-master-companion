# World Config Screen & Timeline World Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the timeline's sidebar world selector with wiki-style top tabs, and move world management (create/edit/delete) to a new admin-only "Weltkonfiguration" config page with a globe nav button.

**Architecture:** Pure frontend change — three files touched (`index.html`, `app.js`, `app.css`). No backend changes. World CRUD modal logic is reused unchanged; only the trigger points and refresh callbacks move. The new `renderTimelineWorldTabs()` function is a direct analogue of the existing `renderWikiWorldTabs()`.

**Tech Stack:** Vanilla JS, HTML, CSS — no framework, no build step. Spring Boot serves static files from `src/main/resources/static/`.

---

## Files Modified

| File | What changes |
|------|-------------|
| `backend/src/main/resources/static/index.html` | Remove world sidebar section + page title block from timeline; add `tl-world-tabs` div; add `page-config` div; add globe nav button |
| `backend/src/main/resources/static/js/app.js` | Add `renderTimelineWorldTabs()`; add `renderConfigWorlds()`; replace all `renderWorldSelector()` calls; extend `showPage()` with config guard; update post-save/delete world callbacks |
| `backend/src/main/resources/static/css/app.css` | Remove `.world-btn`, `.world-edit-btns`, `.world-edit-btn` blocks (now unused) |

---

## Task 1: HTML — Timeline sidebar and header cleanup

**Files:**
- Modify: `backend/src/main/resources/static/index.html:46-66` (timeline aside) and `:69-76` (tl-center header)

- [ ] **Step 1: Remove the world selector from the timeline sidebar**

In `index.html`, find and delete these two lines inside `<aside class="sidebar sidebar-left">`:
```html
    <div class="sb-title">Welten <button class="admin-only" onclick="openAddWorldModal()" style="display:none">+</button></div>
    <div id="world-selector" style="margin-bottom:16px"></div>
```

- [ ] **Step 2: Remove the page header (title + subtitle + divider) from the timeline center**

In `index.html`, find and delete this block inside `<div class="tl-center">`:
```html
    <div class="page-hdr">
      <h1 id="page-title">Aufzeichnung</h1>
      <p>Ereignisse der bekannten Welt</p>
      <div class="divider"><div class="dline"></div><div class="ddiamond"></div><div class="dline"></div></div>
    </div>
```

- [ ] **Step 3: Add the world tabs bar above the timeline center**

Inside `<div class="page" id="page-timeline">`, add this line directly before `<div class="tl-center">`:
```html
  <div class="wiki-world-tabs" id="tl-world-tabs"></div>
```

The result should look like:
```html
<div class="page" id="page-timeline">
  <aside class="sidebar sidebar-left">
    ...type/tag/creator/compact filters, no world section...
  </aside>

  <div class="wiki-world-tabs" id="tl-world-tabs"></div>

  <div class="tl-center">
    <p class="tl-hint user-action-only" id="tl-hint" style="display:none">Seil anklicken um ein Ereignis einzutragen</p>
    <div class="timeline" id="timeline"></div>
  </div>
  ...
</div>
```

- [ ] **Step 4: Verify visually**

Open the app in the browser, navigate to Chronik. Confirm:
- No "Aufzeichnung" heading or subtitle visible
- No "Welten" section in left sidebar
- A blank tab bar area appears above the timeline (will be populated by JS in Task 2)

---

## Task 2: JS — renderTimelineWorldTabs() + replace renderWorldSelector() calls

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add renderTimelineWorldTabs() directly after the existing renderWorldSelector() function**

Find this line in `app.js` (around line 164):
```js
}

async function selectWorld(worldId) {
```

Insert the new function between them:
```js
function renderTimelineWorldTabs() {
  const el = document.getElementById('tl-world-tabs');
  if (!el) return;
  el.innerHTML = state.worlds.map(w => {
    const active = w.id === state.ui.activeWorldId ? ' active' : '';
    return `<button class="wiki-world-tab${active}" onclick="selectWorld(${w.id})">${escHtml(w.name)}</button>`;
  }).join('');
}

async function selectWorld(worldId) {
```

- [ ] **Step 2: In selectWorld(), replace renderWorldSelector() with renderTimelineWorldTabs()**

Find (around line 186):
```js
  renderTimeline();
  renderWorldSelector();
}
```

Replace with:
```js
  renderTimeline();
  renderTimelineWorldTabs();
}
```

- [ ] **Step 3: In init() success path, replace renderWorldSelector()**

Find (around line 1300):
```js
    renderWorldSelector();
    renderTimeline();
    renderItems();
```

Replace with:
```js
    renderTimelineWorldTabs();
    renderTimeline();
    renderItems();
```

- [ ] **Step 4: In init() catch path, replace renderWorldSelector()**

Find (around line 1310):
```js
    renderWorldSelector();
    renderTimeline();
    renderItems();
```

Replace with:
```js
    renderTimelineWorldTabs();
    renderTimeline();
    renderItems();
```

- [ ] **Step 5: Verify in browser**

Reload the app. Navigate to Chronik. World tabs should appear in the header bar matching the wiki style (gold active tab, grey inactive tabs). Clicking a tab switches the world.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/static/index.html backend/src/main/resources/static/js/app.js
git commit -m "feat: replace timeline world sidebar with wiki-style top tabs"
```

---

## Task 3: HTML — Add config page and globe nav button

**Files:**
- Modify: `backend/src/main/resources/static/index.html`

- [ ] **Step 1: Add the globe nav button**

In `index.html`, find the nav-right div:
```html
    <button class="btn btn-sm admin-only" id="btn-gear" onclick="showPage('users')" style="display:none" title="Nutzerverwaltung">⚙</button>
```

Add the globe button directly before it:
```html
    <button class="btn btn-sm admin-only" id="btn-config" onclick="showPage('config')" style="display:none" title="Weltkonfiguration">🌐</button>
    <button class="btn btn-sm admin-only" id="btn-gear" onclick="showPage('users')" style="display:none" title="Nutzerverwaltung">⚙</button>
```

- [ ] **Step 2: Add the config page div**

After the closing `</div>` of `page-users` (around line 218), add:
```html
<!-- ══ CONFIG PAGE ══ -->
<div class="page" id="page-config">
  <div class="pg-hdr">
    <h1>Weltkonfiguration</h1>
    <p>Welten anlegen, bearbeiten und löschen</p>
    <div class="divider" style="margin:10px auto 0"><div class="dline"></div><div class="ddiamond"></div><div class="dline"></div></div>
  </div>
  <div style="max-width:800px;margin:0 auto;padding:0 16px">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" onclick="openAddWorldModal()">+ Welt hinzufügen</button>
    </div>
    <table class="it" id="config-worlds-table">
      <thead><tr>
        <th>Name</th>
        <th>Beschreibung</th>
        <th>Aktionen</th>
      </tr></thead>
      <tbody id="config-worlds-body"></tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 3: Verify HTML structure**

Open the browser, verify the 🌐 button appears in the nav for admin users (hidden for non-admins). Clicking it should show a blank config page (table populated by JS in Task 4).

---

## Task 4: JS — renderConfigWorlds(), showPage() guard, post-save callbacks

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add renderConfigWorlds() near renderTimelineWorldTabs()**

After `renderTimelineWorldTabs()`, add:
```js
function renderConfigWorlds() {
  const el = document.getElementById('config-worlds-body');
  if (!el) return;
  if (!state.worlds.length) {
    el.innerHTML = '<tr><td colspan="3" style="text-align:center;font-style:italic;color:var(--t3);padding:16px">Keine Welten vorhanden</td></tr>';
    return;
  }
  el.innerHTML = state.worlds.map(w => `
    <tr>
      <td>${escHtml(w.name)}</td>
      <td>${escHtml(w.description || '—')}</td>
      <td style="white-space:nowrap">
        <button class="act-btn" onclick="openEditWorldModal(${w.id},event)" title="Bearbeiten">✎</button>
        <button class="act-btn del" onclick="openDeleteWorldConfirm(${w.id},event)" title="Löschen">✕</button>
      </td>
    </tr>
  `).join('');
}
```

- [ ] **Step 2: Extend showPage() with config case and admin guard**

Find `showPage()` (around line 103):
```js
function showPage(p) {
  state.ui.currentPage = p;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  const pageEl = document.getElementById('page-' + p);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.getElementById('nav-' + p);
  if (navEl) navEl.classList.add('active');
  if (p !== 'timeline') closeDetail();
  if (p === 'items') renderItems();
  if (p === 'users') renderUsers();
  if (p === 'wiki') initWikiPage();
}
```

Replace with:
```js
function showPage(p) {
  if (p === 'config' && !state.auth.isAdmin) return;
  state.ui.currentPage = p;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  const pageEl = document.getElementById('page-' + p);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.getElementById('nav-' + p);
  if (navEl) navEl.classList.add('active');
  if (p !== 'timeline') closeDetail();
  if (p === 'items') renderItems();
  if (p === 'users') renderUsers();
  if (p === 'wiki') initWikiPage();
  if (p === 'config') renderConfigWorlds();
}
```

- [ ] **Step 3: Update world create/edit callback to refresh both tabs and config table**

Find the world create/edit save block (around line 967):
```js
      closeModal();
      renderWorldSelector();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }
```

Replace with:
```js
      closeModal();
      renderTimelineWorldTabs();
      renderConfigWorlds();
    } catch (e) { alert('Fehler: ' + e.message); }
    return;
  }
```

- [ ] **Step 4: Update world delete callback to refresh both tabs and config table**

Find the world delete block (around line 984):
```js
      closeModal();
      renderWorldSelector();
      renderTimeline();
    } catch (e) { alert('Fehler: ' + e.message); }
```

Replace with:
```js
      closeModal();
      renderTimelineWorldTabs();
      renderConfigWorlds();
      renderTimeline();
    } catch (e) { alert('Fehler: ' + e.message); }
```

- [ ] **Step 5: Verify end-to-end**

Log in as admin. Open 🌐 Weltkonfiguration. Confirm worlds table renders with name, description, ✎ and ✕ buttons. Test:
- Click ✎ → edit modal opens pre-filled → save → table and timeline tabs both update
- Click ✕ → delete confirm → confirm → world removed from table and timeline tabs
- Click "+ Welt hinzufügen" → create modal opens → save → new world appears in table and timeline tabs
- Log in as non-admin → 🌐 button not visible → navigating to `#` or calling `showPage('config')` in console does nothing

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/static/index.html backend/src/main/resources/static/js/app.js
git commit -m "feat: add Weltkonfiguration config page with world CRUD and globe nav button"
```

---

## Task 5: CSS — Remove unused world selector styles

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Remove the world selector CSS block**

Find and delete the entire `/* ── World selector ── */` section. It starts at:
```css
/* ── World selector ── */
.world-btn {
```

And ends after:
```css
.world-edit-btn.del:hover { border-color: #d97070;     color: #d97070;     }
```

The block to delete in full:
```css
/* ── World selector ── */
.world-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: var(--fs-grn);
  color: var(--t2);
  transition: background var(--transition), border-color var(--transition), color var(--transition);
  font-weight: 600;
}

.world-btn:hover {
  background: color-mix(in srgb, var(--gold) 7%, transparent);
  border-color: var(--bd);
  color: var(--t1);
}

.world-btn.active {
  background: color-mix(in srgb, var(--blue) 14%, transparent);
  border-color: color-mix(in srgb, var(--blue) 36%, transparent);
  color: var(--blue2);
}

.world-edit-btns {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.world-btn:hover .world-edit-btns { opacity: 1; }

.world-edit-btn {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: none;
  border: 1px solid transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: .82rem;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}

.world-edit-btn:hover     { border-color: var(--gold); color: var(--gold); }
.world-edit-btn.del:hover { border-color: #d97070;     color: #d97070;     }
```

- [ ] **Step 2: Verify no visual regressions**

Reload the app. Check that timeline tabs, wiki tabs, and all other UI looks correct. No broken styles should appear.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/static/css/app.css
git commit -m "style: remove unused world sidebar selector CSS"
```

---

## Self-Review

**Spec coverage:**
- ✅ Timeline: title/subtitle/divider removed (Task 1)
- ✅ Timeline: world sidebar section removed (Task 1)
- ✅ Timeline: `tl-world-tabs` bar added (Task 1)
- ✅ `renderTimelineWorldTabs()` added, reuses `wiki-world-tab` CSS (Task 2)
- ✅ All 4 `renderWorldSelector()` call sites replaced (Task 2 steps 2–4, Task 4 steps 3–4)
- ✅ Globe nav button added, admin-only (Task 3)
- ✅ `page-config` HTML with table added (Task 3)
- ✅ `renderConfigWorlds()` added (Task 4)
- ✅ `showPage('config')` guard + render call (Task 4)
- ✅ Post-save and post-delete callbacks refresh config table (Task 4)
- ✅ Old CSS removed (Task 5)

**Placeholder scan:** None found — all steps have complete code.

**Type consistency:** `renderTimelineWorldTabs()`, `renderConfigWorlds()`, `openEditWorldModal()`, `openDeleteWorldConfirm()`, `openAddWorldModal()` — consistent across all tasks. `act-btn` and `act-btn del` CSS classes exist in the codebase (used in the items table).
