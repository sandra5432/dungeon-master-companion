package com.pardur.dto.response;

import java.time.LocalDateTime;

public class WikiEntryListItemDto {
    private Integer id;
    private String title;
    private String type;
    private Integer worldId;
    private String worldName;
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Integer getWorldId() { return worldId; }
    public void setWorldId(Integer worldId) { this.worldId = worldId; }
    public String getWorldName() { return worldName; }
    public void setWorldName(String worldName) { this.worldName = worldName; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    private Integer parentId;
    public Integer getParentId() { return parentId; }
    public void setParentId(Integer parentId) { this.parentId = parentId; }
}
