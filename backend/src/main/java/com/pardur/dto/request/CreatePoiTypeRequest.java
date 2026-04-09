package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreatePoiTypeRequest {

    @NotBlank @Size(max = 80)
    private String name;

    @NotBlank @Size(max = 255)
    private String icon;

    private boolean hasGesinnung = true;
    private boolean hasLabel     = true;

    public String  getName()                  { return name; }
    public void    setName(String n)          { this.name = n; }
    public String  getIcon()                  { return icon; }
    public void    setIcon(String i)          { this.icon = i; }
    public boolean isHasGesinnung()           { return hasGesinnung; }
    public void    setHasGesinnung(boolean v) { this.hasGesinnung = v; }
    public boolean isHasLabel()               { return hasLabel; }
    public void    setHasLabel(boolean v)     { this.hasLabel = v; }
}
