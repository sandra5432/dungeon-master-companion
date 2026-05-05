# Mobile Usability Improvements — Design Spec

**Date:** 2026-05-05  
**Approach:** Option B — Mobile nav + responsive core pages  
**Breakpoint:** `@media (max-width: 768px)`  
**Effort estimate:** ~1 week  
**Backend changes:** None  
**New dependencies:** None  

---

## Overview

The Pardur app is currently desktop-only. It has a single media query in ~3,985 lines of CSS, fixed-width grid layouts, no hamburger navigation, and touch targets as small as 22px. This spec describes a responsive enhancement layer that makes the core pages (Timeline, Items) fully usable on mobile, adds proper navigation, and provides graceful fallbacks for complex pages (Map, Wiki, Ideas). The desktop experience is unchanged — all changes are scoped to `@media (max-width: 768px)`.

---

## 1. Navigation

### Current state
The top nav bar renders all page links and world buttons in a horizontal flex row. On screens narrower than ~600px it wraps or overflows. There is no touch-friendly navigation alternative.

### Mobile design
- **Top bar:** Kept visible on mobile but simplified — shows only the app title/logo and two icon buttons (search 🔍, hamburger ☰). Page name shown as subtitle when on a non-home page.
- **Bottom tab bar:** New persistent element at the bottom of the viewport containing 5 tabs: Timeline, Map, Items, Ideas, Wiki. Activated by tapping. The active tab is highlighted. CSS: `display: none` above 768px, `display: flex` below.
- **Hamburger drawer:** Full-screen slide-in overlay containing: page list (same 5 pages), world switcher (pill chips), and account actions (username + logout). Opens on hamburger tap, closes on ✕ or backdrop tap.
- **World switcher:** Moved out of the top nav into the drawer. Current world shown as active chip.

### Implementation notes
- New HTML in `index.html`: `#mobile-bottom-nav`, `#mobile-drawer`, `#mobile-drawer-backdrop`
- `core.js` `showPage()`: add ~5 lines to sync bottom tab active state when page changes
- `core.js`: add `openDrawer()` / `closeDrawer()` functions (~20 lines)
- Existing `#nav` bar: `display: none` at ≤ 768px

---

## 2. Timeline

### Current state
Three-column grid: `220px left-sidebar | 1fr content | 220px right-panel`. Both sidebars contain filters and an undated-events panel. The detail view is a fixed right panel (`width: 340px`).

### Mobile design
- **Layout:** Grid collapses to single column. Both sidebars hidden (`display: none`).
- **Filters:** Moved into a horizontally scrollable chip row at the top of the content area (same filter logic, new position).
- **Event list:** Full-width event cards, stacked vertically. Each card shows title, year, category tag, and author.
- **Event detail:** Tapping a card opens the detail as a **bottom sheet** — slides up from the bottom, covers ~60% of the screen. Swipe down or tap backdrop to close. Edit/delete buttons inside the sheet.
- **Create new event:** Floating Action Button (FAB, `+`) at bottom-right. Opens the existing event modal, which becomes a bottom sheet on mobile (slides up full-screen).
- **Undated events:** Accessible via a chip/button at the top of the list ("Undatiert (3)") that expands inline.

### Implementation notes
- `app.css`: new `@media` block overrides `.page-timeline` grid, hides `.tl-sidebar`, `.tl-right`
- `timeline.js`: add `openDetailSheet(eventId)` function — toggles CSS class `.mobile-sheet` on the existing detail panel element
- No change to data loading or rendering logic; only display layer changes

---

## 3. Items / Marketplace

### Current state
A toolbar with 4 flex columns (search, sort, filter, add button) followed by a multi-column table. On mobile the toolbar wraps awkwardly and the table forces horizontal scroll.

### Mobile design
- **Search bar:** Full-width, 48px tall, at the top.
- **Filters:** Horizontally scrollable chip row below search (attribute filter, category filter).
- **List:** Table replaced with stacked **item cards**. Each card shows: name, attribute/rarity tag, and price right-aligned.
- **Add button (admin only):** FAB at bottom-right.
- **Item detail:** Tapping a card opens a bottom sheet with full description, price, and admin edit/delete buttons.

### Implementation notes
- **Pure CSS, no JS change for items layout.** At ≤ 768px: `thead { display: none }`, each `tr` becomes a flex row (`display: flex; justify-content: space-between`), `td` elements lose their table role and render as inline blocks. This reshapes the existing table markup into cards without a second render path.
- `app.css`: `@media` block overrides `.items-toolbar` (stacks to single column) and `.items-table` (card reshaping as above)
- No change to `items.js`, API calls, or item data model

---

