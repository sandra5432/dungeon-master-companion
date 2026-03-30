# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded admin with a two-role user system (ADMIN/USER), link timeline events to users, drop the creators table, and add an admin-only user management UI.

**Architecture:** `role` + `must_change_password` + `color_hex` columns on `users`; `created_by_user_id` FK on `timeline_events`; `Creator` layer deleted; Spring Security role hierarchy; ownership checked in `TimelineService`; password-change gate rendered in frontend before any page.

**Tech Stack:** Java 21, Spring Boot 3.3, Spring Security, Flyway (MySQL prod / H2 dev), Vanilla JS

---

## File Map

**New files:**
- `backend/src/main/resources/db/migration/V9__user_roles_and_event_ownership.sql`
- `backend/src/main/resources/db/migration/V10__seed_default_admin.sql`
- `backend/src/main/java/com/pardur/security/PardurUserDetails.java`
- `backend/src/main/java/com/pardur/dto/request/CreateUserRequest.java`
- `backend/src/main/java/com/pardur/dto/request/UpdateUserRequest.java`
- `backend/src/main/java/com/pardur/dto/request/ChangePasswordRequest.java`
- `backend/src/main/java/com/pardur/dto/response/UserDto.java`
- `backend/src/main/java/com/pardur/service/UserService.java`
- `backend/src/main/java/com/pardur/controller/UserController.java`
- `backend/src/test/java/com/pardur/service/UserServiceTest.java`
- `backend/src/test/java/com/pardur/service/TimelineOwnershipTest.java`

**Modified files:**
- `backend/src/main/java/com/pardur/model/User.java`
- `backend/src/main/java/com/pardur/model/TimelineEvent.java`
- `backend/src/main/java/com/pardur/service/AuthService.java`
- `backend/src/main/java/com/pardur/config/SecurityConfig.java`
- `backend/src/main/java/com/pardur/dto/response/AuthStatusResponse.java`
- `backend/src/main/java/com/pardur/controller/AuthController.java`
- `backend/src/main/java/com/pardur/service/TimelineService.java`
- `backend/src/main/java/com/pardur/controller/TimelineController.java`
- `backend/src/main/java/com/pardur/dto/request/CreateEventRequest.java`
- `backend/src/main/java/com/pardur/dto/request/UpdateEventRequest.java`
- `backend/src/main/java/com/pardur/dto/response/EventDto.java`
- `backend/src/main/resources/import.sql`
- `backend/src/main/resources/static/index.html`
- `backend/src/main/resources/static/js/app.js`

**Deleted files:**
- `backend/src/main/java/com/pardur/model/Creator.java`
- `backend/src/main/java/com/pardur/repository/CreatorRepository.java`
- `backend/src/main/java/com/pardur/service/CreatorService.java`
- `backend/src/main/java/com/pardur/controller/CreatorController.java`
- `backend/src/main/java/com/pardur/dto/response/CreatorDto.java`

---

## Task 1: Generate BCrypt hash of "4711"

**Files:**
- Create (temp): `backend/src/test/java/com/pardur/util/BcryptPrinter.java`

- [ ] **Step 1: Write a temporary test that prints the hash**

```java
// backend/src/test/java/com/pardur/util/BcryptPrinter.java
package com.pardur.util;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptPrinter {
    @Test
    void printHash() {
        System.out.println("HASH=" + new BCryptPasswordEncoder(10).encode("4711"));
        System.out.println("USER1_HASH=" + new BCryptPasswordEncoder(10).encode("user1"));
    }
}
```

- [ ] **Step 2: Run the test and capture the hashes**

Run from the `backend` directory:
```bash
mvn test -Dtest=BcryptPrinter -pl . 2>&1 | grep "HASH="
```

Expected output (values will differ on each run — BCrypt is non-deterministic):
```
HASH=$2a$10$<53 random characters>
USER1_HASH=$2a$10$<53 random characters>
```

Copy both hash values — they are used in Task 2 and Task 11.

- [ ] **Step 3: Delete the temp file**

```bash
rm backend/src/test/java/com/pardur/util/BcryptPrinter.java
```

---

## Task 2: Flyway V9 + V10 migrations

**Files:**
- Create: `backend/src/main/resources/db/migration/V9__user_roles_and_event_ownership.sql`
- Create: `backend/src/main/resources/db/migration/V10__seed_default_admin.sql`

- [ ] **Step 1: Write V9**

Replace `<HASH_OF_4711>` with the hash captured in Task 1 Step 2.

```sql
-- V9__user_roles_and_event_ownership.sql

-- 1. Add new columns to users
ALTER TABLE users
  ADD COLUMN role               VARCHAR(10) NOT NULL DEFAULT 'USER',
  ADD COLUMN must_change_password BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN color_hex          VARCHAR(7)  NOT NULL DEFAULT '#888888';

-- 2. Update existing admin user
UPDATE users
SET role                = 'ADMIN',
    must_change_password = TRUE,
    password            = '<HASH_OF_4711>',
    color_hex           = '#9a4aaa'
WHERE username = 'admin';

-- 3. Add created_by_user_id column to timeline_events
ALTER TABLE timeline_events
  ADD COLUMN created_by_user_id INT NULL;

ALTER TABLE timeline_events
  ADD CONSTRAINT fk_event_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL;

-- 4. Drop the old FK that references creators (must happen before dropping column)
ALTER TABLE timeline_events DROP FOREIGN KEY fk_event_creator;

-- 5. Drop the creator_code column
ALTER TABLE timeline_events DROP COLUMN creator_code;

-- 6. Drop creators table (safe now — no FK references it)
DROP TABLE creators;
```

- [ ] **Step 2: Write V10**

Replace `<HASH_OF_4711>` with the same hash from Task 1.

```sql
-- V10__seed_default_admin.sql
-- Ensures a working admin account exists on a fresh database
-- (handles the case where V4 seeded a placeholder hash that was never replaced)

INSERT IGNORE INTO users (username, password, role, must_change_password, color_hex)
VALUES ('admin', '<HASH_OF_4711>', 'ADMIN', TRUE, '#9a4aaa');
```

- [ ] **Step 3: Verify migration files exist**

```bash
ls backend/src/main/resources/db/migration/
```

Expected: V1 through V10 all present.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/
git commit -m "feat: add Flyway V9 (user roles + drop creators) and V10 (default admin seed)"
```

---

## Task 3: Update User entity

**Files:**
- Modify: `backend/src/main/java/com/pardur/model/User.java`

- [ ] **Step 1: Replace the file with the updated entity**

```java
package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, length = 10)
    private String role = "USER";

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = false;

    @Column(name = "color_hex", nullable = false, length = 7)
    private String colorHex = "#888888";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId()                        { return id; }
    public String getUsername()                   { return username; }
    public void setUsername(String username)      { this.username = username; }
    public String getPassword()                   { return password; }
    public void setPassword(String password)      { this.password = password; }
    public String getRole()                       { return role; }
    public void setRole(String role)              { this.role = role; }
    public boolean isMustChangePassword()         { return mustChangePassword; }
    public void setMustChangePassword(boolean v)  { this.mustChangePassword = v; }
    public String getColorHex()                   { return colorHex; }
    public void setColorHex(String colorHex)      { this.colorHex = colorHex; }
    public LocalDateTime getCreatedAt()           { return createdAt; }
}
```

- [ ] **Step 2: Compile to verify no errors**

```bash
mvn compile -pl backend -q
```

Expected: BUILD SUCCESS (may have errors in other files that reference Creator — fix in later tasks).

---

## Task 4: PardurUserDetails + AuthService + SecurityConfig

**Files:**
- Create: `backend/src/main/java/com/pardur/security/PardurUserDetails.java`
- Modify: `backend/src/main/java/com/pardur/service/AuthService.java`
- Modify: `backend/src/main/java/com/pardur/config/SecurityConfig.java`

The custom `UserDetails` implementation carries `userId` and `role` so controllers never need a second DB query to look up the current user.

- [ ] **Step 1: Create PardurUserDetails**

```java
package com.pardur.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;

public class PardurUserDetails implements UserDetails {

    private final Integer userId;
    private final String username;
    private final String password;
    private final String role;
    private final boolean mustChangePassword;
    private final Collection<? extends GrantedAuthority> authorities;

    public PardurUserDetails(Integer userId, String username, String password,
                              String role, boolean mustChangePassword,
                              Collection<? extends GrantedAuthority> authorities) {
        this.userId             = userId;
        this.username           = username;
        this.password           = password;
        this.role               = role;
        this.mustChangePassword = mustChangePassword;
        this.authorities        = authorities;
    }

