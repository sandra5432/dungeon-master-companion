package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "worlds")
public class World {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "miles_per_cell", nullable = false)
    private Integer milesPerCell = 5;

    @Column(name = "chronicle_enabled", nullable = false)
    private boolean chronicleEnabled = true;

    @Column(name = "wiki_enabled", nullable = false)
    private boolean wikiEnabled = true;

    @Column(name = "map_enabled", nullable = false)
    private boolean mapEnabled = true;

    @Column(name = "guest_can_read",   nullable = false) private boolean guestCanRead   = false;
    @Column(name = "guest_can_edit",   nullable = false) private boolean guestCanEdit   = false;
    @Column(name = "guest_can_delete", nullable = false) private boolean guestCanDelete = false;
    @Column(name = "user_can_read",    nullable = false) private boolean userCanRead    = true;
    @Column(name = "user_can_edit",    nullable = false) private boolean userCanEdit    = true;
    @Column(name = "user_can_delete",  nullable = false) private boolean userCanDelete  = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public Integer getMilesPerCell() { return milesPerCell; }
    public void setMilesPerCell(Integer v) { this.milesPerCell = v; }
    public boolean isChronicleEnabled() { return chronicleEnabled; }
    public void setChronicleEnabled(boolean v) { this.chronicleEnabled = v; }
    public boolean isWikiEnabled() { return wikiEnabled; }
    public void setWikiEnabled(boolean v) { this.wikiEnabled = v; }
    public boolean isMapEnabled() { return mapEnabled; }
    public void setMapEnabled(boolean v) { this.mapEnabled = v; }
    public boolean isGuestCanRead()    { return guestCanRead; }
    public void setGuestCanRead(boolean v)   { this.guestCanRead   = v; }
    public boolean isGuestCanEdit()    { return guestCanEdit; }
    public void setGuestCanEdit(boolean v)   { this.guestCanEdit   = v; }
    public boolean isGuestCanDelete()  { return guestCanDelete; }
    public void setGuestCanDelete(boolean v) { this.guestCanDelete = v; }
    public boolean isUserCanRead()     { return userCanRead; }
    public void setUserCanRead(boolean v)    { this.userCanRead    = v; }
    public boolean isUserCanEdit()     { return userCanEdit; }
    public void setUserCanEdit(boolean v)    { this.userCanEdit    = v; }
    public boolean isUserCanDelete()   { return userCanDelete; }
    public void setUserCanDelete(boolean v)  { this.userCanDelete  = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
