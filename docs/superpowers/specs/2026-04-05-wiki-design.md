# Wiki Feature — Functional Specification

**Date:** 2026-04-05
**Status:** Draft

---

## 1. Overview

A wiki module is integrated into the Pardur application as a third top-level tab (`Wiki`) alongside `Zeitleiste` and `Marktplatz`. The wiki allows users to create and maintain interconnected knowledge entries (persons, locations, terms, organisations, etc.) per world. Entries are automatically linked to each other and to timeline events based on title matches in text.

---

## 2. Scope & Constraints

- Backend: Spring Boot / JPA, following existing project conventions
- Frontend: Vanilla JS, same static file setup as the rest of the app
- Graph rendering: D3.js (force-directed layout)
- Markdown rendering: marked.js (GitHub Flavored Markdown — supports tables, lists, bold, italic)
- Images: stored as WebP BLOBs in the database; server converts uploads to WebP and compresses to ≤ 10 MB
- Auto-linking: computed at runtime via SQL LIKE / FULLTEXT queries — no persistent link table
- No new external auth or storage dependencies

---

## 3. Roles & Permissions

| Action | Not logged in | User (logged in) | Admin |
|---|---|---|---|
| View articles (public content) | ✓ | ✓ | ✓ |
| View spoiler blocks | ✗ | Only if on entry's reader list | Always ✓ |
| Create entries | ✗ | ✓ | ✓ |
| Edit own entries | ✗ | ✓ | ✓ |
| Edit any entry | ✗ | ✗ | ✓ |
| Delete own entries | ✗ | ✓ | ✓ |
| Delete any entry | ✗ | ✗ | ✓ |
| Add/edit spoiler blocks | ✗ | ✗ | ✓ |
| Manage spoiler reader list | ✗ | Only if creator of entry | ✓ |
| Upload / delete images | ✗ | Only on own entries | ✓ |

---

## 4. Data Model

### 4.1 `wiki_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | |
| `title` | VARCHAR(255) NOT NULL | Unique per world (and separately unique among world-spanning entries) |
| `world_id` | INT FK → `worlds.id` nullable | NULL = world-spanning entry |
| `type` | ENUM NOT NULL | See §4.4 |
| `body` | TEXT | Markdown content; spoiler blocks embedded as `:::spoiler` syntax (see §6.2) |
| `created_by_user_id` | INT FK → `users.id` NOT NULL | |
| `created_at` | TIMESTAMP NOT NULL | |
| `updated_at` | TIMESTAMP NOT NULL | |

Fulltext index on `title` and `body` for auto-linking queries.

### 4.2 `wiki_images`

| Column | Type | Notes |
|---|---|---|
| `id` | INT PK AUTO_INCREMENT | |
| `entry_id` | INT FK → `wiki_entries.id` NOT NULL | Cascade delete |
| `data` | LONGBLOB NOT NULL | WebP image data |
| `caption` | VARCHAR(255) | Displayed as text label beneath the image |
| `sort_order` | INT NOT NULL DEFAULT 0 | Controls display order alongside article text |

### 4.3 `wiki_spoiler_readers`

| Column | Type | Notes |
|---|---|---|
| `entry_id` | INT FK → `wiki_entries.id` NOT NULL | |
| `user_id` | INT FK → `users.id` NOT NULL | |
| PK: `(entry_id, user_id)` | | |

The entry creator is implicitly always a spoiler reader (no row needed). Admins always have access regardless of this table.

### 4.4 Entry Types (Enum)

`PERSON`, `LOCATION`, `TERM`, `RESOURCE`, `FAUNA`, `FLORA`, `ORGANISATION`, `ENTITAET`, `OTHER`

### 4.5 Cascade Behaviour on Delete

When a `wiki_entry` is deleted:
- All `wiki_images` for that entry are deleted (CASCADE)
- All `wiki_spoiler_readers` rows for that entry are deleted (CASCADE)
- All auto-links that referenced this entry disappear naturally (computed at runtime — no stored links to clean up)
- Any rendered links in event descriptions or other article bodies pointing to this title revert to plain text on the next render

---

## 5. API Endpoints

