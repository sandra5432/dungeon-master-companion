# Wiki Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only wiki export action to the world config menu that downloads all wiki entries as a hierarchical ZIP of Markdown files, accessible both from the SPA and via HTTP Basic Auth.

**Architecture:** New `WikiExportService` builds the ZIP in-memory using `java.util.zip`; new `ExportController` exposes `GET /api/export/worlds/{worldId}/wiki`; `SecurityConfig` gains `.httpBasic()` and an admin-only export rule; `renderConfigWorlds()` in `app.js` gets an export button.

**Tech Stack:** Java 21, Spring Boot 3, Spring Security (session + Basic Auth), `java.util.zip` (JDK standard library, no new dependencies), JUnit 5 + MockMvc + AssertJ + H2

---

## File Map

| Action | File |
|--------|------|
| Create | `backend/src/main/java/com/pardur/service/WikiExportService.java` |
| Create | `backend/src/main/java/com/pardur/controller/ExportController.java` |
| Modify | `backend/src/main/java/com/pardur/config/SecurityConfig.java` |
| Modify | `backend/src/main/resources/static/js/app.js` |
| Create | `backend/src/test/java/com/pardur/service/WikiExportServiceTest.java` |
| Create | `backend/src/test/java/com/pardur/controller/ExportControllerTest.java` |

---

### Task 1: WikiExportService — `sanitize()` and `renderMarkdown()`

**Files:**
- Create: `backend/src/main/java/com/pardur/service/WikiExportService.java`
- Create: `backend/src/test/java/com/pardur/service/WikiExportServiceTest.java`

These two methods are pure static functions; test them without mocks.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/java/com/pardur/service/WikiExportServiceTest.java`:

```java
package com.pardur.service;

