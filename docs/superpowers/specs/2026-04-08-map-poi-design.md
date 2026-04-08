# Map & POI Feature — Design Spec

**Date:** 2026-04-08
**Status:** Draft

---

## Overview

A new **Karte** (Map) page added to each world in the Astral Library app. Users can place, move, and label Points of Interest (POIs) on a canvas with an optional background image and a semi-transparent grid. A ruler tool measures distances between any two points on the canvas.

---

## Navigation Changes

The top nav and world-tab row are **swapped**:

| Bar | Before | After |
|-----|--------|-------|
| Top `<nav>` links | Marktplatz · Chronik · Wiki | Marktplatz · World1 · World2 · … |
| Second row (world tabs) | World1 · World2 · … | Chronik · Wiki · Karte |

- The `nav-right` (username, Abmelden, theme toggle, 🌐, ⚙) stays **unchanged**.
- Both bars remain full-width, using the existing `.nav-link` and `.wiki-world-tab` CSS classes respectively.
- Selecting a world in the top nav sets the active world; the second bar then shows Chronik/Wiki/Karte for that world.

---

## POI Types

### Global, Not World-Specific

POI types are **shared across all worlds**. A single global list is managed by admins. This means:
- Adding a new type makes it available on every world's map immediately.
- Deleting a custom type removes it globally (existing placed instances become "orphaned" and should fall back to an unknown marker).

### Default Types (always present, not deletable)

| Icon | Name | Has Gesinnung | Has Label |
|------|------|--------------|-----------|
| ⭐ | Großer POI | Yes | Yes |
| ● | Kleiner POI | Yes | Yes |
| ? | Unbekannt | No | No |
| ▲ | Erhebung (Riff, Berg) | No | Yes |

### Custom Types (admin-managed)

Admin can create additional global types:
- **Name** — free text label
- **Icon** — chosen from a preset palette (emoji/symbol set) OR uploaded as SVG
- **Hat Gesinnung?** — boolean flag; if true, the POI gets a colour ring (green/grey/red)
- **Hat Label?** — boolean flag; if false, no label input is shown when placing

Default types cannot be deleted. Custom types can be edited or deleted (with cascade-fallback on placed instances).

---

## Canvas & Grid

- **Implementation:** Layered DOM — `<img>` for background → SVG layer for grid + ruler → absolutely-positioned `<div>` elements for POI markers.
- **Grid:** Semi-transparent CSS grid overlay using `background-image: linear-gradient(...)`. Each cell = **5 miles**. Label "1 Feld = 5 Meilen" shown bottom-left.
- **Background image:** Optional per-world upload (admin only). Stored as a file, referenced by world. Without a background the canvas shows the dark `--bg` colour.
- **POI positions:** Stored as relative coordinates (`x_pct`, `y_pct` in range 0–1) so they scale correctly with any canvas size.

---

## POI Instances (Per-World)

### Placing a POI

1. User clicks a POI type in the left sidebar → cursor changes to crosshair.
2. User clicks on the canvas → POI is created at that position.
3. The **edit dialog** opens immediately for the user to set label and gesinnung.
4. On Save, the instance is persisted. On Cancel, the marker is removed.

### Gesinnung (Alignment)

Applies only to types with `hasGesinnung = true`:

| Value | Colour |
|-------|--------|
| FRIENDLY | green (`#5cb85c`) |
| NEUTRAL | grey (`#8a9ab0`) |
| HOSTILE | red (`#d9534f`) |

Rendered as a colour ring around the icon.

### Labels

- Free text, shown below the icon in a small pill.
- Unbekannt type has no label input.
- **Wiki auto-link:** On save (and on load), the label is compared case-insensitively against all wiki entry titles in the same world. If a match is found, the label renders in gold with a `↗` suffix. Clicking it opens the wiki article. No manual linking needed.

### Moving a POI

User drags a placed POI to a new position. On `mouseup`, the new `x_pct`/`y_pct` is saved to the backend.

### Editing / Deleting

Right-click or click on a placed POI to open the edit dialog. Options: change label, change gesinnung, delete.

---

## Ruler Tool

- User activates the Messen tool in the sidebar.
- Clicks a start point → clicks an end point on the canvas.
- A dashed gold line renders between the two points with distance in miles shown mid-line.
- Distance formula: `sqrt(dx² + dy²)` in canvas units, converted via the 5-miles-per-grid-cell scale.
- The ruler line persists until the user clicks again (new measurement) or switches tools.
- The ruler is **client-side only** — not persisted.

