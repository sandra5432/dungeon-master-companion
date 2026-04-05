package com.pardur.model;

import jakarta.persistence.*;

@Entity
@Table(name = "wiki_spoiler_readers")
public class WikiSpoilerReader {

    @EmbeddedId
    private WikiSpoilerReaderId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("entryId")
    @JoinColumn(name = "entry_id")
    private WikiEntry entry;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    public WikiSpoilerReader() {}

    public WikiSpoilerReader(WikiEntry entry, User user) {
        this.entry = entry;
        this.user = user;
        this.id = new WikiSpoilerReaderId(entry.getId(), user.getId());
    }

    public WikiSpoilerReaderId getId() { return id; }
    public WikiEntry getEntry() { return entry; }
    public User getUser() { return user; }
}