import com.pardur.model.User;
import com.pardur.model.WikiEntry;
import com.pardur.model.WikiEntryType;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class WikiExportServiceTest {

    // ── sanitize ─────────────────────────────────────────────────────────────

    @Test
    void sanitize_lowercasesInput() {
        assertThat(WikiExportService.sanitize("ODIN")).isEqualTo("odin");
    }

    @Test
    void sanitize_replacesSpacesWithUnderscores() {
        assertThat(WikiExportService.sanitize("Der Dunkle Wald")).isEqualTo("der_dunkle_wald");
    }

    @Test
    void sanitize_replacesUmlauts() {
        assertThat(WikiExportService.sanitize("Über")).isEqualTo("ueber");
        assertThat(WikiExportService.sanitize("Öde")).isEqualTo("oede");
        assertThat(WikiExportService.sanitize("Güte")).isEqualTo("guete");
        assertThat(WikiExportService.sanitize("Straße")).isEqualTo("strasse");
    }

    @Test
    void sanitize_stripsSpecialChars() {
        assertThat(WikiExportService.sanitize("Ä böser Wald!")).isEqualTo("ae_boeser_wald");
    }

    @Test
    void sanitize_collapsesMultipleUnderscores() {
        assertThat(WikiExportService.sanitize("a  b")).isEqualTo("a_b");
    }

    @Test
    void sanitize_trimsLeadingTrailingUnderscores() {
        assertThat(WikiExportService.sanitize("!test!")).isEqualTo("test");
    }

    // ── renderMarkdown ───────────────────────────────────────────────────────

    @Test
    void renderMarkdown_includesTitleAsH1() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "Allvater.");
        assertThat(WikiExportService.renderMarkdown(e)).startsWith("# Odin");
    }

    @Test
    void renderMarkdown_includesTypeAndAuthor() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "Allvater.");
        String md = WikiExportService.renderMarkdown(e);
        assertThat(md).contains("**Type:** PERSON");
        assertThat(md).contains("**Created by:** admin");
    }

    @Test
    void renderMarkdown_includesBodyVerbatimIncludingSpoilers() {
        String body = "Allvater.\n\n:::spoiler Secret\nHidden\n:::";
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", body);
        assertThat(WikiExportService.renderMarkdown(e)).contains(body);
    }

    @Test
    void renderMarkdown_showsPlaceholderWhenBodyIsNull() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", null);
        assertThat(WikiExportService.renderMarkdown(e)).contains("*(no content)*");
    }

    @Test
    void renderMarkdown_showsPlaceholderWhenBodyIsBlank() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "   ");
        assertThat(WikiExportService.renderMarkdown(e)).contains("*(no content)*");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private WikiEntry buildEntry(String title, WikiEntryType type, String username, String body) {
        User u = new User();
        u.setUsername(username);

        WikiEntry e = new WikiEntry();
        e.setTitle(title);
        e.setType(type);
        e.setBody(body);
        e.setCreatedBy(u);
        return e;
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=WikiExportServiceTest -pl . 2>&1 | tail -20
```

Expected: compilation error — `WikiExportService` does not exist yet.

- [ ] **Step 3: Create `WikiExportService` with `sanitize()` and `renderMarkdown()`**

Create `backend/src/main/java/com/pardur/service/WikiExportService.java`:

```java
package com.pardur.service;

import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.WikiEntry;
import com.pardur.model.World;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Builds wiki export ZIP archives for a given world.
 */
@Service
public class WikiExportService {

    private final WikiEntryRepository wikiEntryRepository;
    private final WorldRepository worldRepository;

    public WikiExportService(WikiEntryRepository wikiEntryRepository,
                             WorldRepository worldRepository) {
        this.wikiEntryRepository = wikiEntryRepository;
        this.worldRepository = worldRepository;
    }

    /**
     * Exports all wiki entries for the given world as an in-memory ZIP.
     * Entries are organized by parent/child hierarchy; spoiler blocks are included verbatim.
     *
     * @param worldId target world; must exist
     * @return ZIP bytes
     * @throws ResourceNotFoundException if the world does not exist
     * @throws IOException if ZIP serialization fails
     */
    @Transactional(readOnly = true)
    public byte[] exportWikiAsZip(Integer worldId) throws IOException {
        loadWorld(worldId); // validates existence
        List<WikiEntry> entries = wikiEntryRepository.findAllByWorldIdOrderByTitleAsc(worldId);

        Map<Integer, List<WikiEntry>> childrenMap = new HashMap<>();
        List<WikiEntry> roots = new ArrayList<>();
        for (WikiEntry e : entries) {
            if (e.getParent() == null) {
                roots.add(e);
            } else {
                childrenMap
                        .computeIfAbsent(e.getParent().getId(), k -> new ArrayList<>())
                        .add(e);
            }
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (WikiEntry root : roots) {
                addEntryToZip(zos, root, "", childrenMap);
            }
        }
        return baos.toByteArray();
    }

    /**
     * Returns the ZIP download filename for the given world.
     *
     * @param worldId target world; must exist
     * @return e.g. {@code "pardur-wiki-export.zip"}
     */
    @Transactional(readOnly = true)
    public String buildZipFilename(Integer worldId) {
        World world = loadWorld(worldId);
        return sanitize(world.getName()) + "-wiki-export.zip";
    }

    /**
     * Sanitizes a title into a safe filename segment (no extension, no path separators).
     * Lowercases, replaces German umlauts, collapses non-alphanumeric chars to underscores.
     *
     * @param title raw title
     * @return sanitized string
     */
    static String sanitize(String title) {
        String s = title.toLowerCase();
        s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss");
        s = s.replaceAll("[\\s\\-]+", "_");
        s = s.replaceAll("[^a-z0-9_]", "");
        s = s.replaceAll("_+", "_");
        s = s.replaceAll("^_+|_+$", "");
        return s;
    }

    /**
     * Renders the Markdown file content for a single wiki entry.
     * Spoiler blocks are included verbatim.
     *
     * @param entry the wiki entry (createdBy and updatedAt may be null-safe)
     * @return Markdown string
     */
    static String renderMarkdown(WikiEntry entry) {
        StringBuilder sb = new StringBuilder();
        sb.append("# ").append(entry.getTitle()).append("\n\n");
        sb.append("**Type:** ").append(entry.getType().name()).append("\n");
        sb.append("**Created by:** ").append(entry.getCreatedBy().getUsername()).append("\n");
        String date = entry.getUpdatedAt() != null
                ? entry.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)
                : "—";
        sb.append("**Last updated:** ").append(date).append("\n\n");
        sb.append("---\n\n");
        String body = entry.getBody();
        sb.append((body == null || body.isBlank()) ? "*(no content)*" : body);
        return sb.toString();
    }

    // ── private ───────────────────────────────────────────────────────────────

    private void addEntryToZip(ZipOutputStream zos, WikiEntry entry, String prefix,
                                Map<Integer, List<WikiEntry>> childrenMap) throws IOException {
        String safeName = sanitize(entry.getTitle());
        List<WikiEntry> children = childrenMap.getOrDefault(entry.getId(), Collections.emptyList());
        boolean hasChildren = !children.isEmpty();

        String filePath;
        String childPrefix;
        if (hasChildren) {
            childPrefix = prefix + safeName + "/";
            filePath = childPrefix + safeName + ".md";
        } else {
            childPrefix = prefix;
            filePath = prefix + safeName + ".md";
        }

        zos.putNextEntry(new ZipEntry(filePath));
        zos.write(renderMarkdown(entry).getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();

        for (WikiEntry child : children) {
            addEntryToZip(zos, child, childPrefix, childrenMap);
        }
    }

    private World loadWorld(Integer worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=WikiExportServiceTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/main/java/com/pardur/service/WikiExportService.java src/test/java/com/pardur/service/WikiExportServiceTest.java && git commit -m "feat(export): add WikiExportService with sanitize and renderMarkdown"
```

---

### Task 2: WikiExportService — `exportWikiAsZip()` and `buildZipFilename()`

**Files:**
- Modify: `backend/src/test/java/com/pardur/service/WikiExportServiceTest.java`

The service is already implemented (Task 1 created the full class). Now add unit tests for the ZIP-building and filename methods, using mocked repositories.

- [ ] **Step 1: Add ZIP tests to `WikiExportServiceTest`**

Add the following to `WikiExportServiceTest` (after the existing helpers, before the closing brace):

```java
    // ── exportWikiAsZip ──────────────────────────────────────────────────────

    import com.pardur.repository.WikiEntryRepository;
    import com.pardur.repository.WorldRepository;
    import org.junit.jupiter.api.BeforeEach;
    import java.io.ByteArrayInputStream;
    import java.util.Optional;
    import java.util.Set;
    import java.util.LinkedHashSet;
    import java.util.zip.ZipInputStream;
    import static org.mockito.Mockito.*;
```

Wait — imports must go at the top of the file. Rewrite the full file with the new tests added and all imports at the top:

```java
package com.pardur.service;

import com.pardur.model.User;
import com.pardur.model.WikiEntry;
import com.pardur.model.WikiEntryType;
import com.pardur.model.World;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.*;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class WikiExportServiceTest {

    WikiEntryRepository wikiEntryRepo;
    WorldRepository worldRepo;
    WikiExportService service;

    @BeforeEach
    void setUp() {
        wikiEntryRepo = mock(WikiEntryRepository.class);
        worldRepo     = mock(WorldRepository.class);
        service       = new WikiExportService(wikiEntryRepo, worldRepo);
    }

    // ── sanitize ─────────────────────────────────────────────────────────────

    @Test
    void sanitize_lowercasesInput() {
        assertThat(WikiExportService.sanitize("ODIN")).isEqualTo("odin");
    }

    @Test
    void sanitize_replacesSpacesWithUnderscores() {
        assertThat(WikiExportService.sanitize("Der Dunkle Wald")).isEqualTo("der_dunkle_wald");
    }

    @Test
    void sanitize_replacesUmlauts() {
        assertThat(WikiExportService.sanitize("Über")).isEqualTo("ueber");
        assertThat(WikiExportService.sanitize("Öde")).isEqualTo("oede");
        assertThat(WikiExportService.sanitize("Güte")).isEqualTo("guete");
        assertThat(WikiExportService.sanitize("Straße")).isEqualTo("strasse");
    }

    @Test
    void sanitize_stripsSpecialChars() {
        assertThat(WikiExportService.sanitize("Ä böser Wald!")).isEqualTo("ae_boeser_wald");
    }

    @Test
    void sanitize_collapsesMultipleUnderscores() {
        assertThat(WikiExportService.sanitize("a  b")).isEqualTo("a_b");
    }

    @Test
    void sanitize_trimsLeadingTrailingUnderscores() {
        assertThat(WikiExportService.sanitize("!test!")).isEqualTo("test");
    }

    // ── renderMarkdown ───────────────────────────────────────────────────────

    @Test
    void renderMarkdown_includesTitleAsH1() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "Allvater.");
        assertThat(WikiExportService.renderMarkdown(e)).startsWith("# Odin");
    }

    @Test
    void renderMarkdown_includesTypeAndAuthor() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "Allvater.");
        String md = WikiExportService.renderMarkdown(e);
        assertThat(md).contains("**Type:** PERSON");
        assertThat(md).contains("**Created by:** admin");
    }

    @Test
    void renderMarkdown_includesBodyVerbatimIncludingSpoilers() {
        String body = "Allvater.\n\n:::spoiler Secret\nHidden\n:::";
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", body);
        assertThat(WikiExportService.renderMarkdown(e)).contains(body);
    }

    @Test
    void renderMarkdown_showsPlaceholderWhenBodyIsNull() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", null);
        assertThat(WikiExportService.renderMarkdown(e)).contains("*(no content)*");
    }

    @Test
    void renderMarkdown_showsPlaceholderWhenBodyIsBlank() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "   ");
        assertThat(WikiExportService.renderMarkdown(e)).contains("*(no content)*");
    }

    // ── exportWikiAsZip ──────────────────────────────────────────────────────

    @Test
    void exportWikiAsZip_returnsEmptyZip_whenNoEntries() throws Exception {
        World world = buildWorld(1, "Leer");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of());

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip)).isEmpty();
    }

    @Test
    void exportWikiAsZip_flatEntry_appearsAtRoot() throws Exception {
        World world = buildWorld(1, "Testworld");
        WikiEntry entry = buildEntry(10, "Odin", null, WikiEntryType.PERSON, "admin", "Allvater");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(entry));

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip)).containsExactly("odin.md");
    }

    @Test
    void exportWikiAsZip_parentWithChild_usesFolder() throws Exception {
        World world = buildWorld(1, "Testworld");
        WikiEntry parent = buildEntry(10, "Gods",  null,   WikiEntryType.OTHER, "admin", "Die Götter");
        WikiEntry child  = buildEntry(20, "Odin",  parent, WikiEntryType.PERSON, "admin", "Allvater");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(parent, child));

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip))
                .containsExactlyInAnyOrder("gods/gods.md", "gods/odin.md");
    }

    @Test
    void exportWikiAsZip_threeGenerations_usesNestedFolders() throws Exception {
        World world       = buildWorld(1, "Testworld");
        WikiEntry root    = buildEntry(1, "Gods",    null,  WikiEntryType.OTHER, "admin", "Götter");
        WikiEntry mid     = buildEntry(2, "Odin",    root,  WikiEntryType.PERSON, "admin", "Allvater");
        WikiEntry leaf    = buildEntry(3, "Valhalla", mid,  WikiEntryType.LOCATION, "admin", "Halle der Toten");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(root, mid, leaf));

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip))
                .containsExactlyInAnyOrder("gods/gods.md", "gods/odin/odin.md", "gods/odin/valhalla.md");
    }

    // ── buildZipFilename ─────────────────────────────────────────────────────

    @Test
    void buildZipFilename_sanitizesWorldName() throws Exception {
        World world = buildWorld(5, "Pardur");
        when(worldRepo.findById(5)).thenReturn(Optional.of(world));

        assertThat(service.buildZipFilename(5)).isEqualTo("pardur-wiki-export.zip");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private WikiEntry buildEntry(String title, WikiEntryType type, String username, String body) {
        User u = new User();
        u.setUsername(username);
        WikiEntry e = new WikiEntry();
        e.setTitle(title);
        e.setType(type);
        e.setBody(body);
        e.setCreatedBy(u);
        return e;
    }

    private WikiEntry buildEntry(int id, String title, WikiEntry parent, WikiEntryType type,
                                  String username, String body) throws Exception {
        WikiEntry e = buildEntry(title, type, username, body);
        setPrivateId(e, WikiEntry.class, id);
        e.setParent(parent);
        return e;
    }

    private World buildWorld(int id, String name) throws Exception {
        World w = new World();
        w.setName(name);
        setPrivateId(w, World.class, id);
        return w;
    }

    private void setPrivateId(Object obj, Class<?> clazz, int id) throws Exception {
        var f = clazz.getDeclaredField("id");
        f.setAccessible(true);
        f.set(obj, id);
    }

    private Set<String> readZipEntryNames(byte[] zip) throws IOException {
        Set<String> names = new LinkedHashSet<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zip))) {
            java.util.zip.ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                names.add(ze.getName());
                zis.closeEntry();
            }
        }
        return names;
    }
}
```

- [ ] **Step 2: Run all WikiExportServiceTest tests**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=WikiExportServiceTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, all 18 tests pass.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/test/java/com/pardur/service/WikiExportServiceTest.java && git commit -m "test(export): unit tests for WikiExportService ZIP building"
```