    public Integer getUserId()            { return userId; }
    public String getRole()               { return role; }
    public boolean mustChangePassword()   { return mustChangePassword; }

    @Override public String getUsername()                                         { return username; }
    @Override public String getPassword()                                         { return password; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities()     { return authorities; }
    @Override public boolean isAccountNonExpired()                                { return true; }
    @Override public boolean isAccountNonLocked()                                 { return true; }
    @Override public boolean isCredentialsNonExpired()                            { return true; }
    @Override public boolean isEnabled()                                          { return true; }
}
```

- [ ] **Step 2: Update AuthService**

```java
package com.pardur.service;

import com.pardur.dto.response.AuthStatusResponse;
import com.pardur.repository.UserRepository;
import com.pardur.security.PardurUserDetails;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class AuthService implements UserDetailsService {

    private final UserRepository userRepository;

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public PardurUserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsername(username)
                .map(user -> new PardurUserDetails(
                        user.getId(),
                        user.getUsername(),
                        user.getPassword(),
                        user.getRole(),
                        user.isMustChangePassword(),
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))
                ))
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    public AuthStatusResponse getAuthStatus(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return new AuthStatusResponse(false, false, null, null, null, false);
        }
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        boolean isAdmin = "ADMIN".equals(details.getRole());
        return new AuthStatusResponse(
                true,
                isAdmin,
                details.getUserId(),
                details.getUsername(),
                details.getRole(),
                details.mustChangePassword()
        );
    }
}
```

- [ ] **Step 3: Update SecurityConfig**

```java
package com.pardur.config;

