package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

/** Records a single upvote by a user on an idea. */
@Entity
@Table(name = "idea_votes")
public class IdeaVote {

    @EmbeddedId
    private IdeaVoteId id = new IdeaVoteId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("ideaId")
    @JoinColumn(name = "idea_id")
    private Idea idea;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public IdeaVoteId getId() { return id; }
    public void setId(IdeaVoteId id) { this.id = id; }
    public Idea getIdea() { return idea; }
    public void setIdea(Idea idea) { this.idea = idea; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
