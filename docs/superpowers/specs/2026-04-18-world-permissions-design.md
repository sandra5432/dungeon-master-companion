# World Permissions — Design Spec
_Date: 2026-04-18_

## Overview

Add per-world read/edit/delete permissions for two caller tiers: unauthenticated guests and authenticated non-admin users. Admins bypass all checks. Defaults preserve current behavior (guests see nothing; logged-in users retain full access to existing worlds).

---

## 1. Data Model

### Migration: `V22__world_permissions.sql`

```sql
ALTER TABLE worlds
  ADD COLUMN guest_can_read   TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN guest_can_edit   TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN guest_can_delete TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN user_can_read    TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN user_can_edit    TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN user_can_delete  TINYINT(1) NOT NULL DEFAULT 1;
```

Defaults:
- Guest flags default `0` — no existing world becomes publicly visible.
- User flags default `1` — all existing worlds remain fully accessible to logged-in users.

### Entity: `World.java`

Add 6 `boolean` fields with corresponding getters/setters:
`guestCanRead`, `guestCanEdit`, `guestCanDelete`, `userCanRead`, `userCanEdit`, `userCanDelete`.

### DTOs

Add all 6 fields to:
- `WorldDto` (response) — so the frontend can render the config and enforce nav visibility
- `CreateWorldRequest` — optional fields; service defaults to `false` for guest flags, `true` for user flags when null
- `UpdateWorldRequest` — optional fields; service applies them when non-null

---

## 2. Backend Permission Enforcement

### `WorldPermissionChecker` (`@Component`)

Single component, three public methods:

```java
public void requireRead(World world, Authentication auth)
public void requireEdit(World world, Authentication auth)
public void requireDelete(World world, Authentication auth)
```

Logic for each:
1. If `auth` has role `ADMIN` → pass (admins bypass everything).
2. If `auth` is authenticated as `USER` → check the corresponding `user_can_*` flag; throw `AccessDeniedException` if false.
3. Otherwise (guest / anonymous) → check the corresponding `guest_can_*` flag; throw `AccessDeniedException` if false.

Returns void; throws `AccessDeniedException` (→ HTTP 403) on failure.

### `SecurityConfig` changes

Move all world-content endpoints from `hasRole("USER")` to `permitAll()` so unauthenticated requests can reach the service layer:

| Endpoint pattern | Before | After |
|---|---|---|
| `GET /api/worlds/**` | `hasRole("USER")` | `permitAll()` |
| `GET /api/worlds/*/events/**` | `hasRole("USER")` | `permitAll()` |
| `POST /api/worlds/*/events` | `hasRole("USER")` | `permitAll()` |
| `PUT/DELETE /api/worlds/*/events/**` | `hasRole("USER")` | `permitAll()` |
| `GET /api/wiki/**` | `hasRole("USER")` | `permitAll()` |
| `POST/PUT/DELETE /api/wiki/**` | `hasRole("USER")` | `permitAll()` |
| `GET /api/worlds/*/map/**` | `hasRole("USER")` | `permitAll()` |
| `POST/PUT/DELETE /api/worlds/*/map/pois/**` | `hasRole("USER")` | `permitAll()` |
| `GET /api/poi-types` | `hasRole("USER")` | `permitAll()` |

Admin-only endpoints (world CRUD, map background, export, user management, poi-type management) remain unchanged.

### `WorldService.getAllWorlds()`

Filter before mapping to DTO:
- Admin → return all worlds.
- Authenticated user → return worlds where `userCanRead = true`.
- Guest → return worlds where `guestCanRead = true`.

Takes `Authentication` as parameter (passed from controller, which injects it via Spring MVC `Authentication` argument).

### Service-layer checks

Each service method that operates on world content calls `WorldPermissionChecker` with the resolved `World` entity and the current `Authentication`:

