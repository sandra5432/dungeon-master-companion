package com.pardur.dto.response;

import java.math.BigDecimal;

/** Response DTO for a timeline epoch. */
public class EpochDto {
    public Integer id;
    public Integer worldId;
    public String  label;
    public String  color;
    public BigDecimal startPosition;
    public BigDecimal endPosition;
    public Integer createdByUserId;

    public EpochDto() {}

    public EpochDto(Integer id, Integer worldId, String label, String color,
                    BigDecimal startPosition, BigDecimal endPosition,
                    Integer createdByUserId) {
        this.id              = id;
        this.worldId         = worldId;
        this.label           = label;
        this.color           = color;
        this.startPosition   = startPosition;
        this.endPosition     = endPosition;
        this.createdByUserId = createdByUserId;
    }
}
