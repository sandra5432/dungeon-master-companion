package com.pardur.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class WikiSpoilerReaderId implements Serializable {

    @Column(name = "entry_id")
    private Integer entryId;

    @Column(name = "user_id")
    private Integer userId;

    public WikiSpoilerReaderId() {}

    public WikiSpoilerReaderId(Integer entryId, Integer userId) {
        this.entryId = entryId;
        this.userId = userId;
    }

    public Integer getEntryId() { return entryId; }
    public Integer getUserId() { return userId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof WikiSpoilerReaderId)) return false;
        WikiSpoilerReaderId that = (WikiSpoilerReaderId) o;
        return Objects.equals(entryId, that.entryId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() { return Objects.hash(entryId, userId); }
}
