package com.pardur.dto.response;

import java.time.LocalDateTime;

public class IdeaCommentDto {
    private Integer id;
    private Integer ideaId;
    private Integer createdByUserId;
    private String creatorUsername;
    private String creatorColorHex;
    private String body;
    private LocalDateTime createdAt;

    public IdeaCommentDto() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getIdeaId() { return ideaId; }
    public void setIdeaId(Integer ideaId) { this.ideaId = ideaId; }
    public Integer getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Integer createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getCreatorUsername() { return creatorUsername; }
    public void setCreatorUsername(String creatorUsername) { this.creatorUsername = creatorUsername; }
    public String getCreatorColorHex() { return creatorColorHex; }
    public void setCreatorColorHex(String creatorColorHex) { this.creatorColorHex = creatorColorHex; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
