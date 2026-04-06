# Wiki Parent Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional parent-child hierarchy to wiki entries (max depth 3), with a hierarchy sidebar view, article breadcrumb/Unterseiten section, and parent search in the editor.

**Architecture:** Self-referencing FK on `wiki_entries.parent_id`. Depth and cycle validation in the service layer. Tree rendering built client-side from the flat entry list already loaded in state. Editor parent search filters `state.wikiAllEntries` client-side, no extra API calls.

**Tech Stack:** Java 21, Spring Boot 3, JPA/Hibernate, Flyway, Vanilla JS, CSS custom properties.

**Maven path:** `/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn`  
**Run tests from:** `backend/` directory

---

## File Map

| File | Change |
|---|---|
| `backend/src/main/resources/db/migration/V14__wiki_parent.sql` | CREATE — adds `parent_id` column |
| `backend/src/main/java/com/pardur/model/WikiEntry.java` | MODIFY — add `parent` ManyToOne field |
| `backend/src/main/java/com/pardur/dto/response/WikiChildDto.java` | CREATE — id, title, type |
| `backend/src/main/java/com/pardur/dto/response/WikiEntryListItemDto.java` | MODIFY — add `parentId` |
| `backend/src/main/java/com/pardur/dto/response/WikiEntryDto.java` | MODIFY — add `parentId`, `parentTitle`, `children` |
| `backend/src/main/java/com/pardur/dto/request/CreateWikiEntryRequest.java` | MODIFY — add `parentId` |
| `backend/src/main/java/com/pardur/dto/request/UpdateWikiEntryRequest.java` | MODIFY — add `parentId` |
| `backend/src/main/java/com/pardur/repository/WikiEntryRepository.java` | MODIFY — add `findByParentId` |
| `backend/src/main/java/com/pardur/service/WikiService.java` | MODIFY — depth/cycle validation, toDto, toListItemDto, create, update |
| `backend/src/test/java/com/pardur/service/WikiServiceTest.java` | MODIFY — add parent validation tests |
| `backend/src/main/resources/static/index.html` | MODIFY — rename view btn, add parent field in editor |
| `backend/src/main/resources/static/js/app.js` | MODIFY — hierarchy view rendering, article breadcrumb/Unterseiten, editor parent search |
| `backend/src/main/resources/static/css/app.css` | MODIFY — hierarchy indent, breadcrumb, Unterseiten, parent search dropdown |

---

### Task 1: DB Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__wiki_parent.sql`

- [ ] **Step 1: Create migration file**

```sql
-- V14__wiki_parent.sql
ALTER TABLE wiki_entries
    ADD COLUMN parent_id INT NULL,
    ADD CONSTRAINT fk_wiki_entry_parent
        FOREIGN KEY (parent_id) REFERENCES wiki_entries(id)
        ON DELETE SET NULL;
```

- [ ] **Step 2: Verify migration applies cleanly**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" flyway:info -Pdev 2>&1 | tail -20
```
Expected: V14 shows as `Pending`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V14__wiki_parent.sql
git commit -m "feat: add parent_id to wiki_entries (V14 migration)"
```

---

### Task 2: WikiEntry entity — add parent field

**Files:**
- Modify: `backend/src/main/java/com/pardur/model/WikiEntry.java`

- [ ] **Step 1: Add the parent field and getter/setter**

After the `createdBy` field (line ~35), add:

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "parent_id")
private WikiEntry parent;
```

After the existing getters/setters (before the closing `}`), add:

```java
public WikiEntry getParent() { return parent; }
public void setParent(WikiEntry parent) { this.parent = parent; }
```

- [ ] **Step 2: Build to verify no compile errors**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/pardur/model/WikiEntry.java
git commit -m "feat: add parent self-reference to WikiEntry entity"
```

---

### Task 3: New WikiChildDto

**Files:**
- Create: `backend/src/main/java/com/pardur/dto/response/WikiChildDto.java`

- [ ] **Step 1: Create the class**

```java
package com.pardur.dto.response;

public class WikiChildDto {
    private Integer id;
    private String title;
    private String type;

    public WikiChildDto(Integer id, String title, String type) {
        this.id = id;
        this.title = title;
        this.type = type;
    }

    public Integer getId() { return id; }
    public String getTitle() { return title; }
    public String getType() { return type; }
}
```

