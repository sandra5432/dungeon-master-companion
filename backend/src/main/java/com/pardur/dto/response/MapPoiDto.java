package com.pardur.dto.response;

public record MapPoiDto(
    Integer id,
    Integer worldId,
    Integer poiTypeId,
    String  poiTypeName,
    String  poiTypeIcon,
    String  poiTypeShape,
    Double  xPct,
    Double  yPct,
    String  label,
    String  gesinnung,
    Integer createdByUserId,
    Boolean textBold,
    Boolean textItalic,
    Integer textSize
) {}
