# Design: "Eingeloggt bleiben" (Remember Me)

**Date:** 2026-05-04  
**Status:** Approved

## Goal

Allow users to opt in to staying logged in across browser sessions. After session expiry (~1 h), a persistent cookie transparently re-authenticates them without requiring a new login — for up to 30 days.

---

## Mechanism

Spring Security's **persistent token remember-me** (`PersistentTokenBasedRememberMeServices`):

1. On login with `rememberMe=true`, Spring generates a random series + token, stores them in the `persistent_logins` table, and sets a `remember-me` cookie (30-day `Max-Age`).
2. On each subsequent request, Spring's `RememberMeAuthenticationFilter` checks for the cookie. If the session is expired/missing, it validates the token against the DB and re-authenticates automatically.
3. On logout, the persistent token is deleted and the cookie is cleared.

Since login is a custom JSON endpoint (not a form POST), `rememberMeServices.loginSuccess()` is called manually in `AuthController` after successful authentication.

---

## Changes

### 1. DB Migration — `V26__persistent_logins.sql`

Standard Spring Security schema:

```sql
CREATE TABLE persistent_logins (
    username  VARCHAR(64)  NOT NULL,
    series    VARCHAR(64)  PRIMARY KEY,
    token     VARCHAR(64)  NOT NULL,
    last_used TIMESTAMP    NOT NULL
);
```

### 2. `SecurityConfig`

- Register `JdbcTokenRepositoryImpl` bean backed by `DataSource`.
- Register `PersistentTokenBasedRememberMeServices` bean:
  - key: `${app.remember-me-key}` (Spring property; set in `application-dev.yml` for dev, via env var `APP_REMEMBER_ME_KEY` in prod)
  - token validity: 30 days (2,592,000 seconds)
  - `setAlwaysRemember(false)` — only activates when explicitly requested
- Wire into `filterChain` via `http.rememberMe(r -> r.rememberMeServices(rememberMeServices))`.

### 3. `LoginRequest` DTO

Add field:
```java
@NotNull
private boolean rememberMe = false;
```

### 4. `AuthController.login()`

- Add `HttpServletResponse httpResponse` parameter.
- After successful authentication, if `req.isRememberMe()`:
  ```java
  rememberMeServices.loginSuccess(httpRequest, httpResponse, auth);
  ```

### 5. `index.html` — login form (`#f-login`)

Add checkbox below the password field:

```html
<div class="f-grp f-remember">
  <label class="f-lbl f-lbl-inline">
    <input type="checkbox" id="fl-remember"> Eingeloggt bleiben
  </label>
</div>
```

### 6. `timeline.js`

- `showLoginModal()`: reset `#fl-remember` to unchecked on open.
- `doLogin(username, password, rememberMe)`: include `rememberMe` in the POST body.
- `_saveEntry()` login branch: read `#fl-remember` checkbox and pass to `doLogin()`.

---

## Configuration

### `application.yml` (base config)

Add the property with a clearly-labelled dev fallback:

```yaml
app:
  remember-me-key: ${app.remember-me-key:pardur-dev-key-replace-in-prod}
```

The fallback covers local dev without any extra configuration. In production the bat file overrides it.

### `start-pardur.bat` (production)

The bat file already passes all secrets as JVM `-D` flags. Add the key the same way:

```bat
:: --- Remember-me secret ---
set REMEMBER_ME_KEY=<your-generated-key>
```

And pass it to the JVM alongside the existing flags:

```bat
java -Dspring.profiles.active=prod ^
     ...
     -Dapp.remember-me-key=%REMEMBER_ME_KEY% ^
     -jar "%JAR%"
```

No changes needed to `application-prod.yml`.

---

## Secret Key — Format & Example

The key is an arbitrary string used to sign remember-me tokens (HMAC). Requirements:

- **Length**: 32–64 characters recommended (longer = harder to brute-force)
- **Characters**: any printable ASCII — letters, digits, `-`, `_`, `!`, `@`, etc.
- **No spaces**

Example (replace with your own generated value):
```
Pardur!RmKey-2026_xK9vQ3mN8wLpZ7rY2tA5bJ0cH4dF6eG
```

Generate one in KeePass: use the "Password Generator" with 48 characters, mixed case + digits + symbols (excluding whitespace).

**Where to put the key after generation:**

| Environment | Where |
|---|---|
| **Production** | `start-pardur.bat` — `set REMEMBER_ME_KEY=<value>` |
| **Local dev** | Not needed — the fallback in `application.yml` is used automatically |

---

## Security Notes

- Tokens are stored hashed; a compromised DB does not immediately expose valid cookies.
- Logout deletes the persistent token — the cookie becomes invalid immediately.
- The secret key should never be committed to git. Only the dev fallback (clearly labelled) lives in `application-dev.yml`.

---

## Out of Scope

- "Log out everywhere" / token revocation UI — can be added later if needed.
- Per-device session management.