- [ ] **Step 2: Compile**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: BUILD SUCCESS

---

### Task 4: Update DTOs

**Files:**
- Modify: `backend/src/main/java/com/pardur/dto/response/WikiEntryListItemDto.java`
- Modify: `backend/src/main/java/com/pardur/dto/response/WikiEntryDto.java`
- Modify: `backend/src/main/java/com/pardur/dto/request/CreateWikiEntryRequest.java`
- Modify: `backend/src/main/java/com/pardur/dto/request/UpdateWikiEntryRequest.java`

- [ ] **Step 1: Add `parentId` to WikiEntryListItemDto**

Add field + getter/setter after `updatedAt`:

```java
private Integer parentId;

public Integer getParentId() { return parentId; }
public void setParentId(Integer parentId) { this.parentId = parentId; }
```

- [ ] **Step 2: Add `parentId`, `parentTitle`, `children` to WikiEntryDto**

Add after `updatedAt` field:

```java
private Integer parentId;
private String parentTitle;
private List<WikiChildDto> children = new ArrayList<>();
```

Add the import at the top of the file:
```java
import java.util.ArrayList;
```

Add getters/setters:
```java
public Integer getParentId() { return parentId; }
public void setParentId(Integer parentId) { this.parentId = parentId; }
public String getParentTitle() { return parentTitle; }
public void setParentTitle(String parentTitle) { this.parentTitle = parentTitle; }
public List<WikiChildDto> getChildren() { return children; }
public void setChildren(List<WikiChildDto> children) { this.children = children; }
```

- [ ] **Step 3: Add `parentId` to CreateWikiEntryRequest**

Add field + getter/setter (no validation annotation — nullable):

```java
private Integer parentId;

public Integer getParentId() { return parentId; }
public void setParentId(Integer parentId) { this.parentId = parentId; }
```

- [ ] **Step 4: Add `parentId` to UpdateWikiEntryRequest**

Same as above:

```java
private Integer parentId;

public Integer getParentId() { return parentId; }
public void setParentId(Integer parentId) { this.parentId = parentId; }
```

- [ ] **Step 5: Compile**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/pardur/dto/
git commit -m "feat: add parentId/children fields to wiki DTOs"
```

---

### Task 5: Repository — add findByParentId

**Files:**
- Modify: `backend/src/main/java/com/pardur/repository/WikiEntryRepository.java`

- [ ] **Step 1: Add the derived query method**

Add after `findDuplicateTitle`:

```java
List<WikiEntry> findByParentId(Integer parentId);
```

- [ ] **Step 2: Compile**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: BUILD SUCCESS

---

### Task 6: WikiService — parent validation + mapping

**Files:**
- Modify: `backend/src/main/java/com/pardur/service/WikiService.java`

- [ ] **Step 1: Add private helper methods for depth and cycle checks**

Add these two private methods before the `toDto` method:

```java
/** Returns number of ancestors of entry (0 = root). Max walks 4 to stay cheap. */
private int ancestorDepth(WikiEntry entry) {
    int depth = 0;
    WikiEntry current = entry.getParent();
    while (current != null && depth < 4) {
        depth++;
        current = current.getParent();
    }
    return depth;
}

/** True if entryId appears anywhere in the ancestor chain of potentialParent. */
private boolean wouldCreateCycle(WikiEntry potentialParent, Integer entryId) {
    WikiEntry current = potentialParent;
    while (current != null) {
        if (current.getId().equals(entryId)) return true;
        current = current.getParent();
    }
    return false;
}

