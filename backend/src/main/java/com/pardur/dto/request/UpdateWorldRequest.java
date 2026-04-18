package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;

public class UpdateWorldRequest {

    @NotBlank
    private String name;

    private String description;
    private Integer sortOrder;
    private Integer milesPerCell;
    private Boolean chronicleEnabled;
    private Boolean wikiEnabled;
    private Boolean mapEnabled;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer v) { this.sortOrder = v; }
    public Integer getMilesPerCell() { return milesPerCell; }
    public void setMilesPerCell(Integer v) { this.milesPerCell = v; }
    public Boolean getChronicleEnabled() { return chronicleEnabled; }
    public void setChronicleEnabled(Boolean v) { this.chronicleEnabled = v; }
    public Boolean getWikiEnabled() { return wikiEnabled; }
    public void setWikiEnabled(Boolean v) { this.wikiEnabled = v; }
    public Boolean getMapEnabled() { return mapEnabled; }
    public void setMapEnabled(Boolean v) { this.mapEnabled = v; }

    private Boolean guestCanRead;
    private Boolean guestCanEdit;
    private Boolean guestCanDelete;
    private Boolean userCanRead;
    private Boolean userCanEdit;
    private Boolean userCanDelete;

    public Boolean getGuestCanRead()   { return guestCanRead; }
    public void setGuestCanRead(Boolean v)   { this.guestCanRead   = v; }
    public Boolean getGuestCanEdit()   { return guestCanEdit; }
    public void setGuestCanEdit(Boolean v)   { this.guestCanEdit   = v; }
    public Boolean getGuestCanDelete() { return guestCanDelete; }
    public void setGuestCanDelete(Boolean v) { this.guestCanDelete = v; }
    public Boolean getUserCanRead()    { return userCanRead; }
    public void setUserCanRead(Boolean v)    { this.userCanRead    = v; }
    public Boolean getUserCanEdit()    { return userCanEdit; }
    public void setUserCanEdit(Boolean v)    { this.userCanEdit    = v; }
    public Boolean getUserCanDelete()  { return userCanDelete; }
    public void setUserCanDelete(Boolean v)  { this.userCanDelete  = v; }
}
