package com.pardur.controller;

import com.pardur.dto.request.ChangePasswordRequest;
import com.pardur.dto.request.LoginRequest;
import com.pardur.dto.response.AuthStatusResponse;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.AuthService;
import com.pardur.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
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
            // loginSuccess() checks request.getParameter("remember-me") internally.
            // Our JSON login has no such parameter, so we wrap the request to inject it.
            HttpServletRequest wrapped = new HttpServletRequestWrapper(httpRequest) {
                @Override
                public String getParameter(String name) {
                    if ("remember-me".equals(name)) return "true";
                    return super.getParameter(name);
                }
            };
            rememberMeServices.loginSuccess(wrapped, httpResponse, auth);
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
