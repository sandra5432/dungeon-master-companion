package com.pardur.dto.response;

public class WorldDto {
    private Integer id;
    private String name;
    private String description;
    private Integer sortOrder;

    public WorldDto(Integer id, String name, String description, Integer sortOrder) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
    }

    public Integer getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Integer getSortOrder() { return sortOrder; }
}
