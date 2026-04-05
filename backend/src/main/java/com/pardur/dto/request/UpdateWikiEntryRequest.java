package com.pardur.dto.request;

import com.pardur.model.WikiEntryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UpdateWikiEntryRequest {

    @NotBlank
    @Size(max = 255)
    private String title;

    @NotNull
    private WikiEntryType type;

    private String body;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public WikiEntryType getType() { return type; }
    public void setType(WikiEntryType type) { this.type = type; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
