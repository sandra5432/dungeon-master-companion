# CLAUDE.md — Pardur App

## Build Tools

- **Maven:** `/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn`
  - Use this full path for all `mvn` commands (not on PATH)
  - Always run from `backend/` directory: `cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" <goal>`

## Project Overview

Web application for managing D&D/tabletop RPG items. Currently has a Node.js/Express prototype (`item-management-list/`). The target architecture is a **Java Spring Boot backend** with a vanilla JS/HTML frontend.

## Legacy Reference Code

`item-management-list/` contains the **original Node.js/Express prototype**. It is kept for reference only — do not modify it, extend it, or use it as a base for new features. All new development goes into the Spring Boot backend.

## Architecture

```
pardur-app/
├── backend/          # Spring Boot (Maven)
│   └── src/main/java/com/pardur/
│       ├── controller/   # REST controllers (@RestController)
│       ├── service/      # Business logic (@Service)
│       ├── repository/   # Data access (@Repository, JpaRepository)
│       ├── model/        # JPA entities (@Entity)
│       ├── dto/          # Request/Response DTOs
│       ├── security/     # Spring Security config
│       └── exception/    # Global exception handling
└── frontend/         # Vanilla JS + HTML served as static files
```

## Spring Boot Backend — Best Practices

### Project Setup
- Java 21 (LTS), Spring Boot 3.x
- Build tool: Maven (`pom.xml`)
- Database: MySQL via Spring Data JPA + Hibernate
- Auth: Spring Security with session-based authentication (matching current design)

### Dependency Selection
```xml
<!-- Core -->
spring-boot-starter-web
spring-boot-starter-data-jpa
spring-boot-starter-security
spring-boot-starter-validation

<!-- Database -->
mysql-connector-j
<!-- or H2 for local dev/tests -->

<!-- Testing -->
spring-boot-starter-test
spring-security-test
```

### REST Controller Conventions
- Annotate with `@RestController` + `@RequestMapping("/api/resource")`
- Return `ResponseEntity<T>` with explicit HTTP status codes
- Use `@Valid` on request body parameters for input validation
- Keep controllers thin — delegate all logic to the service layer
- Use DTOs (not entities) in request/response bodies

```java
@RestController
@RequestMapping("/api/items")
public class ItemController {
    @GetMapping
    public ResponseEntity<List<ItemDto>> getAllItems() { ... }

    @GetMapping("/{id}")
    public ResponseEntity<ItemDto> getItem(@PathVariable Long id) { ... }

    @PostMapping
    public ResponseEntity<ItemDto> createItem(@Valid @RequestBody CreateItemRequest req) { ... }

    @PutMapping("/{id}")
    public ResponseEntity<ItemDto> updateItem(@PathVariable Long id, @Valid @RequestBody UpdateItemRequest req) { ... }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) { ... }
}
```

### Service Layer
- Annotate with `@Service` + `@Transactional` (on methods that write)
- Read-only methods: `@Transactional(readOnly = true)`
- Throw custom exceptions (e.g., `ItemNotFoundException`) — never return null
- Keep business logic here, not in controllers or repositories

### JPA Entities
- Annotate with `@Entity`, use `@Table(name = "items")`
- Primary key: `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)`
- Audit fields: use `@CreationTimestamp` / `@UpdateTimestamp` (Hibernate) or Spring Data `@EntityListeners(AuditingEntityListener.class)`
- Never expose entities directly via API — always map to DTOs

```java
@Entity
@Table(name = "items")
public class Item {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(nullable = false)
    private String attribute;

    private String description;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

### Repository Layer
- Extend `JpaRepository<Entity, ID>` — no boilerplate needed
- Use Spring Data derived queries for simple lookups; `@Query` only when needed
- Never write raw JDBC unless absolutely necessary

### DTOs
- Separate request DTOs (`CreateItemRequest`, `UpdateItemRequest`) from response DTOs (`ItemDto`)
- Use bean validation on request DTOs: `@NotBlank`, `@NotNull`, `@Positive`, `@Size`
- Map with a dedicated mapper method or MapStruct (avoid BeanUtils.copyProperties)

### Global Exception Handling
- Use `@RestControllerAdvice` with `@ExceptionHandler` for a single error-handling class
- Return consistent error response format: `{ "error": "message", "status": 404 }`
- Handle: `EntityNotFoundException` → 404, `MethodArgumentNotValidException` → 400, generic `Exception` → 500

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ItemNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ItemNotFoundException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse(ex.getMessage(), 404));
    }
}
```

### Security (Spring Security)
- Use session-based auth (stateful) to match current design
- Configure `SecurityFilterChain` bean in a `@Configuration` class
- Public endpoints: `GET /api/items`, `GET /api/items/{id}`, `POST /api/login`
- Protected (admin only): `POST /api/items`, `PUT /api/items/{id}`, `DELETE /api/items/{id}`
- Password hashing: `BCryptPasswordEncoder` (already used in Node.js version)
- CSRF: disable only for REST APIs consumed by same-origin SPA

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
            .requestMatchers("/api/login", "/api/logout", "/api/auth/status").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/items").hasRole("ADMIN")
            .requestMatchers(HttpMethod.PUT, "/api/items/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        )
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
        )
        .csrf(csrf -> csrf.disable());  // OK for same-origin SPA
    return http.build();
}
```

### Configuration (application.properties / application.yml)
- Use `application.yml` for readability
- Never hardcode credentials — use environment variables via `${DB_PASSWORD}`
- Separate profiles: `application-dev.yml`, `application-prod.yml`
- Expose only necessary Actuator endpoints in production

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/item_management
    username: ${DB_USER:root}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate   # use 'create-drop' only in dev
    show-sql: false        # only true in dev

server:
  port: 8080
```