---

### Task 3: `SecurityConfig` changes + `ExportController`

**Files:**
- Modify: `backend/src/main/java/com/pardur/config/SecurityConfig.java`
- Create: `backend/src/main/java/com/pardur/controller/ExportController.java`

- [ ] **Step 1: Add HTTP Basic Auth and export rule to `SecurityConfig`**

Add `import org.springframework.security.config.Customizer;` to the imports in `SecurityConfig.java`.

Then in `filterChain()`, make two additions:

**Addition 1** — new security rule before `.anyRequest().authenticated()` (add after the existing world rules block):
```java
.requestMatchers("/api/export/**").hasRole("ADMIN")
```

**Addition 2** — enable HTTP Basic Auth; add after `.csrf(csrf -> csrf.disable())`:
```java
.httpBasic(Customizer.withDefaults())
```

The complete updated `filterChain` method should look like this:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/index.html", "/js/**", "/css/**", "/favicon.ico", "/world/**").permitAll()
            .requestMatchers("/api/login", "/api/logout", "/api/auth/status", "/api/auth/change-password").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
            .requestMatchers(HttpMethod.POST,   "/api/worlds").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT,    "/api/worlds/{id:[0-9]+}").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/worlds/{id:[0-9]+}").hasRole("ADMIN")
            .requestMatchers(HttpMethod.POST,   "/api/items/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT,    "/api/items/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.GET, "/api/admin/users/names").hasRole("USER")
            .requestMatchers("/api/admin/users/**").hasRole("ADMIN")
            .requestMatchers("/api/wiki/**").hasRole("USER")
            .requestMatchers("/api/worlds/*/events/**").hasRole("USER")
            .requestMatchers(HttpMethod.POST, "/api/worlds/*/events").hasRole("USER")
            .requestMatchers(HttpMethod.GET,    "/api/poi-types").hasRole("USER")
            .requestMatchers(HttpMethod.POST,   "/api/poi-types").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT,    "/api/poi-types/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/poi-types/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.GET,    "/api/worlds/*/map/**").hasRole("USER")
            .requestMatchers(HttpMethod.POST,   "/api/worlds/*/map/pois").hasRole("USER")
            .requestMatchers(HttpMethod.PUT,    "/api/worlds/*/map/pois/**").hasRole("USER")
            .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/map/pois/**").hasRole("USER")
            .requestMatchers(HttpMethod.POST,   "/api/worlds/*/map/background").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PATCH,  "/api/worlds/*/map/background/scale").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/map/background").hasRole("ADMIN")
            .requestMatchers("/api/export/**").hasRole("ADMIN")
            .requestMatchers("/api/worlds/**").hasRole("USER")
            .anyRequest().authenticated()
        )
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .csrf(csrf -> csrf.disable())
        .httpBasic(Customizer.withDefaults())
        .logout(logout -> logout
            .logoutUrl("/api/logout")
            .logoutSuccessHandler((req, res, authentication) -> res.setStatus(200))
        );
    return http.build();
}
```

- [ ] **Step 2: Create `ExportController`**

Create `backend/src/main/java/com/pardur/controller/ExportController.java`:

```java
package com.pardur.controller;

import com.pardur.service.WikiExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

/**
 * Handles data export operations. All endpoints require ADMIN role (enforced by SecurityConfig).
 */
