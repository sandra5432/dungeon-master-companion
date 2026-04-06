package com.pardur.dto.request;

import com.pardur.model.WikiEntryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CreateWikiEntryRequest {

    @NotBlank
    @Size(max = 255)
    private String title;

    @NotNull
    private Integer worldId;

    @NotNull
    private WikiEntryType type;

    private String body;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Integer getWorldId() { return worldId; }
    public void setWorldId(Integer worldId) { this.worldId = worldId; }
    public WikiEntryType getType() { return type; }
    public void setType(WikiEntryType type) { this.type = type; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    private Integer parentId;
    public Integer getParentId() { return parentId; }
    public void setParentId(Integer parentId) { this.parentId = parentId; }
}