### Database Migrations
- Use **Flyway** for schema management instead of `ddl-auto: create`
- Migration files: `src/main/resources/db/migration/V1__init.sql`, `V2__add_index.sql`
- Never edit existing migration files — always add new ones
- **Every new migration script requires a second review pass before it is considered complete** — check syntax, verify it applies cleanly on a fresh database, and confirm it does not break existing data

### Testing
- Unit tests: JUnit 5 + Mockito, test service layer with mocked repositories
- Integration tests: `@SpringBootTest` + `@AutoConfigureMockMvc` for controller tests
- Use `@DataJpaTest` with in-memory H2 for repository tests
- Test coverage targets: service layer 80%+, controllers via integration tests
- Never mock the database in integration tests

### Logging
- Use SLF4J (`private static final Logger log = LoggerFactory.getLogger(Foo.class)`)
- Log at appropriate levels: DEBUG for internals, INFO for business events, WARN/ERROR for failures
- Never log passwords, tokens, or PII

## Frontend Best Practices

### Structure
- Vanilla JS — no framework unless explicitly added
- Single entry point: `index.html` as SPA; all non-API routes forward to it
- Static files served from `src/main/resources/static/` (Spring Boot)
- Files: `index.html`, `js/app.js`, `css/app.css`

### State Management
- All application state lives in a single `state` object at the top of `app.js`
- Never store derived data in state — compute it from `state.events`, `state.items`, etc.
- Auth state shape: `{ loggedIn, isAdmin, userId, username, colorHex, mustChangePassword }`

### Auth-Gated UI
- Elements shown only to admins: add class `admin-only`
- Elements shown to any logged-in user: add class `user-action-only`
- Both classes are controlled via `applyAuthUI()` — do not inline `style.display` for auth-gated elements
- Ownership checks (edit/delete buttons on events): check `state.auth.isAdmin || event.createdByUserId === state.auth.userId` in JS, never rely on CSS alone

### API Calls
- All calls go through the `api(method, path, body)` wrapper — never use raw `fetch` for API calls
- The wrapper handles 401 (redirects to login) and non-OK responses uniformly
- Always `await` API calls inside `try/catch`; show `alert('Fehler: ' + e.message)` on failure

### Rendering
- Re-render from state, not from DOM inspection
- Keep render functions pure: `renderTimeline()`, `renderItems()`, `renderUsers()` — each reads from `state` and writes to the DOM
- Escape all user-supplied strings with `escHtml()` before inserting into innerHTML

### Modal Pattern
- One shared modal (`#modal`) for item/event/world/login flows — controlled by `editSource`
- Separate dedicated modals for user management (`#user-modal`) and password change (`#pw-overlay`)
- Always clear form fields and error messages when opening a modal

### CSS Conventions
- Theme variables (`--gold`, `--blue2`, `--bg-s`, `--t3`, etc.) — never hardcode colours in JS
- CSS class toggles for state: `.active`, `.open`, `.on`, `.compact`, `.dragging`
- Dark/light theme stored in `localStorage` under key `theme`

## Security Checklist
- [ ] No credentials in source code — use env vars
- [ ] All admin endpoints protected by `hasRole("ADMIN")`
- [ ] Input validated on all request bodies (`@Valid`)
- [ ] SQL injection impossible — use JPA/parameterized queries only
- [ ] Passwords stored as BCrypt hashes
- [ ] Session cookie: `httpOnly=true`, `secure=true` in production
- [ ] HTTPS enforced in production

## Before Every `git push` — Manual Test Gate

**REQUIRED:** Before running `git push`, always ask the user:

> "Before I push, please do a quick manual smoke test:
> 1. Start the app (`mvn spring-boot:run -Dspring-boot.run.profiles=dev`)
> 2. Log in as `admin` / `4711` — confirm the password-change overlay appears
> 3. Change the password, confirm the app loads normally after
> 4. Create a timeline event, verify it appears attributed to your user
> 5. Log out, log in as `user1` / `user1`, create an event, confirm edit/delete only appears on your own events
> 6. Log back in as admin — confirm the ⚙ gear icon is visible and user management works
>
> All good to push?"

Do **not** push until the user confirms.

## Common Pitfalls to Avoid

### Backend
- Do not use `ddl-auto: create` or `update` in production — use Flyway
- Do not return JPA entities from controllers — use DTOs to avoid lazy-load issues and over-exposure
- Do not put `@Transactional` on controllers
- Do not use `Optional.get()` without checking — throw a meaningful exception instead
- Do not ignore `BindingResult` when using `@Valid`
- Do not hardcode BCrypt hashes in specs or plans — generate them at implementation time and embed the literal string in the migration SQL
- Role checks in service layer (ownership) must use the `Authentication` principal, not re-query the DB

### Frontend
- Do not reference deleted DOM elements by id without null-checking (`if (el)`)
- Do not use `state.creators` — creator data is derived from `event.creatorUsername` / `event.creatorColorHex`
- Do not send `creatorCode` in event payloads — attribution is set server-side from the session user
- Do not show edit/delete buttons via `admin-only` class for events — use the ownership check in `populateDetail()`
- Do not navigate to `page-users` for non-admin users — guard in `showPage()` and server-side