import com.pardur.service.AuthService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public RoleHierarchy roleHierarchy() {
        RoleHierarchyImpl h = new RoleHierarchyImpl();
        h.setHierarchy("ROLE_ADMIN > ROLE_USER");
        return h;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthService authService,
                                                       BCryptPasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(authService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Public read
                .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/worlds/**").permitAll()
                .requestMatchers("/api/login", "/api/logout", "/api/auth/status").permitAll()
                .requestMatchers("/", "/index.html", "/css/**", "/js/**").permitAll()
                // Admin-only: worlds mutation, items mutation, user management
                .requestMatchers(HttpMethod.POST,   "/api/worlds").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/worlds/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST,   "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // Any logged-in user: event mutations (ownership enforced in service)
                .requestMatchers(HttpMethod.POST,   "/api/worlds/*/events/**").hasAnyRole("ADMIN", "USER")
                .requestMatchers(HttpMethod.PUT,    "/api/worlds/*/events/**").hasAnyRole("ADMIN", "USER")
                .requestMatchers(HttpMethod.PATCH,  "/api/worlds/*/events/**").hasAnyRole("ADMIN", "USER")
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/events/**").hasAnyRole("ADMIN", "USER")
                // Password change: any authenticated user
                .requestMatchers(HttpMethod.POST, "/api/auth/change-password").authenticated()
                .anyRequest().authenticated()
            )
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .csrf(csrf -> csrf.disable())
            .logout(logout -> logout
                .logoutUrl("/api/logout")
                .logoutSuccessHandler((req, res, authentication) -> res.setStatus(200))
            );
        return http.build();
    }
}
```

- [ ] **Step 4: Compile**

```bash
mvn compile -pl backend -q
```

Expected: BUILD SUCCESS (AuthStatusResponse compile error expected — fix in Task 5).

---

## Task 5: AuthStatusResponse + change-password endpoint

**Files:**
- Modify: `backend/src/main/java/com/pardur/dto/response/AuthStatusResponse.java`
- Create: `backend/src/main/java/com/pardur/dto/request/ChangePasswordRequest.java`
- Modify: `backend/src/main/java/com/pardur/controller/AuthController.java`

- [ ] **Step 1: Update AuthStatusResponse**

```java
package com.pardur.dto.response;

public class AuthStatusResponse {
    private final boolean loggedIn;
    private final boolean admin;
    private final Integer userId;
    private final String username;
    private final String role;
    private final boolean mustChangePassword;

    public AuthStatusResponse(boolean loggedIn, boolean admin, Integer userId,
                               String username, String role, boolean mustChangePassword) {
        this.loggedIn           = loggedIn;
        this.admin              = admin;
        this.userId             = userId;
        this.username           = username;
        this.role               = role;
        this.mustChangePassword = mustChangePassword;
    }

    public boolean isLoggedIn()           { return loggedIn; }
    public boolean isAdmin()              { return admin; }
    public Integer getUserId()            { return userId; }
    public String getUsername()           { return username; }
    public String getRole()               { return role; }
    public boolean isMustChangePassword() { return mustChangePassword; }
}
```

- [ ] **Step 2: Create ChangePasswordRequest**

```java
package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChangePasswordRequest {

    @NotBlank
    private String currentPassword;

    @NotBlank
    @Size(min = 4)
    private String newPassword;

    public String getCurrentPassword() { return currentPassword; }
    public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }
    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
```

- [ ] **Step 3: Update AuthController**

```java
package com.pardur.controller;

import com.pardur.dto.request.ChangePasswordRequest;
import com.pardur.dto.request.LoginRequest;
import com.pardur.dto.response.AuthStatusResponse;
import com.pardur.repository.UserRepository;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final AuthService authService;
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthController(AuthenticationManager authenticationManager,
                          AuthService authService,
                          UserRepository userRepository,
                          BCryptPasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.authService           = authService;
        this.userRepository        = userRepository;
        this.passwordEncoder       = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthStatusResponse> login(@Valid @RequestBody LoginRequest req,
                                                     HttpServletRequest httpRequest) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
        HttpSession session = httpRequest.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                SecurityContextHolder.getContext());
        return ResponseEntity.ok(authService.getAuthStatus(auth));
    }

    @GetMapping("/auth/status")
    public ResponseEntity<AuthStatusResponse> status(Authentication authentication) {
        return ResponseEntity.ok(authService.getAuthStatus(authentication));
    }

    @PostMapping("/auth/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                                Authentication authentication) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        var user = userRepository.findById(details.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw new BadCredentialsException("Current password incorrect");
        }
        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        user.setMustChangePassword(false);
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }
}
```

Note: add `import com.pardur.service.AuthService;` — the field was already in the original controller as `authService`.

- [ ] **Step 4: Add BadCredentialsException handler to GlobalExceptionHandler**

Open `backend/src/main/java/com/pardur/exception/GlobalExceptionHandler.java` and add:

```java
@ExceptionHandler(org.springframework.security.authentication.BadCredentialsException.class)
public ResponseEntity<ErrorResponse> handleBadCredentials(
        org.springframework.security.authentication.BadCredentialsException ex) {
    return ResponseEntity.status(400).body(new ErrorResponse(ex.getMessage(), 400));
}
```

- [ ] **Step 5: Compile**

```bash
mvn compile -pl backend -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/pardur/
git commit -m "feat: add role-aware auth, PardurUserDetails, change-password endpoint"
```

---

## Task 6: UserService + UserController (TDD)

**Files:**
- Create: `backend/src/test/java/com/pardur/service/UserServiceTest.java`
- Create: `backend/src/main/java/com/pardur/dto/request/CreateUserRequest.java`
- Create: `backend/src/main/java/com/pardur/dto/request/UpdateUserRequest.java`
- Create: `backend/src/main/java/com/pardur/dto/response/UserDto.java`
- Create: `backend/src/main/java/com/pardur/service/UserService.java`
- Create: `backend/src/main/java/com/pardur/controller/UserController.java`

- [ ] **Step 1: Write failing tests**

```java
package com.pardur.service;

import com.pardur.dto.request.CreateUserRequest;
import com.pardur.dto.request.UpdateUserRequest;
import com.pardur.dto.response.UserDto;
import com.pardur.model.User;
import com.pardur.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock BCryptPasswordEncoder passwordEncoder;
    @InjectMocks UserService userService;

    @BeforeEach
    void setUp() { MockitoAnnotations.openMocks(this); }

    @Test
    void createUser_setsMustChangePasswordTrueAndPasswordIsUsername() {
        var req = new CreateUserRequest();
        req.setUsername("newuser");
        req.setRole("USER");
        req.setColorHex("#aabbcc");

        when(userRepository.findByUsername("newuser")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("newuser")).thenReturn("HASHED");
        when(userRepository.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            return u;
        });

        UserDto dto = userService.createUser(req);

        assertThat(dto.getUsername()).isEqualTo("newuser");
        assertThat(dto.isMustChangePassword()).isTrue();
        verify(passwordEncoder).encode("newuser");
    }

    @Test
    void createUser_duplicateUsername_throwsConflict() {
        var req = new CreateUserRequest();
        req.setUsername("existing");
        req.setRole("USER");
        req.setColorHex("#000000");

        when(userRepository.findByUsername("existing"))
            .thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> userService.createUser(req))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("already exists");
    }

    @Test
    void deleteUser_ownAccount_throwsBadRequest() {
        assertThatThrownBy(() -> userService.deleteUser(5, 5))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("own account");
    }

    @Test
    void deleteUser_otherAccount_callsRepository() {
        when(userRepository.existsById(3)).thenReturn(true);
        userService.deleteUser(3, 1);
        verify(userRepository).deleteById(3);
    }
}
```

- [ ] **Step 2: Run to confirm they fail**

```bash
mvn test -Dtest=UserServiceTest -pl backend 2>&1 | tail -5
```

Expected: COMPILATION ERROR or test failures — `UserService` does not exist yet.

- [ ] **Step 3: Create CreateUserRequest**

```java
package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class CreateUserRequest {

    @NotBlank
    private String username;

    @NotBlank
    @Pattern(regexp = "ADMIN|USER")
    private String role;

    private String colorHex = "#888888";

    public String getUsername()              { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getRole()                  { return role; }
    public void setRole(String role)         { this.role = role; }
    public String getColorHex()              { return colorHex; }
    public void setColorHex(String c)        { this.colorHex = c; }
}
```

- [ ] **Step 4: Create UpdateUserRequest**

```java
package com.pardur.dto.request;

import jakarta.validation.constraints.Pattern;

public class UpdateUserRequest {

    @Pattern(regexp = "ADMIN|USER")
    private String role;

    private String colorHex;

    private boolean resetPassword;

    public String getRole()               { return role; }
    public void setRole(String role)      { this.role = role; }
    public String getColorHex()           { return colorHex; }
    public void setColorHex(String c)     { this.colorHex = c; }
    public boolean isResetPassword()      { return resetPassword; }
    public void setResetPassword(boolean v){ this.resetPassword = v; }
}
```

- [ ] **Step 5: Create UserDto**

```java
package com.pardur.dto.response;

import java.time.LocalDateTime;

public class UserDto {
    private Integer id;
    private String username;
    private String role;
    private String colorHex;
    private boolean mustChangePassword;
    private LocalDateTime createdAt;

    public Integer getId()                          { return id; }
    public void setId(Integer id)                   { this.id = id; }
    public String getUsername()                     { return username; }
    public void setUsername(String u)               { this.username = u; }
    public String getRole()                         { return role; }
    public void setRole(String role)                { this.role = role; }
    public String getColorHex()                     { return colorHex; }
    public void setColorHex(String c)               { this.colorHex = c; }
    public boolean isMustChangePassword()           { return mustChangePassword; }
    public void setMustChangePassword(boolean v)    { this.mustChangePassword = v; }
    public LocalDateTime getCreatedAt()             { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt){ this.createdAt = createdAt; }
}
```

- [ ] **Step 6: Create UserService**

```java
package com.pardur.service;

import com.pardur.dto.request.CreateUserRequest;
import com.pardur.dto.request.UpdateUserRequest;
import com.pardur.dto.response.UserDto;
import com.pardur.model.User;
import com.pardur.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository  = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserDto> getAllUsers() {
        return userRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public UserDto createUser(CreateUserRequest req) {
        if (userRepository.findByUsername(req.getUsername()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
        }
        User user = new User();
        user.setUsername(req.getUsername());
        user.setPassword(passwordEncoder.encode(req.getUsername())); // initial password = username
        user.setRole(req.getRole());
        user.setColorHex(req.getColorHex() != null ? req.getColorHex() : "#888888");
        user.setMustChangePassword(true);
        return toDto(userRepository.save(user));
    }

    @Transactional
    public UserDto updateUser(Integer id, UpdateUserRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (req.getRole() != null)     user.setRole(req.getRole());
        if (req.getColorHex() != null) user.setColorHex(req.getColorHex());
        if (req.isResetPassword()) {
            user.setPassword(passwordEncoder.encode(user.getUsername()));
            user.setMustChangePassword(true);
        }
        return toDto(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Integer targetId, Integer currentUserId) {
        if (targetId.equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete your own account");
        }
        if (!userRepository.existsById(targetId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        userRepository.deleteById(targetId);
    }

    private UserDto toDto(User u) {
        UserDto dto = new UserDto();
        dto.setId(u.getId());
        dto.setUsername(u.getUsername());
        dto.setRole(u.getRole());
        dto.setColorHex(u.getColorHex());
        dto.setMustChangePassword(u.isMustChangePassword());
        dto.setCreatedAt(u.getCreatedAt());
        return dto;
    }
}
```

- [ ] **Step 7: Create UserController**

```java
package com.pardur.controller;

import com.pardur.dto.request.CreateUserRequest;
import com.pardur.dto.request.UpdateUserRequest;
import com.pardur.dto.response.UserDto;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<UserDto>> getAll() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping
    public ResponseEntity<UserDto> create(@Valid @RequestBody CreateUserRequest req) {
        return ResponseEntity.status(201).body(userService.createUser(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> update(@PathVariable Integer id,
                                          @Valid @RequestBody UpdateUserRequest req) {
        return ResponseEntity.ok(userService.updateUser(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication authentication) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        userService.deleteUser(id, details.getUserId());
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 8: Run tests**

```bash
mvn test -Dtest=UserServiceTest -pl backend 2>&1 | tail -10
```

Expected: 4 tests PASS.

- [ ] **Step 9: Compile full project**

```bash
mvn compile -pl backend -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/com/pardur/ backend/src/test/java/com/pardur/
git commit -m "feat: add UserService, UserController, and user management DTOs"
```

---

## Task 7: Delete Creator layer

**Files to delete:**
- `backend/src/main/java/com/pardur/model/Creator.java`
- `backend/src/main/java/com/pardur/repository/CreatorRepository.java`
- `backend/src/main/java/com/pardur/service/CreatorService.java`
- `backend/src/main/java/com/pardur/controller/CreatorController.java`
- `backend/src/main/java/com/pardur/dto/response/CreatorDto.java`

- [ ] **Step 1: Delete all five files**

```bash
rm backend/src/main/java/com/pardur/model/Creator.java
rm backend/src/main/java/com/pardur/repository/CreatorRepository.java
rm backend/src/main/java/com/pardur/service/CreatorService.java
rm backend/src/main/java/com/pardur/controller/CreatorController.java
rm backend/src/main/java/com/pardur/dto/response/CreatorDto.java
```

- [ ] **Step 2: Compile to see what broke**

```bash
mvn compile -pl backend 2>&1 | grep "error:"
```

Expected errors:
- `TimelineEvent.java` — references `Creator`
- `TimelineService.java` — references `CreatorRepository`, `Creator`, `resolveCreator`
- `SecurityConfig.java` — may reference `/api/creators` (it doesn't, but verify)

These are fixed in Task 8 and 9.

---

## Task 8: TimelineEvent entity + TimelineService ownership

**Files:**
- Modify: `backend/src/main/java/com/pardur/model/TimelineEvent.java`
- Modify: `backend/src/main/java/com/pardur/service/TimelineService.java`
- Modify: `backend/src/main/java/com/pardur/controller/TimelineController.java`

- [ ] **Step 1: Update TimelineEvent — replace Creator with User**

```java
package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "timeline_events")
public class TimelineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "world_id", nullable = false)
    private World world;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "sequence_order", precision = 20, scale = 10)
    private BigDecimal sequenceOrder;

    @Column(name = "date_label", length = 100)
    private String dateLabel;

    @Column(name = "time_label", length = 50)
    private String timeLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventType type = EventType.WORLD;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EventTag> tags = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String characters;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Integer getId()                          { return id; }
    public World getWorld()                         { return world; }
    public void setWorld(World world)               { this.world = world; }
    public String getTitle()                        { return title; }
    public void setTitle(String title)              { this.title = title; }
    public BigDecimal getSequenceOrder()            { return sequenceOrder; }
    public void setSequenceOrder(BigDecimal v)      { this.sequenceOrder = v; }
    public String getDateLabel()                    { return dateLabel; }
    public void setDateLabel(String dateLabel)      { this.dateLabel = dateLabel; }
    public String getTimeLabel()                    { return timeLabel; }
    public void setTimeLabel(String timeLabel)      { this.timeLabel = timeLabel; }
    public EventType getType()                      { return type; }
    public void setType(EventType type)             { this.type = type; }
    public String getDescription()                  { return description; }
    public void setDescription(String description)  { this.description = description; }
    public User getCreatedBy()                      { return createdBy; }
    public void setCreatedBy(User createdBy)        { this.createdBy = createdBy; }
    public List<EventTag> getTags()                 { return tags; }
    public String getCharacters()                   { return characters; }
    public void setCharacters(String characters)    { this.characters = characters; }
    public LocalDateTime getCreatedAt()             { return createdAt; }
    public LocalDateTime getUpdatedAt()             { return updatedAt; }
}
```

- [ ] **Step 2: Update TimelineService**

```java
package com.pardur.service;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
public class TimelineService {

    private final TimelineEventRepository eventRepository;
    private final EventTagRepository eventTagRepository;
    private final WorldRepository worldRepository;
    private final UserRepository userRepository;

    public TimelineService(TimelineEventRepository eventRepository,
                           EventTagRepository eventTagRepository,
                           WorldRepository worldRepository,
                           UserRepository userRepository) {
        this.eventRepository  = eventRepository;
        this.eventTagRepository = eventTagRepository;
        this.worldRepository  = worldRepository;
        this.userRepository   = userRepository;
    }

    private World requireWorld(Integer worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + worldId));
    }

    @Transactional(readOnly = true)
    public List<EventDto> getPositionedEvents(Integer worldId) {
        requireWorld(worldId);
        return eventRepository
                .findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<EventDto> getUnpositionedEvents(Integer worldId) {
        requireWorld(worldId);
        return eventRepository
                .findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TagCountDto> getTagCounts(Integer worldId) {
        requireWorld(worldId);
        return eventTagRepository.findTagCountsByWorldId(worldId);
    }

    @Transactional(readOnly = true)
    public EventDto getEvent(Integer worldId, Integer id) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        return toDto(event);
    }

    @Transactional
    public EventDto createEvent(Integer worldId, CreateEventRequest req, Integer userId) {
        World world = requireWorld(worldId);
        User createdBy = userId != null
                ? userRepository.findById(userId).orElse(null)
                : null;

        TimelineEvent event = new TimelineEvent();
        event.setWorld(world);
        event.setTitle(req.getTitle());
        event.setDateLabel(req.getDateLabel());
        event.setTimeLabel(req.getTimeLabel());
        event.setType(req.getType());
        event.setDescription(req.getDescription());
        event.setCharacters(joinCharacters(req.getCharacters()));
        event.setCreatedBy(createdBy);
        event.setSequenceOrder(null);

        TimelineEvent saved = eventRepository.save(event);
        setTags(saved, req.getTags());
        return toDto(eventRepository.save(saved));
    }

    @Transactional
    public EventDto updateEvent(Integer worldId, Integer id, UpdateEventRequest req,
                                Integer currentUserId, boolean isAdmin) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        checkOwnership(event, currentUserId, isAdmin);

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
    public EventDto assignPosition(Integer worldId, Integer id, AssignPositionRequest req) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }

        BigDecimal newOrder;
        if (req.getAfterEventId() == null) {
            Optional<TimelineEvent> first =
                    eventRepository.findFirstByWorldIdOrderBySequenceOrderAsc(worldId);
            newOrder = first.isEmpty()
                    ? new BigDecimal("1000")
                    : first.get().getSequenceOrder().subtract(new BigDecimal("1000"));
        } else {
            TimelineEvent predecessor = eventRepository.findById(req.getAfterEventId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Predecessor event not found: " + req.getAfterEventId()));
            Optional<TimelineEvent> successor = eventRepository
                    .findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(
                            worldId, predecessor.getSequenceOrder());
            newOrder = successor.isEmpty()
                    ? predecessor.getSequenceOrder().add(new BigDecimal("1000"))
                    : predecessor.getSequenceOrder()
                            .add(successor.get().getSequenceOrder())
                            .divide(new BigDecimal("2"), 10, RoundingMode.HALF_UP);
        }

        event.setSequenceOrder(newOrder);
        return toDto(eventRepository.save(event));
    }

    @Transactional
    public void deleteEvent(Integer worldId, Integer id, Integer currentUserId, boolean isAdmin) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        checkOwnership(event, currentUserId, isAdmin);
        eventRepository.delete(event);
    }

    private void checkOwnership(TimelineEvent event, Integer currentUserId, boolean isAdmin) {
        if (isAdmin) return;
        Integer ownerId = event.getCreatedBy() != null ? event.getCreatedBy().getId() : null;
        if (!currentUserId.equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your event");
        }
    }

    private String joinCharacters(List<String> characters) {
        if (characters == null || characters.isEmpty()) return null;
        return characters.stream()
                .map(String::trim).filter(s -> !s.isEmpty())
                .reduce((a, b) -> a + "," + b).orElse(null);
    }

    private List<String> splitCharacters(String characters) {
        if (characters == null || characters.isBlank()) return List.of();
        return java.util.Arrays.stream(characters.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private void setTags(TimelineEvent event, List<String> tagNames) {
        event.getTags().clear();
        if (tagNames != null) {
            for (String tag : tagNames) {
                String normalized = tag.trim().toLowerCase();
                if (!normalized.isEmpty()) {
                    event.getTags().add(new EventTag(event, normalized));
                }
            }
        }
    }

    private EventDto toDto(TimelineEvent e) {
        EventDto dto = new EventDto();
        dto.setId(e.getId());
        dto.setWorldId(e.getWorld().getId());
        dto.setTitle(e.getTitle());
        dto.setDateLabel(e.getDateLabel());
        dto.setTimeLabel(e.getTimeLabel());
        dto.setSequenceOrder(e.getSequenceOrder());
        dto.setType(e.getType().name().toLowerCase());
        dto.setDescription(e.getDescription());
        dto.setTags(e.getTags().stream().map(t -> t.getId().getTagName()).toList());
        dto.setCharacters(splitCharacters(e.getCharacters()));
        dto.setCreatedAt(e.getCreatedAt());
        if (e.getCreatedBy() != null) {
            dto.setCreatedByUserId(e.getCreatedBy().getId());
            dto.setCreatorUsername(e.getCreatedBy().getUsername());
            dto.setCreatorColorHex(e.getCreatedBy().getColorHex());
        }
        return dto;
    }
}
```

- [ ] **Step 3: Update TimelineController — pass userId and isAdmin**

```java
package com.pardur.controller;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.security.PardurUserDetails;
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
    public ResponseEntity<List<EventDto>> getPositioned(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getPositionedEvents(worldId));
    }

    @GetMapping("/unpositioned")
    public ResponseEntity<List<EventDto>> getUnpositioned(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getUnpositionedEvents(worldId));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> getTags(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getTagCounts(worldId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDto> getOne(@PathVariable Integer worldId,
                                           @PathVariable Integer id) {
        return ResponseEntity.ok(timelineService.getEvent(worldId, id));
    }

    @PostMapping
    public ResponseEntity<EventDto> create(@PathVariable Integer worldId,
                                           @Valid @RequestBody CreateEventRequest req,
                                           Authentication auth) {
        return ResponseEntity.status(201).body(
                timelineService.createEvent(worldId, req, getUserId(auth)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventDto> update(@PathVariable Integer worldId,
                                           @PathVariable Integer id,
                                           @Valid @RequestBody UpdateEventRequest req,
                                           Authentication auth) {
        return ResponseEntity.ok(
                timelineService.updateEvent(worldId, id, req, getUserId(auth), isAdmin(auth)));
    }

    @PatchMapping("/{id}/assign-position")
    public ResponseEntity<EventDto> assignPosition(@PathVariable Integer worldId,
                                                    @PathVariable Integer id,
                                                    @RequestBody AssignPositionRequest req) {
        return ResponseEntity.ok(timelineService.assignPosition(worldId, id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer worldId,
                                       @PathVariable Integer id,
                                       Authentication auth) {
        timelineService.deleteEvent(worldId, id, getUserId(auth), isAdmin(auth));
        return ResponseEntity.noContent().build();
    }

    private Integer getUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof PardurUserDetails)) return null;
        return ((PardurUserDetails) auth.getPrincipal()).getUserId();
    }

    private boolean isAdmin(Authentication auth) {
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
```

- [ ] **Step 4: Compile**

```bash
mvn compile -pl backend -q
```

Expected: BUILD SUCCESS (EventDto still has old creatorCode fields — fix in Task 9).

---

## Task 9: Cleanup Event DTOs

**Files:**
- Modify: `backend/src/main/java/com/pardur/dto/request/CreateEventRequest.java`
- Modify: `backend/src/main/java/com/pardur/dto/request/UpdateEventRequest.java`
- Modify: `backend/src/main/java/com/pardur/dto/response/EventDto.java`

- [ ] **Step 1: Update CreateEventRequest — remove creatorCode**

```java
package com.pardur.dto.request;

import com.pardur.model.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class CreateEventRequest {

    @NotBlank
    private String title;
    private String dateLabel;
    private String timeLabel;

    @NotNull
    private EventType type;

    private List<String> tags;
    private String description;
    private List<String> characters;

    public String getTitle()                        { return title; }
    public void setTitle(String title)              { this.title = title; }
    public String getDateLabel()                    { return dateLabel; }
    public void setDateLabel(String dateLabel)      { this.dateLabel = dateLabel; }
    public String getTimeLabel()                    { return timeLabel; }
    public void setTimeLabel(String timeLabel)      { this.timeLabel = timeLabel; }
    public EventType getType()                      { return type; }
    public void setType(EventType type)             { this.type = type; }
    public List<String> getTags()                   { return tags; }
    public void setTags(List<String> tags)          { this.tags = tags; }
    public String getDescription()                  { return description; }
    public void setDescription(String description)  { this.description = description; }
    public List<String> getCharacters()             { return characters; }
    public void setCharacters(List<String> chars)   { this.characters = chars; }
}
```

- [ ] **Step 2: Update UpdateEventRequest — same as CreateEventRequest (no creatorCode)**

```java
package com.pardur.dto.request;

import com.pardur.model.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class UpdateEventRequest {

    @NotBlank
    private String title;
    private String dateLabel;
    private String timeLabel;

    @NotNull
    private EventType type;

    private List<String> tags;
    private String description;
    private List<String> characters;

    public String getTitle()                        { return title; }
    public void setTitle(String title)              { this.title = title; }
    public String getDateLabel()                    { return dateLabel; }
    public void setDateLabel(String dateLabel)      { this.dateLabel = dateLabel; }
    public String getTimeLabel()                    { return timeLabel; }
    public void setTimeLabel(String timeLabel)      { this.timeLabel = timeLabel; }
    public EventType getType()                      { return type; }
    public void setType(EventType type)             { this.type = type; }
    public List<String> getTags()                   { return tags; }
    public void setTags(List<String> tags)          { this.tags = tags; }
    public String getDescription()                  { return description; }
    public void setDescription(String description)  { this.description = description; }
    public List<String> getCharacters()             { return characters; }
    public void setCharacters(List<String> chars)   { this.characters = chars; }
}
```

- [ ] **Step 3: Update EventDto — replace creator fields**

```java
package com.pardur.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class EventDto {
    private Integer id;
    private Integer worldId;
    private String title;
    private String dateLabel;
    private String timeLabel;
    private BigDecimal sequenceOrder;
    private String type;
    private List<String> tags;
    private List<String> characters;
    private String description;
    private Integer createdByUserId;
    private String creatorUsername;
    private String creatorColorHex;
    private LocalDateTime createdAt;

    public EventDto() {}

    public Integer getId()                              { return id; }
    public void setId(Integer id)                       { this.id = id; }
    public Integer getWorldId()                         { return worldId; }
    public void setWorldId(Integer worldId)             { this.worldId = worldId; }
    public String getTitle()                            { return title; }
    public void setTitle(String title)                  { this.title = title; }
    public String getDateLabel()                        { return dateLabel; }
    public void setDateLabel(String dateLabel)          { this.dateLabel = dateLabel; }
    public String getTimeLabel()                        { return timeLabel; }
    public void setTimeLabel(String timeLabel)          { this.timeLabel = timeLabel; }
    public BigDecimal getSequenceOrder()                { return sequenceOrder; }
    public void setSequenceOrder(BigDecimal v)          { this.sequenceOrder = v; }
    public String getType()                             { return type; }
    public void setType(String type)                    { this.type = type; }
    public List<String> getTags()                       { return tags; }
    public void setTags(List<String> tags)              { this.tags = tags; }
    public List<String> getCharacters()                 { return characters; }
    public void setCharacters(List<String> characters)  { this.characters = characters; }
    public String getDescription()                      { return description; }
    public void setDescription(String description)      { this.description = description; }
    public Integer getCreatedByUserId()                 { return createdByUserId; }
    public void setCreatedByUserId(Integer id)          { this.createdByUserId = id; }
    public String getCreatorUsername()                  { return creatorUsername; }
    public void setCreatorUsername(String u)            { this.creatorUsername = u; }
    public String getCreatorColorHex()                  { return creatorColorHex; }
    public void setCreatorColorHex(String c)            { this.creatorColorHex = c; }
    public LocalDateTime getCreatedAt()                 { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt)   { this.createdAt = createdAt; }
}
```

- [ ] **Step 4: Compile + run all tests**

```bash
mvn test -pl backend 2>&1 | tail -15
```

Expected: all existing tests pass. ItemServiceTagTest should still pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/pardur/
git commit -m "feat: replace Creator layer with user ownership on timeline events"
```

---

## Task 10: Tests for TimelineService ownership

**Files:**
- Create: `backend/src/test/java/com/pardur/service/TimelineOwnershipTest.java`

- [ ] **Step 1: Write ownership tests**

```java
package com.pardur.service;

import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TimelineOwnershipTest {

    @Mock TimelineEventRepository eventRepository;
    @Mock EventTagRepository eventTagRepository;
    @Mock WorldRepository worldRepository;
    @Mock UserRepository userRepository;
    @InjectMocks TimelineService timelineService;

    private World world;
    private User owner;
    private User other;
    private TimelineEvent event;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        world = new World(); setField(world, "id", 1);
        owner = new User(); setField(owner, "id", 10);
        other = new User(); setField(other, "id", 99);

        event = new TimelineEvent();
        setField(event, "id", 42);
        event.setWorld(world);
        event.setTitle("Test");
        event.setCreatedBy(owner);
        event.setType(EventType.WORLD);

        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(42)).thenReturn(Optional.of(event));
        when(eventRepository.save(any())).thenReturn(event);
    }

    @Test
    void updateEvent_asAdmin_succeeds() {
        var req = new UpdateEventRequest();
        req.setTitle("Updated"); req.setType(EventType.WORLD);
        // isAdmin=true — should not throw
        assertThatCode(() -> timelineService.updateEvent(1, 42, req, 99, true))
            .doesNotThrowAnyException();
    }

    @Test
    void updateEvent_asOwner_succeeds() {
        var req = new UpdateEventRequest();
        req.setTitle("Updated"); req.setType(EventType.WORLD);
        assertThatCode(() -> timelineService.updateEvent(1, 42, req, 10, false))
            .doesNotThrowAnyException();
    }

    @Test
    void updateEvent_asOtherUser_throws403() {
        var req = new UpdateEventRequest();
        req.setTitle("Hack"); req.setType(EventType.WORLD);
        assertThatThrownBy(() -> timelineService.updateEvent(1, 42, req, 99, false))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Not your event");
    }

    @Test
    void deleteEvent_asAdmin_succeeds() {
        assertThatCode(() -> timelineService.deleteEvent(1, 42, 99, true))
            .doesNotThrowAnyException();
        verify(eventRepository).delete(event);
    }

    @Test
    void deleteEvent_asOtherUser_throws403() {
        assertThatThrownBy(() -> timelineService.deleteEvent(1, 42, 99, false))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Not your event");
    }

    // Reflection helper to set private fields on JPA entities that have no setters
    private void setField(Object obj, String fieldName, Object value) {
        try {
            var field = obj.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(obj, value);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
```

- [ ] **Step 2: Run tests**

```bash
mvn test -Dtest=TimelineOwnershipTest -pl backend 2>&1 | tail -10
```

Expected: 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/pardur/service/TimelineOwnershipTest.java
git commit -m "test: add ownership tests for TimelineService"
```

---

## Task 11: Update import.sql

**Files:**
- Modify: `backend/src/main/resources/import.sql`

Replace `<HASH_OF_4711>` and `<HASH_OF_USER1>` with the hashes from Task 1.

- [ ] **Step 1: Update the users section**

Change the existing users block (currently just admin with a hash) to:

```sql
-- ── Users ────────────────────────────────────────────────────────────────────
INSERT INTO users (username, password, role, must_change_password, color_hex, created_at)
VALUES ('admin', '<HASH_OF_4711>', 'ADMIN', TRUE, '#9a4aaa', CURRENT_TIMESTAMP);

INSERT INTO users (username, password, role, must_change_password, color_hex, created_at)
VALUES ('user1', '<HASH_OF_USER1>', 'USER', FALSE, '#2a9a68', CURRENT_TIMESTAMP);
```

- [ ] **Step 2: Remove creators section**

Delete the entire `-- ── Creators ──` section (4 INSERT lines for AL, MM, RV, SK).

- [ ] **Step 3: Update timeline_events inserts**

Remove `creator_code` from all 7 event INSERT columns and values. Add `created_by_user_id` pointing to user id 1 (admin).

Replace every event INSERT:

```sql
INSERT INTO timeline_events (world_id, title, sequence_order, date_label, type, description, created_by_user_id, created_at, updated_at)
VALUES (1, 'Ankunft der Erbauer', 1.0, 'Vor langer Zeit', 'WORLD',
  'Die sogenannten Erbauer erscheinen auf dem Planeten ...',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

Apply the same pattern to all 7 events (replace `creator_code, created_at` with `created_by_user_id, created_at` in the column list, replace `'AL', CURRENT_TIMESTAMP` with `1, CURRENT_TIMESTAMP` in values). The descriptions stay unchanged.

- [ ] **Step 4: Verify the file compiles cleanly on dev startup**

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev -pl backend &
sleep 12
curl -s http://localhost:8080/api/worlds | head -c 200
pkill -f "spring-boot:run"
```

Expected: JSON array with Pardur and Eldorheim worlds returned without error.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/import.sql
git commit -m "feat: update dev seed — users with roles, drop creators, link events to users"
```

---

## Task 12: Frontend HTML

**Files:**
- Modify: `backend/src/main/resources/static/index.html`

- [ ] **Step 0: Remove admin-only class from dp-actions**

In the `<!-- ══ DETAIL PANEL ══ -->` section, find:
```html
<div class="detail-actions admin-only" id="dp-actions" style="display:none">
```
Change to:
```html
<div class="detail-actions" id="dp-actions" style="display:none">
```
This lets the JS in Task 13 Step 10 fully control visibility based on ownership, without `updateAdminVisibility()` fighting it.

- [ ] **Step 1: Add gear button + nav visibility changes**

In the `<div class="nav-right">` block, add the gear button before the theme toggle. Also change the `+ Eintragen` button from `admin-only` to `user-action-only`:

```html
<div class="nav-right">
  <button class="btn btn-sm admin-only" id="btn-login" onclick="showLoginModal()" style="display:none">Anmelden</button>
  <span class="admin-only" id="nav-user" style="display:none;font-family:'Cinzel',serif;font-size:.9rem;letter-spacing:.06em;color:var(--gold);text-transform:uppercase"></span>
  <button class="btn btn-sm admin-only" id="btn-logout" onclick="doLogout()" style="display:none">Abmelden</button>
  <button class="theme-toggle" id="theme-btn" onclick="toggleTheme()">🌙</button>
  <button class="btn btn-sm admin-only" id="btn-manage-users" onclick="showPage('users')" style="display:none" title="Nutzer verwalten">⚙</button>
  <button class="btn btn-primary user-action-only" id="btn-add" onclick="openAddModal()" style="display:none">+ Eintragen</button>
</div>
```

- [ ] **Step 2: Add user management page after the items page**

Insert before the `<!-- ══ EVENT MODAL ══ -->` comment:

```html
<!-- ══ USERS PAGE ══ -->
<div class="page" id="page-users">
  <div class="pg-hdr">
    <h1>Nutzerverwaltung</h1>
    <p>Konten und Berechtigungen</p>
    <div class="divider" style="margin:10px auto 0"><div class="dline"></div><div class="ddiamond"></div><div class="dline"></div></div>
  </div>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="openAddUserModal()">+ Nutzer anlegen</button>
  </div>
  <div class="items-wrap">
    <table class="it">
      <thead><tr>
        <th>Benutzername</th>
        <th>Rolle</th>
        <th>Farbe</th>
        <th>Passwort</th>
        <th id="th-user-actions">Aktionen</th>
      </tr></thead>
      <tbody id="users-body"></tbody>
    </table>
    <div class="t-footer">
      <span class="t-count" id="user-count"></span>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add nav link for users page**

In the `<div class="nav-links">` block, add (the link is hidden via JS when not admin):

```html
<button class="nav-link admin-only" id="nav-users" onclick="showPage('users')" style="display:none">Nutzer</button>
```

- [ ] **Step 4: Add password change overlay (before closing body tag)**

Insert before `<script src="/js/app.js"></script>`:

```html
<!-- ══ PASSWORD CHANGE OVERLAY ══ -->
<div id="pw-overlay" style="display:none;position:fixed;inset:0;z-index:9999;background:var(--bg);display:none;align-items:center;justify-content:center">
  <div class="modal" style="position:relative;max-width:380px;width:90%">
    <div class="m-title">Passwort ändern</div>
    <p style="font-family:'Crimson Pro',serif;font-size:.9rem;color:var(--t2);margin-bottom:14px">Bitte lege ein neues Passwort fest, bevor du fortfährst.</p>
    <div class="f-grid">
      <div class="f-grp"><label class="f-lbl">Aktuelles Passwort</label><input class="f-inp" id="pw-current" type="password" autocomplete="current-password"></div>
      <div class="f-grp"><label class="f-lbl">Neues Passwort</label><input class="f-inp" id="pw-new" type="password" autocomplete="new-password"></div>
      <div class="f-grp"><label class="f-lbl">Neues Passwort bestätigen</label><input class="f-inp" id="pw-confirm" type="password" autocomplete="new-password"></div>
      <div id="pw-err" style="display:none;color:#e07070;font-family:'Crimson Pro',serif;font-size:.88rem"></div>
    </div>
    <div class="m-actions">
      <button class="btn btn-primary" onclick="submitPasswordChange()">Speichern</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add user form section to the event modal**

In the modal, after `<div id="f-login" ...>...</div>`, add:

```html
<div id="f-user" style="display:none">
  <div class="f-grid">
    <div class="f-grp"><label class="f-lbl">Benutzername *</label><input class="f-inp" id="fu-n" type="text" placeholder="benutzername"></div>
    <div class="f-grp"><label class="f-lbl">Rolle</label>
      <select class="f-inp f-sel" id="fu-r">
        <option value="USER">Benutzer</option>
        <option value="ADMIN">Admin</option>
      </select>
    </div>
    <div class="f-grp"><label class="f-lbl">Farbe</label><input class="f-inp" id="fu-c" type="color" value="#888888"></div>
  </div>
</div>
```

- [ ] **Step 6: Remove f-cr input from event form**

Find and remove this line from the event form (`f-tl` section):

```html
<div class="f-grp"><label class="f-lbl">Ersteller-Kürzel *</label><input class="f-inp" id="f-cr" type="text" placeholder="MM" maxlength="3" style="text-transform:uppercase"></div>
```

- [ ] **Step 7: Update nav links block to include users**

Add `nav-users` button and update the `showPage` / `showForms` function (see Task 13 for JS). The HTML is done.

- [ ] **Step 8: Commit HTML changes**

```bash
git add backend/src/main/resources/static/index.html
git commit -m "feat: add users page, gear nav button, password change overlay to HTML"
```

---

## Task 13: Frontend JavaScript

**Files:**
- Modify: `backend/src/main/resources/static/js/app.js`

Make each change as a targeted edit — do not rewrite the whole file at once.

- [ ] **Step 1: Update state.auth**

Change:
```js
auth: { isAdmin: false, username: null },
```
To:
```js
auth: { loggedIn: false, isAdmin: false, userId: null, username: null, mustChangePassword: false },
```

Also remove `creators: {},` from state and remove `state.creators` from all references.

- [ ] **Step 2: Update updateAdminVisibility()**

Replace the full `updateAdminVisibility` function:

```js
function updateAdminVisibility() {
  const isAdmin    = state.auth.isAdmin;
  const isLoggedIn = state.auth.loggedIn;

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  document.querySelectorAll('.user-action-only').forEach(el => {
    el.style.display = isLoggedIn ? '' : 'none';
  });

  const btnLogin  = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const navUser   = document.getElementById('nav-user');

  if (isLoggedIn) {
    if (btnLogin)  btnLogin.style.display  = 'none';
    if (btnLogout) btnLogout.style.display = '';
    if (navUser) {
      navUser.style.display = '';
      navUser.textContent   = state.auth.username || '';
    }
  } else {
    if (btnLogin)  btnLogin.style.display  = '';
    if (btnLogout) btnLogout.style.display = 'none';
    if (navUser)   navUser.style.display   = 'none';
  }

  // btn-add: on users/items page show only to admin; on timeline always show to logged-in
  const btnAdd = document.getElementById('btn-add');
  if (btnAdd) {
    if (state.ui.currentPage === 'timeline') {
      btnAdd.style.display = isLoggedIn ? '' : 'none';
    } else {
      btnAdd.style.display = isAdmin ? '' : 'none';
    }
  }

  // tl-hint
  const tlHint = document.getElementById('tl-hint');
  if (tlHint) tlHint.style.display = isLoggedIn ? '' : 'none';
}
```

- [ ] **Step 3: Update showPage() to re-evaluate btn-add visibility**

After the existing `showPage` function body, add a call to `updateAdminVisibility()` at the end:

```js
function showPage(p) {
  state.ui.currentPage = p;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p)?.classList.add('active');
  document.getElementById('nav-' + p)?.classList.add('active');
  if (p !== 'timeline') closeDetail();
  if (p === 'items') renderItems();
  if (p === 'users') renderUsers();
  updateAdminVisibility();
}
```

- [ ] **Step 4: Update doLogin()**

```js
async function doLogin(username, password) {
  try {
    const result = await api('POST', '/login', { username, password });
    state.auth = {
      loggedIn:           true,
      isAdmin:            result.admin || false,
      userId:             result.userId || null,
      username:           result.username || null,
      mustChangePassword: result.mustChangePassword || false,
    };
    hideLoginModal();
    updateAdminVisibility();
    if (state.auth.mustChangePassword) {
      showPasswordChangeOverlay();
      return;
    }
    renderTimeline();
    renderItems();
  } catch (e) {
    const errEl = document.getElementById('fl-err');
    if (errEl) { errEl.textContent = 'Anmeldung fehlgeschlagen: ' + e.message; errEl.style.display = 'block'; }
    throw e;
  }
}
```

- [ ] **Step 5: Update doLogout()**

```js
async function doLogout() {
  try { await api('POST', '/logout'); } catch (e) { /* ignore */ }
  state.auth = { loggedIn: false, isAdmin: false, userId: null, username: null, mustChangePassword: false };
  updateAdminVisibility();
  renderTimeline();
  renderItems();
}
```

- [ ] **Step 6: Add password change overlay functions**

Add after the `doLogout` function:

```js
function showPasswordChangeOverlay() {
  const o = document.getElementById('pw-overlay');
  if (o) { o.style.display = 'flex'; }
}

