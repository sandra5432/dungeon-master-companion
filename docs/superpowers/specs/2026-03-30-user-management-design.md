# User Management Design

**Goal:** Replace the single hardcoded admin with a proper two-role user system, link timeline events directly to users, drop the creators table, and add an admin-only user management UI.

**Architecture:** Role column on `users`, direct FK from `timeline_events` to `users`, Spring Security role hierarchy, ownership check in service layer, password-change gate in frontend.

**Tech Stack:** Java 21, Spring Boot 3.3, Spring Security, Flyway (MySQL prod / H2 dev), Vanilla JS

---

## 1. Data Model

### `users` table — three new columns

| Column | Type | Notes |
|---|---|---|
| `role` | `VARCHAR(10) NOT NULL DEFAULT 'USER'` | Values: `ADMIN`, `USER` |
| `must_change_password` | `BOOLEAN NOT NULL DEFAULT FALSE` | Set `TRUE` for newly created users |
| `color_hex` | `VARCHAR(7) NOT NULL DEFAULT '#888888'` | Display colour in timeline; replaces `creators.color_hex` |

### `timeline_events` table — one column added, one removed

| Change | Detail |
|---|---|
| Add `created_by_user_id INT NULL` | FK → `users.id ON DELETE SET NULL` |
| Drop `creator_code VARCHAR(...)` | Replaced by the user FK; existing rows get `NULL` on migration |

### `creators` table — dropped entirely

All Java code for `Creator` entity, `CreatorRepository`, `CreatorService`, `CreatorController`, and `CreatorDto` is deleted.

### Display name on events

`username` replaces `creator_code` everywhere in the UI. The colour dot next to the creator name comes from `users.color_hex`. Events with `created_by_user_id = NULL` (pre-migration rows) display as "Unbekannt" with colour `#888888`.

---

## 2. Database Migration (Prod — Flyway)

### V9__user_roles_and_event_ownership.sql

Applies cleanly on top of the existing prod schema (V1–V8). Steps in exact order (order matters for FK constraints):

1. Add `role`, `must_change_password`, `color_hex` to `users`
2. Update the existing `admin` user: `role='ADMIN'`, `must_change_password=TRUE`, BCrypt(`4711`), `color_hex='#9a4aaa'`
3. Add `created_by_user_id INT NULL` to `timeline_events` with FK → `users.id ON DELETE SET NULL`
4. Drop the existing FK constraint `fk_event_creator` from `timeline_events` (was referencing `creators.code`)
5. Drop `creator_code` column from `timeline_events` — existing rows get `NULL` on the new `created_by_user_id` FK
6. Drop `creators` table (safe now that no FK references it)

The BCrypt hash of `4711` (cost 10) is generated during implementation by running `new BCryptPasswordEncoder(10).encode("4711")` and embedding the result literally in the SQL. It is **not** a variable — it is a hardcoded string in the migration file.

> **Note:** Never edit this migration file after it has been applied to any environment.

### V10__seed_default_admin.sql

