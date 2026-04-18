# World Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-world read/edit/delete permission flags for guests and logged-in users, enforced in Spring services and reflected in the frontend world config UI.

**Architecture:** A new `WorldPermissionChecker` component centralises access decisions; services inject it and call `requireRead/Edit/Delete` at the start of each public method. `SecurityConfig` relaxes world-content endpoints to `permitAll()` so unauthenticated requests reach the service layer. The frontend enforces the guest≤user and edit→read constraints via checkbox listeners and filters the world nav by permissions returned from the server.

**Tech Stack:** Java 21, Spring Boot 3, Spring Security, JPA/Hibernate, Flyway, MySQL, Vanilla JS

---

## File Map

**Created**
- `backend/src/main/resources/db/migration/V22__world_permissions.sql`
- `backend/src/main/java/com/pardur/service/WorldPermissionChecker.java`
- `backend/src/test/java/com/pardur/service/WorldPermissionCheckerTest.java`

**Modified**
- `backend/src/main/java/com/pardur/model/World.java`
- `backend/src/main/java/com/pardur/dto/response/WorldDto.java`
- `backend/src/main/java/com/pardur/dto/request/CreateWorldRequest.java`
- `backend/src/main/java/com/pardur/dto/request/UpdateWorldRequest.java`
- `backend/src/main/java/com/pardur/service/WorldService.java`
- `backend/src/main/java/com/pardur/controller/WorldController.java`
- `backend/src/main/java/com/pardur/config/SecurityConfig.java`
- `backend/src/main/java/com/pardur/service/TimelineService.java`
- `backend/src/main/java/com/pardur/controller/TimelineController.java`
- `backend/src/main/java/com/pardur/service/WikiService.java`
- `backend/src/main/java/com/pardur/controller/WikiController.java`
- `backend/src/main/java/com/pardur/service/MapPoiService.java`
- `backend/src/main/java/com/pardur/controller/MapController.java`
- `backend/src/main/resources/static/index.html`
- `backend/src/main/resources/static/js/app.js`

---

## Task 1: Migration + World Entity + DTOs

**Files:**
- Create: `backend/src/main/resources/db/migration/V22__world_permissions.sql`
- Modify: `backend/src/main/java/com/pardur/model/World.java`
- Modify: `backend/src/main/java/com/pardur/dto/response/WorldDto.java`
- Modify: `backend/src/main/java/com/pardur/dto/request/CreateWorldRequest.java`
- Modify: `backend/src/main/java/com/pardur/dto/request/UpdateWorldRequest.java`

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/migration/V22__world_permissions.sql`:

```sql
-- Per-world access flags for guests (unauthenticated) and logged-in users.
-- Defaults preserve current behaviour: guests see nothing; logged-in users retain full access.
ALTER TABLE worlds
    ADD COLUMN guest_can_read   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN guest_can_edit   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN guest_can_delete TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN user_can_read    TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN user_can_edit    TINYINT(1) NOT NULL DEFAULT 1,
    ADD COLUMN user_can_delete  TINYINT(1) NOT NULL DEFAULT 1;
```

- [ ] **Step 2: Add 6 fields to `World.java`**

After the `mapEnabled` field (line 35), add:

```java
    @Column(name = "guest_can_read",   nullable = false) private boolean guestCanRead   = false;
    @Column(name = "guest_can_edit",   nullable = false) private boolean guestCanEdit   = false;
    @Column(name = "guest_can_delete", nullable = false) private boolean guestCanDelete = false;
    @Column(name = "user_can_read",    nullable = false) private boolean userCanRead    = true;
    @Column(name = "user_can_edit",    nullable = false) private boolean userCanEdit    = true;
    @Column(name = "user_can_delete",  nullable = false) private boolean userCanDelete  = true;
```

After the existing getters/setters at the bottom of the class, add:

```java
    public boolean isGuestCanRead()   { return guestCanRead; }
    public void setGuestCanRead(boolean v)   { this.guestCanRead   = v; }
    public boolean isGuestCanEdit()   { return guestCanEdit; }
    public void setGuestCanEdit(boolean v)   { this.guestCanEdit   = v; }
    public boolean isGuestCanDelete() { return guestCanDelete; }
    public void setGuestCanDelete(boolean v) { this.guestCanDelete = v; }
    public boolean isUserCanRead()    { return userCanRead; }
    public void setUserCanRead(boolean v)    { this.userCanRead    = v; }
    public boolean isUserCanEdit()    { return userCanEdit; }
    public void setUserCanEdit(boolean v)    { this.userCanEdit    = v; }
    public boolean isUserCanDelete()  { return userCanDelete; }
    public void setUserCanDelete(boolean v)  { this.userCanDelete  = v; }
```

- [ ] **Step 3: Update `WorldDto.java`**

Add 6 fields to the class and constructor. Replace the entire file:

```java
package com.pardur.dto.response;

public class WorldDto {
    private Integer id;
    private String name;
    private String description;
    private Integer sortOrder;
    private Integer milesPerCell;
    private boolean chronicleEnabled;
    private boolean wikiEnabled;
    private boolean mapEnabled;
    private boolean guestCanRead;
    private boolean guestCanEdit;
    private boolean guestCanDelete;
    private boolean userCanRead;
    private boolean userCanEdit;
    private boolean userCanDelete;

    public WorldDto(Integer id, String name, String description, Integer sortOrder, Integer milesPerCell,
                    boolean chronicleEnabled, boolean wikiEnabled, boolean mapEnabled,
                    boolean guestCanRead, boolean guestCanEdit, boolean guestCanDelete,
                    boolean userCanRead, boolean userCanEdit, boolean userCanDelete) {
        this.id = id; this.name = name; this.description = description;
        this.sortOrder = sortOrder; this.milesPerCell = milesPerCell;
        this.chronicleEnabled = chronicleEnabled; this.wikiEnabled = wikiEnabled; this.mapEnabled = mapEnabled;
        this.guestCanRead = guestCanRead; this.guestCanEdit = guestCanEdit; this.guestCanDelete = guestCanDelete;
        this.userCanRead = userCanRead; this.userCanEdit = userCanEdit; this.userCanDelete = userCanDelete;
    }

    public Integer getId()             { return id; }
    public String getName()            { return name; }
    public String getDescription()     { return description; }
    public Integer getSortOrder()      { return sortOrder; }
    public Integer getMilesPerCell()   { return milesPerCell; }
    public boolean isChronicleEnabled(){ return chronicleEnabled; }
    public boolean isWikiEnabled()     { return wikiEnabled; }
    public boolean isMapEnabled()      { return mapEnabled; }
    public boolean isGuestCanRead()    { return guestCanRead; }
    public boolean isGuestCanEdit()    { return guestCanEdit; }
    public boolean isGuestCanDelete()  { return guestCanDelete; }
    public boolean isUserCanRead()     { return userCanRead; }
    public boolean isUserCanEdit()     { return userCanEdit; }
    public boolean isUserCanDelete()   { return userCanDelete; }
}
```

- [ ] **Step 4: Update `CreateWorldRequest.java`**

Add 6 optional Boolean fields after the `wikiEnabled` field and its getter/setter:

```java
    private Boolean guestCanRead;
    private Boolean guestCanEdit;
    private Boolean guestCanDelete;
    private Boolean userCanRead;
    private Boolean userCanEdit;
    private Boolean userCanDelete;

    public Boolean getGuestCanRead()   { return guestCanRead; }
    public void setGuestCanRead(Boolean v)   { this.guestCanRead   = v; }
    public Boolean getGuestCanEdit()   { return guestCanEdit; }
    public void setGuestCanEdit(Boolean v)   { this.guestCanEdit   = v; }
    public Boolean getGuestCanDelete() { return guestCanDelete; }
    public void setGuestCanDelete(Boolean v) { this.guestCanDelete = v; }
    public Boolean getUserCanRead()    { return userCanRead; }
    public void setUserCanRead(Boolean v)    { this.userCanRead    = v; }
    public Boolean getUserCanEdit()    { return userCanEdit; }
    public void setUserCanEdit(Boolean v)    { this.userCanEdit    = v; }
    public Boolean getUserCanDelete()  { return userCanDelete; }
    public void setUserCanDelete(Boolean v)  { this.userCanDelete  = v; }
