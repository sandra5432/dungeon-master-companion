package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;

public class UpdateWorldRequest {

    @NotBlank
    private String name;

    private String description;
    private Integer milesPerCell;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getMilesPerCell() { return milesPerCell; }
    public void setMilesPerCell(Integer v) { this.milesPerCell = v; }
}
