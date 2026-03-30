package com.pardur.model;

import jakarta.persistence.*;

@Entity
@Table(name = "item_tags")
public class ItemTag {

    @EmbeddedId
    private ItemTagId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("itemId")
    @JoinColumn(name = "item_id")
    private Item item;

    public ItemTag() {}

    public ItemTag(Item item, String tagName) {
        this.item = item;
        this.id = new ItemTagId(item.getId(), tagName);
    }

    public ItemTagId getId() { return id; }
    public void setId(ItemTagId id) { this.id = id; }
    public Item getItem() { return item; }
    public void setItem(Item item) { this.item = item; }
}