---

## Permissions

| Action | Who |
|--------|-----|
| View map + all POIs | All logged-in users |
| Place / move / edit / delete own POIs | All logged-in users |
| Edit / delete any POI | Admin |
| Upload background image | Admin only |
| Add / edit / delete custom POI types | Admin only |

No spoiler system for POIs — all placed markers are visible to all users of that world.

---

## Backend

### New Entities

**`PoiType`** (global)
```
id            BIGINT PK
name          VARCHAR(80) NOT NULL
icon          VARCHAR(255)       -- emoji char or "/api/poi-type-icons/{id}"
is_default    BOOLEAN DEFAULT false
has_gesinnung BOOLEAN DEFAULT true
has_label     BOOLEAN DEFAULT true
created_at    TIMESTAMP
```

**`MapPoi`** (per world)
```
id            BIGINT PK
world_id      BIGINT FK → World
poi_type_id   BIGINT FK → PoiType
x_pct         DOUBLE NOT NULL   -- 0.0–1.0
y_pct         DOUBLE NOT NULL   -- 0.0–1.0
label         VARCHAR(120)
gesinnung     ENUM('FRIENDLY','NEUTRAL','HOSTILE') NULL
created_by    BIGINT FK → User
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

**`WorldMapBackground`** (per world, optional)
```
world_id      BIGINT PK FK → World
filename      VARCHAR(255)
uploaded_at   TIMESTAMP
```

### New Endpoints

```
GET    /api/worlds/{worldId}/map/pois              → List<MapPoiDto>
POST   /api/worlds/{worldId}/map/pois              → MapPoiDto         (any user)
PUT    /api/worlds/{worldId}/map/pois/{id}         → MapPoiDto         (owner or admin)
DELETE /api/worlds/{worldId}/map/pois/{id}         → 204               (owner or admin)

GET    /api/poi-types                              → List<PoiTypeDto>  (all users)
POST   /api/poi-types                              → PoiTypeDto        (admin)
PUT    /api/poi-types/{id}                         → PoiTypeDto        (admin)
DELETE /api/poi-types/{id}                         → 204               (admin)

POST   /api/worlds/{worldId}/map/background        → 204               (admin, multipart)
GET    /api/worlds/{worldId}/map/background        → image file or 404
DELETE /api/worlds/{worldId}/map/background        → 204               (admin)

GET    /api/poi-types/{id}/icon                    → SVG file          (custom SVG icons)
```

### Database Migration

New Flyway migration `V{N}__add_map_poi.sql` creates all three tables and seeds the six default `PoiType` rows.

---

## Frontend

### New Page: `page-map`

```html
<div class="page" id="page-map">
  <!-- reuses wiki-world-tabs for Chronik/Wiki/Karte switching -->
  <aside class="sidebar sidebar-left" id="map-sidebar">
    <!-- tool buttons + poi type list + admin section -->
  </aside>
  <div class="map-canvas-wrap" id="map-canvas-wrap">
    <img id="map-bg-img" ...>
    <div id="map-grid"></div>   <!-- CSS grid overlay -->
    <svg id="map-ruler-svg">...</svg>
    <!-- POI divs injected here -->
    <span class="map-scale-label">1 Feld = 5 Meilen</span>
  </div>
</div>
```

### State Shape (additions to `state`)

```js
state.map = {
  activeWorldId: null,
  pois: [],           // MapPoiDto[]
  poiTypes: [],       // PoiTypeDto[] — loaded once, global
  activeTool: 'select', // 'select' | 'ruler' | poi-type-id
  ruler: null,        // { x1, y1, x2, y2 } | null
  bgUrl: null,        // background image URL or null
}
```

### Key Functions

- `renderMap()` — redraws all POI elements from `state.map.pois`
- `startPlacePoi(typeId)` — sets cursor, binds canvas click handler
- `openPoiDialog(poi|null, x, y)` — opens edit/create modal
- `dragPoi(id)` — mouse drag handler, throttled, saves on mouseup
- `renderRuler()` — draws SVG line + distance label
- `loadMapData(worldId)` — fetches POIs + background for a world
- `wikiLinkCheck(label, worldId)` — returns matched wiki entry id or null

---

## Open Questions / Future Scope

- Configurable grid scale per world (deferred — fixed at 5 miles for now).
- POI spoiler system (deferred — all users see all POIs).
- Export map as image (deferred).
- Snap-to-POI for ruler (optional enhancement).