/** Resolves and validates a parentId, returning the parent entity or null. */
private WikiEntry resolveParent(Integer parentId, Integer worldId, Integer selfId) {
    if (parentId == null) return null;
    WikiEntry parent = entryRepo.findById(parentId)
            .orElseThrow(() -> new ResourceNotFoundException("Parent entry not found: " + parentId));
    if (!parent.getWorld().getId().equals(worldId)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Übergeordneter Eintrag muss zur gleichen Welt gehören");
    }
    if (selfId != null && selfId.equals(parentId)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Ein Eintrag kann nicht sein eigener Elterneintrag sein");
    }
    if (selfId != null && wouldCreateCycle(parent, selfId)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Zirkuläre Eltern-Kind-Beziehung nicht erlaubt");
    }
    // parent itself is at depth ancestorDepth(parent); the new entry would be one deeper
    if (ancestorDepth(parent) >= 2) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Maximale Verschachtelungstiefe (3) überschritten");
    }
    return parent;
}
```

- [ ] **Step 2: Update `create` to set parent**

In the `create` method, after `entry.setCreatedBy(creator);` add:

```java
WikiEntry parent = resolveParent(req.getParentId(), req.getWorldId(), null);
entry.setParent(parent);
```

- [ ] **Step 3: Update `update` to set parent**

In the `update` method, after `entry.setType(req.getType());` add:

```java
WikiEntry parent = resolveParent(req.getParentId(), entry.getWorld().getId(), id);
entry.setParent(parent);
```

- [ ] **Step 4: Update `toDto` to include parent info and children**

In the `toDto` method, after `dto.setUpdatedAt(e.getUpdatedAt());` add:

```java
if (e.getParent() != null) {
    dto.setParentId(e.getParent().getId());
    dto.setParentTitle(e.getParent().getTitle());
}
dto.setChildren(entryRepo.findByParentId(e.getId()).stream()
        .map(c -> new WikiChildDto(c.getId(), c.getTitle(), c.getType().name()))
        .sorted(Comparator.comparing(WikiChildDto::getTitle))
        .toList());
```

Add the import at the top of WikiService.java if not present:
```java
import com.pardur.dto.response.WikiChildDto;
```

- [ ] **Step 5: Update `toListItemDto` to include parentId**

In `toListItemDto`, after `dto.setUpdatedAt(e.getUpdatedAt());` add:

```java
if (e.getParent() != null) {
    dto.setParentId(e.getParent().getId());
}
```

- [ ] **Step 6: Compile**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/pardur/service/WikiService.java \
        backend/src/main/java/com/pardur/repository/WikiEntryRepository.java \
        backend/src/main/java/com/pardur/dto/response/WikiChildDto.java
git commit -m "feat: wiki parent validation and DTO mapping in WikiService"
```

---

### Task 7: Unit tests for parent validation

**Files:**
- Modify: `backend/src/test/java/com/pardur/service/WikiServiceTest.java`

- [ ] **Step 1: Add tests for resolveParent validation**

Add the following test methods after the existing `delete_throwsForbidden_whenNotOwnerAndNotAdmin` test:

