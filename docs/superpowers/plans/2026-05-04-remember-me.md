# Remember Me ("Eingeloggt bleiben") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users opt in to a 30-day persistent login cookie so they are re-authenticated automatically after their session expires.

**Architecture:** Spring Security's `PersistentTokenBasedRememberMeServices` stores a secure token in a `persistent_logins` DB table and sets a `remember-me` cookie. Because login is a custom JSON endpoint (not a form POST), `rememberMeServices.loginSuccess()` is called manually in `AuthController`. The frontend adds a checkbox to the login modal and passes `rememberMe: true` in the POST body when checked.

**Tech Stack:** Spring Security 6, JDBC persistent tokens, Flyway (prod), H2 auto-create (dev), Playwright E2E

---

## Files

| Action | Path | What changes |
|---|---|---|
| Create | `backend/src/main/resources/db/migration/V26__persistent_logins.sql` | Flyway migration for prod |
| Modify | `backend/src/main/resources/application.yml` | Add `app.remember-me-key` property |
| Modify | `backend/src/main/java/com/pardur/config/SecurityConfig.java` | Add token repo + remember-me service beans, wire into filter chain |
| Modify | `backend/src/main/java/com/pardur/dto/request/LoginRequest.java` | Add `rememberMe` boolean field |
| Modify | `backend/src/main/java/com/pardur/controller/AuthController.java` | Inject service, call `loginSuccess()` when flag is set |
| Modify | `backend/src/main/resources/static/index.html` | Add `#fl-remember` checkbox to login form |
| Modify | `backend/src/main/resources/static/css/app.css` | Add `.f-lbl-inline` style for checkbox label |
| Modify | `backend/src/main/resources/static/js/core.js` | Reset checkbox in `showLoginModal()`; pass `rememberMe` in `doLogin()` |
| Modify | `backend/src/main/resources/static/js/timeline.js` | Read checkbox in `_saveEntry()` login branch |
| Modify | `start-pardur.bat` | Add `REMEMBER_ME_KEY` variable and `-D` flag |
| Modify | `e2e/allgemein.spec.js` | Add `AL-G-004` tests for remember-me behaviour |

---

### Task 1: Write failing E2E tests

**Files:**
- Modify: `e2e/allgemein.spec.js`

- [ ] **Step 1: Add the failing test block at the end of `e2e/allgemein.spec.js`**

```javascript
// ── AL-G-004: Eingeloggt bleiben ──────────────────────────────────────────────

test.describe('AL-G-004 — Eingeloggt bleiben', () => {

  test('"Eingeloggt bleiben" checkbox is visible in login modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-login').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fl-remember')).toBeVisible();
  });

  test('"Eingeloggt bleiben" checkbox is unchecked by default', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-login').click();
    await expect(page.locator('#modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#fl-remember')).not.toBeChecked();
  });

  test('login without checkbox does not set remember-me cookie', async ({ page, context }) => {
    await page.goto('/');
    await page.locator('#btn-login').click();
    await page.locator('#fl-u').fill('admin');
    await page.locator('#fl-p').fill('4711');
    // checkbox NOT checked
    await page.locator('#m-save').click();
    await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });
    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'remember-me')).toBeFalsy();
  });

  test('login with checkbox sets remember-me cookie with ~30-day expiry', async ({ page, context }) => {
    await page.goto('/');
    await page.locator('#btn-login').click();
    await page.locator('#fl-u').fill('admin');
    await page.locator('#fl-p').fill('4711');
    await page.locator('#fl-remember').check();
    await page.locator('#m-save').click();
    await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });
    const cookies = await context.cookies();
    const rm = cookies.find(c => c.name === 'remember-me');
    expect(rm).toBeTruthy();
    // expiry must be at least 28 days from now
    expect(rm.expires).toBeGreaterThan(Date.now() / 1000 + 28 * 24 * 3600);
  });

  test('remember-me cookie re-authenticates after session is cleared', async ({ page, context }) => {
    await page.goto('/');
    await page.locator('#btn-login').click();
    await page.locator('#fl-u').fill('admin');
    await page.locator('#fl-p').fill('4711');
    await page.locator('#fl-remember').check();
    await page.locator('#m-save').click();
    await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });

    // Keep only the remember-me cookie (discard JSESSIONID)
    const cookies = await context.cookies();
    const rm = cookies.find(c => c.name === 'remember-me');
    await context.clearCookies();
    if (rm) await context.addCookies([rm]);

    await page.goto('/');
    // Should be re-authenticated transparently
    await expect(page.locator('#btn-logout')).toBeVisible({ timeout: 5000 });
  });

});
```