### 5.1 Wiki Entries

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/wiki` | public | List entries; supports `?worldId=`, `?type=`, `?q=` (search). Spoiler blocks stripped for unauthorised users. |
| `GET` | `/api/wiki/recent` | public | Last 20 entries by `updated_at` descending across all worlds (including world-specific entries), used for left-panel list. |
| `GET` | `/api/wiki/{id}` | public | Single entry. Spoiler blocks stripped based on session user. |
| `POST` | `/api/wiki` | logged in | Create entry. |
| `PUT` | `/api/wiki/{id}` | creator or admin | Update entry. |
| `DELETE` | `/api/wiki/{id}` | creator or admin | Delete entry and all associated images. |

### 5.2 Auto-Linking (read-only, no stored links)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/wiki/{id}/linked-events` | public | Timeline events whose `title` or `description` contains the entry's title (case-insensitive). |
| `GET` | `/api/wiki/{id}/linked-entries` | public | Other wiki entries whose `body` or `title` contains this entry's title, or whose title appears in this entry's body. |
| `GET` | `/api/wiki/graph?worldId=` | public | Returns all entries for the given world (plus world-spanning entries) and their pairwise links as `{ nodes: [], edges: [] }` for the graph renderer. |

### 5.3 Images

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/wiki/{id}/images` | creator or admin | Multipart upload. Server converts to WebP, compresses if > 10 MB. Returns image metadata. |
| `GET` | `/api/wiki/images/{imageId}` | public | Serve raw WebP bytes. |
| `PUT` | `/api/wiki/images/{imageId}` | creator or admin | Update caption or sort_order. |
| `DELETE` | `/api/wiki/images/{imageId}` | creator or admin | Delete image. |

### 5.4 Spoiler Reader Management

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/wiki/{id}/spoiler-readers` | creator or admin | List users with spoiler access. |
| `POST` | `/api/wiki/{id}/spoiler-readers/{userId}` | creator or admin | Grant spoiler access. |
| `DELETE` | `/api/wiki/{id}/spoiler-readers/{userId}` | creator or admin | Revoke spoiler access. |

### 5.5 Error Responses

All errors follow the existing `{ "error": "message", "status": 404 }` pattern. Relevant cases:
- `404` — entry or image not found
- `403` — insufficient permissions (not creator, not admin)
- `400` — validation error (missing title, unsupported image format, image too large after compression)
- `409` — duplicate title within the same world

---

## 6. Business Logic

### 6.1 Auto-Linking

Auto-linking is computed at read time — no link table is persisted.

**Entry → Events:**
`SELECT * FROM timeline_events WHERE LOWER(title) LIKE LOWER('%{entry.title}%') OR LOWER(description) LIKE LOWER('%{entry.title}%')`
Results returned via `GET /api/wiki/{id}/linked-events`.

**Entry → Entries (graph edges):**
For the graph, the backend collects all entry titles for the selected world (plus world-spanning entries), then for each pair `(A, B)` checks whether `A.body` contains `B.title` or `B.body` contains `A.title` (case-insensitive). An edge is created if either direction matches.

**In Event text (frontend):**
When rendering an event's description in the timeline detail panel, the frontend replaces occurrences of known wiki titles with `<a>` tags pointing to the wiki entry. Matching is case-insensitive; longer titles take precedence over shorter ones to avoid partial matches.

### 6.2 Spoiler Block Format

Spoiler blocks are stored inline in the `body` Markdown field:

```
:::spoiler Name des Spoiler-Blocks
Geheimer Inhalt hier. Unterstützt ebenfalls Markdown.
:::
```

Multiple named spoiler blocks per article are supported. On the backend, before returning the `body` to the client, a parser strips all `:::spoiler ... :::` blocks for users who are neither admin nor on the entry's spoiler reader list. For authorised users the blocks are returned intact; the frontend renders them with a distinct visual style (e.g. red-bordered box with the spoiler name as heading).

### 6.3 Image Processing

On upload:
1. Server receives multipart file
2. Converts to WebP (using an image processing library, e.g. `thumbnailator` + WebP encoder or `imageio-webp`)
3. If resulting file > 10 MB, downscales resolution progressively until ≤ 10 MB
4. Stores as BLOB; returns `{ id, caption, sortOrder }` to client

### 6.4 Title Uniqueness

- Within a world: no two entries may share the same title (case-insensitive)
- Among world-spanning entries: no two world-spanning entries may share the same title
- A world-spanning entry and a world-specific entry may share the same title (they are separate concepts)

### 6.5 Ownership for Edit/Delete

Edit and delete operations check: `currentUser.isAdmin() || entry.createdByUserId == currentUser.id`. This check is enforced in the service layer using the Spring Security `Authentication` principal — not re-queried from the DB.

---

## 7. Frontend

### 7.1 Tab Layout