```java
@Test
void create_setsParent_whenValidParentId() throws Exception {
    WikiEntry parent = buildEntry(100, "Glimmquali", null, world);
    when(worldRepo.findById(1)).thenReturn(Optional.of(world));
    when(userRepo.findById(10)).thenReturn(Optional.of(user));
    when(entryRepo.findDuplicateTitle(eq(1), eq("Tavari"), eq(-1))).thenReturn(Optional.empty());
    when(entryRepo.findById(100)).thenReturn(Optional.of(parent));
    when(entryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(entryRepo.findByParentId(any())).thenReturn(List.of());

    CreateWikiEntryRequest req = new CreateWikiEntryRequest();
    req.setTitle("Tavari");
    req.setWorldId(1);
    req.setType(WikiEntryType.LOCATION);
    req.setParentId(100);

    // Should not throw
    assertThatCode(() -> service.create(req, 10)).doesNotThrowAnyException();
}

@Test
void create_throwsBadRequest_whenParentInDifferentWorld() throws Exception {
    World otherWorld = new World();
    setId(otherWorld, World.class, 99);
    otherWorld.setName("Other");

    WikiEntry parent = buildEntry(100, "OtherEntry", null, otherWorld);
    when(worldRepo.findById(1)).thenReturn(Optional.of(world));
    when(userRepo.findById(10)).thenReturn(Optional.of(user));
    when(entryRepo.findDuplicateTitle(eq(1), eq("Child"), eq(-1))).thenReturn(Optional.empty());
    when(entryRepo.findById(100)).thenReturn(Optional.of(parent));

    CreateWikiEntryRequest req = new CreateWikiEntryRequest();
    req.setTitle("Child");
    req.setWorldId(1);
    req.setType(WikiEntryType.TERM);
    req.setParentId(100);

    assertThatThrownBy(() -> service.create(req, 10))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("gleichen Welt");
}

@Test
void create_throwsBadRequest_whenDepthExceeded() throws Exception {
    // grandparent -> parent -> (new entry would be depth 3, grandparent's parent makes depth 4)
    WikiEntry grandGrandParent = buildEntry(10, "GGP", null, world);
    WikiEntry grandParent = buildEntry(11, "GP", null, world);
    WikiEntry parent = buildEntry(12, "P", null, world);
    // set chain: parent.parent = grandParent, grandParent.parent = grandGrandParent
    WikiEntry.class.getDeclaredField("parent"); // just access to verify field exists
    var parentField = WikiEntry.class.getDeclaredField("parent");
    parentField.setAccessible(true);
    parentField.set(grandParent, grandGrandParent);
    parentField.set(parent, grandParent);

    when(worldRepo.findById(1)).thenReturn(Optional.of(world));
    when(userRepo.findById(10)).thenReturn(Optional.of(user));
    when(entryRepo.findDuplicateTitle(eq(1), eq("TooDeep"), eq(-1))).thenReturn(Optional.empty());
    when(entryRepo.findById(12)).thenReturn(Optional.of(parent));

    CreateWikiEntryRequest req = new CreateWikiEntryRequest();
    req.setTitle("TooDeep");
    req.setWorldId(1);
    req.setType(WikiEntryType.TERM);
    req.setParentId(12);

    assertThatThrownBy(() -> service.create(req, 10))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Verschachtelungstiefe");
}
```

Also add `import org.mockito.ArgumentMatchers.any;` at the top if not present, and add `import static org.assertj.core.api.Assertions.assertThatCode;`.

- [ ] **Step 2: Run tests**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . -Dtest=WikiServiceTest -q
```
Expected: All tests pass (BUILD SUCCESS).

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/pardur/service/WikiServiceTest.java
git commit -m "test: wiki parent validation tests"
```

---

### Task 8: Frontend — sidebar hierarchy view

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Rename "Zuletzt" button to "Hierarchie" in index.html**

Find and replace in `index.html`:
```html
<!-- FIND -->
<button class="wiki-view-btn active" id="wiki-view-recent" onclick="setWikiView('recent')" title="Zuletzt geändert">Zuletzt</button>
```
```html
<!-- REPLACE WITH -->
<button class="wiki-view-btn active" id="wiki-view-hierarchy" onclick="setWikiView('hierarchy')" title="Eltern-Kind-Hierarchie">Hierarchie</button>
```

- [ ] **Step 2: Add `wikiCollapsedNodes` to state in app.js**

Find:
```js
    wikiCollapsedTypes: new Set(),
```
Replace with:
```js
    wikiCollapsedTypes: new Set(),
    wikiCollapsedNodes: new Set(),
```

- [ ] **Step 3: Change default wikiView to 'hierarchy' in state**

Find:
```js
    wikiView: 'recent',
```
Replace with:
```js
    wikiView: 'hierarchy',
```

- [ ] **Step 4: Update `setWikiView` to handle renamed id**

Find:
```js
  ['recent', 'alpha', 'type'].forEach(v => {
    const btn = document.getElementById(`wiki-view-${v}`);
    if (btn) btn.classList.toggle('active', v === view);
  });
```
Replace with:
```js
  ['hierarchy', 'alpha', 'type'].forEach(v => {
    const btn = document.getElementById(`wiki-view-${v}`);
    if (btn) btn.classList.toggle('active', v === view);
  });
```

- [ ] **Step 5: Add hierarchy rendering to `renderWikiRecentList`**

Find the `if (view === 'recent') {` block and replace the entire `if/else if/else if` chain with:

```js
  if (view === 'hierarchy') {
    const idSet = new Set(entries.map(e => e.id));
    // Build children map from the full entry list so parentId lookups work even when filtered
    const childrenMap = {};
    entries.forEach(e => {
      const pid = e.parentId;
      if (pid && idSet.has(pid)) {
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(e);
      }
    });
    Object.values(childrenMap).forEach(arr => arr.sort((a, b) => a.title.localeCompare(b.title, 'de')));

    const roots = entries
      .filter(e => !e.parentId || !idSet.has(e.parentId))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));

    function renderNode(e, depth) {
      const collapsed = state.ui.wikiCollapsedNodes.has(e.id);
      const children = childrenMap[e.id] || [];
      const hasChildren = children.length > 0;
      const indent = depth * 16;
      let html = `
        <div class="wiki-list-item wiki-hierarchy-item" style="padding-left:${12 + indent}px" onclick="loadWikiArticle(${e.id})">
          ${hasChildren
            ? `<span class="wiki-hierarchy-toggle" onclick="event.stopPropagation();toggleWikiNode(${e.id})">${collapsed ? '▶' : '▼'}</span>`
            : `<span class="wiki-hierarchy-spacer"></span>`}
          <span class="wiki-list-title">${escHtml(e.title)}</span>
          <span class="wiki-type-badge wiki-type-${e.type.toLowerCase()} wiki-type-badge--sm">${escHtml(e.type)}</span>
        </div>
      `;
      if (hasChildren && !collapsed) {
        children.forEach(child => { html += renderNode(child, depth + 1); });
      }
      return html;
    }

    el.innerHTML = roots.map(e => renderNode(e, 0)).join('');

  } else if (view === 'alpha') {
```

- [ ] **Step 6: Add `toggleWikiNode` function after `toggleWikiTypeGroup`**

```js
function toggleWikiNode(id) {
  if (state.ui.wikiCollapsedNodes.has(id)) {
    state.ui.wikiCollapsedNodes.delete(id);
  } else {
    state.ui.wikiCollapsedNodes.add(id);
  }
  applyWikiFilter();
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/static/index.html \
        backend/src/main/resources/static/js/app.js
git commit -m "feat: wiki hierarchy sidebar view with collapsible tree"
```

---

### Task 9: Frontend — article breadcrumb and Unterseiten section

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add breadcrumb and Unterseiten to `renderWikiArticle`**

In `renderWikiArticle`, find:

```js
  content.innerHTML = `
    <div class="wiki-article-header">
```

Replace the full `content.innerHTML = \`...\`` assignment (ending at the closing backtick after `</div>`) with the version below. The only additions are `breadcrumbHtml` before the header and `childrenHtml` before the meta line:

First, add these two variable declarations right before `content.innerHTML = \``:

```js
  const breadcrumbHtml = entry.parentId
    ? `<div class="wiki-breadcrumb"><a class="wiki-breadcrumb-link" onclick="loadWikiArticle(${entry.parentId})">← ${escHtml(entry.parentTitle)}</a></div>`
    : '';

  const childrenHtml = (entry.children && entry.children.length > 0)
    ? `<div class="wiki-linked-section">
        <h4>Unterseiten</h4>
        <div class="wiki-children-list">
          ${entry.children.map(c => `
            <a class="wiki-linked-item" href="#" onclick="loadWikiArticle(${c.id});return false">
              <span class="wiki-type-badge wiki-type-${c.type.toLowerCase()} wiki-type-badge--sm">${escHtml(c.type)}</span>
              ${escHtml(c.title)}
            </a>
          `).join('')}
        </div>
      </div>`
    : '';
```

Then in the template string, add `${breadcrumbHtml}` directly before `<div class="wiki-article-header">`, and add `${childrenHtml}` directly before the existing `<div class="wiki-article-meta">` line.

The template should look like:

```js
  content.innerHTML = `
    ${breadcrumbHtml}
    <div class="wiki-article-header">
      <span class="wiki-type-badge wiki-type-${entry.type.toLowerCase()}">${escHtml(entry.type)}</span>
      <h2 class="wiki-article-title">${escHtml(entry.title)}</h2>
      ${canEdit ? `
        <button class="wiki-icon-btn" title="Bearbeiten" onclick="openWikiEditor(${entry.id})">✎</button>
      ` : ''}
      ${canManageSpoilers ? `
        <button class="wiki-icon-btn wiki-icon-btn--del" title="Löschen" onclick="deleteWikiEntry(${entry.id})">🗑</button>
      ` : ''}
      <span class="wiki-article-world">${escHtml(entry.worldName)}</span>
    </div>
    <div class="wiki-article-body">
      <div class="wiki-images-float">${imagesHtml}</div>
      <div class="wiki-body-text">${bodyHtml}</div>
      <div style="clear:both"></div>
    </div>
    ${spoilerSection}
    <div class="wiki-linked-section">
      <h4>Verknüpfte Events</h4>
      <div id="wiki-linked-events-${entry.id}">Lade…</div>
    </div>
    <div class="wiki-linked-section">
      <h4>Verknüpfte Artikel</h4>
      <div id="wiki-linked-entries-${entry.id}">Lade…</div>
    </div>
    ${childrenHtml}
    <div class="wiki-article-meta">Erstellt von <strong>${escHtml(entry.createdByUsername)}</strong></div>
  `;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/static/js/app.js
git commit -m "feat: wiki article breadcrumb and Unterseiten section"
```

---

### Task 10: Frontend — editor parent search field

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add parent search field to editor HTML**

In `index.html`, find the editor's `two-col` form row (Typ + Welt). Add a new `form-row` directly after the closing `</div>` of that row (before `</div><!-- wiki-editor-fields -->`):

```html
            <div class="form-row wiki-parent-row">
              <label>Übergeordneter Eintrag</label>
              <div class="wiki-parent-search-wrap">
                <input type="text" id="wiki-ed-parent-input" placeholder="Elterneintrag suchen…" autocomplete="off"
                       oninput="onWikiParentSearch(this.value)">
                <div id="wiki-parent-dropdown" class="wiki-parent-dropdown" style="display:none"></div>
                <div id="wiki-parent-selected" class="wiki-parent-selected" style="display:none">
                  <span id="wiki-parent-selected-label"></span>
                  <button type="button" class="wiki-parent-clear" onclick="clearWikiParent()">✕</button>
                </div>
                <input type="hidden" id="wiki-ed-parent-id">
              </div>
            </div>
```

- [ ] **Step 2: Add parent state tracking and JS functions**

Add `wikiEditParentId: null` to the `ui` state object:

```js
    wikiEditParentId: null,
```

Add the following functions after `closeWikiEditor`:

```js
function onWikiParentSearch(value) {
  const dropdown = document.getElementById('wiki-parent-dropdown');
  if (!dropdown) return;
  const worldId = parseInt(document.getElementById('wiki-ed-world').value);
  const selfId  = state.ui.wikiEditId;
  const q = value.trim().toLowerCase();

  if (!q) { dropdown.style.display = 'none'; return; }

  const matches = state.wikiAllEntries
    .filter(e => e.worldId === worldId && e.id !== selfId && e.title.toLowerCase().includes(q))
    .slice(0, 10);

  if (!matches.length) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = matches.map(e => `
    <div class="wiki-parent-option" onclick="selectWikiParent(${e.id}, '${escHtml(e.title).replace(/'/g, "\\'")}')">
      <span class="wiki-type-badge wiki-type-${e.type.toLowerCase()} wiki-type-badge--sm">${escHtml(e.type)}</span>
      ${escHtml(e.title)}
    </div>
  `).join('');
  dropdown.style.display = '';
}

function selectWikiParent(id, title) {
  state.ui.wikiEditParentId = id;
  document.getElementById('wiki-ed-parent-id').value = id;
  document.getElementById('wiki-ed-parent-input').value = '';
  document.getElementById('wiki-parent-dropdown').style.display = 'none';
  const sel = document.getElementById('wiki-parent-selected');
  document.getElementById('wiki-parent-selected-label').textContent = title;
  sel.style.display = '';
}

function clearWikiParent() {
  state.ui.wikiEditParentId = null;
  document.getElementById('wiki-ed-parent-id').value = '';
  document.getElementById('wiki-ed-parent-input').value = '';
  document.getElementById('wiki-parent-selected').style.display = 'none';
}
```

- [ ] **Step 3: Reset parent field when editor opens**

In `openWikiEditor`, after `state.ui.wikiPendingImages = [];`, add:

```js
  clearWikiParent();
```

In the `if (entryId)` branch, inside the `.then(entry => {` callback, add after `bodyArea.value = entry.body || '';`:

