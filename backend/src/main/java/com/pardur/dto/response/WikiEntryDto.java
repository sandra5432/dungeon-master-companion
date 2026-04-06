package com.pardur.dto.response;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class WikiEntryDto {
    private Integer id;
    private String title;
    private String type;
    private Integer worldId;
    private String worldName;
    private String body;
    private Integer createdByUserId;
    private String createdByUsername;
    private List<WikiImageDto> images;
    private List<Integer> spoilerReaderUserIds;
    private boolean canReadSpoilers;
    private LocalDateTime createdAt;
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
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Integer getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Integer createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getCreatedByUsername() { return createdByUsername; }
    public void setCreatedByUsername(String createdByUsername) { this.createdByUsername = createdByUsername; }
    public List<WikiImageDto> getImages() { return images; }
    public void setImages(List<WikiImageDto> images) { this.images = images; }
    public List<Integer> getSpoilerReaderUserIds() { return spoilerReaderUserIds; }
    public void setSpoilerReaderUserIds(List<Integer> spoilerReaderUserIds) { this.spoilerReaderUserIds = spoilerReaderUserIds; }
    public boolean isCanReadSpoilers() { return canReadSpoilers; }
    public void setCanReadSpoilers(boolean canReadSpoilers) { this.canReadSpoilers = canReadSpoilers; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    private Integer parentId;
    private String parentTitle;
    private List<WikiChildDto> children = new ArrayList<>();

    public Integer getParentId() { return parentId; }
    public void setParentId(Integer parentId) { this.parentId = parentId; }
    public String getParentTitle() { return parentTitle; }
    public void setParentTitle(String parentTitle) { this.parentTitle = parentTitle; }
    public List<WikiChildDto> getChildren() { return children; }
    public void setChildren(List<WikiChildDto> children) { this.children = children; }
}
