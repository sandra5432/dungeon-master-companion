package com.pardur.dto.request;

import jakarta.validation.constraints.*;

public class UpdateMapPoiRequest {

    @DecimalMin("0.0") @DecimalMax("1.0") private Double xPct;
    @DecimalMin("0.0") @DecimalMax("1.0") private Double yPct;
    @Size(max = 120) private String label;
    private String gesinnung;

    public Double  getXPct()              { return xPct; }
    public void    setXPct(Double v)      { this.xPct = v; }
    public Double  getYPct()              { return yPct; }
    public void    setYPct(Double v)      { this.yPct = v; }
    public String  getLabel()             { return label; }
    public void    setLabel(String v)     { this.label = v; }
    public String  getGesinnung()         { return gesinnung; }
    public void    setGesinnung(String v) { this.gesinnung = v; }
}
