package com.pardur.dto.response;

import java.time.LocalDateTime;

public class UserDto {
    private Integer id;
    private String username;
    private String role;
    private String colorHex;
    private LocalDateTime createdAt;

    public UserDto(Integer id, String username, String role, String colorHex, LocalDateTime createdAt) {
        this.id = id;
        this.username = username;
        this.role = role;
        this.colorHex = colorHex;
        this.createdAt = createdAt;
    }

    public Integer getId() { return id; }
    public String getUsername() { return username; }
    public String getRole() { return role; }
    public String getColorHex() { return colorHex; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
