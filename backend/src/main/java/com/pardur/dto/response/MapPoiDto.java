package com.pardur.dto.response;

public record MapPoiDto(
    Integer id,
    Integer worldId,
    Integer poiTypeId,
    String  poiTypeName,
    String  poiTypeIcon,
    Double  xPct,
    Double  yPct,
    String  label,
    String  gesinnung,
    Integer createdByUserId
) {}
