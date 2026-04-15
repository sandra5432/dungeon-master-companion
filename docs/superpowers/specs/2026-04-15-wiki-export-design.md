# Wiki Export — Design Spec

**Date:** 2026-04-15
**Status:** Approved

## Summary

Add an admin-only "export wiki" action to the world config menu. When triggered, the browser downloads a ZIP file containing all wiki entries for that world as individual Markdown files, organized by the parent/child hierarchy.

---

## Requirements

- Admin-only: only users with role `ADMIN` may trigger the export.
- Scope: one world at a time (triggered from the world config table row).
- Output: a single ZIP file download.
- Content: **all** entries including verbatim spoiler blocks (`:::spoiler ... :::`).
- File organization: hierarchical — parent entries become folders; root entries with no children are flat files at the ZIP root.
- Filenames: sanitized — spaces → underscores, characters outside `[a-z0-9_-]` stripped (after lowercasing), multiple consecutive underscores collapsed to one.
- ZIP filename: `<world-name-sanitized>-wiki-export.zip`.
- **HTTP Basic Auth supported** — the endpoint must accept both session-based auth (browser/SPA) and HTTP Basic Auth (username + password header), so it can be called from scripts or tools without a session cookie.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `controller/ExportController.java` | Single endpoint for export operations |
| `service/WikiExportService.java` | ZIP-building logic |
| `test/controller/ExportControllerTest.java` | Integration tests |

### Changed Files

| File | Change |
|------|--------|
| `config/SecurityConfig.java` | Add `/api/export/**` → `hasRole("ADMIN")` |
| `static/js/app.js` | Add `exportWorldWiki()` function and button in `renderConfigWorlds()` |

---

## Backend

### Endpoint

```
GET /api/export/worlds/{worldId}/wiki
```

- **Auth:** `hasRole("ADMIN")`
- **Response:** `200 OK`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="<sanitized-world-name>-wiki-export.zip"`
- **Errors:** `404` if world does not exist

### ExportController

```java
@RestController
@RequestMapping("/api/export")
public class ExportController {

    @GetMapping(value = "/worlds/{worldId}/wiki", produces = "application/zip")
    public ResponseEntity<byte[]> exportWiki(@PathVariable Integer worldId) throws IOException {
        byte[] zip = wikiExportService.exportWikiAsZip(worldId);
        String filename = wikiExportService.buildZipFilename(worldId);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(zip);
    }
}
```

### WikiExportService

**`byte[] exportWikiAsZip(Integer worldId)`**

1. Load world (throw `ResourceNotFoundException` if missing).
2. Load all entries for world via `WikiEntryRepository.findAllByWorldIdOrderByTitleAsc(worldId)`.
3. Separate into root entries (no parent) and a lookup map of `parentId → List<child>`.
4. For each root entry:
   - If it has no children: add `<sanitized-title>.md` at ZIP root.
   - If it has children: add `<sanitized-title>/<sanitized-title>.md` + recurse for each child.
   - Rule applies at every level: any entry that has children becomes a folder; its own `.md` lives inside that folder alongside its children's files.
   - Example with 3 levels: `gods/gods.md`, `gods/odin/odin.md`, `gods/odin/valhalla.md`.
5. Return the completed ZIP as `byte[]`.

**File content format** for each `.md`:

```markdown
# <Title>

**Type:** <TYPE>
**Created by:** <username>
**Last updated:** <YYYY-MM-DD>

---

<body verbatim, or *(no content)* if body is null/blank>
```

**Filename sanitization:**
1. Lowercase the title.
2. Replace umlauts: ä→ae, ö→oe, ü→ue, ß→ss.
3. Replace spaces and hyphens with underscores.
4. Strip all characters not in `[a-z0-9_]`.
5. Collapse multiple underscores to one.
6. Trim leading/trailing underscores.
7. Append `.md`.

**`String buildZipFilename(Integer worldId)`** — returns `<sanitized-world-name>-wiki-export.zip`.

---

## Security

Two changes to `SecurityConfig.filterChain()`:

**1. Enable HTTP Basic Auth** — add `.httpBasic(Customizer.withDefaults())` to the filter chain. Spring Security will then accept either a valid session cookie or a `Authorization: Basic <base64>` header. The existing session-based login flow for the SPA is unaffected.

**2. Add the export rule** — add before the `anyRequest().authenticated()` catch-all:

```
.requestMatchers("/api/export/**").hasRole("ADMIN")
```

Together these allow both:
- Browser SPA: session cookie (existing flow, no change)
- Scripts/tools: `curl -u admin:password https://host/api/export/worlds/1/wiki --output export.zip`

Note: Basic Auth sends credentials on every request. This is acceptable here because the app enforces HTTPS in production and the endpoint is intentionally admin-only.

---

## Frontend

### New function: `exportWorldWiki(worldId, worldName)`

```js
function exportWorldWiki(worldId, worldName) {
  console.debug('[exportWorldWiki] →', worldId, worldName);
  const a = document.createElement('a');
  a.href = `/api/export/worlds/${worldId}/wiki`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.debug('[exportWorldWiki] ← download triggered');
}
```

No `fetch` needed — the browser handles the file download via navigation.

### Updated `renderConfigWorlds()`

Add the export button to each world row's action cell:

```html
<button class="act-btn" onclick="exportWorldWiki(${w.id},${JSON.stringify(w.name)})" title="Wiki exportieren">⬇</button>
```

Placed between the edit (✎) and delete (✕) buttons.

---

## Tests

File: `backend/src/test/java/com/pardur/controller/ExportControllerTest.java`

All tests use `@SpringBootTest`, `@AutoConfigureMockMvc`, `@ActiveProfiles("dev")`.

| # | Test | Assertion |
|---|------|-----------|
| 1 | `exportWiki_returns401_whenUnauthenticated` | `4xx` status |
| 2 | `exportWiki_returns403_whenNonAdmin` | `403` with `@WithMockUser(roles="USER")` |
| 3 | `exportWiki_returns404_whenWorldNotFound` | `404` with `@WithMockUser(roles={"ADMIN","USER"})` |
| 4 | `exportWiki_returnsEmptyZip_whenWorldHasNoEntries` | `200`, valid ZIP, 0 entries |
| 5 | `exportWiki_returnsZipWithFlatFiles_whenEntriesHaveNoParent` | ZIP contains `<sanitized>.md` at root |
| 6 | `exportWiki_returnsZipWithFolders_whenEntriesHaveChildren` | ZIP contains `parent/parent.md` and `parent/child.md` |
| 7 | `exportWiki_fileContainsExpectedFrontmatter` | `.md` content has `# Title`, `**Type:**`, `**Created by:**`, body |
| 8 | `exportWiki_sanitizesFilenamesCorrectly` | Title `"Ä böser Wald!"` → `ae_boser_wald.md` |
| 9 | `exportWiki_returns200_withBasicAuth` | Admin credentials via `Authorization: Basic` header → `200 OK` |
| 10 | `exportWiki_returns401_withBasicAuth_wrongPassword` | Wrong password via Basic Auth → `401` |

---

## Out of Scope

- Exporting images (binary blobs) — text only.
- Exporting other world data (timeline events, map POIs).
- Bulk export of all worlds at once.
- Progress indicator for large worlds.
