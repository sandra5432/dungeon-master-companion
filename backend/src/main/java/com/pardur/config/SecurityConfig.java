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

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Public: static assets, auth endpoints, items (Marktplatz is view-only for guests)
                .requestMatchers("/", "/index.html", "/js/**", "/css/**", "/favicon.ico", "/world/**").permitAll()
                .requestMatchers("/api/login", "/api/logout", "/api/auth/status", "/api/auth/change-password").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/items/**").permitAll()
                // Admin-only: world management (create/edit/delete), item management, user management
                .requestMatchers(HttpMethod.POST,   "/api/worlds").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/worlds/{id:[0-9]+}").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/{id:[0-9]+}").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST,   "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/admin/users/names").hasRole("USER")
                .requestMatchers("/api/admin/users/**").hasRole("ADMIN")
                // Wiki: any logged-in user can read/write/delete own entries
                .requestMatchers("/api/wiki/**").hasRole("USER")
                // Timeline events: any logged-in user can read/create/edit/delete; ownership enforced in service
                .requestMatchers("/api/worlds/*/events/**").hasRole("USER")
                .requestMatchers(HttpMethod.POST, "/api/worlds/*/events").hasRole("USER")
                // Map: any logged-in user can read; logged-in users manage POIs; admin manages types + background
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
                // All other world endpoints (GET /api/worlds, GET /api/worlds/{id}, etc.) require login
                .requestMatchers("/api/worlds/**").hasRole("USER")
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
