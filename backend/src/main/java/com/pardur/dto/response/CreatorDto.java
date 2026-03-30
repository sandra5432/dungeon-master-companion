package com.pardur.dto.response;

public class CreatorDto {
    private String code;
    private String fullName;
    private String colorHex;

    public CreatorDto(String code, String fullName, String colorHex) {
        this.code = code;
        this.fullName = fullName;
        this.colorHex = colorHex;
    }

    public String getCode() { return code; }
    public String getFullName() { return fullName; }
    public String getColorHex() { return colorHex; }
}
