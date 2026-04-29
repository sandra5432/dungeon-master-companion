package com.pardur.model;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class IdeaVoteId implements Serializable {
    private Integer ideaId;
    private Integer userId;
    public IdeaVoteId() {}
    public IdeaVoteId(Integer ideaId, Integer userId) { this.ideaId = ideaId; this.userId = userId; }
    public Integer getIdeaId() { return ideaId; }
    public void setIdeaId(Integer ideaId) { this.ideaId = ideaId; }
    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }
    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof IdeaVoteId that)) return false;
        return Objects.equals(ideaId, that.ideaId) && Objects.equals(userId, that.userId);
    }
    @Override public int hashCode() { return Objects.hash(ideaId, userId); }
}
