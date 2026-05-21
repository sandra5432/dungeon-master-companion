package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A named, coloured span of timeline events for a given world.
 * Boundaries are stored as positional fence values (BigDecimal midpoints).
 */
@Entity
@Table(name = "timeline_epochs")
public class TimelineEpoch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "world_id", nullable = false)
    private World world;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(nullable = false, length = 7)
    private String color;

    @Column(name = "start_position", nullable = false, precision = 20, scale = 10)
    private BigDecimal startPosition;

    @Column(name = "end_position", precision = 20, scale = 10)
    private BigDecimal endPosition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId() { return id; }

    public World getWorld() { return world; }
    public void setWorld(World world) { this.world = world; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public BigDecimal getStartPosition() { return startPosition; }
    public void setStartPosition(BigDecimal startPosition) { this.startPosition = startPosition; }

    public BigDecimal getEndPosition() { return endPosition; }
    public void setEndPosition(BigDecimal endPosition) { this.endPosition = endPosition; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
