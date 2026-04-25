# Items Export — Design Spec

**Date:** 2026-04-19

## Overview

Admin-only download button in the Marktplatz toolbar that exports all items from the database as a single Markdown file containing a formatted table.

---

## Backend

### New Service: `ItemExportService`

`backend/src/main/java/com/pardur/service/ItemExportService.java`

- `@Service`, `@Transactional(readOnly = true)`
- Single public method: `exportItemsAsMarkdown() → String`
  - Loads all items via `ItemRepository.findAll()`, sorted by name ascending
  - Renders a Markdown document:
    ```
    # Marktplatz — Export

    _Exportiert: 2026-04-19_

    | Name | Preis ⚜ | Tags | Link |
    |------|---------|------|------|
    | Heiltrank | 50.00 | trank, heilung | [Link](https://…) |
    ```
  - Tags joined with `, `; empty tag list renders as `—`
  - URL field: if present, renders as `[Link](url)`; otherwise `—`
  - Exports **all items in the DB** — no filters, no world scope

### Updated Controller: `ExportController`

New endpoint added to existing `ExportController`:

```
GET /api/export/items
Produces: text/markdown
Response header: Content-Disposition: attachment; filename="items-export.md"
Security: already covered by /api/export/** → ADMIN only (SecurityConfig)
```

Returns `ResponseEntity<byte[]>` with UTF-8 encoded Markdown bytes.

---

## Frontend

### `index.html` — Toolbar button

In `#page-items > .toolbar`, add a button after the existing filter fields:

```html
<div class="fg admin-only" style="display:none; align-self:flex-end">
  <button class="btn btn-sm" onclick="exportItems()">⤓ Exportieren</button>
</div>
```

Uses `admin-only` class so `applyAuthUI()` controls visibility automatically.

### `app.js` — `exportItems()` function

New function following the same anchor-download pattern as `exportWorldWiki()`:

```js
function exportItems() {
  console.debug('[exportItems] →');
  const a = document.createElement('a');
  a.href = '/api/export/items';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.debug('[exportItems] ← download triggered');
}
```

---

## Security

No changes needed. `/api/export/**` is already restricted to `ADMIN` in `SecurityConfig`.

---

## Out of Scope

- Filtering/searching before export (always full DB export)
- Per-item `.md` files / ZIP archive
- Description field in export (not present in current `ItemDto`; toDto maps url or description to url field — export uses the same resolved url value)