@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final WikiExportService wikiExportService;

    public ExportController(WikiExportService wikiExportService) {
        this.wikiExportService = wikiExportService;
    }

    /**
     * Exports all wiki entries for the given world as a ZIP of Markdown files.
     * Supports both session-based auth and HTTP Basic Auth.
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
}
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -pl . 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/main/java/com/pardur/controller/ExportController.java src/main/java/com/pardur/config/SecurityConfig.java && git commit -m "feat(export): ExportController + Basic Auth in SecurityConfig"
```

---

### Task 4: `ExportControllerTest` — auth and error cases

**Files:**
- Create: `backend/src/test/java/com/pardur/controller/ExportControllerTest.java`

Covers spec tests 1 (unauthenticated → 4xx), 2 (non-admin → 403), 3 (unknown world → 404). No DB seeding required.

- [ ] **Step 1: Write the three failing tests**

Create `backend/src/test/java/com/pardur/controller/ExportControllerTest.java`:

```java
package com.pardur.controller;

import com.pardur.model.User;
import com.pardur.model.WikiEntry;
import com.pardur.model.WikiEntryType;
import com.pardur.model.World;
import com.pardur.repository.UserRepository;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ExportControllerTest {

    @Autowired MockMvc mvc;
    @Autowired WorldRepository worldRepository;
    @Autowired WikiEntryRepository wikiEntryRepository;
    @Autowired UserRepository userRepository;
    @Autowired BCryptPasswordEncoder passwordEncoder;

    World testWorld;
    User adminUser;

    @BeforeEach
    void setUp() {
        User u = new User();
        u.setUsername("export-admin-" + System.nanoTime()); // unique per run
        u.setPassword(passwordEncoder.encode("export-pass"));
        u.setRole("ADMIN");
        adminUser = userRepository.save(u);

        World w = new World();
        w.setName("ExportTestWorld-" + System.nanoTime());
        testWorld = worldRepository.save(w);
    }

    @AfterEach
    void tearDown() {
        if (testWorld != null) {
            wikiEntryRepository.deleteAll(
                    wikiEntryRepository.findAllByWorldIdOrderByTitleAsc(testWorld.getId()));
            worldRepository.delete(testWorld);
        }
        if (adminUser != null) {
            userRepository.delete(adminUser);
        }
    }

    // ── auth / error cases ────────────────────────────────────────────────────

    @Test
    void exportWiki_returns4xx_whenUnauthenticated() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void exportWiki_returns403_whenNonAdmin() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_returns404_whenWorldNotFound() throws Exception {
        mvc.perform(get("/api/export/worlds/999999/wiki"))
                .andExpect(status().isNotFound());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Reads all ZIP entries from a response body into a filename→content map. */
    Map<String, String> readZip(MvcResult result) throws IOException {
        byte[] body = result.getResponse().getContentAsByteArray();
        Map<String, String> files = new LinkedHashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(body))) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                files.put(ze.getName(), new String(zis.readAllBytes(), StandardCharsets.UTF_8));
                zis.closeEntry();
            }
        }
        return files;
    }

    /** Saves a wiki entry to testWorld with the given title. */
    WikiEntry saveEntry(String title, WikiEntry parent) {
        WikiEntry e = new WikiEntry();
        e.setTitle(title);
        e.setType(WikiEntryType.OTHER);
        e.setBody("Body of " + title);
        e.setWorld(testWorld);
        e.setCreatedBy(adminUser);
        e.setParent(parent);
        return wikiEntryRepository.save(e);
    }
}
```

- [ ] **Step 2: Run these three tests to confirm they pass**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=ExportControllerTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, 3 tests pass (auth/error cases are covered by SecurityConfig from Task 3).

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/test/java/com/pardur/controller/ExportControllerTest.java && git commit -m "test(export): auth and 404 integration tests"
```

