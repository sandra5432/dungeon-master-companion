package com.pardur.dto.response;

public record PoiTypeDto(
    Integer id,
    String  name,
    String  icon,
    boolean isDefault,
    boolean hasGesinnung,
    boolean hasLabel
) {}
