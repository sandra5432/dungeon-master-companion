package com.pardur.service;

import com.pardur.dto.response.AuthStatusResponse;
import com.pardur.repository.UserRepository;
import com.pardur.security.PardurUserDetails;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
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
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsername(username)
                .map(user -> new PardurUserDetails(
                        user.getId(),
                        user.getUsername(),
                        user.getPassword(),
                        user.getRole(),
                        user.getColorHex(),
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
                details.getColorHex(),
                details.mustChangePassword()
        );
    }
}
