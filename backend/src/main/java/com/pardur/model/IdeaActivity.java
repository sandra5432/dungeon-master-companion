package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/** An immutable activity-log entry for an idea (creation, status change, or comment). */
@Entity
@Table(name = "idea_activity")
public class IdeaActivity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "idea_id", nullable = false)
    private Idea idea;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IdeaActivityType type;

    @Column(name = "from_status", length = 20)
    private String fromStatus;

    @Column(name = "to_status", length = 20)
    private String toStatus;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId() { return id; }
    public Idea getIdea() { return idea; }
    public void setIdea(Idea idea) { this.idea = idea; }
    public User getActor() { return actor; }
    public void setActor(User actor) { this.actor = actor; }
    public IdeaActivityType getType() { return type; }
    public void setType(IdeaActivityType type) { this.type = type; }
    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }
    public String getToStatus() { return toStatus; }
    public void setToStatus(String toStatus) { this.toStatus = toStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
