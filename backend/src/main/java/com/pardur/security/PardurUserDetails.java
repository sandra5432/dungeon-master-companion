package com.pardur.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class PardurUserDetails implements UserDetails {

    private final Integer userId;
    private final String username;
    private final String password;
    private final String role;
    private final String colorHex;
    private final boolean mustChangePassword;
    private final Collection<? extends GrantedAuthority> authorities;

    public PardurUserDetails(Integer userId, String username, String password,
                              String role, String colorHex, boolean mustChangePassword,
                              List<? extends GrantedAuthority> authorities) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.role = role;
        this.colorHex = colorHex;
        this.mustChangePassword = mustChangePassword;
        this.authorities = authorities;
    }

    public Integer getUserId() { return userId; }
    public String getRole() { return role; }
    public String getColorHex() { return colorHex; }
    public boolean mustChangePassword() { return mustChangePassword; }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public String getPassword() { return password; }
    @Override public String getUsername() { return username; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
