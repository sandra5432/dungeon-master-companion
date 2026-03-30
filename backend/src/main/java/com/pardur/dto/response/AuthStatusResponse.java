package com.pardur.dto.response;

public class AuthStatusResponse {
    private boolean admin;
    private String username;

    public AuthStatusResponse(boolean admin, String username) {
        this.admin = admin;
        this.username = username;
    }

    public boolean isAdmin() { return admin; }
    public String getUsername() { return username; }
}