function hidePasswordChangeOverlay() {
  const o = document.getElementById('pw-overlay');
  if (o) { o.style.display = 'none'; }
}

async function submitPasswordChange() {
  const current  = document.getElementById('pw-current').value;
  const newPw    = document.getElementById('pw-new').value;
  const confirm  = document.getElementById('pw-confirm').value;
  const errEl    = document.getElementById('pw-err');
  if (!current || !newPw) { errEl.textContent = 'Alle Felder sind Pflicht.'; errEl.style.display = 'block'; return; }
  if (newPw !== confirm)  { errEl.textContent = 'Passwörter stimmen nicht überein.'; errEl.style.display = 'block'; return; }
  try {
    await api('POST', '/auth/change-password', { currentPassword: current, newPassword: newPw });
    state.auth.mustChangePassword = false;
    hidePasswordChangeOverlay();
    renderTimeline();
    renderItems();
  } catch (e) {
    errEl.textContent = 'Fehler: ' + e.message;
    errEl.style.display = 'block';
  }
}
```

- [ ] **Step 7: Update isVisible() — use createdByUserId for creator filter**

```js
function isVisible(ev) {
  if (state.ui.activeTags.size > 0 && !ev.tags.some(t => state.ui.activeTags.has(t))) return false;
  if (state.ui.activeCreators.size > 0 && !state.ui.activeCreators.has(ev.createdByUserId)) return false;
  if (state.ui.activeTypes.size > 0 && !state.ui.activeTypes.has(ev.type)) return false;
  return true;
}
```

- [ ] **Step 8: Update renderCreatorList()**

```js
function renderCreatorList() {
  const allEvents = [...state.events, ...state.undated];
  const seen = new Map();
  allEvents.forEach(e => {
    if (e.createdByUserId && !seen.has(e.createdByUserId)) {
      seen.set(e.createdByUserId, { username: e.creatorUsername || '?', color: e.creatorColorHex || '#888' });
    }
  });
  document.getElementById('creator-list').innerHTML = [...seen.entries()].map(([uid, u]) =>
    `<button class="creator-fb${state.ui.activeCreators.has(uid) ? ' on' : ''}" onclick="toggleCreator(${uid})">
      <span class="creator-dot" style="background:${escHtml(u.color)}"></span>
      <span class="creator-nm">${escHtml(u.username)}</span>
    </button>`
  ).join('');
}
```

- [ ] **Step 9: Update renderUndated() — replace state.creators lookup**

In `renderUndated`, replace:
```js
const cr = state.creators[ev.creatorCode] || { name: ev.creatorCode || '?', color: '#888' };
```
with:
```js
const crName  = ev.creatorUsername  || '?';
const crColor = ev.creatorColorHex  || '#888';
```

And replace usage of `cr.color`, `cr.name`, and `ev.creatorCode` with `crColor`, `crName` accordingly:

```js
el.innerHTML = state.undated.map(ev => {
  const crName  = ev.creatorUsername  || '?';
  const crColor = ev.creatorColorHex  || '#888';
  const isAct   = state.ui.detailId === ev.id && state.ui.detailSource === 'undated';
  const isLoggedIn = state.auth.loggedIn;
  const draggable  = isLoggedIn ? 'draggable="true"' : '';
  return `<div class="undated-card${isAct ? ' active' : ''}"
            ${draggable}
            data-uid="${ev.id}"
            onmousedown="onUndatedMouseDown(event)"
            ondragstart="onUndatedDragStart(event,${ev.id})"
            ondragend="onUndatedDragEnd(event)"
            onclick="onUndatedClick(event,${ev.id})">
    <div class="undated-ttl">${escHtml(ev.title)}</div>
    <div class="undated-tags">${(ev.tags || []).map(t => '<span class="undated-tag">' + escHtml(t) + '</span>').join('')}</div>
    <div class="undated-cr"><div class="undated-av" style="background:${escHtml(crColor)}">${escHtml(crName.substring(0,2).toUpperCase())}</div>${escHtml(crName)}</div>
  </div>`;
}).join('');
```

- [ ] **Step 10: Update populateDetail() — replace creator lookup**

In `populateDetail`, replace:
```js
const cr = state.creators[ev.creatorCode] || { name: ev.creatorCode || '?', color: '#888' };
```
with:
```js
const crName  = ev.creatorUsername  || '?';
const crColor = ev.creatorColorHex  || '#888888';
```

Replace `cr.name` → `crName` and `cr.color` → `crColor` in the two places they appear in this function.

Update the `dp-meta` line:
```js
document.getElementById('dp-meta').innerHTML = `
  <div class="detail-type"><div class="detail-type-dot ${escHtml(ev.type)}"></div>${ev.type === 'world' ? 'Weltereignis' : 'Lokales Ereignis'}</div>
  <div class="detail-creator" style="color:${escHtml(crColor)}">${escHtml(crName)}</div>`;
