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
                .requestMatchers(HttpMethod.GET,    "/api/worlds/*/epochs").permitAll()
                .requestMatchers(HttpMethod.POST,   "/api/worlds/*/epochs").authenticated()
                .requestMatchers(HttpMethod.PUT,    "/api/worlds/*/epochs/*").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/worlds/*/epochs/*").authenticated()
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
