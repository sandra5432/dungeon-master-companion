package com.pardur.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public class UpdateMapBgScaleRequest {

    @NotNull @DecimalMin("0.3") @DecimalMax("3.0")
    private Double scale;

    public Double getScale()             { return scale; }
    public void   setScale(Double scale) { this.scale = scale; }
}