The `Wiki` tab is added to the main navigation alongside `Zeitleiste` and `Marktplatz`.

### 7.2 Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Zeitleiste]  [Marktplatz]  [Wiki]                          │
├──────────────┬───────────────────────────────────────────────┤
│ 🔍 Suche     │  [Welt 1] [Welt 2] [Welt 3]                   │
│──────────────│                                               │
│ Zuletzt      │                                               │
│ bearbeitet:  │           Interaktiver Graph                  │
│              │         (Knoten der gewählten Welt            │
│ • Nerathis   │          + weltübergreifende Knoten)          │
│ • Nerathari  │                                               │
│ • Drachenhain│                                               │
│   ...        │                                               │
│              │                                               │
│ [+ Neu]      │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

**Left panel:**
- Search field at top (world-spanning search, searches titles and body text, not spoilers)
- Below: list of the 20 most recently added/edited entries across all worlds (from `GET /api/wiki/recent`)
- When a search query is active: list is replaced by search results
- "Neu" button (only for logged-in users) opens the create-entry editor
- Clicking any list item opens the article view (see §7.3)

**Right panel:**
- World tabs at top — selecting a world loads `GET /api/wiki/graph?worldId={id}`
- D3.js force-directed graph: nodes = wiki entries, edges = auto-links
- Node colour by type (exact palette defined at implementation time; indicative: PERSON=yellow, FLORA=green, FAUNA=red, LOCATION=blue, ORGANISATION=purple, ENTITAET=orange, TERM=grey, RESOURCE=teal, OTHER=white)
- Clicking a node opens the article view (same as clicking a list item)
- Graph supports zoom and drag

### 7.3 Article View

Opens as a side panel or overlay (consistent with existing modal patterns in the app).

Contents:
- Title + type badge + world name (or "Weltübergreifend")
- Images floated to the right of the text, with text caption label below each image
- Markdown-rendered body (tables, lists, bold, italic supported via marked.js)
- Spoiler blocks: visible with red-bordered box + spoiler name as heading for authorised users; hidden entirely for others
- Section: **Verknüpfte Events** — list of timeline event titles; clicking opens the event in the Zeitleiste tab
- Section: **Verknüpfte Artikel** — list of other wiki entry titles; clicking loads that article in the same view
- Edit button (creator or admin only) → opens editor pre-filled with current content
- Delete button (creator or admin only) → confirmation dialog, then DELETE request
- Spoiler reader management (creator or admin only): collapsible section listing users with access, add/remove controls

### 7.4 Article Editor

Used for both create and edit flows.

Fields:
- Title (text input, required)
- Type (dropdown: all enum values)
- World (dropdown: all worlds + "Weltübergreifend")
- Body (textarea with Markdown toolbar)
- Image upload area (drag & drop or file dialog; multiple images; each gets a caption field and drag-to-reorder)

Markdown toolbar buttons: Bold, Italic, Table (inserts template), Unordered List, Ordered List, **Spoiler-Block einfügen** (admin only — prompts for spoiler name, inserts `:::spoiler Name\n\n:::` at cursor position).

### 7.5 Auto-Linking in Timeline Events

When an event's detail panel is rendered in the Zeitleiste, the frontend fetches the list of all known wiki titles (cached in `state.wikiTitles`) and replaces matching substrings in the event description with `<a>` tags. Clicking a link navigates to the Wiki tab and opens the corresponding article. Matching is case-insensitive; longer titles take priority over shorter ones to prevent partial matches (e.g. "Nerathari" is matched before "Nera").

### 7.6 Search Behaviour

- Triggered after the user stops typing (debounced, ~300 ms)
- Calls `GET /api/wiki?q={term}`
- Results replace the recent-entries list in the left panel
- Clearing the search field restores the recent-entries list
- Spoilers are never included in search results (stripped server-side)

---

## 8. Non-Functional Requirements

- Image BLOBs are served via a dedicated endpoint to avoid loading them with every entry list call
- The graph endpoint returns only titles, types, IDs, and edge pairs — no body content — to keep payload small
- Fulltext index on `wiki_entries.title` and `wiki_entries.body` for search and auto-link queries
- Fulltext or regular index on `timeline_events.description` for event auto-link queries

---

## 9. Out of Scope (first version)

- Version history / change log for articles
- Comment or discussion threads on articles
- Export (PDF, HTML)
- Notification when a spoiler is shared with you
- Drag-and-drop graph layout persistence (positions reset on reload)
