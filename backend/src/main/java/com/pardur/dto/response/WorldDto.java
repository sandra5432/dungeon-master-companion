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
    private boolean guestCanRead;
    private boolean guestCanEdit;
    private boolean guestCanDelete;
    private boolean userCanRead;
    private boolean userCanEdit;
    private boolean userCanDelete;

    public WorldDto(Integer id, String name, String description, Integer sortOrder, Integer milesPerCell,
                    boolean chronicleEnabled, boolean wikiEnabled, boolean mapEnabled,
                    boolean guestCanRead, boolean guestCanEdit, boolean guestCanDelete,
                    boolean userCanRead, boolean userCanEdit, boolean userCanDelete) {
        this.id = id; this.name = name; this.description = description;
        this.sortOrder = sortOrder; this.milesPerCell = milesPerCell;
        this.chronicleEnabled = chronicleEnabled; this.wikiEnabled = wikiEnabled; this.mapEnabled = mapEnabled;
        this.guestCanRead = guestCanRead; this.guestCanEdit = guestCanEdit; this.guestCanDelete = guestCanDelete;
        this.userCanRead = userCanRead; this.userCanEdit = userCanEdit; this.userCanDelete = userCanDelete;
    }

    public Integer getId()              { return id; }
    public String getName()             { return name; }
    public String getDescription()      { return description; }
    public Integer getSortOrder()       { return sortOrder; }
    public Integer getMilesPerCell()    { return milesPerCell; }
    public boolean isChronicleEnabled() { return chronicleEnabled; }
    public boolean isWikiEnabled()      { return wikiEnabled; }
    public boolean isMapEnabled()       { return mapEnabled; }
    public boolean isGuestCanRead()     { return guestCanRead; }
    public boolean isGuestCanEdit()     { return guestCanEdit; }
    public boolean isGuestCanDelete()   { return guestCanDelete; }
    public boolean isUserCanRead()      { return userCanRead; }
    public boolean isUserCanEdit()      { return userCanEdit; }
    public boolean isUserCanDelete()    { return userCanDelete; }
}
