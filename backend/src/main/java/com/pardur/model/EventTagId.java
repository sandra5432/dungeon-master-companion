package com.pardur.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class EventTagId implements Serializable {

    private Integer eventId;
    private String tagName;

    public EventTagId() {}

    public EventTagId(Integer eventId, String tagName) {
        this.eventId = eventId;
        this.tagName = tagName;
    }

    public Integer getEventId() { return eventId; }
    public void setEventId(Integer eventId) { this.eventId = eventId; }
    public String getTagName() { return tagName; }
    public void setTagName(String tagName) { this.tagName = tagName; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof EventTagId that)) return false;
        return Objects.equals(eventId, that.eventId) && Objects.equals(tagName, that.tagName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(eventId, tagName);
    }
}