```

Update the edit/delete button visibility — show to admin OR event owner:
```js
const dpActions = document.getElementById('dp-actions');
const canEdit   = state.auth.isAdmin || ev.createdByUserId === state.auth.userId;
if (dpActions) dpActions.style.display = canEdit ? '' : 'none';
```

- [ ] **Step 11: Update openTLModal() and openEditModal() — remove f-cr**

In `openTLModal`, change:
```js
['f-ti','f-tg','f-cr','f-chars'].forEach(id => document.getElementById(id).value = '');
```
to:
```js
['f-ti','f-tg','f-chars'].forEach(id => document.getElementById(id).value = '');
```

In `openEditModal`, remove:
```js
document.getElementById('f-cr').value = ev.creatorCode || '';
```

- [ ] **Step 12: Update _saveEntry() — remove creatorCode from event payload**

Find this block in `_saveEntry`:
```js
const creator = document.getElementById('f-cr').value.trim().toUpperCase();
if (!creator) { alert('Ersteller-Kürzel ist Pflicht'); return; }
```
Delete both lines.

Then find:
```js
const payload = { title, type, tags, characters, description: desc, creatorCode: creator, dateLabel: dateStr || null };
```
Change to:
```js
const payload = { title, type, tags, characters, description: desc, dateLabel: dateStr || null };
```

- [ ] **Step 13: Update rope gap rendering — logged-in users, not just admin**

In `renderTimeline`, find every occurrence of:
```js
if (isAdmin) {
  html += `<div class="rope-gap" ...>`;
} else {
  html += `<div class="rope-gap" style="pointer-events:none"></div>`;
}
```
Replace `isAdmin` checks for rope gaps with `isLoggedIn`:
```js
const isLoggedIn = state.auth.loggedIn;
```
And replace both `if (isAdmin)` rope-gap blocks with `if (isLoggedIn)`.

Also update the drag-over wiring block:
```js
if (isLoggedIn) {
  tl.querySelectorAll('.rope-gap').forEach(gap => { ... });
}
```

- [ ] **Step 14: Update onUndatedDragStart — allow logged-in users**

```js
function onUndatedDragStart(e, id) {
  if (!state.auth.loggedIn) { e.preventDefault(); return; }
  ...
}
```

- [ ] **Step 15: Update onRopeClick — allow logged-in users**

```js
function onRopeClick(e, afterEventId) {
  if (state.ui.dragId !== null) return;
  if (!state.auth.loggedIn) return;
  openTLModal(afterEventId === 'null' ? null : afterEventId);
}
```

- [ ] **Step 16: Add user management functions**

Add at the end of the file, before `document.addEventListener('DOMContentLoaded', init)`:

```js
/* ══════════════════════════════════════
   USER MANAGEMENT
══════════════════════════════════════ */
let allUsers = [];

