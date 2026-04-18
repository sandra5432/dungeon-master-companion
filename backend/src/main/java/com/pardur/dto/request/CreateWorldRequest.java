package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateWorldRequest {

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
}