---

### Task 5: `ExportControllerTest` — ZIP content tests

**Files:**
- Modify: `backend/src/test/java/com/pardur/controller/ExportControllerTest.java`

Covers spec tests 4 (empty ZIP), 5 (flat files), 6 (folder structure), 7 (frontmatter), 8 (filename sanitization).

- [ ] **Step 1: Add the five ZIP content tests**

Add these test methods inside `ExportControllerTest` (before the `// ── helpers` comment):

```java
    // ── ZIP content tests ─────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_returnsValidEmptyZip_whenWorldHasNoEntries() throws Exception {
        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/zip"))
                .andReturn();

        Map<String, String> files = readZip(result);
        assertThat(files).isEmpty();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_flatEntries_appearAtZipRoot() throws Exception {
        saveEntry("Odin", null);
        saveEntry("Thor", null);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        Map<String, String> files = readZip(result);
        assertThat(files.keySet()).containsExactlyInAnyOrder("odin.md", "thor.md");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_parentWithChildren_usesFolder() throws Exception {
        WikiEntry gods = saveEntry("Gods", null);
        saveEntry("Odin", gods);
        saveEntry("Thor", gods);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        Map<String, String> files = readZip(result);
        assertThat(files.keySet())
                .containsExactlyInAnyOrder("gods/gods.md", "gods/odin.md", "gods/thor.md");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_markdownContainsFrontmatterAndBody() throws Exception {
        WikiEntry e = saveEntry("Allvater", null);
        // update body directly via entity
        e.setBody("Der Allvater regiert.");
        e.setType(WikiEntryType.PERSON);
        wikiEntryRepository.save(e);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        Map<String, String> files = readZip(result);
        String content = files.get("allvater.md");
        assertThat(content).isNotNull();
        assertThat(content).contains("# Allvater");
        assertThat(content).contains("**Type:** PERSON");
        assertThat(content).contains("**Created by:** " + adminUser.getUsername());
        assertThat(content).contains("Der Allvater regiert.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_sanitizesFilenames() throws Exception {
        saveEntry("Ä böser Wald!", null);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        Map<String, String> files = readZip(result);
        assertThat(files.keySet()).containsExactly("ae_boeser_wald.md");
    }
```