async function renderUsers() {
  if (!state.auth.isAdmin) return;
  try {
    allUsers = await api('GET', '/admin/users');
  } catch (e) { return; }
  document.getElementById('users-body').innerHTML = allUsers.map(u => `
    <tr>
      <td><strong>${escHtml(u.username)}</strong>${u.mustChangePassword ? ' <span class="ev-tag" style="font-size:.6rem">pw-change</span>' : ''}</td>
      <td><span class="ev-tag">${escHtml(u.role.toLowerCase())}</span></td>
      <td><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${escHtml(u.colorHex)};vertical-align:middle"></span> ${escHtml(u.colorHex)}</td>
      <td><button class="act-btn" onclick="resetUserPassword(${u.id})">Reset</button></td>
      <td><div class="act-btns">
        <button class="act-btn" onclick="openEditUserModal(${u.id})">✎</button>
        <button class="act-btn del" onclick="deleteUser(${u.id},'${escHtml(u.username)}')">✕</button>
      </div></td>
    </tr>`).join('');
  document.getElementById('user-count').textContent = allUsers.length + ' Nutzer';
}

function openAddUserModal() {
  editSource = 'user'; editId = null;
  document.getElementById('m-title').textContent = 'Nutzer anlegen';
  showForms(false, false, false, false, false, false);
  document.getElementById('f-user').style.display = 'block';
  document.getElementById('fu-n').value = '';
  document.getElementById('fu-r').value = 'USER';
  document.getElementById('fu-c').value = '#888888';
  setSaveBtn('Anlegen', false);
  openModal();
}

