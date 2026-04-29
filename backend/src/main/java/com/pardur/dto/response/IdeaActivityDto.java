package com.pardur.dto.response;

import java.time.LocalDateTime;

public class IdeaActivityDto {
    private Integer id;
    private Integer actorUserId;
    private String actorUsername;
    private String actorColorHex;
    private String type;
    private String fromStatus;
    private String toStatus;
    private LocalDateTime createdAt;

    public IdeaActivityDto() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getActorUserId() { return actorUserId; }
    public void setActorUserId(Integer actorUserId) { this.actorUserId = actorUserId; }
    public String getActorUsername() { return actorUsername; }
    public void setActorUsername(String actorUsername) { this.actorUsername = actorUsername; }
    public String getActorColorHex() { return actorColorHex; }
    public void setActorColorHex(String actorColorHex) { this.actorColorHex = actorColorHex; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }
    public String getToStatus() { return toStatus; }
    public void setToStatus(String toStatus) { this.toStatus = toStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
