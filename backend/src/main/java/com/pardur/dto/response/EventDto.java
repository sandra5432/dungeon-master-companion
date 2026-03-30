package com.pardur.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class EventDto {
    private Integer id;
    private Integer worldId;
    private String title;
    private String dateLabel;
    private String timeLabel;
    private BigDecimal sequenceOrder;
    private String type;
    private List<String> tags;
    private List<String> characters;
    private String description;
    private String creatorCode;
    private String creatorName;
    private String creatorColor;
    private LocalDateTime createdAt;

    public EventDto() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getWorldId() { return worldId; }
    public void setWorldId(Integer worldId) { this.worldId = worldId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDateLabel() { return dateLabel; }
    public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }
    public String getTimeLabel() { return timeLabel; }
    public void setTimeLabel(String timeLabel) { this.timeLabel = timeLabel; }
    public BigDecimal getSequenceOrder() { return sequenceOrder; }
    public void setSequenceOrder(BigDecimal sequenceOrder) { this.sequenceOrder = sequenceOrder; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public List<String> getCharacters() { return characters; }
    public void setCharacters(List<String> characters) { this.characters = characters; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCreatorCode() { return creatorCode; }
    public void setCreatorCode(String creatorCode) { this.creatorCode = creatorCode; }
    public String getCreatorName() { return creatorName; }
    public void setCreatorName(String creatorName) { this.creatorName = creatorName; }
    public String getCreatorColor() { return creatorColor; }
    public void setCreatorColor(String creatorColor) { this.creatorColor = creatorColor; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