function openEditUserModal(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;
  editSource = 'user'; editId = userId;
  document.getElementById('m-title').textContent = 'Nutzer bearbeiten';
  showForms(false, false, false, false, false, false);
  document.getElementById('f-user').style.display = 'block';
  document.getElementById('fu-n').value = u.username;
  document.getElementById('fu-r').value = u.role;
  document.getElementById('fu-c').value = u.colorHex || '#888888';
  setSaveBtn('Speichern', false);
  openModal();
}

async function resetUserPassword(userId) {
  if (!confirm('Passwort zurücksetzen? Das neue Passwort ist der Benutzername.')) return;
  try {
    await api('PUT', '/admin/users/' + userId, { resetPassword: true });
    renderUsers();
  } catch (e) { alert('Fehler: ' + e.message); }
}

async function deleteUser(userId, username) {
  if (!confirm('Nutzer „' + username + '" wirklich löschen?')) return;
  try {
    await api('DELETE', '/admin/users/' + userId);
    renderUsers();
  } catch (e) { alert('Fehler: ' + e.message); }
}
```

- [ ] **Step 17: Add user save handling to _saveEntry()**

In `_saveEntry()`, add the user create/edit case before the WORLD create/edit block:

```js
// USER create/edit
if (editSource === 'user') {
  const username = document.getElementById('fu-n').value.trim();
  const role     = document.getElementById('fu-r').value;
  const colorHex = document.getElementById('fu-c').value;
  if (!username) { alert('Benutzername ist Pflicht'); return; }
  try {
    if (editId != null) {
      await api('PUT', '/admin/users/' + editId, { role, colorHex });
    } else {
      await api('POST', '/admin/users', { username, role, colorHex });
    }
    closeModal();
    renderUsers();
  } catch (e) { alert('Fehler: ' + e.message); }
  return;
}
```

- [ ] **Step 18: Update showForms() to handle f-user**

Add `f-user` to the hide-all-forms logic. Replace:

```js
function showForms(tl, it, del, drop, world, login) {
  document.getElementById('f-tl').style.display    = tl    ? 'grid'  : 'none';
  document.getElementById('f-it').style.display    = it    ? 'grid'  : 'none';
  document.getElementById('f-del').style.display   = del   ? 'block' : 'none';
  document.getElementById('f-drop').style.display  = drop  ? 'block' : 'none';
  document.getElementById('f-world').style.display = world ? 'block' : 'none';
  document.getElementById('f-login').style.display = login ? 'block' : 'none';
}
```

With:

```js
function showForms(tl, it, del, drop, world, login) {
  document.getElementById('f-tl').style.display    = tl    ? 'grid'  : 'none';
  document.getElementById('f-it').style.display    = it    ? 'grid'  : 'none';
  document.getElementById('f-del').style.display   = del   ? 'block' : 'none';
  document.getElementById('f-drop').style.display  = drop  ? 'block' : 'none';
  document.getElementById('f-world').style.display = world ? 'block' : 'none';
  document.getElementById('f-login').style.display = login ? 'block' : 'none';
  document.getElementById('f-user').style.display  = 'none';
}
```

- [ ] **Step 19: Update init() — remove creators fetch, handle mustChangePassword**

Replace the `const [authStatus, creatorsArr, worlds]` line and the creators processing block:

```js
async function init() {
  applyThemeFromStorage();
  try {
    const [authStatus, worlds] = await Promise.all([
      api('GET', '/auth/status'),
      api('GET', '/worlds'),
    ]);
    state.auth = {
      loggedIn:           authStatus.loggedIn || false,
      isAdmin:            authStatus.admin    || false,
      userId:             authStatus.userId   || null,
      username:           authStatus.username || null,
      mustChangePassword: authStatus.mustChangePassword || false,
    };
    state.worlds = worlds || [];

    const savedWorldId = parseInt(localStorage.getItem('activeWorldId'));
    state.ui.activeWorldId = (savedWorldId && state.worlds.find(w => w.id === savedWorldId))
      ? savedWorldId : (state.worlds[0]?.id ?? null);

    if (state.ui.activeWorldId) {
      const [events, undated, items, tagCounts] = await Promise.all([
        api('GET', `/worlds/${state.ui.activeWorldId}/events`),
        api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
        api('GET', '/items'),
        api('GET', '/items/tags'),
      ]);
      state.events  = events     || [];
      state.undated = undated    || [];
      state.items   = items      || [];
      itemTagCounts = tagCounts  || [];
    } else {
      const [items, tagCounts] = await Promise.all([
        api('GET', '/items'),
        api('GET', '/items/tags'),
      ]);
      state.items   = items     || [];
      itemTagCounts = tagCounts || [];
    }

    renderWorldSelector();
    renderTimeline();
    renderItems();
    renderItemTagFilter();
    updateAdminVisibility();
    showPage('timeline');

    if (state.auth.mustChangePassword) {
      showPasswordChangeOverlay();
    }
  } catch (e) {
    console.error('Init failed', e);
    renderWorldSelector();
    renderTimeline();
    renderItems();
    renderItemTagFilter();
    updateAdminVisibility();
    showPage('timeline');
  }
}
```

- [ ] **Step 20: Run the full test suite**

```bash
mvn test -pl backend 2>&1 | tail -15
```

Expected: All tests pass (UserServiceTest ×4, TimelineOwnershipTest ×5, ItemServiceTagTest ×4).

- [ ] **Step 21: Commit**

```bash
git add backend/src/main/resources/static/
git commit -m "feat: update frontend — user management UI, password change gate, remove creator fields"
```

---

## Task 14: Final verification + push

- [ ] **Step 1: Build the JAR**

```bash
mvn clean package -DskipTests -pl backend -q
```

Expected: BUILD SUCCESS, JAR created in `backend/target/`.

- [ ] **Step 2: Smoke test on dev profile**

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev -pl backend &
sleep 15
echo "=== worlds ===" && curl -s http://localhost:8080/api/worlds
echo "=== auth ===" && curl -s http://localhost:8080/api/auth/status
echo "=== items ===" && curl -s http://localhost:8080/api/items | head -c 100
pkill -f "spring-boot:run"
```

Expected:
- `/api/worlds` → JSON array with Pardur and Eldorheim
- `/api/auth/status` → `{"loggedIn":false,"admin":false,...}`
- `/api/items` → JSON array of items

- [ ] **Step 3: Final commit + push**

```bash
git add -A
git status  # verify no unintended files
git commit -m "feat: complete user management — roles, ownership, user admin UI"
git push origin master
```
