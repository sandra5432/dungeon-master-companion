# Wiki Parent Hierarchy — Design Spec
**Date:** 2026-04-06  
**Status:** Approved

---

## Overview

Each wiki entry can optionally declare a parent entry (within the same world). This creates a navigable tree up to 3 levels deep. The sidebar gains a "Hierarchie" view replacing the current "Zuletzt" view. Articles show their children inline. The editor allows selecting a parent via live text search.

---

## Data Model

### Migration: `V14__wiki_parent.sql`
```sql
ALTER TABLE wiki_entries
  ADD COLUMN parent_id INT NULL,
  ADD CONSTRAINT fk_wiki_parent
    FOREIGN KEY (parent_id) REFERENCES wiki_entries(id)
    ON DELETE SET NULL;
```

- `parent_id` is nullable — null means root-level entry.
- `ON DELETE SET NULL`: if a parent is deleted, its children become root entries (no cascade delete).
- No DB constraint on depth — depth limit (≤ 3) is enforced in the service layer.

### Entity: `WikiEntry`
Add a `@ManyToOne` self-reference:
```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "parent_id")
private WikiEntry parent;
```
No `@OneToMany children` on the entity — children are derived in the service by querying by `parent_id`.

---

## DTOs

### `WikiEntryListItemDto` — add:
- `parentId: Integer` (nullable)

### `WikiEntryDto` (full article) — add:
- `parentId: Integer` (nullable)
- `parentTitle: String` (nullable) — for breadcrumb display in the article header
- `children: List<WikiChildDto>` — direct children only (id, title, type)

### New `WikiChildDto`:
```java
public class WikiChildDto {
    private Integer id;
    private String title;
    private String type;
}
```

---

## Service Layer (`WikiService`)

### `create` and `update`
Both accept an optional `parentId` in their request DTOs.

On set/change of parent, validate:
1. Parent exists and belongs to the same world.
2. Entry is not its own parent (id ≠ parentId).
3. Parent is not a descendant of the entry (no cycle) — walk up the parent chain.
4. Resulting depth ≤ 3: count ancestors of the selected parent; if ≥ 3, reject with 400.

Depth is computed by walking the parent chain in-memory (max 3 hops, cheap).

### `get` (full article)
`toDto()` additionally:
- Sets `parentId` and `parentTitle` from `entry.getParent()`.
- Queries `entryRepository.findByParentId(entry.getId())` to populate `children` list.

### `toListItemDto`
Sets `parentId` from `entry.getParent()?.getId()`.

---

## Repository

Add to `WikiEntryRepository`:
```java
List<WikiEntry> findByParentId(Integer parentId);
```

---

## Request DTOs

### `CreateWikiEntryRequest` — add:
```java
private Integer parentId; // nullable, no @NotNull
```

### `UpdateWikiEntryRequest` — add:
```java
private Integer parentId; // nullable
```

---

## Frontend

### Sidebar — View Toggle
Replace "Zuletzt" button with "Hierarchie". Final three views:
- **Hierarchie** — tree view (new)
- **A–Z** — alphabetical (unchanged)
- **Typ** — grouped by type (unchanged)

The default view on page load changes from `'recent'` to `'hierarchy'` in `state.ui.wikiView`.

### Hierarchy View Rendering (`renderWikiRecentList` — `view === 'hierarchy'`)
Built entirely client-side from the flat `state.wikiAllEntries` list (all entries already include `parentId`). Algorithm:

1. Build a map: `id → entry`.
2. Partition into roots (no parentId) and children.
3. Recursively render the tree, root entries sorted alphabetically, children sorted alphabetically within their group.
4. Indentation: `padding-left: 12px` per level (max 3 levels = max 36px extra).
5. Entries with a `parentId` that references an entry not in the current filtered list are shown at root level (graceful degradation when type filter is active).

Collapse/expand state re-uses `state.ui.wikiCollapsedTypes` keyed by entry id (rename to `wikiCollapsed: new Set()` for generality, or use a separate `wikiCollapsedNodes: new Set()`).

### Article View — Unterseiten Section
At the bottom of `renderWikiArticle(entry)`, after body and related sections:

```
── UNTERSEITEN ──────────────────
[Tavari]  LOCATION
[Handelsposten Süd]  LOCATION
```

Rendered as clickable list items using `entry.children` from the API response. Only shown if `entry.children.length > 0`.

### Article View — Breadcrumb
In the article header (after title), if `entry.parentId` is set, show a small breadcrumb:
```
← Glimmquali
```
Clicking navigates to the parent article via `loadWikiArticle(entry.parentId)`.

### Editor — Parent Selection Field
New field "Übergeordneter Eintrag" in the wiki editor form, above the body textarea.

- A text input that filters `state.wikiAllEntries` as you type (client-side, no extra API call).
- Dropdown shows up to 10 matches: title + type badge.
- Selecting an entry fills a hidden `parentId` field and shows the selected title with a ✕ clear button.
- Entries already excluded: self (current entry id), own descendants (computed client-side by walking children).
- On save, `parentId` is included in the create/update request body.
- When editing an existing entry that already has a parent, the field is pre-populated.

---

## Validation Error Messages
| Condition | HTTP | Message |
|---|---|---|
| Parent not in same world | 400 | "Übergeordneter Eintrag muss zur gleichen Welt gehören" |
| Self-reference | 400 | "Ein Eintrag kann nicht sein eigener Elterneintrag sein" |
| Cycle detected | 400 | "Zirkuläre Eltern-Kind-Beziehung nicht erlaubt" |
| Depth exceeded | 400 | "Maximale Verschachtelungstiefe (3) überschritten" |

---

## Out of Scope
- Moving a subtree when a parent is reassigned (entries simply re-parent individually).
- Visualising the hierarchy in the knowledge graph (graph remains type-based).
- Breadcrumb beyond one level (only immediate parent shown in article header).