```

- [ ] **Step 5: Update `UpdateWorldRequest.java`** — identical 6 fields as Step 4 (same field names, same Boolean type).

- [ ] **Step 6: Verify migration syntax — run compile only**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/migration/V22__world_permissions.sql \
        backend/src/main/java/com/pardur/model/World.java \
        backend/src/main/java/com/pardur/dto/response/WorldDto.java \
        backend/src/main/java/com/pardur/dto/request/CreateWorldRequest.java \
        backend/src/main/java/com/pardur/dto/request/UpdateWorldRequest.java
git commit -m "feat(worlds): add 6 permission flags to entity, DTOs, and migration V22"
```

---

## Task 2: WorldPermissionChecker

**Files:**
- Create: `backend/src/main/java/com/pardur/service/WorldPermissionChecker.java`
- Create: `backend/src/test/java/com/pardur/service/WorldPermissionCheckerTest.java`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/test/java/com/pardur/service/WorldPermissionCheckerTest.java`:

```java
package com.pardur.service;

import com.pardur.model.World;
import com.pardur.security.PardurUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WorldPermissionCheckerTest {

    private final WorldPermissionChecker checker = new WorldPermissionChecker();

    private World world(boolean gR, boolean gE, boolean gD, boolean uR, boolean uE, boolean uD) {
        World w = new World();
        w.setGuestCanRead(gR); w.setGuestCanEdit(gE); w.setGuestCanDelete(gD);
        w.setUserCanRead(uR);  w.setUserCanEdit(uE);  w.setUserCanDelete(uD);
        return w;
    }

    private Authentication admin() {
        PardurUserDetails d = new PardurUserDetails(1, "admin", "", "ADMIN", "#fff", false,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return new UsernamePasswordAuthenticationToken(d, null, d.getAuthorities());
    }

    private Authentication user() {
        PardurUserDetails d = new PardurUserDetails(2, "user", "", "USER", "#fff", false,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(d, null, d.getAuthorities());
    }

    private Authentication guest() {
        return new AnonymousAuthenticationToken("key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
    }

    // --- admin bypasses all ---

    @Test
    void admin_can_read_locked_world() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,false,false,false,false), admin()));
    }

    @Test
    void admin_can_edit_locked_world() {
        assertDoesNotThrow(() -> checker.requireEdit(world(false,false,false,false,false,false), admin()));
    }

    @Test
    void admin_can_delete_locked_world() {
        assertDoesNotThrow(() -> checker.requireDelete(world(false,false,false,false,false,false), admin()));
    }

    // --- guest permission checks ---

    @Test
    void guest_blocked_when_no_guest_permissions() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireRead(world(false,false,false,true,true,true), guest()));
    }

    @Test
    void guest_can_read_when_guest_read_true() {
        assertDoesNotThrow(() -> checker.requireRead(world(true,false,false,true,true,true), guest()));
    }

    @Test
    void guest_edit_implies_read() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,true,false,true,true,true), guest()));
    }

    @Test
    void guest_delete_implies_read() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,true,true,true,true), guest()));
    }

    @Test
    void guest_cannot_edit_without_guest_edit() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireEdit(world(true,false,false,true,true,true), guest()));
    }

    @Test
    void guest_can_edit_when_guest_edit_true() {
        assertDoesNotThrow(() -> checker.requireEdit(world(false,true,false,true,true,true), guest()));
    }

    @Test
    void guest_cannot_delete_without_guest_delete() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireDelete(world(true,true,false,true,true,true), guest()));
    }

    @Test
    void guest_can_delete_when_guest_delete_true() {
        assertDoesNotThrow(() -> checker.requireDelete(world(false,false,true,true,true,true), guest()));
    }

    // --- null auth treated as guest ---

    @Test
    void null_auth_blocked_on_locked_world() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireRead(world(false,false,false,true,true,true), null));
    }

    @Test
    void null_auth_can_read_when_guest_read_true() {
        assertDoesNotThrow(() -> checker.requireRead(world(true,false,false,true,true,true), null));
    }

    // --- user permission checks ---

    @Test
    void user_blocked_when_user_read_false() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireRead(world(false,false,false,false,false,false), user()));
    }

    @Test
    void user_can_read_when_user_read_true() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,false,true,false,false), user()));
    }

    @Test
    void user_edit_implies_read() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,false,false,true,false), user()));
    }

    @Test
    void user_cannot_edit_without_user_edit() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireEdit(world(false,false,false,true,false,false), user()));
    }

    @Test
    void user_can_edit_when_user_edit_true() {
        assertDoesNotThrow(() -> checker.requireEdit(world(false,false,false,false,true,false), user()));
    }

    // --- canRead boolean variant ---

    @Test
    void canRead_returns_false_for_locked_guest() {
        assertFalse(checker.canRead(world(false,false,false,true,true,true), guest()));
    }

    @Test
    void canRead_returns_true_for_admin_on_locked_world() {
        assertTrue(checker.canRead(world(false,false,false,false,false,false), admin()));
    }
}
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -pl . -Dtest=WorldPermissionCheckerTest -q 2>&1 | tail -5
```

Expected: compilation failure (class not found).

- [ ] **Step 3: Implement `WorldPermissionChecker.java`**

Create `backend/src/main/java/com/pardur/service/WorldPermissionChecker.java`:

```java
package com.pardur.service;

import com.pardur.model.World;
import com.pardur.security.PardurUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Centralises world-level access decisions for read, edit, and delete actions.
 * Admin users bypass all checks. Authenticated non-admin users are checked against
 * user_can_* flags; unauthenticated callers against guest_can_* flags.
 */
@Component
public class WorldPermissionChecker {

    /**
     * Throws 403 if the caller cannot read content in the given world.
     * Edit or delete permission implicitly grants read.
     */
    public void requireRead(World world, Authentication auth) {
        if (isAdmin(auth)) return;
        boolean ok = isAuthenticated(auth)
                ? (world.isUserCanRead() || world.isUserCanEdit() || world.isUserCanDelete())
                : (world.isGuestCanRead() || world.isGuestCanEdit() || world.isGuestCanDelete());
        if (!ok) deny();
    }

    /**
     * Throws 403 if the caller cannot create or modify content in the given world.
     */
    public void requireEdit(World world, Authentication auth) {
        if (isAdmin(auth)) return;
        boolean ok = isAuthenticated(auth) ? world.isUserCanEdit() : world.isGuestCanEdit();
        if (!ok) deny();
    }

    /**
     * Throws 403 if the caller cannot delete content in the given world.
     */
    public void requireDelete(World world, Authentication auth) {
        if (isAdmin(auth)) return;
        boolean ok = isAuthenticated(auth) ? world.isUserCanDelete() : world.isGuestCanDelete();
        if (!ok) deny();
    }