```js
      if (entry.parentId) {
        selectWikiParent(entry.parentId, entry.parentTitle);
      }
```

- [ ] **Step 4: Include parentId in saveWikiEntry payload**

In `saveWikiEntry`, find the `payload` object:

```js
  const payload = {
    title,
    type:    typeSelect.value,
    worldId: parseInt(worldSelect.value),
    body:    bodyArea.value
  };
```

Replace with:

```js
  const parentIdVal = document.getElementById('wiki-ed-parent-id').value;
  const payload = {
    title,
    type:    typeSelect.value,
    worldId: parseInt(worldSelect.value),
    body:    bodyArea.value,
    parentId: parentIdVal ? parseInt(parentIdVal) : null
  };
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/static/index.html \
        backend/src/main/resources/static/js/app.js
git commit -m "feat: wiki editor parent search field"
```

---

### Task 11: CSS — hierarchy view, breadcrumb, Unterseiten, parent search

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add hierarchy tree styles**

Add after the `.wiki-type-group-entries .wiki-list-item` rule:

```css
.wiki-hierarchy-item { align-items: center; }
.wiki-hierarchy-toggle,
.wiki-hierarchy-spacer {
  font-size: 0.55rem;
  color: var(--t3);
  width: 12px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}
.wiki-hierarchy-spacer { cursor: default; }
```

- [ ] **Step 2: Add breadcrumb styles**

Add after `.wiki-article-panel` rule:

```css
.wiki-breadcrumb {
  margin-bottom: 10px;
}
.wiki-breadcrumb-link {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: var(--fs-grn);
  color: var(--t3);
  cursor: pointer;
  transition: color var(--transition);
}
.wiki-breadcrumb-link:hover { color: var(--gold); }
```

- [ ] **Step 3: Add parent search dropdown styles**

Add after `.wiki-filter-panel` rule:

```css
.wiki-parent-search-wrap { position: relative; }
.wiki-parent-search-wrap input[type="text"] {
  width: 100%;
  background: var(--inp);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--t1);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: var(--fs-grn);
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition);
}
.wiki-parent-search-wrap input[type="text"]:focus { border-color: var(--gold); }
.wiki-parent-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0; right: 0;
  background: var(--bg-c);
  border: 1px solid var(--bd);
  border-radius: var(--radius-sm);
  z-index: 100;
  box-shadow: var(--sh);
  max-height: 200px;
  overflow-y: auto;
}
.wiki-parent-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: var(--fs-grn);
  color: var(--t1);
  cursor: pointer;
  transition: background .12s;
}
.wiki-parent-option:hover { background: var(--bg-ch); }
.wiki-parent-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--tag-bg);
  border: 1px solid var(--tag-bd);
  border-radius: var(--radius-sm);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: var(--fs-grn);
  color: var(--t1);
  margin-top: 4px;
}
.wiki-parent-clear {
  background: none;
  border: none;
  color: var(--t3);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 2px;
  line-height: 1;
}
.wiki-parent-clear:hover { color: var(--t1); }
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/static/css/app.css
git commit -m "feat: CSS for wiki hierarchy tree, breadcrumb, parent search"
```

---

### Task 12: Full test run and smoke test

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -q
```
Expected: BUILD SUCCESS, no test failures.

- [ ] **Step 2: Manual smoke test**

1. Start app: `mvn spring-boot:run -Dspring-boot.run.profiles=dev`
2. Log in as admin.
3. Create entry "Western Union" (no parent).
4. Create entry "Glimmquali" — set parent to "Western Union" via search.
5. Create entry "Tavari" — set parent to "Glimmquali".
6. Switch sidebar to "Hierarchie" view — verify tree: Western Union → Glimmquali → Tavari.
7. Click "Glimmquali" — verify breadcrumb "← Western Union" and Unterseiten section shows "Tavari".
8. Edit "Tavari" — verify parent field shows "Glimmquali" pre-filled with ✕ clear button.
9. Try to set "Tavari" as parent of "Western Union" (should fail with cycle error).
10. Collapse "Western Union" in hierarchy view — Glimmquali and Tavari should hide.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: wiki parent hierarchy — complete implementation"
git push
```