## 4. Modals and Forms

### Current state
Modals are centered overlays (`position: fixed; inset: 0`). Form grids use `grid-template-columns: 1fr 1fr` in places. Close button is 28px.

### Mobile design
- **Modals:** On mobile, slide up from the bottom as a sheet instead of centering. Inside the media query, the existing `.modal` styles are overridden directly — no new class or JS toggle needed: `top: auto; bottom: 0; left: 0; right: 0; transform: none; border-radius: 16px 16px 0 0; max-height: 90vh; overflow-y: auto`.
- **Form grids:** Single column at ≤ 768px.
- **Inputs:** Minimum height 48px.
- **Close button:** Minimum 44×44px tap target via padding.

### Implementation notes
- Pure CSS changes in `app.css`; no JS modal logic changes required
- All existing modals (event, item, user, POI, password) inherit the sheet behavior automatically via the shared modal class

---

## 5. Map, Wiki, Ideas — Graceful Fallback

These pages have complex interactive UIs (D3 force graph, drag-and-drop Kanban, canvas-based map) that cannot be made touch-friendly within the scope of this work.

### Mobile design
- At ≤ 768px, the page content is replaced by a **desktop-preferred notice**:
  - Page icon + "Desktop empfohlen" heading
  - One-sentence explanation of why
  - Two action buttons: "Querformat probieren" (try landscape) and "Trotzdem öffnen" (open anyway, which hides the notice and shows the page as-is)
- **Wiki exception:** In addition to the notice, a flat article list (title + summary, no graph) is shown below the notice as a read-only mobile fallback.

### Implementation notes
- `index.html`: add a `<div class="desktop-notice" data-page="map">` block inside each affected page section
- `app.css`: show notice, hide page content at ≤ 768px; "open anyway" toggles a class that reverses this
- `core.js` or per-page JS: ~10 lines to wire the "open anyway" button per page
- Wiki article list: reuses existing `wiki.js` article data, renders a simplified list — no graph

---

## 6. Global Touch Target Fixes

Applied globally inside `@media (max-width: 768px)`:

| Element | Current size | Target size |
|---|---|---|
| Icon buttons (close, collapse, etc.) | 22–28px | 44px via padding |
| Tab/filter chips | ~24px height | 36px height |
| Primary action buttons | 28–36px height | 44px height |
| Checkboxes in forms | 16px (browser default) | `width: 20px; height: 20px` |
| Form inputs | varies | min-height: 48px |
| Font sizes | as low as `0.6rem` | minimum `0.875rem` (14px) on mobile |

---

## 7. Out of Scope

The following are explicitly excluded from this work:

- Touch gestures on the Map (pinch-zoom, touch drag) — deferred to a future "full mobile" phase
- Drag-and-drop on the Ideas Kanban — deferred
- D3 graph touch support — deferred
- Landscape-specific layouts
- PWA / offline support
- Performance optimizations for mobile networks

---

## 8. Files Changed

| File | Type of change |
|---|---|
| `backend/src/main/resources/static/index.html` | Add bottom nav, drawer, backdrop HTML |
| `backend/src/main/resources/static/css/app.css` | Add `@media (max-width: 768px)` block (~200–300 lines) |
| `backend/src/main/resources/static/js/core.js` | `showPage()` sync, `openDrawer()` / `closeDrawer()` |
| `backend/src/main/resources/static/js/timeline.js` | `openDetailSheet()`, undated events chip |
| `backend/src/main/resources/static/js/items.js` | Mobile card rendering path |
| `backend/src/main/resources/static/js/wiki.js` | Mobile article list fallback |

No backend changes. No new files. No new dependencies.

---

## 9. Testing Checklist

- [ ] Desktop layout unchanged at 1024px+ (Chrome, Firefox)
- [ ] Bottom tab bar visible and functional at 375px (iPhone SE width)
- [ ] Hamburger drawer opens/closes, world switching works
- [ ] Timeline card list scrolls, filter chips scroll horizontally
- [ ] Event detail bottom sheet opens on tap, closes on swipe/backdrop
- [ ] FAB opens new event modal as bottom sheet
- [ ] Items card list renders, search and filter work
- [ ] Item detail bottom sheet opens on tap
- [ ] Map/Wiki/Ideas show desktop notice at 375px; "open anyway" reveals page
- [ ] Wiki mobile article list renders
- [ ] All touch targets ≥ 44px (verify in Chrome DevTools touch simulation)
- [ ] No horizontal overflow / scroll at 375px on Timeline and Items
- [ ] Modals slide up correctly, form fields single-column, inputs 48px tall
- [ ] Admin-only FAB hidden for non-admin users
