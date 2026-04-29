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
import org.springframework.security.config.Customizer;
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
                // Ideenkammer — login required for all operations
                .requestMatchers("/api/worlds/*/ideas/**").hasRole("USER")
                .requestMatchers(HttpMethod.GET,    "/api/worlds/*/ideas").hasRole("USER")
                .requestMatchers(HttpMethod.POST,   "/api/worlds/*/ideas").hasRole("USER")
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
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .csrf(csrf -> csrf.disable())
            .httpBasic(Customizer.withDefaults())
            .logout(logout -> logout
                .logoutUrl("/api/logout")
                .logoutSuccessHandler((req, res, authentication) -> res.setStatus(200))
            );
        return http.build();
    }
}