- [ ] **Step 2: Run to confirm all five new tests fail**

```
npx playwright test e2e/allgemein.spec.js --grep "AL-G-004"
```

Expected: all 5 fail — checkbox not found, cookie not set.

---

### Task 2: DB migration and application property

**Files:**
- Create: `backend/src/main/resources/db/migration/V26__persistent_logins.sql`
- Modify: `backend/src/main/resources/application.yml`

- [ ] **Step 1: Create the Flyway migration**

Create `backend/src/main/resources/db/migration/V26__persistent_logins.sql`:

```sql
CREATE TABLE persistent_logins (
    username  VARCHAR(64) NOT NULL,
    series    VARCHAR(64) PRIMARY KEY,
    token     VARCHAR(64) NOT NULL,
    last_used TIMESTAMP   NOT NULL
);
```

- [ ] **Step 2: Add the property to `application.yml`**

In `backend/src/main/resources/application.yml`, append after the `server:` block:

```yaml
app:
  remember-me-key: pardur-dev-key-replace-in-prod
```

The production value is supplied via `-Dapp.remember-me-key=...` in `start-pardur.bat` (Task 7) and overrides this default at runtime.

- [ ] **Step 3: Commit**

```
git add backend/src/main/resources/db/migration/V26__persistent_logins.sql
git add backend/src/main/resources/application.yml
git commit -m "feat(auth): add persistent_logins migration and remember-me-key property"
```

---

### Task 3: SecurityConfig — remember-me beans

**Files:**
- Modify: `backend/src/main/java/com/pardur/config/SecurityConfig.java`

- [ ] **Step 1: Replace the entire file with the updated version**