- [ ] **Step 2: Run the full test class**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=ExportControllerTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/test/java/com/pardur/controller/ExportControllerTest.java && git commit -m "test(export): ZIP content integration tests"
```

---

### Task 6: `ExportControllerTest` — Basic Auth tests

**Files:**
- Modify: `backend/src/test/java/com/pardur/controller/ExportControllerTest.java`

Covers spec tests 9 (Basic Auth success with real admin credentials) and 10 (wrong password → 401). These tests rely on `adminUser` seeded in `@BeforeEach` and use `httpBasic()` from `spring-security-test`.

- [ ] **Step 1: Add Basic Auth tests**

Add these two test methods inside `ExportControllerTest` (after the ZIP content tests, before `// ── helpers`):

```java
    // ── Basic Auth tests ──────────────────────────────────────────────────────

    @Test
    void exportWiki_returns200_withValidBasicAuth() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId())
                        .with(httpBasic(adminUser.getUsername(), "export-pass")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/zip"));
    }

    @Test
    void exportWiki_returns401_withWrongBasicAuthPassword() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId())
                        .with(httpBasic(adminUser.getUsername(), "wrong-password")))
                .andExpect(status().isUnauthorized());
    }
```

- [ ] **Step 2: Run the full test class**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=ExportControllerTest -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, all 10 tests pass.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/test/java/com/pardur/controller/ExportControllerTest.java && git commit -m "test(export): Basic Auth integration tests"
```

---

### Task 7: Frontend — export button in world config menu

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

Two changes: add the `exportWorldWiki` function, and add an export button to each world row in `renderConfigWorlds()`.

- [ ] **Step 1: Add `exportWorldWiki` function**

Find the `renderConfigWorlds` function in `app.js` (around line 333). Add the following JSDoc + function **immediately before** `renderConfigWorlds`:

```js
/**
 * Triggers a browser download of the wiki export ZIP for the given world.
 * Uses a temporary anchor element to initiate the download without a fetch call.
 * @param {number} worldId  ID of the world to export
 */
