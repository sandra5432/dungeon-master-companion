package com.pardur.dto.request;

import jakarta.validation.constraints.Pattern;

public class UpdateUserRequest {

    @Pattern(regexp = "ADMIN|USER", message = "Role must be ADMIN or USER")
    private String role;

    @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "colorHex must be a valid hex colour like #aabbcc")
    private String colorHex;

    private boolean resetPassword;

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getColorHex() { return colorHex; }
    public void setColorHex(String colorHex) { this.colorHex = colorHex; }
    public boolean isResetPassword() { return resetPassword; }
    public void setResetPassword(boolean resetPassword) { this.resetPassword = resetPassword; }
}