```java
package com.pardur.config;

import com.pardur.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.rememberme.JdbcTokenRepositoryImpl;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;

import javax.sql.DataSource;

/**
 * Central Spring Security configuration: authorization rules, session management,
 * remember-me persistent tokens, and logout.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.remember-me-key}")
    private String rememberMeKey;

    /** True in prod (Flyway manages schema); false in dev (H2, Flyway disabled). */
    @Value("${spring.flyway.enabled:true}")
    private boolean flywayEnabled;

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.fromHierarchy("ROLE_ADMIN > ROLE_USER");
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthService authService,
                                                       BCryptPasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(authService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    /**
     * JDBC-backed token store for remember-me.
     * In dev (Flyway disabled) the table is created automatically by Spring Security.
     * In prod it is created by migration V26.
     */
    @Bean
    public PersistentTokenRepository tokenRepository(DataSource dataSource) {
        JdbcTokenRepositoryImpl repo = new JdbcTokenRepositoryImpl();
        repo.setDataSource(dataSource);
        repo.setCreateTableOnStartup(!flywayEnabled);
        return repo;
    }

    /**
     * Remember-me service: 30-day token validity, opt-in only (alwaysRemember=false).
     */
    @Bean
    public PersistentTokenBasedRememberMeServices rememberMeServices(
            AuthService authService,
            PersistentTokenRepository tokenRepository) {
        PersistentTokenBasedRememberMeServices services =
                new PersistentTokenBasedRememberMeServices(rememberMeKey, authService, tokenRepository);
        services.setTokenValiditySeconds(2_592_000); // 30 days
        services.setAlwaysRemember(false);
        return services;
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            PersistentTokenBasedRememberMeServices rememberMeServices) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/index.html", "/js/**", "/css/**", "/favicon.ico", "/world/**", "/ideas", "/ideas/**").permitAll()
                .requestMatchers("/api/login", "/api/logout", "/api/auth/status", "/api/auth/change-password").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
                .requestMatchers(HttpMethod.GET,    "/api/worlds").permitAll()
                .requestMatchers(HttpMethod.GET,    "/api/worlds/*").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/worlds").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/worlds/*").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/*").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST,   "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/admin/users/names").hasRole("USER")
                .requestMatchers("/api/admin/users/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST,   "/api/wiki/*/images").hasRole("USER")
                .requestMatchers(HttpMethod.PUT,    "/api/wiki/images/**").hasRole("USER")
                .requestMatchers(HttpMethod.DELETE, "/api/wiki/images/**").hasRole("USER")
                .requestMatchers(HttpMethod.POST,   "/api/wiki/*/spoiler-readers/**").hasRole("USER")
                .requestMatchers(HttpMethod.DELETE, "/api/wiki/*/spoiler-readers/**").hasRole("USER")
                .requestMatchers(HttpMethod.GET,    "/api/wiki/**").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/wiki").permitAll()
                .requestMatchers(HttpMethod.PUT,    "/api/wiki/{id:[0-9]+}").permitAll()
                .requestMatchers(HttpMethod.DELETE, "/api/wiki/{id:[0-9]+}").permitAll()
                .requestMatchers("/api/ideas/**").hasRole("USER")
                .requestMatchers("/api/worlds/*/events/**").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/worlds/*/events").permitAll()
                .requestMatchers(HttpMethod.GET,    "/api/poi-types").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/poi-types").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/poi-types/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/poi-types/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET,    "/api/worlds/*/map/**").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/worlds/*/map/pois").permitAll()
                .requestMatchers(HttpMethod.PUT,    "/api/worlds/*/map/pois/**").permitAll()
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/map/pois/**").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/worlds/*/map/background").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH,  "/api/worlds/*/map/background/scale").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/map/background").hasRole("ADMIN")
                .requestMatchers("/api/export/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .csrf(csrf -> csrf.disable())
            .httpBasic(Customizer.withDefaults())
            .rememberMe(r -> r.rememberMeServices(rememberMeServices))
            .logout(logout -> logout
                .logoutUrl("/api/logout")
                .logoutSuccessHandler((req, res, authentication) -> res.setStatus(200))
                .deleteCookies("remember-me")
            );
        return http.build();
    }
}
```

- [ ] **Step 2: Build to confirm it compiles**

```
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```
git add backend/src/main/java/com/pardur/config/SecurityConfig.java
git commit -m "feat(auth): add persistent remember-me token beans to SecurityConfig"
```

---

### Task 4: LoginRequest DTO

**Files:**
- Modify: `backend/src/main/java/com/pardur/dto/request/LoginRequest.java`

- [ ] **Step 1: Add `rememberMe` field**

Replace the entire file:

```java
package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Request body for POST /api/login. */
public class LoginRequest {

    @NotBlank
    private String username;

    @NotBlank
    private String password;

    private boolean rememberMe = false;

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public boolean isRememberMe() { return rememberMe; }
    public void setRememberMe(boolean rememberMe) { this.rememberMe = rememberMe; }
}
```

- [ ] **Step 2: Build to confirm it compiles**

```
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```
git add backend/src/main/java/com/pardur/dto/request/LoginRequest.java
git commit -m "feat(auth): add rememberMe field to LoginRequest"
```

---

### Task 5: AuthController — call loginSuccess

**Files:**
- Modify: `backend/src/main/java/com/pardur/controller/AuthController.java`

- [ ] **Step 1: Replace the entire file**

