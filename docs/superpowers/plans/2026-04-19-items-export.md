# Items Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only download button in the Marktplatz toolbar that exports all items from the database as a single Markdown file with a table.

**Architecture:** A new `ItemExportService` builds the Markdown string from all DB items sorted by name. `ExportController` gets a new `GET /api/export/items` endpoint that returns the file as bytes. The frontend adds an `admin-only` button and `exportItems()` anchor-download function matching the existing `exportWorldWiki()` pattern.

**Tech Stack:** Java 21, Spring Boot 3, JUnit 5 + Mockito (unit), `@SpringBootTest` + MockMvc (integration), Vanilla JS

---

## File Map

| File | Action |
|------|--------|
| `backend/src/main/java/com/pardur/service/ItemExportService.java` | Create |
| `backend/src/main/java/com/pardur/controller/ExportController.java` | Modify — add endpoint |
| `backend/src/test/java/com/pardur/service/ItemExportServiceTest.java` | Create |
| `backend/src/test/java/com/pardur/controller/ExportControllerTest.java` | Modify — add test methods |
| `backend/src/main/resources/static/index.html` | Modify — add toolbar button |
| `backend/src/main/resources/static/js/app.js` | Modify — add `exportItems()` |

---

### Task 1: Unit-test and implement `ItemExportService`

**Files:**
- Create: `backend/src/main/java/com/pardur/service/ItemExportService.java`
- Create: `backend/src/test/java/com/pardur/service/ItemExportServiceTest.java`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/src/test/java/com/pardur/service/ItemExportServiceTest.java`:

```java
package com.pardur.service;

