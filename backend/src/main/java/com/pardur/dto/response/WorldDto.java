package com.pardur.dto.response;

public class WorldDto {
    private Integer id;
    private String name;
    private String description;
    private Integer sortOrder;
    private Integer milesPerCell;
    private boolean chronicleEnabled;
    private boolean wikiEnabled;
    private boolean mapEnabled;

    public WorldDto(Integer id, String name, String description, Integer sortOrder, Integer milesPerCell,
                    boolean chronicleEnabled, boolean wikiEnabled, boolean mapEnabled) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
        this.milesPerCell = milesPerCell;
        this.chronicleEnabled = chronicleEnabled;
        this.wikiEnabled = wikiEnabled;
        this.mapEnabled = mapEnabled;
    }

    public Integer getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Integer getSortOrder() { return sortOrder; }
    public Integer getMilesPerCell() { return milesPerCell; }
    public boolean isChronicleEnabled() { return chronicleEnabled; }
    public boolean isWikiEnabled() { return wikiEnabled; }
    public boolean isMapEnabled() { return mapEnabled; }
}