| Service | Methods | Check |
|---|---|---|
| `TimelineService` | get events, create event, update event, delete event | read / edit / delete |
| `WikiService` | get entries, create entry, update entry, delete entry | read / edit / delete |
| `MapPoiService` | get POIs, create POI, update POI, delete POI | read / edit / delete |

Controllers pass `Authentication auth` as a method parameter (Spring injects it automatically).

### Anonymous attribution

When `createdByUserId` is `null` (guest-created content), all display paths show "Anonym". No other changes to the data model are needed — the column is already nullable.

### Spoiler rule (unchanged)

Existing spoiler visibility logic is untouched. Logged-in users still cannot see spoilers unless they own the entry or are on the spoiler-read list. Admins see all spoilers.

---

## 3. Frontend

### World config form (`#f-world` in `index.html`)

Add a "Berechtigungen" section below the existing feature checkboxes:

```
Berechtigungen
  Gäste (nicht angemeldet)   [ ] Lesen   [ ] Bearbeiten   [ ] Löschen
  Angemeldete Benutzer       [✓] Lesen   [✓] Bearbeiten   [✓] Löschen
```

Element IDs: `fw-guest-read`, `fw-guest-edit`, `fw-guest-delete`, `fw-user-read`, `fw-user-edit`, `fw-user-delete`.

### Constraint enforcement (JS)

Two rules enforced on every checkbox change:

1. **Cross-tier parity**: if a guest checkbox is checked, the corresponding user checkbox is force-checked and disabled. When the guest checkbox is unchecked, the user checkbox re-enables. Prevents logged-in users having less access than guests.
2. **Within-tier implication**: checking "Bearbeiten" (edit) also force-checks "Lesen" (read) in the same tier; checking "Löschen" (delete) also force-checks "Lesen". Read is a prerequisite for edit and delete. Unchecking "Lesen" also unchecks edit and delete in the same tier.

### Modal open/close

- `openEditWorldModal()`: populate all 6 checkboxes from the world object; reapply constraint state.
- `openAddWorldModal()`: reset to defaults (guest all unchecked, user all checked); reapply constraint state.
- Save path in `handleSave()`: read all 6 checkbox values and include them in the PUT/POST payload.

### Navigation (`renderTopNavWorlds()`)

- Guests: only include worlds where `w.guestCanRead === true`.
- Logged-in non-admin users: only include worlds where `w.userCanRead === true`.
- Admins: show all worlds (unchanged).

Since `GET /api/worlds` already returns only the worlds the caller can see (server-side filter), the frontend just renders whatever `state.worlds` contains. The nav filter is a redundant safety layer.

### "Anonym" attribution

Wherever a creator username is displayed (timeline event detail, wiki entry header, etc.), fall back to `"Anonym"` when the `creatorUsername` field is `null` or absent.

---

## 4. Invariants & Edge Cases

| Case | Behaviour |
|---|---|
| Guest requests a world with `guestCanRead = false` | 403 from service; world not in `GET /api/worlds` response |
| Logged-in user on a world with `userCanRead = false` | 403; world not in list |
| Admin | Always passes; world always in list |
| Guest edit with `guestCanEdit = true` but `guestCanRead = false` | Edit implies read — if edit is enabled but read is not, the server still allows the edit call; however the UI prevents this config via the constraint (edit ≥ read is a UI concern, not strictly enforced in DB). Consider: enforcing edit→read implication in the checker (if edit allowed, read is also effectively granted). |
| World with all 6 flags false | No one except admins can access it — effectively a hidden/draft world. |
| `createdByUserId = null` in existing data | None exists today; safe to treat null as "Anonym" going forward. |

### Edit implies Read

In `WorldPermissionChecker.requireRead()`, also return true if the caller has edit permission for that world. This prevents the odd state of someone who can write but can't read.

---

## 5. Out of Scope

- Per-section permissions (e.g., guest can read wiki but not chronicle) — feature flags already handle which sections exist; permissions apply to the whole world.
- Per-entry permissions beyond the existing spoiler system.
- IP-based or token-based guest identity.
- Audit log of anonymous edits.