import com.pardur.model.Item;
import com.pardur.model.ItemTag;
import com.pardur.repository.ItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ItemExportServiceTest {

    ItemRepository itemRepo;
    ItemExportService service;

    @BeforeEach
    void setUp() {
        itemRepo = mock(ItemRepository.class);
        service  = new ItemExportService(itemRepo);
    }

    // ── renderMarkdownTable ────────────────────────────────────────────────────

    @Test
    void renderMarkdownTable_containsHeader() {
        String md = ItemExportService.renderMarkdownTable(List.of());
        assertThat(md).contains("# Marktplatz");
        assertThat(md).contains("| Name |");
        assertThat(md).contains("| Preis ⚜ |");
        assertThat(md).contains("| Tags |");
        assertThat(md).contains("| Link |");
    }

    @Test
    void renderMarkdownTable_emptyList_hasNoDataRows() {
        String md = ItemExportService.renderMarkdownTable(List.of());
        // header row + separator row only — no third | row
        long tableRows = md.lines()
                .filter(l -> l.startsWith("|") && !l.startsWith("|---"))
                .count();
        assertThat(tableRows).isEqualTo(1); // only the header row
    }

    @Test
    void renderMarkdownTable_itemWithAllFields_renderedCorrectly() {
        Item item = buildItem("Heiltrank", "50.00", List.of("trank", "heilung"), "https://example.com");
        String md = ItemExportService.renderMarkdownTable(List.of(item));
        assertThat(md).contains("| Heiltrank |");
        assertThat(md).contains("50.00");
        assertThat(md).contains("trank, heilung");
        assertThat(md).contains("[Link](https://example.com)");
    }

    @Test
    void renderMarkdownTable_itemWithNoTags_rendersDash() {
        Item item = buildItem("Schwert", "120.00", List.of(), null);
        String md = ItemExportService.renderMarkdownTable(List.of(item));
        assertThat(md).contains("| — |"); // tags cell
    }

    @Test
    void renderMarkdownTable_itemWithNoUrl_rendersDash() {
        Item item = buildItem("Schwert", "120.00", List.of(), null);
        String md = ItemExportService.renderMarkdownTable(List.of(item));
        // last column before newline should be —
        assertThat(md).contains("— |");
    }

    @Test
    void renderMarkdownTable_multipleItems_allPresent() {
        Item a = buildItem("Apfel", "1.00", List.of(), null);
        Item b = buildItem("Brot",  "2.00", List.of(), null);
        String md = ItemExportService.renderMarkdownTable(List.of(a, b));
        assertThat(md).contains("| Apfel |");
        assertThat(md).contains("| Brot |");
    }

    // ── exportItemsAsMarkdown ─────────────────────────────────────────────────

    @Test
    void exportItemsAsMarkdown_queriesRepoSortedByNameAsc() {
        when(itemRepo.findAll(Sort.by(Sort.Direction.ASC, "name"))).thenReturn(List.of());
        service.exportItemsAsMarkdown();
        verify(itemRepo).findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Item buildItem(String name, String price, List<String> tagNames, String url) {
        Item item = new Item();
        item.setName(name);
        item.setPrice(new BigDecimal(price));
        item.setUrl(url);
        for (String t : tagNames) {
            item.getTags().add(new ItemTag(item, t));
        }
        return item;
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . -Dtest=ItemExportServiceTest -q 2>&1 | tail -20
```

Expected: compilation error — `ItemExportService` does not exist yet.

- [ ] **Step 3: Implement `ItemExportService`**

Create `backend/src/main/java/com/pardur/service/ItemExportService.java`:

```java
package com.pardur.service;

import com.pardur.model.Item;
import com.pardur.repository.ItemRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Builds a Markdown export document for all marketplace items.
 */
@Service
public class ItemExportService {

    private final ItemRepository itemRepository;

    public ItemExportService(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    /**
     * Exports all items from the database as a Markdown document with a table.
     * Items are sorted by name ascending.
     *
     * @return Markdown string ready to be written to a .md file
     */
    @Transactional(readOnly = true)
    public String exportItemsAsMarkdown() {
        List<Item> items = itemRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return renderMarkdownTable(items);
    }

    /**
     * Renders the Markdown table for the given list of items.
     * Static to allow direct unit testing without Spring context.
     *
     * @param items items to render; may be empty
     * @return Markdown string
     */
    static String renderMarkdownTable(List<Item> items) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Marktplatz — Export\n\n");
        sb.append("_Exportiert: ").append(LocalDate.now()).append("_\n\n");
        sb.append("| Name | Preis ⚜ | Tags | Link |\n");
        sb.append("|------|---------|------|------|\n");
        for (Item item : items) {
            String tags = item.getTags().isEmpty()
                    ? "—"
                    : item.getTags().stream()
                            .map(t -> t.getId().getTagName())
                            .collect(Collectors.joining(", "));
            String url = (item.getUrl() != null && !item.getUrl().isBlank())
                    ? "[Link](" + item.getUrl() + ")"
                    : "—";
            sb.append("| ").append(escape(item.getName())).append(" | ")
              .append(item.getPrice().toPlainString()).append(" | ")
              .append(tags).append(" | ")
              .append(url).append(" |\n");
        }
        return sb.toString();
    }

    /** Escapes Markdown pipe characters inside cell values. */
    private static String escape(String value) {
        return value == null ? "" : value.replace("|", "\\|");
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . -Dtest=ItemExportServiceTest -q 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/pardur/service/ItemExportService.java \
        backend/src/test/java/com/pardur/service/ItemExportServiceTest.java
git commit -m "feat(export): add ItemExportService — renders all items as markdown table"
```

---

### Task 2: Expose `GET /api/export/items` endpoint + integration tests

**Files:**
- Modify: `backend/src/main/java/com/pardur/controller/ExportController.java`
- Modify: `backend/src/test/java/com/pardur/controller/ExportControllerTest.java`

- [ ] **Step 1: Write the failing integration tests**

Add these test methods to `ExportControllerTest` (inside the existing class body, after the existing wiki tests). The class already has `@SpringBootTest`, `@AutoConfigureMockMvc`, `@ActiveProfiles("dev")`, and an `adminUser` / `tearDown` with `ItemRepository` not yet injected — add the field and teardown cleanup as shown:

First add these two fields to the existing `ExportControllerTest` class:

```java
@Autowired ItemRepository itemRepository;

// Add to @BeforeEach or save items in each test — use per-test items below
```

Now add the following test methods to the existing `ExportControllerTest` class:

```java
// ── /api/export/items ────────────────────────────────────────────────────────

@Test
void exportItems_returns4xx_whenUnauthenticated() throws Exception {
    mvc.perform(get("/api/export/items"))
            .andExpect(status().is4xxClientError());
}

@Test
@WithMockUser(username = "user", roles = {"USER"})
void exportItems_returns403_whenNonAdmin() throws Exception {
    mvc.perform(get("/api/export/items"))
            .andExpect(status().isForbidden());
}

@Test
@WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
void exportItems_returns200WithMarkdown_whenAdmin() throws Exception {
    mvc.perform(get("/api/export/items"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/markdown")))
            .andExpect(header().string("Content-Disposition",
                    org.hamcrest.Matchers.containsString("items-export.md")));
}

@Test
@WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
void exportItems_markdownContainsItemData() throws Exception {
    Item item = new Item();
    item.setName("Testgegenstand-" + System.nanoTime());
    item.setPrice(new java.math.BigDecimal("42.00"));
    item = itemRepository.save(item);
    final int savedId = item.getId();

    try {
        MvcResult result = mvc.perform(get("/api/export/items"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(body).contains(item.getName());
        assertThat(body).contains("42.00");
        assertThat(body).contains("# Marktplatz");
    } finally {
        itemRepository.deleteById(savedId);
    }
}
```

Also add the import at the top of `ExportControllerTest.java`:

```java
import com.pardur.model.Item;
import com.pardur.repository.ItemRepository;
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . -Dtest=ExportControllerTest -q 2>&1 | tail -20
```

Expected: `exportItems_*` tests fail with 404 — endpoint not yet mapped.

- [ ] **Step 3: Add endpoint to `ExportController`**

Open `backend/src/main/java/com/pardur/controller/ExportController.java`. Add the `ItemExportService` dependency and the new endpoint:

```java
package com.pardur.controller;

import com.pardur.service.ItemExportService;
import com.pardur.service.WikiExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Handles data export operations. All endpoints require ADMIN role (enforced by SecurityConfig).
 * Both session-based auth and HTTP Basic Auth are accepted.
 */
@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final WikiExportService wikiExportService;
    private final ItemExportService itemExportService;

    public ExportController(WikiExportService wikiExportService,
                            ItemExportService itemExportService) {
        this.wikiExportService = wikiExportService;
        this.itemExportService = itemExportService;
    }

    /**
     * Exports all wiki entries for the given world as a ZIP of Markdown files,
     * organized by parent/child hierarchy.
     *
     * @param worldId the world to export; must exist
     * @return ZIP bytes with Content-Disposition attachment header
     * @throws IOException if ZIP serialization fails
     */
    @GetMapping(value = "/worlds/{worldId}/wiki", produces = "application/zip")
    public ResponseEntity<byte[]> exportWiki(@PathVariable Integer worldId) throws IOException {
        byte[] zip = wikiExportService.exportWikiAsZip(worldId);
        String filename = wikiExportService.buildZipFilename(worldId);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(zip);
    }

    /**
     * Exports all marketplace items as a single Markdown file with a table.
     * Items are sorted by name ascending; no filters are applied.
     *
     * @return Markdown bytes with Content-Disposition attachment header
     */
    @GetMapping(value = "/items", produces = "text/markdown;charset=UTF-8")
    public ResponseEntity<byte[]> exportItems() {
        byte[] bytes = itemExportService.exportItemsAsMarkdown()
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"items-export.md\"")
                .body(bytes);
    }
}
```

- [ ] **Step 4: Run all export tests to verify they pass**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . -Dtest=ExportControllerTest,ItemExportServiceTest -q 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/pardur/controller/ExportController.java \
        backend/src/test/java/com/pardur/controller/ExportControllerTest.java
git commit -m "feat(export): GET /api/export/items — download all items as markdown"
```

---

### Task 3: Frontend — toolbar button and `exportItems()` function

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add the download button in `index.html`**

In `index.html`, find the `#page-items` toolbar. It currently ends with:

```html
    <div class="fg"><label class="fl">Max. Preis ⚜</label><input class="fi" id="s-max" type="number" placeholder="∞" oninput="state.ui.itemPage=0;renderItems()"></div>
  </div>
```

Add the export button div **before** the closing `</div>` of `.toolbar`:

```html
    <div class="fg"><label class="fl">Max. Preis ⚜</label><input class="fi" id="s-max" type="number" placeholder="∞" oninput="state.ui.itemPage=0;renderItems()"></div>
    <div class="fg admin-only" style="display:none; align-self:flex-end">
      <button class="btn btn-sm" onclick="exportItems()">⤓ Exportieren</button>
    </div>
  </div>
```

- [ ] **Step 2: Add `exportItems()` in `app.js`**

Find the existing `exportWorldWiki` function in `app.js`. Add `exportItems` immediately after it:

```js
/**
 * Triggers a browser download of the full items export as a Markdown file.
 * Uses a temporary anchor element to initiate the download without a fetch call.
 */
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

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -q 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Manual smoke test**

1. Start the app: `cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" spring-boot:run -Dspring-boot.run.profiles=dev`
2. Log in as `admin` — navigate to Marktplatz
3. Verify the "⤓ Exportieren" button appears in the filter bar
4. Click it — confirm a file `items-export.md` downloads
5. Open the file — confirm it contains a Markdown table with all items, correct prices and tags
6. Log in as a non-admin user — verify the button is not visible

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/static/index.html \
        backend/src/main/resources/static/js/app.js
git commit -m "feat(export): admin-only export button on Marktplatz toolbar"
```
