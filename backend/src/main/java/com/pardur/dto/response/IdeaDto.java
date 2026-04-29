package com.pardur.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class IdeaDto {
    private Integer id;
    private Integer worldId;
    private String title;
    private String description;
    private String status;
    private Integer createdByUserId;
    private String creatorUsername;
    private String creatorColorHex;
    private LocalDate dueAt;
    private List<String> tags;
    private int voteCount;
    private boolean votedByMe;
    private int commentCount;
    private boolean wikiStubCreated;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public IdeaDto() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getWorldId() { return worldId; }
    public void setWorldId(Integer worldId) { this.worldId = worldId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Integer createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getCreatorUsername() { return creatorUsername; }
    public void setCreatorUsername(String creatorUsername) { this.creatorUsername = creatorUsername; }
    public String getCreatorColorHex() { return creatorColorHex; }
    public void setCreatorColorHex(String creatorColorHex) { this.creatorColorHex = creatorColorHex; }
    public LocalDate getDueAt() { return dueAt; }
    public void setDueAt(LocalDate dueAt) { this.dueAt = dueAt; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public int getVoteCount() { return voteCount; }
    public void setVoteCount(int voteCount) { this.voteCount = voteCount; }
    public boolean isVotedByMe() { return votedByMe; }
    public void setVotedByMe(boolean votedByMe) { this.votedByMe = votedByMe; }
    public int getCommentCount() { return commentCount; }
    public void setCommentCount(int commentCount) { this.commentCount = commentCount; }
    public boolean isWikiStubCreated() { return wikiStubCreated; }
    public void setWikiStubCreated(boolean wikiStubCreated) { this.wikiStubCreated = wikiStubCreated; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