    /**
     * Returns true if the caller can read content in the given world (non-throwing variant).
     * Used for filtering lists.
     */
    public boolean canRead(World world, Authentication auth) {
        if (isAdmin(auth)) return true;
        return isAuthenticated(auth)
                ? (world.isUserCanRead() || world.isUserCanEdit() || world.isUserCanDelete())
                : (world.isGuestCanRead() || world.isGuestCanEdit() || world.isGuestCanDelete());
    }

    /** Returns true if auth represents a fully authenticated non-anonymous principal. */
    public static boolean isAuthenticated(Authentication auth) {
        return auth != null && auth.isAuthenticated()
                && auth.getPrincipal() instanceof PardurUserDetails;
    }

    /** Returns true if the authenticated principal has ADMIN role. */
    public static boolean isAdmin(Authentication auth) {
        if (!isAuthenticated(auth)) return false;
        return "ADMIN".equals(((PardurUserDetails) auth.getPrincipal()).getRole());
    }

    /**
     * Extracts the user ID from an authenticated principal; returns null for guests.
     */
    public static Integer resolveUserId(Authentication auth) {
        if (!isAuthenticated(auth)) return null;
        return ((PardurUserDetails) auth.getPrincipal()).getUserId();
    }

    private void deny() {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest=WorldPermissionCheckerTest 2>&1 | grep -E "Tests run|BUILD"
```

Expected: `Tests run: 21, Failures: 0, Errors: 0` and `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/pardur/service/WorldPermissionChecker.java \
        backend/src/test/java/com/pardur/service/WorldPermissionCheckerTest.java
git commit -m "feat(worlds): WorldPermissionChecker with full test coverage"
```

---

## Task 3: SecurityConfig — Open Content Endpoints

**Files:**
- Modify: `backend/src/main/java/com/pardur/config/SecurityConfig.java`

- [ ] **Step 1: Replace the `authorizeHttpRequests` block**

In `SecurityConfig.java`, replace the entire `.authorizeHttpRequests(auth -> auth ... )` lambda with:

```java
.authorizeHttpRequests(auth -> auth
    // Static assets and auth endpoints — always public
    .requestMatchers("/", "/index.html", "/js/**", "/css/**", "/favicon.ico", "/world/**").permitAll()
    .requestMatchers("/api/login", "/api/logout", "/api/auth/status", "/api/auth/change-password").permitAll()
    // Items (Marktplatz) — always public reads
    .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
    // World list + per-world GET — world-level permissions enforced in service
    .requestMatchers(HttpMethod.GET,    "/api/worlds").permitAll()
    .requestMatchers(HttpMethod.GET,    "/api/worlds/*").permitAll()
    // Admin-only: world CRUD
    .requestMatchers(HttpMethod.POST,   "/api/worlds").hasRole("ADMIN")
    .requestMatchers(HttpMethod.PUT,    "/api/worlds/*").hasRole("ADMIN")
    .requestMatchers(HttpMethod.DELETE, "/api/worlds/*").hasRole("ADMIN")
    // Admin-only: item management
    .requestMatchers(HttpMethod.POST,   "/api/items/**").hasRole("ADMIN")
    .requestMatchers(HttpMethod.PUT,    "/api/items/**").hasRole("ADMIN")
    .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
    // User management
    .requestMatchers(HttpMethod.GET, "/api/admin/users/names").hasRole("USER")
    .requestMatchers("/api/admin/users/**").hasRole("ADMIN")
    // Wiki images and spoiler-readers — require login (before the permitAll catch-all below)
    .requestMatchers(HttpMethod.POST,   "/api/wiki/*/images").hasRole("USER")
    .requestMatchers(HttpMethod.PUT,    "/api/wiki/images/**").hasRole("USER")
    .requestMatchers(HttpMethod.DELETE, "/api/wiki/images/**").hasRole("USER")
    .requestMatchers(HttpMethod.POST,   "/api/wiki/*/spoiler-readers/**").hasRole("USER")
    .requestMatchers(HttpMethod.DELETE, "/api/wiki/*/spoiler-readers/**").hasRole("USER")
    // Wiki entry CRUD — world-level permissions enforced in service
    .requestMatchers(HttpMethod.GET,    "/api/wiki/**").permitAll()
    .requestMatchers(HttpMethod.POST,   "/api/wiki").permitAll()
    .requestMatchers(HttpMethod.PUT,    "/api/wiki/{id:[0-9]+}").permitAll()
    .requestMatchers(HttpMethod.DELETE, "/api/wiki/{id:[0-9]+}").permitAll()
    // Timeline events — world-level permissions enforced in service
    .requestMatchers("/api/worlds/*/events/**").permitAll()
    .requestMatchers(HttpMethod.POST,   "/api/worlds/*/events").permitAll()
    // POI types
    .requestMatchers(HttpMethod.GET,    "/api/poi-types").permitAll()
    .requestMatchers(HttpMethod.POST,   "/api/poi-types").hasRole("ADMIN")
    .requestMatchers(HttpMethod.PUT,    "/api/poi-types/**").hasRole("ADMIN")
    .requestMatchers(HttpMethod.DELETE, "/api/poi-types/**").hasRole("ADMIN")
    // Map — world-level permissions for reads and POI mutations; background admin-only
    .requestMatchers(HttpMethod.GET,    "/api/worlds/*/map/**").permitAll()
    .requestMatchers(HttpMethod.POST,   "/api/worlds/*/map/pois").permitAll()
    .requestMatchers(HttpMethod.PUT,    "/api/worlds/*/map/pois/**").permitAll()
    .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/map/pois/**").permitAll()
    .requestMatchers(HttpMethod.POST,   "/api/worlds/*/map/background").hasRole("ADMIN")
    .requestMatchers(HttpMethod.PATCH,  "/api/worlds/*/map/background/scale").hasRole("ADMIN")
    .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/map/background").hasRole("ADMIN")
    // Export
    .requestMatchers("/api/export/**").hasRole("ADMIN")
    // Everything else requires login
    .anyRequest().authenticated()
)
```

- [ ] **Step 2: Verify compile**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/pardur/config/SecurityConfig.java
git commit -m "feat(security): relax world-content endpoints to permitAll; service layer enforces world permissions"
```

---

## Task 4: WorldService + WorldController

**Files:**
- Modify: `backend/src/main/java/com/pardur/service/WorldService.java`
- Modify: `backend/src/main/java/com/pardur/controller/WorldController.java`
- Modify: `backend/src/test/java/com/pardur/service/WorldServiceSortTest.java`

- [ ] **Step 1: Update `WorldService.java`**

Add `WorldPermissionChecker checker` as a constructor field:

```java
private final WorldRepository worldRepository;
private final WikiEntryRepository wikiEntryRepository;
private final WorldPermissionChecker checker;

public WorldService(WorldRepository worldRepository, WikiEntryRepository wikiEntryRepository,
                    WorldPermissionChecker checker) {
    this.worldRepository = worldRepository;
    this.wikiEntryRepository = wikiEntryRepository;
    this.checker = checker;
}
```

Replace `getAllWorlds()` with:

```java
@Transactional(readOnly = true)
public List<WorldDto> getAllWorlds(Authentication auth) {
    return worldRepository.findAll().stream()
            .filter(w -> WorldPermissionChecker.isAdmin(auth) || checker.canRead(w, auth))
            .sorted(Comparator
                    .comparingInt((World w) -> w.getSortOrder() == 0 ? Integer.MAX_VALUE : w.getSortOrder())
                    .thenComparing(w -> w.getName().toLowerCase()))
            .map(this::toDto)
            .toList();
}
```

Add `import org.springframework.security.core.Authentication;` at the top.

In `createWorld()`, after `world.setMapEnabled(...)`, add:

```java
        world.setGuestCanRead(req.getGuestCanRead()   != null && req.getGuestCanRead());
        world.setGuestCanEdit(req.getGuestCanEdit()   != null && req.getGuestCanEdit());
        world.setGuestCanDelete(req.getGuestCanDelete() != null && req.getGuestCanDelete());
        world.setUserCanRead(req.getUserCanRead()   == null || req.getUserCanRead());
        world.setUserCanEdit(req.getUserCanEdit()   == null || req.getUserCanEdit());
        world.setUserCanDelete(req.getUserCanDelete() == null || req.getUserCanDelete());
```

In `updateWorld()`, after `if (req.getMapEnabled() != null) world.setMapEnabled(...)`, add:

```java
        if (req.getGuestCanRead()   != null) world.setGuestCanRead(req.getGuestCanRead());
        if (req.getGuestCanEdit()   != null) world.setGuestCanEdit(req.getGuestCanEdit());
        if (req.getGuestCanDelete() != null) world.setGuestCanDelete(req.getGuestCanDelete());
        if (req.getUserCanRead()    != null) world.setUserCanRead(req.getUserCanRead());
        if (req.getUserCanEdit()    != null) world.setUserCanEdit(req.getUserCanEdit());
        if (req.getUserCanDelete()  != null) world.setUserCanDelete(req.getUserCanDelete());
```

Replace `toDto()` with:

```java
private WorldDto toDto(World w) {
    return new WorldDto(w.getId(), w.getName(), w.getDescription(), w.getSortOrder(), w.getMilesPerCell(),
            w.isChronicleEnabled(), w.isWikiEnabled(), w.isMapEnabled(),
            w.isGuestCanRead(), w.isGuestCanEdit(), w.isGuestCanDelete(),
            w.isUserCanRead(), w.isUserCanEdit(), w.isUserCanDelete());
}
```

- [ ] **Step 2: Update `WorldController.java`**

Replace the `getAll()` method:

```java
@GetMapping
public ResponseEntity<List<WorldDto>> getAll(Authentication auth) {
    return ResponseEntity.ok(worldService.getAllWorlds(auth));
}
```

Add `import org.springframework.security.core.Authentication;`

- [ ] **Step 3: Fix `WorldServiceSortTest.java`**

Open `backend/src/test/java/com/pardur/service/WorldServiceSortTest.java`. The test class constructs `WorldService` via `@InjectMocks`. Since `WorldService` now has a third constructor parameter (`WorldPermissionChecker`), add a mock for it and update the test setup to pass an admin `Authentication` to `getAllWorlds()`.

In the test class, add:
```java
@Mock WorldPermissionChecker checker;
```

In every test that calls `worldService.getAllWorlds()`, change it to `worldService.getAllWorlds(null)` and add a mock setup:
```java
// checker.canRead always returns true so sort order is the only variable
when(checker.canRead(any(World.class), isNull())).thenReturn(true);
```

Add imports:
```java
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test -Dtest="WorldServiceSortTest,WorldPermissionCheckerTest" 2>&1 | grep -E "Tests run|BUILD"
```

Expected: all pass, `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/pardur/service/WorldService.java \
        backend/src/main/java/com/pardur/controller/WorldController.java \
        backend/src/test/java/com/pardur/service/WorldServiceSortTest.java
git commit -m "feat(worlds): filter world list by permission; wire 6 flags through create/update"
```

---

## Task 5: TimelineService + TimelineController

**Files:**
- Modify: `backend/src/main/java/com/pardur/service/TimelineService.java`
- Modify: `backend/src/main/java/com/pardur/controller/TimelineController.java`

The ownership check (`checkOwnership`) is removed — world-level edit/delete permission replaces it. Anonymous callers get `createdByUserId = null`.

- [ ] **Step 1: Update `TimelineService.java`**

Add constructor injection of `WorldPermissionChecker`:

```java
private final WorldPermissionChecker checker;

public TimelineService(TimelineEventRepository eventRepository,
                       EventTagRepository eventTagRepository,
                       WorldRepository worldRepository,
                       UserRepository userRepository,
                       WorldPermissionChecker checker) {
    this.eventRepository = eventRepository;
    this.eventTagRepository = eventTagRepository;
    this.worldRepository = worldRepository;
    this.userRepository = userRepository;
    this.checker = checker;
}
```

Add `import org.springframework.security.core.Authentication;`

Delete the `checkOwnership` private method entirely.

Replace each public method signature and body as follows:

```java
@Transactional(readOnly = true)
public List<EventDto> getPositionedEvents(Integer worldId, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireRead(world, auth);
    return eventRepository.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId)
            .stream().map(this::toDto).toList();
}

@Transactional(readOnly = true)
public List<EventDto> getUnpositionedEvents(Integer worldId, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireRead(world, auth);
    return eventRepository.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(worldId)
            .stream().map(this::toDto).toList();
}

@Transactional(readOnly = true)
public List<TagCountDto> getTagCounts(Integer worldId, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireRead(world, auth);
    return eventTagRepository.findTagCountsByWorldId(worldId);
}

@Transactional(readOnly = true)
public EventDto getEvent(Integer worldId, Integer id, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireRead(world, auth);
    TimelineEvent event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
    if (!event.getWorld().getId().equals(worldId))
        throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
    return toDto(event);
}

@Transactional
public EventDto createEvent(Integer worldId, CreateEventRequest req, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireEdit(world, auth);
    Integer creatorId = WorldPermissionChecker.resolveUserId(auth);

    TimelineEvent event = new TimelineEvent();
    event.setWorld(world);
    event.setTitle(req.getTitle());
    event.setDateLabel(req.getDateLabel());
    event.setTimeLabel(req.getTimeLabel());
    event.setType(req.getType());
    event.setDescription(req.getDescription());
    event.setCharacters(joinCharacters(req.getCharacters()));
    event.setSequenceOrder(null);

    if (creatorId != null) {
        User creator = userRepository.findById(creatorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + creatorId));
        event.setCreatedBy(creator);
    }

    TimelineEvent saved = eventRepository.save(event);
    setTags(saved, req.getTags());
    return toDto(eventRepository.save(saved));
}

@Transactional
public EventDto updateEvent(Integer worldId, Integer id, UpdateEventRequest req, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireEdit(world, auth);
    TimelineEvent event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
    if (!event.getWorld().getId().equals(worldId))
        throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);

    event.setTitle(req.getTitle());
    event.setDateLabel(req.getDateLabel());
    event.setTimeLabel(req.getTimeLabel());
    event.setType(req.getType());
    event.setDescription(req.getDescription());
    event.setCharacters(joinCharacters(req.getCharacters()));
    setTags(event, req.getTags());
    return toDto(eventRepository.save(event));
}

@Transactional
public EventDto assignPosition(Integer worldId, Integer id, AssignPositionRequest req, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireEdit(world, auth);
    TimelineEvent event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
    if (!event.getWorld().getId().equals(worldId))
        throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);

    BigDecimal newOrder;
    if (req.getAfterEventId() == null) {
        Optional<TimelineEvent> first = eventRepository.findFirstByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId);
        newOrder = first.isEmpty() ? new BigDecimal("1000")
                : first.get().getSequenceOrder().subtract(new BigDecimal("1000"));
    } else {
        TimelineEvent predecessor = eventRepository.findById(req.getAfterEventId())
                .orElseThrow(() -> new ResourceNotFoundException("Predecessor event not found: " + req.getAfterEventId()));
        Optional<TimelineEvent> successor = eventRepository
                .findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(worldId, predecessor.getSequenceOrder());
        newOrder = successor.isEmpty()
                ? predecessor.getSequenceOrder().add(new BigDecimal("1000"))
                : predecessor.getSequenceOrder().add(successor.get().getSequenceOrder())
                        .divide(new BigDecimal("2"), 10, RoundingMode.HALF_UP);
    }
    event.setSequenceOrder(newOrder);
    return toDto(eventRepository.save(event));
}

@Transactional
public void unplaceEvent(Integer worldId, Integer id, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireEdit(world, auth);
    TimelineEvent event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
    if (!event.getWorld().getId().equals(worldId))
        throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
    event.setSequenceOrder(null);
    eventRepository.save(event);
}

@Transactional
public void deleteEvent(Integer worldId, Integer id, Authentication auth) {
    World world = requireWorld(worldId);
    checker.requireDelete(world, auth);
    TimelineEvent event = eventRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
    if (!event.getWorld().getId().equals(worldId))
        throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
    eventRepository.delete(event);
}
```

In `toDto()`, change the else branch for null creator:
```java
    } else {
        dto.setCreatorUsername("Anonym");
        dto.setCreatorColorHex("#888888");
    }
```

- [ ] **Step 2: Update `TimelineController.java`**

Replace the entire controller. Add a `resolve` helper and update all methods to pass `auth`:

```java
package com.pardur.controller;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.service.TimelineService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/worlds/{worldId}/events")
public class TimelineController {

    private final TimelineService timelineService;

    public TimelineController(TimelineService timelineService) {
        this.timelineService = timelineService;
    }

    @GetMapping
    public ResponseEntity<List<EventDto>> getPositioned(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(timelineService.getPositionedEvents(worldId, auth));
    }

    @GetMapping("/unpositioned")
    public ResponseEntity<List<EventDto>> getUnpositioned(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(timelineService.getUnpositionedEvents(worldId, auth));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> getTags(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(timelineService.getTagCounts(worldId, auth));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDto> getOne(@PathVariable Integer worldId, @PathVariable Integer id,
                                           Authentication auth) {
        return ResponseEntity.ok(timelineService.getEvent(worldId, id, auth));
    }

    @PostMapping
    public ResponseEntity<EventDto> create(@PathVariable Integer worldId,
                                           @Valid @RequestBody CreateEventRequest req,
                                           Authentication auth) {
        return ResponseEntity.status(201).body(timelineService.createEvent(worldId, req, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventDto> update(@PathVariable Integer worldId, @PathVariable Integer id,
                                           @Valid @RequestBody UpdateEventRequest req,
                                           Authentication auth) {
        return ResponseEntity.ok(timelineService.updateEvent(worldId, id, req, auth));
    }

    @PatchMapping("/{id}/assign-position")
    public ResponseEntity<EventDto> assignPosition(@PathVariable Integer worldId, @PathVariable Integer id,
                                                    @RequestBody AssignPositionRequest req,
                                                    Authentication auth) {
        return ResponseEntity.ok(timelineService.assignPosition(worldId, id, req, auth));
    }

    @DeleteMapping("/{id}/position")
    public ResponseEntity<Void> unplace(@PathVariable Integer worldId, @PathVariable Integer id,
                                        Authentication auth) {
        timelineService.unplaceEvent(worldId, id, auth);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer worldId, @PathVariable Integer id,
                                       Authentication auth) {
        timelineService.deleteEvent(worldId, id, auth);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test 2>&1 | grep -E "Tests run|BUILD|FAIL"
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/pardur/service/TimelineService.java \
        backend/src/main/java/com/pardur/controller/TimelineController.java
git commit -m "feat(timeline): world permission checks; anonymous create; remove ownership checks"
```

---

## Task 6: WikiService + WikiController

**Files:**
- Modify: `backend/src/main/java/com/pardur/service/WikiService.java`
- Modify: `backend/src/main/java/com/pardur/controller/WikiController.java`

Key changes: world permission checks; anonymous create (null createdBy); null-safety for `entry.getCreatedBy()` in spoiler logic; `recent()` filters by accessible worlds.

- [ ] **Step 1: Update `WikiService.java`**

Add `WorldPermissionChecker checker` as a constructor field (add to constructor parameter list and assignment). Add `import org.springframework.security.core.Authentication;`

Replace/update each method:

**`list()`** — change signature and add read check when worldId present:
```java
@Transactional(readOnly = true)
public List<WikiEntryListItemDto> list(Integer worldId, String q, Authentication auth) {
    Integer currentUserId = WorldPermissionChecker.resolveUserId(auth);
    boolean isAdmin = WorldPermissionChecker.isAdmin(auth);
    List<WikiEntry> entries;
    if (q != null && !q.isBlank()) {
        String qLower = q.trim().toLowerCase();
        entries = entryRepository.searchByTitleOrBody(q.trim());
        if (worldId != null) {
            entries = entries.stream()
                    .filter(e -> e.getWorld().getId().equals(worldId))
                    .toList();
        }
        entries = entries.stream()
                .filter(e -> checker.canRead(e.getWorld(), auth))
                .sorted(Comparator.comparing(e -> !e.getTitle().toLowerCase().contains(qLower)))
                .toList();
    } else if (worldId != null) {
        World world = worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
        checker.requireRead(world, auth);
        entries = entryRepository.findAllByWorldIdOrderByTitleAsc(worldId);
    } else {
        entries = entryRepository.findAll().stream()
                .filter(e -> checker.canRead(e.getWorld(), auth))
                .toList();
    }
    return entries.stream().map(this::toListItemDto).toList();
}
```

**`recent()`** — add auth param and filter:
```java
@Transactional(readOnly = true)
public List<WikiEntryListItemDto> recent(Authentication auth) {
    return entryRepository.findTop20ByOrderByUpdatedAtDesc().stream()
            .filter(e -> checker.canRead(e.getWorld(), auth))
            .map(this::toListItemDto)
            .toList();
}
```

**`get()`** — change signature; add read check; fix null createdBy:
```java
@Transactional(readOnly = true)
public WikiEntryDto get(Integer id, Authentication auth) {
    Integer currentUserId = WorldPermissionChecker.resolveUserId(auth);
    boolean isAdmin = WorldPermissionChecker.isAdmin(auth);
    WikiEntry entry = requireEntry(id);
    checker.requireRead(entry.getWorld(), auth);
    boolean canReadSpoilers = isAdmin
            || (currentUserId != null && entry.getCreatedBy() != null
                && entry.getCreatedBy().getId().equals(currentUserId))
            || (currentUserId != null
                && spoilerReaderRepository.existsByIdEntryIdAndIdUserId(id, currentUserId));
    boolean canManageSpoilers = isAdmin
            || (currentUserId != null && entry.getCreatedBy() != null
                && entry.getCreatedBy().getId().equals(currentUserId));
    return toDto(entry, canReadSpoilers, canManageSpoilers);
}
```

**`create()`** — change signature; allow null userId:
```java
@Transactional
public WikiEntryDto create(CreateWikiEntryRequest req, Authentication auth) {
    Integer currentUserId = WorldPermissionChecker.resolveUserId(auth);
    World world = worldRepository.findById(req.getWorldId())
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + req.getWorldId()));
    checker.requireEdit(world, auth);
    checkDuplicate(req.getWorldId(), req.getTitle(), -1);

    WikiEntry entry = new WikiEntry();
    entry.setTitle(req.getTitle());
    entry.setWorld(world);
    entry.setType(req.getType());
    entry.setBody(req.getBody());
    entry.setParent(resolveParent(req.getParentId(), req.getWorldId(), null));
    if (currentUserId != null) {
        User creator = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + currentUserId));
        entry.setCreatedBy(creator);
    }
    WikiEntry saved = entryRepository.save(entry);
    return toDto(saved, true, true);
}
```

**`update()`** — change signature; add edit check; fix null createdBy:
```java
@Transactional
public WikiEntryDto update(Integer id, UpdateWikiEntryRequest req, Authentication auth) {
    Integer currentUserId = WorldPermissionChecker.resolveUserId(auth);
    boolean isAdmin = WorldPermissionChecker.isAdmin(auth);
    WikiEntry entry = requireEntry(id);
    checker.requireEdit(entry.getWorld(), auth);
    checkDuplicate(entry.getWorld().getId(), req.getTitle(), id);

    boolean canReadSpoilers = isAdmin
            || (currentUserId != null && entry.getCreatedBy() != null
                && entry.getCreatedBy().getId().equals(currentUserId))
            || (currentUserId != null
                && spoilerReaderRepository.existsByIdEntryIdAndIdUserId(id, currentUserId));
    boolean canManageSpoilers = isAdmin
            || (currentUserId != null && entry.getCreatedBy() != null
                && entry.getCreatedBy().getId().equals(currentUserId));

    entry.setTitle(req.getTitle());
    entry.setType(req.getType());
    entry.setParent(resolveParent(req.getParentId(), entry.getWorld().getId(), id));

    if (canReadSpoilers) {
        entry.setBody(req.getBody());
    } else {
        String preserved = extractSpoilers(entry.getBody());
        String newBody   = stripSpoilers(req.getBody());
        entry.setBody(preserved.isEmpty() ? newBody : newBody + "\n\n" + preserved);
    }
    return toDto(entryRepository.save(entry), canReadSpoilers, canManageSpoilers);
}
```

**`delete()`** — change signature; add delete check; remove ownership check:
```java
@Transactional
public void delete(Integer id, Authentication auth) {
    WikiEntry entry = requireEntry(id);
    checker.requireDelete(entry.getWorld(), auth);
    entryRepository.delete(entry);
}
```

**`getGraph()`** — add auth:
```java
@Transactional(readOnly = true)
public WikiGraphDto getGraph(Integer worldId, Authentication auth) {
    World world = worldRepository.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    checker.requireRead(world, auth);
    // ... rest of existing implementation unchanged
}
```

Also add `checker.requireRead` at the start of `getLinkedEvents(id, auth)`, `getLinkedEntries(id, auth)`, and `getPreview(id, auth)` by first loading the entry's world and checking read access. Add `Authentication auth` to those method signatures.

For `getSpoilerReaders`, `addSpoilerReader`, `removeSpoilerReader` — these still receive `Integer currentUserId, boolean isAdmin` from the controller (spoiler management stays logged-in only). No signature change needed.

**`toListItemDto()`** — add null check for createdBy if it references `entry.getCreatedBy()`. If it does, guard with `entry.getCreatedBy() != null ?`.

- [ ] **Step 2: Update `WikiController.java`**

Update every call site to match new service signatures. Key changes:

- `list()`: pass `auth` instead of `userId, isAdmin`
- `recent()`: pass `auth`
- `get()`: pass `auth` instead of `userId, isAdmin`
- `create()`: pass `auth` instead of `user.getUserId()`; stop casting (use `resolve(auth)` then pass auth)
- `update()`: pass `auth` instead of `userId, isAdmin`
- `delete()`: pass `auth` instead of `userId, isAdmin`
- `graph()`: pass `auth`
- `linkedEvents()`, `linkedEntries()`, `preview()`: pass `auth`

For `create`, `update`, `delete` — these no longer need to cast auth; just pass `auth` directly:

```java
@PostMapping
public ResponseEntity<WikiEntryDto> create(@Valid @RequestBody CreateWikiEntryRequest req,
                                            Authentication auth) {
    return ResponseEntity.status(201).body(wikiService.create(req, auth));
}

@PutMapping("/{id}")
public ResponseEntity<WikiEntryDto> update(@PathVariable Integer id,
                                            @Valid @RequestBody UpdateWikiEntryRequest req,
                                            Authentication auth) {
    return ResponseEntity.ok(wikiService.update(id, req, auth));
}

@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication auth) {
    wikiService.delete(id, auth);
    return ResponseEntity.noContent().build();
}

@GetMapping("/recent")
public ResponseEntity<List<WikiEntryListItemDto>> recent(Authentication auth) {
    return ResponseEntity.ok(wikiService.recent(auth));
}

@GetMapping("/{id}")
public ResponseEntity<WikiEntryDto> get(@PathVariable Integer id, Authentication auth) {
    return ResponseEntity.ok(wikiService.get(id, auth));
}

@GetMapping
public ResponseEntity<List<WikiEntryListItemDto>> list(
        @RequestParam(required = false) Integer worldId,
        @RequestParam(required = false) String q,
        Authentication auth) {
    return ResponseEntity.ok(wikiService.list(worldId, q, auth));
}
```

Image and spoiler-reader methods still cast auth (they remain ROLE_USER — auth is always non-null there).

- [ ] **Step 3: Run full test suite**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test 2>&1 | grep -E "Tests run|BUILD|FAIL"
```

Expected: `BUILD SUCCESS`, all tests pass. Fix any compilation errors before proceeding.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/pardur/service/WikiService.java \
        backend/src/main/java/com/pardur/controller/WikiController.java
git commit -m "feat(wiki): world permission checks; anonymous create; null-safe createdBy"
```

---

## Task 7: MapPoiService + MapController

**Files:**
- Modify: `backend/src/main/java/com/pardur/service/MapPoiService.java`
- Modify: `backend/src/main/java/com/pardur/controller/MapController.java`

- [ ] **Step 1: Update `MapPoiService.java`**

Add `WorldPermissionChecker checker` to constructor. Add `import org.springframework.security.core.Authentication;`

Delete the `checkOwnership` private method.

Replace public methods:

```java
@Transactional(readOnly = true)
public List<MapPoiDto> listPois(Integer worldId, Authentication auth) {
    World world = worldRepo.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    checker.requireRead(world, auth);
    return poiRepo.findAllByWorldIdOrderByCreatedAtAsc(worldId).stream().map(this::toDto).toList();
}

@Transactional
public MapPoiDto createPoi(Integer worldId, CreateMapPoiRequest req, Authentication auth) {
    World world = worldRepo.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    checker.requireEdit(world, auth);
    PoiType type = typeRepo.findById(req.getPoiTypeId())
            .orElseThrow(() -> new ResourceNotFoundException("POI type not found: " + req.getPoiTypeId()));
    Integer userId = WorldPermissionChecker.resolveUserId(auth);

    MapPoi poi = new MapPoi();
    poi.setWorld(world);
    poi.setPoiType(type);
    poi.setXPct(req.getXPct());
    poi.setYPct(req.getYPct());
    poi.setLabel(req.getLabel());
    poi.setGesinnung(type.isHasGesinnung() && req.getGesinnung() != null
            ? MapPoi.Gesinnung.valueOf(req.getGesinnung()) : null);
    if ("TEXT".equals(type.getShape())) {
        poi.setTextBold(req.getTextBold() != null ? req.getTextBold() : false);
        poi.setTextItalic(req.getTextItalic() != null ? req.getTextItalic() : false);
        poi.setTextSize(req.getTextSize() != null ? req.getTextSize() : 14);
    }
    if (userId != null) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        poi.setCreatedBy(user);
    }
    return toDto(poiRepo.save(poi));
}

@Transactional
public MapPoiDto updatePoi(Integer worldId, Integer poiId, UpdateMapPoiRequest req, Authentication auth) {
    World world = worldRepo.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    checker.requireEdit(world, auth);
    MapPoi poi = poiRepo.findById(poiId)
            .orElseThrow(() -> new ResourceNotFoundException("POI not found: " + poiId));

    if (req.getXPct()      != null) poi.setXPct(req.getXPct());
    if (req.getYPct()      != null) poi.setYPct(req.getYPct());
    if (req.getLabel()     != null) poi.setLabel(req.getLabel());
    if (req.getGesinnung() != null) {
        poi.setGesinnung(poi.getPoiType().isHasGesinnung()
                ? MapPoi.Gesinnung.valueOf(req.getGesinnung()) : null);
    }
    if ("TEXT".equals(poi.getPoiType().getShape())) {
        if (req.getTextBold()   != null) poi.setTextBold(req.getTextBold());
        if (req.getTextItalic() != null) poi.setTextItalic(req.getTextItalic());
        if (req.getTextSize()   != null) poi.setTextSize(req.getTextSize());
    }
    return toDto(poiRepo.save(poi));
}

@Transactional
public void deletePoi(Integer worldId, Integer poiId, Authentication auth) {
    World world = worldRepo.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    checker.requireDelete(world, auth);
    MapPoi poi = poiRepo.findById(poiId)
            .orElseThrow(() -> new ResourceNotFoundException("POI not found: " + poiId));
    poiRepo.delete(poi);
}
```

In `toDto()`, guard the creator reference: if `poi.getCreatedBy() == null`, skip setting creator fields (or set to null/"Anonym" as appropriate for the DTO).

- [ ] **Step 2: Update `MapController.java`**

Replace the `resolve` helper so it returns null for unauthenticated callers instead of throwing:

```java
private PardurUserDetails resolve(Authentication auth) {
    if (auth == null || !(auth.getPrincipal() instanceof PardurUserDetails u)) return null;
    return u;
}
```

Update the poi endpoints to pass `auth` directly to the service:

```java
@GetMapping("/api/worlds/{worldId}/map/pois")
public ResponseEntity<List<MapPoiDto>> listPois(@PathVariable Integer worldId, Authentication auth) {
    return ResponseEntity.ok(poiService.listPois(worldId, auth));
}

@PostMapping("/api/worlds/{worldId}/map/pois")
public ResponseEntity<MapPoiDto> createPoi(@PathVariable Integer worldId,
                                            @Valid @RequestBody CreateMapPoiRequest req,
                                            Authentication auth) {
    return ResponseEntity.status(201).body(poiService.createPoi(worldId, req, auth));
}

@PutMapping("/api/worlds/{worldId}/map/pois/{poiId}")
public ResponseEntity<MapPoiDto> updatePoi(@PathVariable Integer worldId,
                                            @PathVariable Integer poiId,
                                            @Valid @RequestBody UpdateMapPoiRequest req,
                                            Authentication auth) {
    return ResponseEntity.ok(poiService.updatePoi(worldId, poiId, req, auth));
}

@DeleteMapping("/api/worlds/{worldId}/map/pois/{poiId}")
public ResponseEntity<Void> deletePoi(@PathVariable Integer worldId,
                                       @PathVariable Integer poiId,
                                       Authentication auth) {
    poiService.deletePoi(worldId, poiId, auth);
    return ResponseEntity.noContent().build();
}
```

Map background endpoints are admin-only and don't change.

- [ ] **Step 3: Also add a world read check for the map background GET**

In `MapController.getBackground()`, add a world read check before returning the image:

```java
@GetMapping("/api/worlds/{worldId}/map/background")
public ResponseEntity<byte[]> getBackground(@PathVariable Integer worldId, Authentication auth) {
    World world = worldRepo.findById(worldId)   // inject WorldRepository into MapController
            .orElseThrow(() -> new ResourceNotFoundException("No background for world: " + worldId));
    checker.requireRead(world, auth);           // inject WorldPermissionChecker into MapController
    MapBackground bg = bgRepo.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("No background for world: " + worldId));
    return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(bg.getContentType()))
            .header("X-Bg-Scale", String.valueOf(bg.getBgScale()))
            .body(bg.getData());
}
```

Add `WorldRepository worldRepo` and `WorldPermissionChecker checker` to `MapController`'s constructor.

- [ ] **Step 4: Run full test suite**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test 2>&1 | grep -E "Tests run|BUILD|FAIL"
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/pardur/service/MapPoiService.java \
        backend/src/main/java/com/pardur/controller/MapController.java
git commit -m "feat(map): world permission checks; anonymous POI create; remove ownership checks"
```

---

## Task 8: Frontend — Permission Checkboxes in World Form

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Add permission section to `index.html`**

In `index.html`, inside `#f-world > .f-grid`, after the closing `</div>` of the `Funktionen` group (after line 191), add:

```html
        <div class="f-grp"><label class="f-lbl">Berechtigungen</label>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
            <div>
              <div style="font-size:.8rem;color:var(--t3);margin-bottom:4px">Gäste (nicht angemeldet)</div>
              <div style="display:flex;gap:16px">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="fw-guest-read"> Lesen</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="fw-guest-edit"> Bearbeiten</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="fw-guest-delete"> Löschen</label>
              </div>
            </div>
            <div>
              <div style="font-size:.8rem;color:var(--t3);margin-bottom:4px">Angemeldete Benutzer</div>
              <div style="display:flex;gap:16px">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="fw-user-read"> Lesen</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="fw-user-edit"> Bearbeiten</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="fw-user-delete"> Löschen</label>
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 2: Add permission helpers to `app.js`**

Add a new function `applyWorldPermConstraints()` near the world modal functions in `app.js`. This enforces both the within-tier (edit/delete → read) and cross-tier (guest ≤ user) rules:

```js
/**
 * Enforces world permission checkbox constraints:
 * 1. Within each tier: edit and delete imply read; unchecking read clears edit+delete.
 * 2. Cross-tier: if a guest checkbox is checked, the corresponding user checkbox is force-checked and disabled.
 * @param {string} changedId  ID of the checkbox that just changed, or null on initial load.
 */
function applyWorldPermConstraints(changedId) {
  console.debug('[applyWorldPermConstraints] →', changedId);
  const gR = document.getElementById('fw-guest-read');
  const gE = document.getElementById('fw-guest-edit');
  const gD = document.getElementById('fw-guest-delete');
  const uR = document.getElementById('fw-user-read');
  const uE = document.getElementById('fw-user-edit');
  const uD = document.getElementById('fw-user-delete');
  if (!gR) return;

  // Within-tier: edit/delete imply read
  if (gE.checked || gD.checked) gR.checked = true;
  if (uE.checked || uD.checked) uR.checked = true;
  // Within-tier: unchecking read clears edit+delete (only when read was explicitly unchecked)
  if (changedId === 'fw-guest-read' && !gR.checked) { gE.checked = false; gD.checked = false; }
  if (changedId === 'fw-user-read'  && !uR.checked) { uE.checked = false; uD.checked = false; }

  // Cross-tier: guest ≥ 0, user ≥ guest
  for (const [g, u] of [[gR, uR], [gE, uE], [gD, uD]]) {
    if (g.checked) { u.checked = true; u.disabled = true; }
    else { u.disabled = false; }
  }
  console.debug('[applyWorldPermConstraints] ← done');
}
```

- [ ] **Step 3: Wire constraint listeners in world form**

After the `applyWorldPermConstraints` function, add a helper that attaches the change listeners (called once on page load after the DOM is ready, or inline via onchange attributes). The simplest approach: add `onchange="applyWorldPermConstraints(this.id)"` to each of the 6 checkbox elements in `index.html`:

Update the 6 checkbox `<input>` elements to add `onchange="applyWorldPermConstraints(this.id)"`:

```html
<input type="checkbox" id="fw-guest-read"   onchange="applyWorldPermConstraints(this.id)">
<input type="checkbox" id="fw-guest-edit"   onchange="applyWorldPermConstraints(this.id)">
<input type="checkbox" id="fw-guest-delete" onchange="applyWorldPermConstraints(this.id)">
<input type="checkbox" id="fw-user-read"    onchange="applyWorldPermConstraints(this.id)">
<input type="checkbox" id="fw-user-edit"    onchange="applyWorldPermConstraints(this.id)">
<input type="checkbox" id="fw-user-delete"  onchange="applyWorldPermConstraints(this.id)">
```

- [ ] **Step 4: Populate 6 checkboxes in `openEditWorldModal()`**

In `openEditWorldModal()`, after the existing `document.getElementById('fw-map').checked = ...` line, add:

```js
  document.getElementById('fw-guest-read').checked   = w.guestCanRead   === true;
  document.getElementById('fw-guest-edit').checked   = w.guestCanEdit   === true;
  document.getElementById('fw-guest-delete').checked = w.guestCanDelete === true;
  document.getElementById('fw-user-read').checked    = w.userCanRead    !== false;
  document.getElementById('fw-user-edit').checked    = w.userCanEdit    !== false;
  document.getElementById('fw-user-delete').checked  = w.userCanDelete  !== false;
  applyWorldPermConstraints(null);
```

- [ ] **Step 5: Reset 6 checkboxes in `openAddWorldModal()` (or the new-world path)**

Find the function or code path that opens the modal for a new world (likely sets `editSource = 'world'` with empty fields). After the existing feature flag resets, add:

```js
  document.getElementById('fw-guest-read').checked   = false;
  document.getElementById('fw-guest-edit').checked   = false;
  document.getElementById('fw-guest-delete').checked = false;
  document.getElementById('fw-user-read').checked    = true;
  document.getElementById('fw-user-edit').checked    = true;
  document.getElementById('fw-user-delete').checked  = true;
  applyWorldPermConstraints(null);
```

- [ ] **Step 6: Include 6 fields in save payload**

Find the `handleSave` / world save code path in `app.js` (where it builds the body for `PUT /api/worlds/{id}` or `POST /api/worlds`). Add the 6 permission fields to the request body object:

```js
    guestCanRead:   document.getElementById('fw-guest-read').checked,
    guestCanEdit:   document.getElementById('fw-guest-edit').checked,
    guestCanDelete: document.getElementById('fw-guest-delete').checked,
    userCanRead:    document.getElementById('fw-user-read').checked,
    userCanEdit:    document.getElementById('fw-user-edit').checked,
    userCanDelete:  document.getElementById('fw-user-delete').checked,
```

- [ ] **Step 7: Compile backend, run tests**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test 2>&1 | grep -E "Tests run|BUILD"
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/static/index.html \
        backend/src/main/resources/static/js/app.js
git commit -m "feat(frontend): world permission checkboxes with constraint enforcement"
```

---

## Task 9: Frontend — Nav Filter + "Anonym" Attribution

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

- [ ] **Step 1: Update `renderTopNavWorlds()`**

The server already filters `state.worlds` to only include worlds the caller can see. However, add a client-side guard so guests never see worlds where `guestCanRead` is false (defensive redundancy):

In `renderTopNavWorlds()`, the existing code:
```js
  if (!state.auth.loggedIn) return; // guests see only Marktplatz
```

Replace with:
```js
  if (!state.auth.loggedIn) {
    // Guests see only worlds where guestCanRead is true (server also enforces this)
    state.worlds.filter(w => w.guestCanRead).forEach(w => {
      const btn = document.createElement('button');
      btn.className = 'nav-link' + (w.id === state.ui.activeWorldId ? ' active' : '');
      btn.id = 'nav-world-' + w.id;
      btn.textContent = w.name;
      btn.onclick = () => selectWorld(w.id);
      linksEl.appendChild(btn);
    });
    return;
  }
```

The existing logged-in loop below renders all worlds from `state.worlds` (server already filtered for user permissions), so no change needed there.

- [ ] **Step 2: "Anonym" attribution in timeline display**

Find every location in `app.js` where `event.creatorUsername` is displayed. The pattern is typically in `populateDetail()` or similar. Add a fallback:

```js
const creatorName = event.creatorUsername || 'Anonym';
```

Search for `creatorUsername` in `app.js` and replace each display use with `(event.creatorUsername || 'Anonym')`.

- [ ] **Step 3: "Anonym" attribution in wiki display**

Find where wiki entry creator is displayed in `app.js`. Add the same null fallback:

```js
const creatorName = entry.createdByUsername || entry.creatorUsername || 'Anonym';
```

- [ ] **Step 4: Run full test suite**

```bash
cd /c/Users/sandr/IdeaProjects/pardur-app/backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" test 2>&1 | grep -E "Tests run|BUILD"
```

Expected: `BUILD SUCCESS`, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/static/js/app.js
git commit -m "feat(frontend): nav filters by world permissions; Anonym attribution for anonymous content"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|---|---|
| 6 boolean columns, guest defaults 0, user defaults 1 | Task 1 |
| WorldPermissionChecker with requireRead/Edit/Delete and canRead | Task 2 |
| Admin bypasses all checks | Task 2 |
| edit/delete imply read | Task 2 |
| SecurityConfig opens content endpoints to permitAll | Task 3 |
| getAllWorlds filters by caller's permissions | Task 4 |
| createWorld/updateWorld save 6 flags | Task 4 |
| Timeline permission checks + anonymous create + remove ownership | Task 5 |
| Wiki permission checks + anonymous create + null createdBy safety | Task 6 |
| Map permission checks + anonymous create | Task 7 |
| World config form: 6 permission checkboxes | Task 8 |
| Constraint enforcement: edit→read, guest≤user | Task 8 |
| Modal populate + reset + save payload | Task 8 |
| Nav filter for guests | Task 9 |
| Anonym attribution | Task 9 |
| Spoiler logic unchanged | Tasks 6 (preserved existing spoiler handling) |
| `toDto` updated with 6 new fields | Task 1 (WorldDto) + Task 4 (WorldService.toDto) |
