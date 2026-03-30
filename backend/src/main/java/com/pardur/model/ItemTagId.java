package com.pardur.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class ItemTagId implements Serializable {

    private Integer itemId;
    private String tagName;

    public ItemTagId() {}

    public ItemTagId(Integer itemId, String tagName) {
        this.itemId = itemId;
        this.tagName = tagName;
    }

    public Integer getItemId() { return itemId; }
    public void setItemId(Integer itemId) { this.itemId = itemId; }
    public String getTagName() { return tagName; }
    public void setTagName(String tagName) { this.tagName = tagName; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ItemTagId that)) return false;
        return Objects.equals(itemId, that.itemId) && Objects.equals(tagName, that.tagName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(itemId, tagName);
    }
}
