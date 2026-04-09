package com.pardur.dto.request;

import jakarta.validation.constraints.Size;

public class UpdatePoiTypeRequest {

    @Size(max = 80)  private String  name;
    @Size(max = 255) private String  icon;
    private Boolean hasGesinnung;
    private Boolean hasLabel;

    public String  getName()                   { return name; }
    public void    setName(String n)           { this.name = n; }
    public String  getIcon()                   { return icon; }
    public void    setIcon(String i)           { this.icon = i; }
    public Boolean getHasGesinnung()           { return hasGesinnung; }
    public void    setHasGesinnung(Boolean v)  { this.hasGesinnung = v; }
    public Boolean getHasLabel()               { return hasLabel; }
    public void    setHasLabel(Boolean v)      { this.hasLabel = v; }
}