```java
package com.pardur.controller;

import com.pardur.dto.request.ChangePasswordRequest;
import com.pardur.dto.request.LoginRequest;
import com.pardur.dto.response.AuthStatusResponse;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.AuthService;
import com.pardur.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

/**
 * Handles login, logout, auth status, and password change.
 */
@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final AuthService authService;
    private final UserService userService;
    private final PersistentTokenBasedRememberMeServices rememberMeServices;

    public AuthController(AuthenticationManager authenticationManager,
                          AuthService authService,
                          UserService userService,
                          PersistentTokenBasedRememberMeServices rememberMeServices) {
        this.authenticationManager = authenticationManager;
        this.authService = authService;
        this.userService = userService;
        this.rememberMeServices = rememberMeServices;
    }

    /**
     * Authenticates the user and creates a session.
     * If {@code rememberMe} is true, also issues a persistent remember-me cookie.
     */
    @PostMapping("/login")
    public ResponseEntity<AuthStatusResponse> login(@Valid @RequestBody LoginRequest req,
                                                     HttpServletRequest httpRequest,
                                                     HttpServletResponse httpResponse) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
        HttpSession session = httpRequest.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                SecurityContextHolder.getContext());
        if (req.isRememberMe()) {
            rememberMeServices.loginSuccess(httpRequest, httpResponse, auth);
        }
        return ResponseEntity.ok(authService.getAuthStatus(auth));
    }

    /** Returns the current authentication state. */
    @GetMapping("/auth/status")
    public ResponseEntity<AuthStatusResponse> status(Authentication authentication) {
        return ResponseEntity.ok(authService.getAuthStatus(authentication));
    }

    /**
     * Changes the authenticated user's own password.
     * Refreshes the session principal so mustChangePassword is reflected immediately.
     */
    @PostMapping("/auth/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                                Authentication authentication,
                                                HttpServletRequest httpRequest) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        userService.changePassword(details.getUserId(), req.getCurrentPassword(), req.getNewPassword());
        UserDetails freshDetails = authService.loadUserByUsername(details.getUsername());
        Authentication freshAuth = new UsernamePasswordAuthenticationToken(
                freshDetails, authentication.getCredentials(), freshDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(freshAuth);
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                    SecurityContextHolder.getContext());
        }
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Build to confirm it compiles**

```
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```
git add backend/src/main/java/com/pardur/controller/AuthController.java
git commit -m "feat(auth): wire rememberMeServices.loginSuccess in AuthController"
```

---

### Task 6: Frontend — checkbox in login form and CSS

**Files:**
- Modify: `backend/src/main/resources/static/index.html`
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add checkbox to `#f-login` in `index.html`**

Find this block (around line 210):

```html
        <div class="f-grp"><label class="f-lbl">Passwort</label><input class="f-inp" id="fl-p" type="password" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')document.getElementById('m-save').click()"></div>
        <div id="fl-err" style="display:none;color:#e07070;font-family:'Inter',system-ui,sans-serif;font-size:.88rem"></div>
```

Replace with:

```html
        <div class="f-grp"><label class="f-lbl">Passwort</label><input class="f-inp" id="fl-p" type="password" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')document.getElementById('m-save').click()"></div>
        <div class="f-grp">
          <label class="f-lbl-inline"><input type="checkbox" id="fl-remember"> Eingeloggt bleiben</label>
        </div>
        <div id="fl-err" style="display:none;color:#e07070;font-family:'Inter',system-ui,sans-serif;font-size:.88rem"></div>
```

- [ ] **Step 2: Add `.f-lbl-inline` CSS**

Find the existing `.f-lbl` rule in `backend/src/main/resources/static/css/app.css` and add the new class directly after it. Search for `.f-lbl {` to find the location, then add after its closing `}`:

```css
.f-lbl-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: .82rem;
  color: var(--t2);
  cursor: pointer;
  font-weight: normal;
  margin-top: 4px;
}
.f-lbl-inline input[type="checkbox"] { cursor: pointer; accent-color: var(--gold); }
```

- [ ] **Step 3: Commit**

```
git add backend/src/main/resources/static/index.html
git add backend/src/main/resources/static/css/app.css
git commit -m "feat(auth): add Eingeloggt-bleiben checkbox to login form"
```

---

### Task 7: Frontend — JS wiring

**Files:**
- Modify: `backend/src/main/resources/static/js/core.js`
- Modify: `backend/src/main/resources/static/js/timeline.js`

- [ ] **Step 1: Reset checkbox in `showLoginModal()` in `core.js`**

Find this block in `core.js`:

```javascript
  const errEl = document.getElementById('fl-err');
  if (errEl) errEl.style.display = 'none';
  openModal();
```

Replace with:

```javascript
  const errEl = document.getElementById('fl-err');
  if (errEl) errEl.style.display = 'none';
  const rememberEl = document.getElementById('fl-remember');
  if (rememberEl) rememberEl.checked = false;
  openModal();
```

- [ ] **Step 2: Add `rememberMe` parameter to `doLogin()` in `core.js`**

Find:

```javascript
async function doLogin(username, password) {
  console.debug('[doLogin] →', username);
  try {
    const result = await api('POST', '/login', { username, password });
```

Replace with:

```javascript
async function doLogin(username, password, rememberMe = false) {
  console.debug('[doLogin] →', username, 'rememberMe:', rememberMe);
  try {
    const result = await api('POST', '/login', { username, password, rememberMe });
```

- [ ] **Step 3: Read checkbox in `_saveEntry()` login branch in `timeline.js`**

Find:

```javascript
  if (editSource === 'login') {
    const username = document.getElementById('fl-u').value.trim();
    const password = document.getElementById('fl-p').value;
    if (!username || !password) { alert('Benutzername und Passwort sind Pflicht'); return; }
    await doLogin(username, password);
    return;
  }
```

Replace with:

```javascript
  if (editSource === 'login') {
    const username = document.getElementById('fl-u').value.trim();
    const password = document.getElementById('fl-p').value;
    const rememberMe = document.getElementById('fl-remember')?.checked || false;
    if (!username || !password) { alert('Benutzername und Passwort sind Pflicht'); return; }
    await doLogin(username, password, rememberMe);
    return;
  }
```

- [ ] **Step 4: Commit**

```
git add backend/src/main/resources/static/js/core.js
git add backend/src/main/resources/static/js/timeline.js
git commit -m "feat(auth): wire rememberMe checkbox through showLoginModal/doLogin/_saveEntry"
```

---

### Task 8: Production bat file

**Files:**
- Modify: `start-pardur.bat`

- [ ] **Step 1: Add `REMEMBER_ME_KEY` variable**

After the `set DB_PASSWORD=...` line, add:

```bat
:: --- Remember-me secret ---
set REMEMBER_ME_KEY=pardur-dev-key-replace-in-prod
```

⚠️ **Replace the value** with a 48-character random string generated in KeePass (mixed case + digits + symbols, no spaces) before deploying to production. Example format: `Pardur!RmKey-2026_xK9vQ3mN8wLpZ7rY2tA5bJ0cH4dF6eG`

- [ ] **Step 2: Pass the key as a JVM flag**

Find:

```bat
java -Dspring.profiles.active=prod ^
     -DPORT=%PORT% ^
     -DDB_HOST=%DB_HOST% ^
     -DDB_PORT=%DB_PORT% ^
     -DDB_NAME=%DB_NAME% ^
     -DDB_USER=%DB_USER% ^
     -DDB_PASSWORD=%DB_PASSWORD% ^
     -jar "%JAR%"
```

Replace with:

```bat
java -Dspring.profiles.active=prod ^
     -DPORT=%PORT% ^
     -DDB_HOST=%DB_HOST% ^
     -DDB_PORT=%DB_PORT% ^
     -DDB_NAME=%DB_NAME% ^
     -DDB_USER=%DB_USER% ^
     -DDB_PASSWORD=%DB_PASSWORD% ^
     -Dapp.remember-me-key=%REMEMBER_ME_KEY% ^
     -jar "%JAR%"
```

- [ ] **Step 3: Commit**

```
git add start-pardur.bat
git commit -m "feat(auth): pass REMEMBER_ME_KEY to JVM in start-pardur.bat"
```

---

### Task 9: Run the full test suite

- [ ] **Step 1: Start the app with the dev profile if not already running**

```
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" spring-boot:run -Dspring-boot.run.profiles=dev -q
```

- [ ] **Step 2: Run the full Playwright suite**

```
npx playwright test
```

Expected: all 293 + 5 new = 298 tests pass.

- [ ] **Step 3: If all pass, push**

```
git push
```
