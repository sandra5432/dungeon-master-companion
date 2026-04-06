package com.pardur.controller;

import com.pardur.dto.request.ChangePasswordRequest;
import com.pardur.dto.request.LoginRequest;
import com.pardur.dto.response.AuthStatusResponse;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.AuthService;
import com.pardur.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final AuthService authService;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager,
                          AuthService authService,
                          UserService userService) {
        this.authenticationManager = authenticationManager;
        this.authService = authService;
        this.userService = userService;
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
                                                Authentication authentication,
                                                HttpServletRequest httpRequest) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        userService.changePassword(details.getUserId(), req.getCurrentPassword(), req.getNewPassword());
        // Refresh session principal so mustChangePassword is reflected immediately
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
