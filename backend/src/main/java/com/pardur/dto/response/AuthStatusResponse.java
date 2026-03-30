package com.pardur.dto.response;

public class AuthStatusResponse {
    private boolean loggedIn;
    private boolean admin;
    private Integer userId;
    private String username;
    private String colorHex;
    private boolean mustChangePassword;

    public AuthStatusResponse(boolean loggedIn, boolean admin, Integer userId,
                               String username, String colorHex, boolean mustChangePassword) {
        this.loggedIn = loggedIn;
        this.admin = admin;
        this.userId = userId;
        this.username = username;
        this.colorHex = colorHex;
        this.mustChangePassword = mustChangePassword;
    }

    public boolean isLoggedIn() { return loggedIn; }
    public boolean isAdmin() { return admin; }
    public Integer getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getColorHex() { return colorHex; }
    public boolean isMustChangePassword() { return mustChangePassword; }
}
