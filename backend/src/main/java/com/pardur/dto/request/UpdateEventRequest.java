package com.pardur.dto.request;

import com.pardur.model.EventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class UpdateEventRequest {

    @NotBlank
    private String title;

    private String dateLabel;

    private String timeLabel;

    @NotNull
    private EventType type;

    private List<String> tags;

    private String description;

    private List<String> characters;

    @NotBlank
    private String creatorCode;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDateLabel() { return dateLabel; }
    public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }
    public String getTimeLabel() { return timeLabel; }
    public void setTimeLabel(String timeLabel) { this.timeLabel = timeLabel; }
    public EventType getType() { return type; }
    public void setType(EventType type) { this.type = type; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public List<String> getCharacters() { return characters; }
    public void setCharacters(List<String> characters) { this.characters = characters; }
    public String getCreatorCode() { return creatorCode; }
    public void setCreatorCode(String creatorCode) { this.creatorCode = creatorCode; }
}
