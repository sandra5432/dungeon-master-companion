# World Config Screen & Timeline World Tabs — Design Spec

**Date:** 2026-04-07  
**Status:** Approved

---

## Overview

Two related changes:

1. **Timeline world navigation** is redesigned from a sidebar list to a top tab bar matching the wiki pattern.
2. **World management** (create / edit / delete) is moved out of the timeline into a dedicated admin-only "Weltkonfiguration" config page, accessible via a new globe button in the nav.

No backend changes are required — all existing world API endpoints remain as-is.

---

## 1. Timeline Page Changes

### Remove
- `<h1>Aufzeichnung</h1>`, subtitle paragraph, and the decorative divider from `.tl-center`
- The entire "Welten" sidebar section: the `sb-title` with its `+` button and `#world-selector` div
- Edit/delete buttons (`world-edit-btns`) from `renderWorldSelector()` — the function is repurposed as `renderTimelineWorldTabs()`
- `openAddWorldModal()` / `openEditWorldModal()` / `openDeleteWorldConfirm()` calls that originate from the timeline sidebar

### Add
- A `<div class="wiki-world-tabs" id="tl-world-tabs"></div>` bar inserted directly above `.tl-center` content (same position as in the wiki page, below the nav)
- `renderTimelineWorldTabs()` function — renders world tabs into `#tl-world-tabs`, same markup as `renderWikiWorldTabs()`, clicking a tab calls `selectWorld(id)`
- `renderTimelineWorldTabs()` is called wherever `renderWorldSelector()` was called

### CSS
- Reuse existing `.wiki-world-tabs` and `.wiki-world-tab` styles — no new CSS needed for the tabs themselves
- The `.world-btn`, `.world-edit-btns`, `.world-edit-btn` CSS classes can be removed once the sidebar selector is gone

### Sidebar (unchanged)
Typ / Tags / Ersteller / Kompakt filters remain exactly as they are.

---

## 2. Config Page (`page-config`)

### HTML
New `<div class="page" id="page-config">` added to `index.html`, admin-only (guarded in `showPage()`).

Structure:
```
pg-hdr
  h1: "Weltkonfiguration"
  p:  "Welten anlegen, bearbeiten und löschen"
  divider

content area (max-width: 800px, centered, same as Nutzerverwaltung)
  "+ Welt hinzufügen" button (btn btn-primary, calls openAddWorldModal())
  table.it
    thead: Name | Beschreibung | Aktionen
    tbody: #config-worlds-body  (rendered dynamically)
```

Each row: world name, description (truncated if long), ✎ edit button → `openEditWorldModal(id)`, ✕ delete button → `openDeleteWorldConfirm(id)`.

### JS
- `renderConfigWorlds()` — reads `state.worlds`, populates `#config-worlds-body`
- `showPage('config')` extended to call `renderConfigWorlds()`
- After world save/delete, `renderConfigWorlds()` is called to refresh the table (alongside the existing `renderTimelineWorldTabs()` call)

### Modal reuse
- Create/edit world: reuses existing `f-world` modal form (`fw-n`, `fw-d` fields), `editSource = 'world'`
- Delete world: reuses existing `f-del` confirm flow, `editSource = 'world-del'`
- No modal changes needed

---

## 3. Nav Changes

### Add
- Globe button (`🌐`) in `.nav-right`, before the ⚙ gear button
- `class="btn btn-sm admin-only"`, `id="btn-config"`, `onclick="showPage('config')"`, `title="Weltkonfiguration"`
- Hidden by default (`style="display:none"`), shown by `applyAuthUI()` via `admin-only` class

### Unchanged
- ⚙ gear button (`btn-gear`) continues to link to `showPage('users')` / Nutzerverwaltung

---

## 4. Guard: Admin-Only Config Page

In `showPage(p)`:
```js
if (p === 'config') {
  if (!state.auth.isAdmin) return; // non-admins cannot navigate here
  renderConfigWorlds();
}
```

---

## 5. Affected Files

| File | Changes |
|------|---------|
| `index.html` | Add `page-config` div; add globe nav button; remove world sidebar section; add `tl-world-tabs` div; remove title/subtitle from timeline |
| `js/app.js` | Add `renderTimelineWorldTabs()`; add `renderConfigWorlds()`; update `showPage()`; replace `renderWorldSelector()` calls; update post-save/delete world callbacks |
| `css/app.css` | Remove `.world-btn`, `.world-edit-btns`, `.world-edit-btn` blocks (now unused) |

---

## 6. Out of Scope

- No backend changes
- No changes to world API, controller, service, or DTOs
- No changes to wiki world tabs
- No changes to Marktplatz or Nutzerverwaltung pages
