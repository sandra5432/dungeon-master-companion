# Item Tags — Design Spec
**Date:** 2026-03-30
**Status:** Approved

## Overview

Add free-form tags to marketplace items, filterable via a multi-select dropdown in the toolbar. Mirrors the existing event tags pattern. The existing `rarity` column is retired and its values are migrated into tags — the tag filter replaces both the old rarity filter and the new tag filter in one unified UI.

---

## Database Layer

**Migration V7:** `V7__add_item_tags.sql`

```sql
-- 1. Create item_tags table
CREATE TABLE item_tags (
  item_id  INT          NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (item_id, tag_name),
  CONSTRAINT fk_item_tag_item
    FOREIGN KEY (item_id) REFERENCES items(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_item_tags_tag ON item_tags(tag_name);

-- 2. Migrate existing rarity values as tags (lowercase, spaces → '-')
INSERT INTO item_tags (item_id, tag_name)
SELECT id, LOWER(REPLACE(rarity, ' ', '-'))
FROM items
WHERE rarity IS NOT NULL AND rarity != '';

-- 3. Drop rarity column
ALTER TABLE items DROP COLUMN rarity;
```

Rarity values migrate as: `Common` → `common`, `Uncommon` → `uncommon`, `Rare` → `rare`, `Legendary` → `legendary`.

---

## Backend

### New model classes

**`ItemTagId`** (`@Embeddable`) — composite key with `itemId (Integer)` and `tagName (String)`.

**`ItemTag`** (`@Entity`, table `item_tags`) — `@EmbeddedId ItemTagId id` + `@ManyToOne Item item`. Mirrors `EventTag`/`EventTagId` exactly.

### Item entity changes

- Add:
```java
@OneToMany(mappedBy = "item", cascade = CascadeType.ALL, orphanRemoval = true)
private List<ItemTag> tags = new ArrayList<>();
```
- Remove: `rarity` field, getter, setter

### Repository

**`ItemTagRepository`** extends `JpaRepository<ItemTag, ItemTagId>`:
```java
@Query("SELECT new com.pardur.dto.response.TagCountDto(t.id.tagName, COUNT(t)) " +
       "FROM ItemTag t GROUP BY t.id.tagName ORDER BY COUNT(t) DESC")
List<TagCountDto> findAllTagCounts();
```

### Service — `ItemService`

New private helper:
```java
private void setTags(Item item, List<String> tagNames) {
    item.getTags().clear();
    if (tagNames != null) {
        for (String tag : tagNames) {
            String normalized = tag.trim().toLowerCase().replace(' ', '-');
            if (!normalized.isEmpty()) {
                item.getTags().add(new ItemTag(item, normalized));
            }
        }
    }
}
```

Called in both `createItem` and `updateItem`. Remove all rarity handling.

DTO mapping — add to `toDto()`:
```java
dto.setTags(item.getTags().stream().map(t -> t.getId().getTagName()).toList());
```

New method:
```java
public List<TagCountDto> getTagCounts() {
    return itemTagRepository.findAllTagCounts();
}
```

### Controller — `ItemController`

New endpoint:
```java
@GetMapping("/tags")
public ResponseEntity<List<TagCountDto>> getTags() {
    return ResponseEntity.ok(itemService.getTagCounts());
}
```

### DTOs

- `CreateItemRequest` / `UpdateItemRequest` — remove `rarity`, add `private List<String> tags;`
- `ItemDto` — remove `rarity`, add `private List<String> tags;`
- `TagCountDto` — already exists, reused as-is

---

## Frontend

### Tag input in item modal form (`index.html`)

Replace the `Seltenheit` select field with a tags text input:
```html
<div class="f-grp">
  <label class="f-lbl">Tags</label>
  <input class="f-inp" id="fi-tags" type="text" placeholder="z.B. rare, melee, warrior">
  <span class="f-hint">Kommagetrennt – Leerzeichen werden zu „-" umgewandelt</span>
</div>
```

### Tag filter dropdown in toolbar (`index.html` + `app.js`)

Replace the existing rarity filter dropdown with a unified tag filter, same structure and style:

```html
<div class="tag-filter" id="item-tag-filter">
  <button id="itf-trigger" onclick="toggleItemTagDd(event)">
    <span id="itf-label"><span class="placeholder">Alle Tags</span></span> ▾
  </button>
  <div id="itf-dropdown">
    <!-- populated dynamically from GET /api/items/tags -->
  </div>
</div>
```

Tag counts fetched once on page load alongside items. Dropdown rebuilt whenever the page loads.

### State

Replace `state.ui.rarityFilter` with `state.ui.activeItemTags` — `new Set()`.

### Filtering logic in `renderItems()`

Replace rarity filter clause with:
```js
&& (state.ui.activeItemTags.size === 0 ||
    (it.tags || []).some(t => state.ui.activeItemTags.has(t)))
```

OR-logic: item shown if it has at least one of the selected tags.

### Tag display in item table

Replace the `Seltenheit` column with a **Tags** column. Tags rendered as plain small badges reusing `.ev-tag` style (no colour coding):
```js
<td>${(it.tags || []).map(t => `<span class="ev-tag">${escHtml(t)}</span>`).join('')}</td>
```

Table header `onclick` sort for rarity removed (no sort on tags column).

### Create/edit modal (`app.js`)

- `openAddModal()` — clears `fi-tags` input, remove `fi-r` references
- `openEditItem()` — prefills `fi-tags` with `it.tags.join(', ')`, remove `fi-r` references
- `saveEntry()` — reads `fi-tags`, splits on `,`, passes as `tags` array; remove `rarity` from payload

### Remove rarity-specific code

- `updateRarityLabel()`, `toggleRarityDd()`, `clearRarity()`, `onRarityChange()` functions — remove
- `#rarity-filter`, `#rf-dropdown`, `#rf-trigger`, `#rf-label` elements — remove
- `.rarity-badge`, `.rarity-common`, `.rarity-uncommon`, `.rarity-rare`, `.rarity-legendary` CSS — remove

---

## Tag Normalization (summary)

Applied in `ItemService.setTags()` on the backend:

| Input | Stored as |
|-------|-----------|
| `"Wild fire"` | `"wild-fire"` |
| `"  RP-Item  "` | `"rp-item"` |
| `"Rare"` | `"rare"` |
| `"Legendary"` | `"legendary"` |

The frontend sends the raw comma-separated string; the backend splits and normalizes.

---

## Migration Pre-check

Before writing V7, V6 (`add_characters_to_timeline_events`) was created as a hotfix to close a gap where the `characters` column existed in the entity but had no migration script.

Migration order:
- V6 — adds `characters` to `timeline_events` (hotfix, already written)
- V7 — creates `item_tags`, migrates rarity values as tags, drops `rarity` column