Only runs if no `ADMIN` user exists yet (handles fresh-database deployments where V4's placeholder was never replaced):

```sql
INSERT IGNORE INTO users (username, password, role, must_change_password, color_hex)
VALUES ('admin', '<BCrypt(4711) generated during implementation>', 'ADMIN', TRUE, '#9a4aaa');
```

This ensures a working admin account exists on every fresh deployment without relying on V4's placeholder hash.

### Dev seed (`import.sql`)

Updated to:
- Remove all `creators` inserts
- Remove `creator_code` from all `timeline_events` inserts
- Admin user: `role='ADMIN'`, `must_change_password=TRUE`, BCrypt(`4711`), `color_hex='#9a4aaa'`
- Second seed user: `username='user1'`, `role='USER'`, BCrypt(`user1`), `must_change_password=FALSE`, `color_hex='#2a9a68'`

---

## 3. Backend

### `User` entity — new fields

```java
@Column(nullable = false, length = 10)
private String role;           // "ADMIN" or "USER"

@Column(nullable = false)
private boolean mustChangePassword;

@Column(nullable = false, length = 7)
private String colorHex;
```

### `AuthService` — role-aware

`loadUserByUsername` reads `user.getRole()` and assigns `ROLE_ADMIN` or `ROLE_USER` accordingly. Spring Security role hierarchy configured in `SecurityConfig`:

```
ROLE_ADMIN > ROLE_USER
```

### `AuthStatusResponse` — extended

New fields returned on login and `/api/auth/status`:

```json
{
  "loggedIn": true,
  "admin": true,
  "userId": 1,
  "username": "admin",
  "colorHex": "#9a4aaa",
  "mustChangePassword": false
}
```

`userId` is needed by the frontend for ownership checks on events.

### `SecurityConfig` — updated rules

| Endpoint | Old | New |
|---|---|---|
| `POST/PUT/DELETE /api/timeline/events/**` | `ADMIN` only | `USER` or `ADMIN` |
| `GET/POST/PUT/DELETE /api/admin/users/**` | n/a | `ADMIN` only |
| Everything else | unchanged | unchanged |

### `TimelineService` — ownership enforcement

`updateEvent` and `deleteEvent` receive the current `Authentication`. Logic:
- If `ROLE_ADMIN` → allow
- If `ROLE_USER` → allow only if `event.createdByUserId == currentUserId`, else throw `AccessDeniedException` (→ HTTP 403)

`createEvent` auto-sets `createdByUserId` from the authenticated user's id. No `creator_code` field in `CreateEventRequest` anymore.

### `EventDto` — updated

Remove `creatorCode`. Add `createdByUserId`, `creatorUsername`, `creatorColorHex`.

### Password change endpoint

`POST /api/auth/change-password` — available to any authenticated user.

Request: `{ "currentPassword": "...", "newPassword": "..." }`

On success: sets `mustChangePassword = FALSE`, re-encodes password with BCrypt.

### `UserController` — new, admin-only (`/api/admin/users`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/users` | List all users (id, username, role, colorHex, createdAt — no password) |
| `POST` | `/api/admin/users` | Create user (username, role, colorHex); password auto-set to username, `mustChangePassword = TRUE` |
| `PUT` | `/api/admin/users/{id}` | Update role or colorHex; or reset password (sets it back to username, `mustChangePassword = TRUE`) |
| `DELETE` | `/api/admin/users/{id}` | Delete user; blocked if `id == currentUserId` |

### Deleted code

- `Creator.java`, `CreatorId.java` (if exists), `CreatorRepository.java`, `CreatorService.java`, `CreatorController.java`, `CreatorDto.java`
- All `creator_code` references in `TimelineEvent`, `CreateEventRequest`, `UpdateEventRequest`, `EventDto`, `TimelineService`

---

## 4. Frontend

### Nav — gear icon

A `⚙` button added to `nav-right`, visible only to admins. Clicking it navigates to `page-users` (new page). The "Manage Users" entry lives directly on the button as a tooltip / aria-label; no dropdown needed given it's a single action.

### `page-users`

Admin-only page. Shows a table: Username, Role, Colour, Actions (Reset Password, Change Role, Delete). "Nutzer anlegen" button opens the modal in user-creation mode (username + role + colour picker).

Blocked client-side if `!state.auth.isAdmin` — also blocked server-side.

### Password change gate

After any login, if `mustChangePassword === true`:
- A full-screen overlay (not dismissable) is shown before any page renders
- Form: current password, new password, confirm new password
- On success: overlay dismissed, normal app loads
- On failure: error shown inline

### Event form — creator field removed

The `f-cr` input (Ersteller-Kürzel) is removed. `creatorCode` is no longer sent. Backend derives attribution from the session user.

### Event card / detail panel

Shows `creatorUsername` with the colour dot from `creatorColorHex` instead of `creator_code`.

### Sidebar "Ersteller" filter

Populated from unique `(createdByUserId, creatorUsername, creatorColorHex)` tuples across loaded events instead of the `/api/creators` endpoint. The creators endpoint is removed.

### Ownership-gated edit/delete

Edit and delete buttons on an event are shown only if:
```js
state.auth.isAdmin || event.createdByUserId === state.auth.userId
```

---

## 5. Error Handling

| Scenario | HTTP | Message |
|---|---|---|
| Non-admin tries to create/edit/delete world or item | 403 | `Access denied` |
| User tries to edit/delete another user's event | 403 | `Not your event` |
| Admin tries to delete their own account | 400 | `Cannot delete your own account` |
| Username already taken | 409 | `Username already exists` |
| Password change: wrong current password | 400 | `Current password incorrect` |

---

## 6. Testing

- `UserServiceTest` — unit: create user sets mustChangePassword, delete own account throws, role change persists
- `TimelineServiceOwnershipTest` — unit: USER can edit own event, USER cannot edit other's event (403), ADMIN can edit any event
- `UserControllerTest` — integration: non-admin gets 403 on all `/api/admin/users` endpoints
- `AuthControllerTest` — integration: login returns mustChangePassword flag; change-password clears flag
- Update `import.sql` assertions in existing tests to remove creator_code references
