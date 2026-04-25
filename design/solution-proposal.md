# Solution Proposal: Seekarten der Zeit
## Spring Boot 3 / Vanilla JS Campaign Companion App

**Version:** 1.3
**Date:** 2026-03-26
**Status:** Draft for team review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Feature Scope](#2-feature-scope)
3. [Database Schema](#3-database-schema)
4. [Backend Architecture](#4-backend-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Migration Plan](#7-migration-plan)
8. [Open Questions and Decisions](#8-open-questions-and-decisions)

---

## 1. Executive Summary

"Seekarten der Zeit" (Sea Charts of Time) is a D&D campaign companion web application for a small group of players. It replaces an existing Node.js/Express prototype with a production-grade Java 21 / Spring Boot 3 backend served alongside a vanilla JS single-page frontend. The app provides two primary modules: **Chronik** (a vertical rope-style timeline for campaign events with tag and creator filtering, compact/normal view toggle, and drag-and-drop placement of undated events) and **Marktplatz** (a searchable, filterable, sortable magic-item catalog). The app supports **multiple worlds** — each world has its own independent timeline (Chronik), while the Marktplatz item catalog is shared globally across all worlds. Users switch between worlds via a selector in the nav bar. Access to write operations (create, edit, delete) is gated behind session-based admin authentication using BCrypt-hashed passwords stored in MySQL. The existing `items` table is evolved in-place via Flyway migrations (column rename + new column); a new `worlds`, `timeline_events`, and `event_tags` table set is introduced. All schema changes are version-controlled through Flyway; no `ddl-auto: create` is used in any profile beyond local developer testing. The resulting application is a single deployable Spring Boot JAR that serves the frontend as static resources, exposes a clean REST API under `/api/`, and requires only a MySQL instance to run.

---

## 2. Feature Scope

### World Management

- **Multiple worlds** — The app hosts any number of independent worlds (campaigns, settings). Each world has a name and an optional description. The Chronik (timeline) is fully scoped per world; each world has its own events, tags, and undated list entirely separate from other worlds.
- **World selector** — A dropdown in the nav bar lets users switch the active world. The entire Chronik view re-loads for the selected world. The active world is stored in `localStorage` and restored on next visit.
- **World CRUD** — Admin can create, rename, and delete worlds. Deleting a world also deletes all its events (cascade). A world cannot be deleted if it is the last one.
- **Marktplatz is global** — The item catalog is shared across all worlds. It is not scoped per world.

### Chronik (Timeline Module)

- **Timeline CRUD** — Create, read, update, and delete events scoped to the active world. Events have a title, integer year (relative to in-world calendar, can be negative), type (`world` or `local`), description, creator code, and a set of tags.
- **Unpositioned events** — Events with no assigned position are stored separately and rendered in the right sidebar ("Datum Unbekannt"). They participate in full CRUD.
- **Drag-to-place** — Unpositioned event cards are draggable. Dropping onto a rope gap opens a modal to optionally set a date label, then places the event at that position on the timeline.
- **Event ordering by sequence** — Events are ordered by an explicit `sequence_order` integer, not by date. Date/time is a free-form display label (`date_label`) that can be a specific year (`"-342 n.Z."`), a vague phrase (`"Lang vergangen"`, `"Vor der Zeitrechnung"`), or left blank. The label is purely for display; it has no effect on ordering.
- **Reordering** — Admin can reorder events by dragging them to a different rope gap. The server computes new sequence positions using midpoint insertion; it automatically renumbers all events in the world if gaps become too small.
- **Tag filter** — Left sidebar shows all tags with occurrence counts. Clicking a tag filters the timeline to events that carry that tag. Multiple tags use OR logic (any match). "Alle" resets the filter.
- **Creator filter** — Left sidebar lists all creators whose events exist. Clicking filters the timeline. "Alle" resets.
- **Compact / normal view toggle** — A toggle switch in the left sidebar collapses event cards to title+date label only, hiding tags and description preview.
- **Detail panel** — Clicking an event card slides in a right-side panel showing full title, date label, description, tags, type indicator, and creator avatar. Includes Edit and Delete action buttons (admin only).
- **Unpositioned events** are appended to the right sidebar in creation order.

### Marktplatz (Items Module)

- **Items CRUD** — Create, read, update, and delete magic items. Fields: name, price (integer gold pieces), rarity (Common / Uncommon / Rare / Legendary), optional URL link.
- **Text search** — Filters items by name substring (case-insensitive).
- **Rarity multiselect filter** — Checkbox dropdown for filtering by one or more rarity tiers simultaneously.
- **Price range filter** — Min and max price inputs applied as AND condition on top of other filters.
- **Sortable columns** — Table columns for name, price, and rarity are sortable ascending/descending by clicking the column header.
- **Item count footer** — Displays number of currently visible items.

### Authentication and Authorization

- **Session-based login** — Single admin user; credentials stored as BCrypt hash in `users` table. Session cookie is `httpOnly`, `secure` in production.
- **"+ Eintragen" nav button** — Visible to all users; opens the create modal for the current page context (event or item).
- **Edit and Delete** — Admin-only. Buttons appear in the detail panel and items table; backend enforces the role check independently of frontend visibility.
- **Auth status endpoint** — Frontend queries `/api/auth/status` on load to determine whether to show admin controls.

### Theme and UX

- **Dark / light theme toggle** — CSS custom-property-based theme switching persisted in `localStorage`. Dark theme is default.
- **Animated compass brand** — SVG compass needle with CSS keyframe animation in the nav bar.
- **Responsive typography** — Google Fonts: Cinzel (headings), Crimson Pro (body), JetBrains Mono (codes/dates).

---

## 3. Database Schema

### Design Decisions

**Tags — normalized join table vs. JSON column:** The mockup treats tags as free-form, comma-separated strings. Two storage options exist:

- **JSON column** (`tags JSON`) on `timeline_events`: simple, no join required for reads, works well with MySQL 8+. However, querying events by tag requires JSON_CONTAINS or a generated column index, which is non-trivial. Tag counts require application-side aggregation.
- **Normalized `event_tags` join table**: clean relational model, efficient `GROUP BY tag_name COUNT(*)` for the tag-count sidebar, straightforward filtering with `IN` or `EXISTS`, fully indexable. Costs an extra join on event reads, but for the scale of this application (dozens to hundreds of events) this is negligible.

**Decision: use the normalized `event_tags` join table.** The ability to query tag counts efficiently from the database, and the cleanliness of the relational model, outweigh the slightly higher write complexity. Tags are stored as lowercase, trimmed strings to avoid duplicates like "Magie" vs "magie".

**Creators — dedicated table vs. hardcoded:** The mockup hardcodes four creators (SK, MM, AL, RV) with display names and colors. Options:

- **Hardcoded in application config or frontend JS**: simple, no DB lookup, but requires a code deploy to add a new group member.
- **`creators` table**: allows adding new creators via the admin UI without a deploy. Each row stores the 2–3 character code, full name, and hex color. Foreign key from `timeline_events.creator_code` to `creators.code`.

**Decision: use a `creators` table.** The group may grow or change over the campaign's lifetime. Adding a row is trivial. The four initial creators are seeded in `V3__seed_creators.sql`. The `creator_code` column on `timeline_events` is a VARCHAR(3) foreign key referencing `creators.code`.

**Event ordering — `sequence_order DECIMAL(20,10)`, not date:** Events on the timeline are ordered by an explicit `sequence_order DECIMAL(20,10)` column, not by a parsed date value. The date/time associated with an event is a free-form `date_label VARCHAR` (nullable) — it can be a year string (`"-342 n.Z."`), a vague phrase (`"Lang vergangen"`), or absent entirely. This means:
- Two adjacent events can have labels `"long ago"` and `"-342 n.Z."` — their visual order is controlled solely by `sequence_order`.
- Unpositioned events (right sidebar) have `sequence_order IS NULL`; positioned events always have a non-null value.
- `DECIMAL(20,10)` is chosen over `INT` so midpoint insertion never exhausts precision — **renumbering is never needed**. Initial seeding uses whole numbers (1000, 2000, 3000…). Inserting between A and B assigns `(A + B) / 2`. Because DECIMAL can represent any midpoint exactly, no gap ever collapses to zero.
- **Insert cost: always 1 row write.** No other rows are updated on insertion or reordering.
- Reordering an existing event: update that event's `sequence_order` to the midpoint of its new neighbors — again 1 row write.
- **Linked-list alternative evaluated and rejected:** using `prev_id`/`next_id` pointer columns reduces insert writes to 3 rows but requires a `WITH RECURSIVE` CTE for every ordered read. In this app reads vastly outnumber writes, so paying a CTE cost on every timeline load to save two extra writes on rare inserts is the wrong trade-off. Simple `ORDER BY sequence_order` on an indexed DECIMAL column is faster, simpler, and easier to maintain.

**Worlds — dedicated table:** Each timeline belongs to a `world`. The `worlds` table stores a name, optional description, and a sort order for the selector dropdown. `timeline_events` carries a `world_id` FK with cascade delete — removing a world removes all its events automatically. A default world ("Standardwelt") is seeded so the app works out of the box with zero configuration. The `worlds` table is introduced in V3; no existing event data needs migration since `timeline_events` is also new in V3.

**`items` table evolution:** The existing `items` table uses `attribute` for rarity and carries a `description` column that the new UI does not expose. The migration renames `attribute` to `rarity` and adds a `url` VARCHAR column. The `description` column is retained but unused by the new UI (no data loss). A `Very Rare` rarity value exists in the seed data but is not present in the UI's four-option select — this is noted in Open Questions.

---

### Full SQL

#### Flyway Migration V1 — Baseline Schema (existing tables)

```sql
-- V1__baseline_schema.sql
-- Baseline: captures the existing state so Flyway can manage from here.
-- Run on a fresh database. On an existing database, use Flyway baseline command.

CREATE TABLE IF NOT EXISTS users (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
    id          INT            AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)   NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,
    attribute   VARCHAR(100)   NOT NULL,   -- renamed to rarity in V2
    description TEXT,
    url         VARCHAR(2048),
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **Note:** If migrating a live database with existing data, run `flyway baseline -baselineVersion=1` so Flyway recognizes the current state without re-running V1.

---

#### Flyway Migration V2 — Evolve Items Table

```sql
-- V2__evolve_items.sql
-- Rename attribute -> rarity; add url column if not already present.

ALTER TABLE items
    CHANGE COLUMN attribute rarity VARCHAR(100) NOT NULL;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS url VARCHAR(2048) NULL;
```

---

#### Flyway Migration V3 — Worlds, Creators, Timeline Events, Seed Data

```sql
-- V3__worlds_creators_and_timeline.sql

-- ── Worlds ──────────────────────────────────────────────────────────────────
CREATE TABLE worlds (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default world so the app works immediately after migration
INSERT INTO worlds (name, description, sort_order)
VALUES ('Standardwelt', 'Die erste Welt', 0);

-- ── Creators ────────────────────────────────────────────────────────────────
CREATE TABLE creators (
    code       VARCHAR(3)   NOT NULL PRIMARY KEY,
    full_name  VARCHAR(100) NOT NULL,
    color_hex  VARCHAR(7)   NOT NULL DEFAULT '#888888',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO creators (code, full_name, color_hex) VALUES
    ('SK', 'Sven K.',  '#3a7abf'),
    ('MM', 'Max M.',   '#2a9a68'),
    ('AL', 'Anna L.',  '#9a4aaa'),
    ('RV', 'Ralf V.',  '#bf603a');

-- ── Timeline Events ──────────────────────────────────────────────────────────
CREATE TABLE timeline_events (
    id             INT           AUTO_INCREMENT PRIMARY KEY,
    world_id       INT           NOT NULL,
    title          VARCHAR(255)  NOT NULL,
    sequence_order DECIMAL(20,10) NULL,    -- NULL = unpositioned (right sidebar)
                                           -- positioned events: 1000, 2000, 3000, ...
                                           -- insert between A and B: (A+B)/2
                                           -- DECIMAL ensures midpoint is always exact; renumber never needed
    date_label     VARCHAR(100)  NULL,     -- free-form display string: "-342 n.Z.", "long ago", etc.
                                           -- purely for display; has no effect on ordering
    type           ENUM('world','local') NOT NULL DEFAULT 'world',
    description    TEXT,
    creator_code   VARCHAR(3)    NOT NULL,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_event_world
        FOREIGN KEY (world_id) REFERENCES worlds(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_event_creator
        FOREIGN KEY (creator_code) REFERENCES creators(code)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for efficient ordered fetch per world
CREATE INDEX idx_timeline_events_world_seq ON timeline_events(world_id, sequence_order);

-- ── Event Tags ───────────────────────────────────────────────────────────────
CREATE TABLE event_tags (
    event_id   INT         NOT NULL,
    tag_name   VARCHAR(80) NOT NULL,

    PRIMARY KEY (event_id, tag_name),

    CONSTRAINT fk_event_tag_event
        FOREIGN KEY (event_id) REFERENCES timeline_events(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_event_tags_tag ON event_tags(tag_name);
```

---

#### Flyway Migration V4 — Seed Admin User

```sql
-- V4__seed_admin.sql
-- IMPORTANT: Replace the hash below with a freshly generated BCrypt hash before deployment.
-- Generate with: new BCryptPasswordEncoder(10).encode("your-chosen-password")

INSERT IGNORE INTO users (username, password)
VALUES ('admin', '$2a$10$REPLACE_THIS_WITH_REAL_BCRYPT_HASH');
```

---

### Entity-Relationship Summary

```
users
  id PK | username UNIQUE | password | created_at

worlds
  id PK | name | description | sort_order | created_at | updated_at

creators
  code PK (2-3 chars) | full_name | color_hex | created_at

timeline_events
  id PK | world_id FK→worlds.id (cascade delete) | title
  | sequence_order (nullable DECIMAL(20,10), NULL=unpositioned, midpoint insertion, never needs renumbering)
  | date_label (nullable VARCHAR, free-form display string, no ordering effect)
  | type ENUM('world','local') | description | creator_code FK→creators.code
  | created_at | updated_at
  INDEX (world_id, sequence_order)

event_tags
  (event_id FK→timeline_events.id, tag_name) — composite PK, cascade delete

items  [global — shared across all worlds]
  id PK | name | price DECIMAL | rarity VARCHAR | description (legacy, unused)
  | url | created_at | updated_at
```

---

## 4. Backend Architecture

### Package Structure

```
backend/src/main/java/com/pardur/
├── PardurApplication.java
│
├── config/
│   ├── SecurityConfig.java          # SecurityFilterChain, BCryptPasswordEncoder bean
│   └── WebMvcConfig.java            # SPA fallback: forward non-/api/** to index.html
│
├── controller/
│   ├── AuthController.java          # POST /api/login, POST /api/logout, GET /api/auth/status
│   ├── WorldController.java         # CRUD /api/worlds/**
│   ├── TimelineController.java      # CRUD /api/worlds/{worldId}/events/**
│   ├── ItemController.java          # CRUD /api/items/**
│   └── CreatorController.java       # GET /api/creators
│
├── service/
│   ├── AuthService.java
│   ├── WorldService.java            # World CRUD, last-world guard
│   ├── TimelineService.java         # Event logic scoped by worldId, tag aggregation
│   ├── ItemService.java
│   └── CreatorService.java
│
├── repository/
│   ├── UserRepository.java
│   ├── WorldRepository.java
│   ├── TimelineEventRepository.java # findAllByWorldIdAndYearIsNotNull..., findAllByWorldIdAndYearIsNull...
│   ├── EventTagRepository.java      # Tag count aggregation query scoped by worldId
│   ├── ItemRepository.java
│   └── CreatorRepository.java
│
├── model/
│   ├── User.java
│   ├── World.java                   # @Entity worlds
│   ├── TimelineEvent.java           # @ManyToOne → World; @OneToMany → EventTag
│   ├── EventTag.java                # @EmbeddedId composite key
│   ├── EventTagId.java              # @Embeddable
│   ├── Item.java
│   └── Creator.java
│
├── dto/
│   ├── request/
│   │   ├── LoginRequest.java
│   │   ├── CreateWorldRequest.java  # { name, description }
│   │   ├── UpdateWorldRequest.java
│   │   ├── CreateEventRequest.java  # title, dateLabel (nullable string), type, tags[], description, creatorCode
│   │   ├── UpdateEventRequest.java  # same fields; does NOT change sequence position
│   │   ├── AssignPositionRequest.java  # { afterEventId: Long|null }
│   │   ├── CreateItemRequest.java   # name, price, rarity, url
│   │   └── UpdateItemRequest.java
│   └── response/
│       ├── AuthStatusResponse.java  # { isAdmin, username }
│       ├── WorldDto.java            # { id, name, description, sortOrder }
│       ├── EventDto.java            # includes worldId, creatorName, creatorColor, tags[]
│       ├── TagCountDto.java         # { tagName, count }
│       ├── ItemDto.java
│       └── CreatorDto.java
│
└── exception/
    ├── GlobalExceptionHandler.java  # @RestControllerAdvice
    ├── ResourceNotFoundException.java
    └── ErrorResponse.java           # { error, status }
```

### Resource Layout

```
backend/src/main/resources/
├── application.yml
├── application-dev.yml
├── application-prod.yml
└── db/migration/
    ├── V1__baseline_schema.sql
    ├── V2__evolve_items.sql
    ├── V3__creators_and_timeline.sql
    └── V4__seed_admin.sql

backend/src/main/resources/static/
├── index.html          # SPA entry point
├── css/app.css         # extracted from seekarten_unified.html <style>
└── js/app.js           # extracted from seekarten_unified.html <script>, rewritten for Fetch API
```

### Spring Security Configuration (outline)

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/worlds/**").permitAll()  // includes events sub-resource
            .requestMatchers(HttpMethod.GET, "/api/creators").permitAll()
            .requestMatchers("/api/login", "/api/logout", "/api/auth/status").permitAll()
            .requestMatchers("/", "/index.html", "/css/**", "/js/**").permitAll()
            .requestMatchers(HttpMethod.POST,   "/api/worlds").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT,    "/api/worlds/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/worlds/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.POST,   "/api/worlds/*/events/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT,    "/api/worlds/*/events/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/events/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.POST,   "/api/items/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT,    "/api/items/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .csrf(csrf -> csrf.disable())  // same-origin SPA; revisit if cross-origin consumers added
        .logout(logout -> logout
            .logoutUrl("/api/logout")
            .logoutSuccessHandler((req, res, auth) -> res.setStatus(200))
        );
    return http.build();
}

@Bean
public BCryptPasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(10);
}
```

### Service Layer Responsibilities

**WorldService:**
- `getAllWorlds()` — returns all worlds ordered by `sort_order ASC`.
- `createWorld(req)` — creates a new world.
- `updateWorld(id, req)` — renames or updates description.
- `deleteWorld(id)` — deletes world and all its events (FK cascade). Throws `LastWorldException` (→ 409 Conflict) if it is the only remaining world.

**TimelineService:**
- All methods receive `worldId` as the first parameter and verify the world exists before operating.
- `getPositionedEvents(worldId)` — events where `sequence_order IS NOT NULL`, ordered by `sequence_order ASC`.
- `getUnpositionedEvents(worldId)` — events where `sequence_order IS NULL`, ordered by `created_at ASC`.
- `getTagCounts(worldId)` — `List<TagCountDto>` aggregated from `event_tags` for events in the given world, sorted by count DESC.
- `createEvent(worldId, req)` — creates `TimelineEvent` with `world_id` set, `sequence_order = null` (unpositioned). `date_label` and all other fields set from request.
- `updateEvent(worldId, id, req)` — verifies event belongs to world, replaces tags, updates fields including `date_label`. Does not move sequence position.
- `assignPosition(worldId, id, req)` — places an unpositioned event (or repositions an existing one). `req` contains `afterEventId` (nullable — null means insert at the beginning). Server looks up the predecessor and successor, computes `sequence_order = (predecessor.sequence_order + successor.sequence_order) / 2` using `BigDecimal` arithmetic. Because `DECIMAL(20,10)` always has an exact midpoint, no renumbering is ever needed — this is always a single row update.
- `deleteEvent(worldId, id)` — verifies event belongs to world, deletes; tags cascade.

**ItemService:**
- Standard CRUD: `getAllItems()`, `createItem()`, `updateItem()`, `deleteItem()`.
- Filtering and sorting are handled client-side (full fetch); the dataset is small. Server-side `Pageable` can be added later without breaking changes.

**AuthService:**
- `login(req, session)` — looks up user, verifies BCrypt hash, sets `session.setAttribute("ROLE", "ADMIN")`.
- Backed by a custom `UserDetailsService` implementation for Spring Security.

### SPA Fallback

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/{path:[^\\.]*}").setViewName("forward:/index.html");
    }
}
```

### application.yml (base)

```yaml
spring:
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3306}/${DB_NAME:item_management}?useSSL=false&serverTimezone=UTC
    username: ${DB_USER:root}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: 10
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration
    validate-on-migrate: true

server:
  port: ${PORT:8080}
```

---

## 5. Frontend Architecture

### Structure: Split Files (not monolithic HTML)

The target UI is currently a single `seekarten_unified.html` file with embedded CSS and JS. For the production build this is split into three files served as Spring Boot static resources:

| File | Location | Content |
|---|---|---|
| `index.html` | `static/index.html` | HTML structure only; links to CSS and JS |
| `app.css` | `static/css/app.css` | All CSS from `<style>` block |
| `app.js` | `static/js/app.js` | All JS, rewritten to use Fetch API |

`seekarten_unified.html` is preserved at the repo root as the design reference. It is never deployed.

**Rationale:** CSS and JS can be browser-cached independently between deploys. Split files are more maintainable and diff-friendly.

### State Management

All application state lives in a single plain-object module variable in `app.js`:

```js
const state = {
  worlds: [],          // WorldDto[] from API, sorted by sort_order
  events: [],          // dated EventDto[] for the active world
  undated: [],         // undated EventDto[] for the active world
  items: [],           // ItemDto[] (global)
  creators: {},        // { code: CreatorDto } map
  auth: { isAdmin: false, username: null },
  ui: {
    activeWorldId: null,   // loaded from localStorage, falls back to worlds[0].id
    activeTags: new Set(),
    activeCreators: new Set(),
    compact: false,
    currentPage: 'timeline',
    detailId: null,
    detailSource: null,  // 'tl' | 'undated'
    sortKey: null,
    sortDir: 1,
    rarityFilter: new Set(),
    searchText: '',
    minPrice: 0,
    maxPrice: Infinity,
    dragId: null,
  }
};
```

### API Wrapper

```js
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });
  if (res.status === 401) { showLoginModal(); throw new Error('Unauthorized'); }
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Request failed'); }
  if (res.status === 204) return null;
  return res.json();
}
```

### Initialization Sequence

```
DOMContentLoaded
  → api('GET', '/auth/status')                         → state.auth
  → api('GET', '/creators')                            → state.creators (keyed by code)
  → api('GET', '/worlds')                              → state.worlds
  → resolve activeWorldId from localStorage or worlds[0].id
  → api('GET', '/worlds/{activeWorldId}/events')         → state.events
  → api('GET', '/worlds/{activeWorldId}/events/undated') → state.undated
  → api('GET', '/items')                               → state.items
  → renderWorldSelector()
  → renderTimeline()
  → renderItems()
  → applyThemeFromStorage()
```

When the user switches world via the selector:
```
selectWorld(worldId)
  → state.ui.activeWorldId = worldId
  → localStorage.setItem('activeWorldId', worldId)
  → clear state.events, state.undated, state.ui.activeTags, state.ui.activeCreators
  → api('GET', '/worlds/{worldId}/events')         → state.events
  → api('GET', '/worlds/{worldId}/events/undated') → state.undated
  → renderTimeline()
```

### Render Architecture

Render functions read from `state` and write to the DOM — they never make API calls. API calls happen in event handlers, which update `state`, then call render.

Key render functions:
- `renderWorldSelector()` — builds the world dropdown in the nav bar from `state.worlds`; marks active world.
- `renderTimeline()` — rebuilds `#timeline` DOM for the active world, re-wires drag listeners.
- `renderTagList()` — rebuilds the tag filter sidebar from aggregated tag-count map for the active world.
- `renderCreatorList()` — rebuilds creator filter sidebar from `state.creators`.
- `renderUndated()` — rebuilds right sidebar undated list for the active world.
- `renderItems()` — filters and sorts `state.items` client-side, rebuilds table body.

### Theme Persistence

```js
function applyThemeFromStorage() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  document.getElementById('theme-btn').textContent = saved === 'dark' ? '🌙' : '☀️';
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  document.getElementById('theme-btn').textContent = next === 'dark' ? '🌙' : '☀️';
}
```

---

## 6. API Endpoint Reference

All endpoints are prefixed with `/api`. Content type is JSON. Authentication uses the `JSESSIONID` cookie set on login.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/login` | None | `{ username, password }` → sets session, returns `AuthStatusResponse` |
| `POST` | `/api/logout` | None | Invalidates session → `204` |
| `GET` | `/api/auth/status` | None | Returns `{ isAdmin, username }` |
| `GET` | `/api/worlds` | None | All worlds sorted by `sort_order` → `WorldDto[]` |
| `POST` | `/api/worlds` | Admin | Create world → `201 WorldDto` |
| `PUT` | `/api/worlds/{worldId}` | Admin | Update world name/description → `WorldDto` |
| `DELETE` | `/api/worlds/{worldId}` | Admin | Delete world + all its events → `204` (409 if last world) |
| `GET` | `/api/worlds/{worldId}/events` | None | All positioned events sorted by `sequence_order` ASC → `EventDto[]` |
| `GET` | `/api/worlds/{worldId}/events/unpositioned` | None | All unpositioned events sorted by `created_at` ASC → `EventDto[]` |
| `GET` | `/api/worlds/{worldId}/events/tags` | None | Tag counts for world → `TagCountDto[]` |
| `GET` | `/api/worlds/{worldId}/events/{id}` | None | Single event → `EventDto` |
| `POST` | `/api/worlds/{worldId}/events` | Admin | Create unpositioned event → `201 EventDto` |
| `PUT` | `/api/worlds/{worldId}/events/{id}` | Admin | Update fields (title, dateLabel, type, tags, description, creatorCode) → `EventDto` |
| `PATCH` | `/api/worlds/{worldId}/events/{id}/assign-position` | Admin | Place/reorder event on timeline → `EventDto` |
| `DELETE` | `/api/worlds/{worldId}/events/{id}` | Admin | Delete event → `204` |
| `GET` | `/api/items` | None | All items (global) → `ItemDto[]` |
| `GET` | `/api/items/{id}` | None | Single item → `ItemDto` |
| `POST` | `/api/items` | Admin | Create item → `201 ItemDto` |
| `PUT` | `/api/items/{id}` | Admin | Full update → `ItemDto` |
| `DELETE` | `/api/items/{id}` | Admin | Delete item → `204` |
| `GET` | `/api/creators` | None | All creators sorted by code → `CreatorDto[]` |

### Key Request/Response Shapes

**WorldDto:**
```json
{ "id": 1, "name": "Standardwelt", "description": "Die erste Welt", "sortOrder": 0 }
```

**CreateWorldRequest / UpdateWorldRequest:**
```json
{ "name": "Die Schattenlande", "description": "Eine düstere Parallelwelt" }
```

**CreateEventRequest / UpdateEventRequest:** (`worldId` comes from the URL path, not the body)
```json
{
  "title": "Der Grosse Sturm der Magie",
  "dateLabel": "-342 n.Z.",
  "type": "world",
  "tags": ["Magie", "Urkristall", "Verbotene Zone"],
  "description": "Ein katastrophaler Überlauf...",
  "creatorCode": "SK"
}
```
`dateLabel` is optional — can be a year string (`"-342 n.Z."`), a vague phrase (`"Lang vergangen"`), or omitted. Purely a display string with no effect on ordering. New events are always created unpositioned; use `assign-position` to place them on the timeline.

**EventDto:**
```json
{
  "id": 3,
  "worldId": 1,
  "title": "Der Grosse Sturm der Magie",
  "dateLabel": "-342 n.Z.",
  "sequenceOrder": 30000,
  "type": "world",
  "tags": ["Magie", "Urkristall", "Verbotene Zone"],
  "description": "Ein katastrophaler Überlauf...",
  "creatorCode": "SK",
  "creatorName": "Sven K.",
  "creatorColor": "#3a7abf",
  "createdAt": "2026-03-26T10:00:00"
}
```
`sequenceOrder` is `null` for unpositioned events. `dateLabel` is `null` when no label was set.

**CreateItemRequest:**
```json
{ "name": "Bag of Holding", "price": 4000, "rarity": "Uncommon", "url": "https://..." }
```

**ItemDto:**
```json
{ "id": 16, "name": "Bag of Holding", "price": 4000, "rarity": "Uncommon", "url": "https://..." }
```

**AssignPositionRequest:**
```json
{ "afterEventId": 2 }
```
`afterEventId` — ID of the event to insert after. Pass `null` to place at the beginning. Server computes `sequence_order`; client never sends raw sequence numbers.

**Error response:**
```json
{ "error": "Event not found with id: 99", "status": 404 }
```

---

## 7. Migration Plan

### Phase 0 — Repository Preparation (1 day)

- [ ] Create `backend/` directory with Spring Boot Maven project structure.
- [ ] Add `pom.xml` with: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `spring-boot-starter-validation`, `mysql-connector-j`, `flyway-core`, `flyway-mysql`, `spring-boot-starter-test`.
- [ ] Create `application.yml`, `application-dev.yml`, `application-prod.yml` using environment variable placeholders — no hardcoded credentials.
- [ ] Add `.gitignore` entries for `target/`, `*.class`, `.env`.

### Phase 1 — Database Migration (1 day)

- [ ] **Option A (keep existing database — recommended):** Keep the `item_management` database in HeidiSQL as-is. Set `DB_NAME=item_management` in your environment. Run `flyway baseline -baselineVersion=1` so Flyway registers the current state without re-running V1. Then run `flyway migrate` to apply V2–V4. All existing items and users data is preserved in place.
- [ ] **Option B (fresh start):** Create a new MySQL database `seekarten`. Run `flyway migrate` — applies V1–V4 in order. Re-import existing item data manually via HeidiSQL export/import from `item_management`.
- [ ] Write `V1__baseline_schema.sql` capturing existing `users` and `items` tables exactly as they exist in `item_management` (use HeidiSQL "Export as SQL" to get the exact DDL).
- [ ] Write and apply `V2__evolve_items.sql` — rename `attribute` → `rarity`, add `url` column.
- [ ] Write and apply `V3__creators_and_timeline.sql` — `creators` table, four seeded creators, `timeline_events`, `event_tags`.
- [ ] Write and apply `V4__seed_admin.sql` — insert hashed admin user. Generate a fresh BCrypt hash; do **not** reuse the hardcoded password from the old `server.js`.
- [ ] Verify with `flyway info` that all migrations show status `Success`.

### Phase 2 — Backend Core (3–4 days)

- [ ] Write JPA entities: `User`, `World`, `Creator`, `TimelineEvent` (`@ManyToOne` → `World`, `@OneToMany` → `EventTag`), `EventTag` (`@EmbeddedId`), `Item`.
- [ ] Write repositories:
  - `WorldRepository`: standard `JpaRepository<World, Long>` + `count()` for last-world guard
  - `TimelineEventRepository`: `findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(Long worldId)`, `findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(Long worldId)`, `findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(Long worldId, BigDecimal seq)` (find successor for midpoint calc)
  - `EventTagRepository`: JPQL `SELECT t.tagName, COUNT(t.tagName) FROM EventTag t WHERE t.event.worldId = :worldId GROUP BY t.tagName ORDER BY COUNT(t.tagName) DESC`
- [ ] Write DTOs and request validators (`@NotBlank`, `@NotNull`, `@Positive`).
- [ ] Write `GlobalExceptionHandler`: `ResourceNotFoundException` → 404, `MethodArgumentNotValidException` → 400, `Exception` → 500.
- [ ] Write `SecurityConfig` and `UserDetailsService`.
- [ ] Write `AuthController`, `WorldController`, `CreatorController`, `ItemController`, `TimelineController` with all endpoints.
- [ ] Write `WebMvcConfig` SPA forward fallback.
- [ ] Integration tests: `@SpringBootTest` for auth flow, item CRUD, event CRUD.
- [ ] Unit tests: `TimelineService` covering tag aggregation and dated/undated transitions.

### Phase 3 — Frontend Integration (2–3 days)

- [ ] Extract CSS → `src/main/resources/static/css/app.css`.
- [ ] Extract JS → `src/main/resources/static/js/app.js`.
- [ ] Create `src/main/resources/static/index.html` linking both files; remove all hardcoded data arrays.
- [ ] Replace hardcoded `events`, `undated`, `items`, `CREATORS` with API calls through the `api()` wrapper.
- [ ] Load `state.worlds` from `GET /api/worlds`; render world selector dropdown in nav bar.
- [ ] Implement `selectWorld(worldId)` — reloads events/undated for the chosen world, persists to `localStorage`.
- [ ] Add world create/edit/delete modal (admin only).
- [ ] Implement login modal (shown on 401 or when admin action triggered without session).
- [ ] Wire admin-only UI elements to `state.auth.isAdmin` — hide when not admin.
- [ ] Replace mock `nid++` ID counter with server-assigned IDs from API responses.
- [ ] Wire all CRUD modals (event create/edit/delete, item create/edit/delete) to API calls using world-scoped paths.
- [ ] Wire drag-to-rope action to `PATCH /api/worlds/{worldId}/events/{id}/assign-position` — pass `afterEventId` derived from the rope gap the card was dropped on.
- [ ] Load `state.creators` from API; replace hardcoded `CREATORS` object.
- [ ] End-to-end test all features including world switching against the running Spring Boot app.

### Phase 4 — Polish and Hardening (1–2 days)

- [ ] Add loading states (disabled buttons) during API calls.
- [ ] Verify session cookie: `httpOnly=true` (dev), `secure=true` (prod profile).
- [ ] Security audit: confirm all POST/PUT/DELETE return 401 without a session.
- [ ] Run `git grep -i password` to confirm no credentials in committed files.
- [ ] Update `CLAUDE.md` with new package structure and Flyway migration list.
- [ ] Write `README.md` with local dev setup (HeidiSQL setup, env vars, `mvn spring-boot:run`).

### Phase 5 — Decommission Old Prototype (final)

- [ ] Confirm all `item_management` data migrated to `seekarten` database.
- [ ] Archive `item-management-list/` — stays in repo history as reference, not touched.
- [ ] Update CLAUDE.md note to confirm prototype is archived.

---

## 8. Open Questions and Decisions

### 8.1 "Very Rare" Rarity Value

The existing seed data contains items with `rarity = 'Very Rare'`. The Marktplatz UI only exposes four tiers: Common, Uncommon, Rare, Legendary. **Decision needed:** Add "Very Rare" as a fifth option, or remap existing items to "Rare" in a Flyway migration? Adding a fifth option is the least lossy approach and requires a minor UI change (one `<option>` and one CSS class).

### 8.2 Pagination for Items

The current dataset is ~120 items — a single fetch is fine. If the Marktplatz grows, add Spring Data `Pageable` support to `ItemRepository` and `ItemController` with `?page=0&size=50&sort=name,asc`. Client-side filtering would shift to server-side query parameters. This is out of scope for launch but the architecture supports it without breaking changes.

### 8.3 Creator Management UI

No admin UI exists for adding creators. New group members require a Flyway migration (`V5__add_creator_xy.sql`) and redeploy. A `POST /api/creators` admin endpoint can be added in a future iteration without changing existing endpoints.

### 8.4 Session Cookie Security

Spring Boot's default session handling requires no secret configuration. For production, set in `application-prod.yml`:
```yaml
server:
  servlet:
    session:
      cookie:
        secure: true
        same-site: strict
```
In `application-dev.yml`, `secure: false` to allow HTTP on localhost.

### 8.5 Real-Time Updates (WebSocket)

If two players open the app simultaneously, one will not see the other's changes without a refresh. This is acceptable at launch for a small group. A future enhancement could add Spring STOMP WebSocket to push `{ type: 'event_created', id: 42 }` messages to connected clients. Explicitly out of scope for the initial build.

### 8.6 CSRF Protection

CSRF is disabled in the Security config (same-origin SPA, acceptable). If a cross-origin consumer is added later, re-enable with `CookieCsrfTokenRepository.withHttpOnlyFalse()` so the JS frontend can read the token from a cookie.

### 8.7 Item `description` Column

The existing `items` table has `description TEXT` with German flavor text that the new Marktplatz UI does not expose. The column is retained (no data loss). `ItemDto` deliberately omits it. It can be added to the detail view in a future iteration — the data is already there.

### 8.9 Marktplatz is Global — Decided

The Marktplatz item catalog is **global** and shared across all worlds. No `world_id` on the `items` table. This is a confirmed decision, not an open question.

### 8.10 Date Label Format Convention

`date_label` is a free-form string — the app imposes no format. Recommended conventions for consistency within a group:
- Specific year: `"-342 n.Z."`, `"+312 n.Z."`
- Vague: `"Lang vergangen"`, `"Vor der Zeitrechnung"`, `"Kürzlich"`
- Unknown within a range: `"~500 n.Z."`

The backend stores and returns the label as-is. No parsing, no validation. Formatting guidance can be documented in a campaign wiki rather than enforced by the app.

### 8.11 Sequence Order — Design Rationale and Example

`sequence_order` uses `DECIMAL(20,10)` rather than `INT` specifically to eliminate the renumbering problem entirely. The midpoint between any two distinct DECIMAL values is always representable — the column can sustain unlimited bisections in any gap without loss of precision or need for rebalancing.

A linked-list approach (`prev_id`/`next_id`) was considered: it achieves true O(1) inserts touching only 3 rows. It was rejected because every ordered read would require a `WITH RECURSIVE` CTE instead of a simple `ORDER BY`, and reads occur far more frequently than writes in this application. The DECIMAL approach costs 1 row write per insert and a single index scan per read — optimal for the actual access pattern.

#### Concrete example

**Initial state** — 5 events seeded with gap 1000:

| sequence_order | date_label | title |
|---|---|---|
| 1000.0000000000 | "long ago" | new world was discovered |
| 2000.0000000000 | "-1000 Jahr" | the volcanic eruption destroyed Nevenia |
| 3000.0000000000 | "Jahr 0" | the ash settles |
| 4000.0000000000 | "Jahr 100" | new capital found |
| 5000.0000000000 | "Jahr 1500" | a flourishing empire |

**Insert "Jahr -1500" between event 1 and event 2.**
User drags the new event to the rope gap between "long ago" and "the volcanic eruption". Frontend sends:

```json
PATCH /api/worlds/1/events/6/assign-position
{ "afterEventId": 1 }
```

Server computes: `(1000 + 2000) / 2 = 1500`. **One row written. The other 5 events are not touched.**

| sequence_order | date_label | title |
|---|---|---|
| 1000.0000000000 | "long ago" | new world was discovered |
| **1500.0000000000** | **"Jahr -1500"** | **new event** |
| 2000.0000000000 | "-1000 Jahr" | the volcanic eruption destroyed Nevenia |
| 3000.0000000000 | "Jahr 0" | the ash settles |
| 4000.0000000000 | "Jahr 100" | new capital found |
| 5000.0000000000 | "Jahr 1500" | a flourishing empire |

**Insert again into the same gap** ("long ago" → "Jahr -1500"): `(1000 + 1500) / 2 = 1250`. Still 1 row, nothing else touched.

**Stress test — 33 bisections in the exact same gap:**

With `DECIMAL(20,10)` (10 decimal places) the same gap can be bisected ~33 times before hitting precision limits. For a campaign with tens of events, this is never reachable in practice.

| Insertion # | sequence_order |
|---|---|
| 1 | 1500.0000000000 |
| 2 | 1250.0000000000 |
| 10 | 1000.9765625000 |
| 20 | 1000.0009536743 |
| 30 | 1000.0000009313 |
| ~33 | precision limit of this column |

**For contrast — what a dense integer position (1, 2, 3…) would do:**

```sql
-- Insert at position 2 with dense integers:
UPDATE timeline_events SET position = position + 1 WHERE position >= 2;
-- → touches 4 rows (events 2, 3, 4, 5)
-- With 100 events after the insert point → 100 row updates
```

The DECIMAL midpoint approach never does this. Every insert is always exactly 1 row write, regardless of how many events exist in the world.

---

*End of solution proposal. Raise questions or amendments in the team repository.*
