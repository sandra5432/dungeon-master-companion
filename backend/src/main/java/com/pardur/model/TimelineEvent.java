package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "timeline_events")
public class TimelineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "world_id", nullable = false)
    private World world;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "sequence_order", precision = 20, scale = 10)
    private BigDecimal sequenceOrder;

    @Column(name = "date_label", length = 100)
    private String dateLabel;

    @Column(name = "time_label", length = 50)
    private String timeLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventType type = EventType.WORLD;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_code", nullable = false)
    private Creator creator;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EventTag> tags = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String characters;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public World getWorld() { return world; }
    public void setWorld(World world) { this.world = world; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public BigDecimal getSequenceOrder() { return sequenceOrder; }
    public void setSequenceOrder(BigDecimal sequenceOrder) { this.sequenceOrder = sequenceOrder; }
    public String getDateLabel() { return dateLabel; }
    public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }
    public String getTimeLabel() { return timeLabel; }
    public void setTimeLabel(String timeLabel) { this.timeLabel = timeLabel; }
    public EventType getType() { return type; }
    public void setType(EventType type) { this.type = type; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Creator getCreator() { return creator; }
    public void setCreator(Creator creator) { this.creator = creator; }
    public List<EventTag> getTags() { return tags; }
    public String getCharacters() { return characters; }
    public void setCharacters(String characters) { this.characters = characters; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