function exportWorldWiki(worldId) {
  console.debug('[exportWorldWiki] →', worldId);
  const a = document.createElement('a');
  a.href = `/api/export/worlds/${worldId}/wiki`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.debug('[exportWorldWiki] ← download triggered');
}
```

- [ ] **Step 2: Add export button to `renderConfigWorlds`**

In `renderConfigWorlds`, find this section of the template literal:

```js
      <td style="white-space:nowrap">
        <button class="act-btn" onclick="openEditWorldModal(${w.id},event)" title="Bearbeiten">✎</button>
        <button class="act-btn del" onclick="openDeleteWorldConfirm(${w.id},event)" title="Löschen">✕</button>
      </td>
```

Replace it with:

```js
      <td style="white-space:nowrap">
        <button class="act-btn" onclick="openEditWorldModal(${w.id},event)" title="Bearbeiten">✎</button>
        <button class="act-btn" onclick="exportWorldWiki(${w.id})" title="Wiki exportieren">⬇</button>
        <button class="act-btn del" onclick="openDeleteWorldConfirm(${w.id},event)" title="Löschen">✕</button>
      </td>
```

- [ ] **Step 3: Compile the backend (static assets are bundled as-is)**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -pl . 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Run the full test suite one final time**

```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/main/resources/static/js/app.js && git commit -m "feat(export): add wiki export button to world config menu"
```

---

## Self-Review Checklist

- **Spec §Requirements:** Basic Auth ✓, admin-only ✓, ZIP output ✓, spoilers verbatim ✓, hierarchy ✓, sanitized filenames ✓.
- **Spec §Architecture:** ExportController ✓, WikiExportService ✓, SecurityConfig ✓, app.js ✓, ExportControllerTest ✓.
- **Spec §Tests 1–10:** All 10 covered across Tasks 4–6 ✓.
- **Type consistency:** `WikiExportService.sanitize(String)` used in `buildZipFilename` and `addEntryToZip` — consistent ✓. `renderMarkdown(WikiEntry)` called inside `addEntryToZip` — consistent ✓.
- **Note on filename sanitization test:** Spec example showed `ae_boser_wald` but correct result of ö→oe is `ae_boeser_wald`. Tests use `ae_boeser_wald` (correct). ✓
