package com.pardur.model;

import jakarta.persistence.*;

@Entity
@Table(name = "event_tags")
public class EventTag {

    @EmbeddedId
    private EventTagId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("eventId")
    @JoinColumn(name = "event_id")
    private TimelineEvent event;

    public EventTag() {}

    public EventTag(TimelineEvent event, String tagName) {
        this.event = event;
        this.id = new EventTagId(event.getId(), tagName);
    }

    public EventTagId getId() { return id; }
    public void setId(EventTagId id) { this.id = id; }
    public TimelineEvent getEvent() { return event; }
    public void setEvent(TimelineEvent event) { this.event = event; }
}
