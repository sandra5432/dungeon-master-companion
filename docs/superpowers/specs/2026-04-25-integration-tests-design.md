# Integration Tests — Design Spec
**Date:** 2026-04-25

## Context

All features in features-allgemein.md, features-A-marktplatz.md, features-B-welt.md, and features-C-admin.md need at least one integration test per code path (happy path + error/access-denied path).

Nine Playwright e2e spec files already exist locally (`backend/src/test/e2e/`) but are untracked. They cover most features comprehensively. This spec documents what needs to be added or fixed.

## Test Framework

**Playwright** (JavaScript) — `@playwright/test` ^1.59.1, already in root `package.json`.

Tests live in `backend/src/test/e2e/`. The app must be running at `http://localhost:8080` with the `dev` Spring profile before running tests.

Dev seed credentials: `admin` / `4711`, `user` / `user`.  
Seed data: Pardur (world_id=1) `guestCanRead/Edit/Delete=true`; Eldorheim (world_id=2) no guest access.

## Changes Required

### 1. `playwright.config.js` (new file, root level)

```js
module.exports = {
  testDir: 'backend/src/test/e2e',
  use: { baseURL: 'http://localhost:8080' },
  workers: 1,      // sequential — tests mutate shared DB state
  retries: 0,
};
```

### 2. `package.json` — update scripts

```json
"test:e2e":  "playwright test",
"test:unit": "node backend/src/test/js/worldSort.test.js"
```

### 3. Bug fix — `admin-worlds.spec.js`

All setup/teardown calls use `/api/admin/worlds` which does not exist.  
`WorldController` is mounted at `/api/worlds`.  
All occurrences must be changed to `/api/worlds`.

### 4. Missing tests — added to existing spec files

#### `worlds-nav.spec.js` — AL-B-006 (Gast-Lösch-Berechtigung)

| Path | Test description |
|------|-----------------|
| Happy | Guest creates an event in Pardur (guestCanEdit=true), then deletes it (guestCanDelete=true) — event disappears |
| Access denied | Set `guestCanDelete=false` on Pardur; guest creates event; delete button is hidden; restore permissions after |

#### `chronicle.spec.js` — AL-B1-009, AL-B1-011, AL-B1-012

**AL-B1-009 — Charakter-Filter**
| Path | Test description |
|------|-----------------|
| Happy | Seeded event with character "Aela" exists; click "Aela" chip in sidebar → only events with Aela visible |
| Clear | Deactivate chip → all events visible again |

**AL-B1-011 — API: Undated event erhält Datum**
| Path | Test description |
|------|-----------------|
| Happy | Create undated event via API; `PUT /api/worlds/1/events/{id}` with `{ date: "Jahr 500" }` → 200, event has date |

**AL-B1-012 — API: Dated event wird undated**
| Path | Test description |
|------|-----------------|
| Happy | Create dated event via API; `PUT` with `{ date: null }` → 200, event has no date |

#### `wiki.spec.js` — AL-B2-007, AL-B2-012, AL-B2-014, AL-B2-015

**AL-B2-007 — Hover-Tooltip**
| Path | Test description |
|------|-----------------|
| Happy | Open Glimmquali article (body contains "Tavari" inline link); hover over `.wiki-inline-link` → `#wiki-preview-tip` becomes visible with non-empty title |

**AL-B2-012 — Bild-Lightbox**
| Path | Test description |
|------|-----------------|
| Setup | Create wiki entry via API; upload a 1×1 WebP via `POST /api/wiki/{id}/images` (multipart) |
| Happy | Open the article, click the image → `#img-lightbox` visible |
| Close via Escape | `#img-lightbox` hidden after `Escape` key press |
| Teardown | Delete the entry |

**AL-B2-014 — Spoiler-Block erstellen**
| Path | Test description |
|------|-----------------|
| Happy | Admin opens wiki editor; `#wiki-toolbar-spoiler` is visible; clicking it inserts `:::spoiler` text into `#wiki-ed-body` |
| Access | Spoiler button is hidden for guests (read-only mode, no editor) |

**AL-B2-015 — Spoiler-Zugriff verwalten**
| Path | Test description |
|------|-----------------|
| Happy | `POST /api/wiki/{id}/spoiler-readers/{userId}` with USER token → 200 |
| Remove | `DELETE /api/wiki/{id}/spoiler-readers/{userId}` → 200 |
| Access denied | Same POST without auth → 401/403 |

#### `map.spec.js` — AL-B3-005, AL-B3-009

**AL-B3-005 — POI verschieben (API-only)**
| Path | Test description |
|------|-----------------|
| Happy | Create POI at (20, 20) via API; `PUT /api/worlds/1/map/pois/{id}` with `{ xPct: 75, yPct: 80 }` → 200, response has updated coordinates |

**AL-B3-009 — Kartenhintergrund hochladen**
| Path | Test description |
|------|-----------------|
| Happy | `POST /api/worlds/1/map/background` (multipart WebP buffer) with admin auth → 200 |
| Access denied | Same POST without auth → 401/403 |

## Spec Coverage After Changes

| Feature area | Before | After |
|---|---|---|
| AL-G (allgemein) | ✓ complete | ✓ |
| AL-A (Marktplatz) | ✓ complete | ✓ |
| AL-B-001–005,007–009 | ✓ complete | ✓ |
| AL-B-006 (Gast-Löschen) | ✗ missing | ✓ |
| AL-B-010 (ZIP export location) | covered via AL-C2-006 | ✓ |
| AL-B1 (Chronik) | mostly covered | ✓ (B1-009, 011, 012 added) |
| AL-B2 (Wiki) | mostly covered | ✓ (B2-007, 012, 014, 015 added) |
| AL-B3 (Karte) | mostly covered | ✓ (B3-005, 009 added) |
| AL-C1 (Nutzerverwaltung) | ✓ complete | ✓ |
| AL-C2 (Weltverwaltung) | ✓ complete (after bug fix) | ✓ |
