# World Feature Toggles — Design Spec

**Date:** 2026-04-13

## Overview

Each world can independently enable or disable three features: Wiki, Chronik (timeline), and Karte (map). Disabled features are hidden from the sub-header navigation and inaccessible via URL. Toggles are admin-only, part of the world config edit screen.

## Requirements

- Three boolean flags per world: `wikiEnabled`, `chronicleEnabled`, `mapEnabled`
- Default: all `true` for new and existing worlds
- Admin-only: shown in the world edit modal (config screen)
- Disabled tab: hidden from `#section-tabs` sub-header
- URL access to disabled page: redirect to the first enabled page for that world
- When switching worlds: if the current page is disabled for the new world, redirect to the first enabled page

## Data Layer

New Flyway migration `V21__world_feature_flags.sql`:

```sql
ALTER TABLE worlds
  ADD COLUMN chronicle_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN wiki_enabled      TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN map_enabled       TINYINT(1) NOT NULL DEFAULT 1;
```

- `World` entity: three `boolean` fields
- `WorldDto`: exposes `chronicleEnabled`, `wikiEnabled`, `mapEnabled`
- `UpdateWorldRequest` / `CreateWorldRequest`: three optional booleans (absent = `true`)

## Backend API

- `WorldService.update()` maps the three booleans from request to entity
- No server-side enforcement on content endpoints for now (flags are config-only)
- No controller changes beyond DTO

## Frontend

- `renderSectionTabs()`: hide each tab if its flag is `false` on the active world
- `navigateToUrl()` / `selectWorld()` / `showPage()`: before showing a world page, resolve the page to the first enabled feature if the requested one is disabled
- World edit modal: three checkbox toggles (admin-only, inside `#form-world`)
- Save handler: include `chronicleEnabled`, `wikiEnabled`, `mapEnabled` in PUT/POST payload
- Helper `firstEnabledSection(world)`: returns `'timeline'|'wiki'|'map'` or `null` if all disabled

## Decisions

- No backend enforcement on content write endpoints (trusted admin)
- All three default to enabled — existing worlds unaffected after migration
- If all three features are disabled for a world: world is still selectable but shows nothing (edge case, admin responsibility)
