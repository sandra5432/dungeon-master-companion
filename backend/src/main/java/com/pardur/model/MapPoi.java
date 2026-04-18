package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "map_poi")
public class MapPoi {

    public enum Gesinnung { FRIENDLY, NEUTRAL, HOSTILE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "world_id", nullable = false)
    private World world;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poi_type_id", nullable = false)
    private PoiType poiType;

    @Column(name = "x_pct", nullable = false)
    private Double xPct;

    @Column(name = "y_pct", nullable = false)
    private Double yPct;

    @Column(length = 120)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Gesinnung gesinnung;

    @Column(name = "text_bold")
    private Boolean textBold;

    @Column(name = "text_italic")
    private Boolean textItalic;

    @Column(name = "text_size")
    private Integer textSize;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = true)
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Integer   getId()                   { return id; }
    public World     getWorld()                { return world; }
    public void      setWorld(World w)         { this.world = w; }
    public PoiType   getPoiType()              { return poiType; }
    public void      setPoiType(PoiType t)     { this.poiType = t; }
    public Double    getXPct()                 { return xPct; }
    public void      setXPct(Double x)         { this.xPct = x; }
    public Double    getYPct()                 { return yPct; }
    public void      setYPct(Double y)         { this.yPct = y; }
    public String    getLabel()                { return label; }
    public void      setLabel(String l)        { this.label = l; }
    public Gesinnung getGesinnung()            { return gesinnung; }
    public void      setGesinnung(Gesinnung g) { this.gesinnung = g; }
    public Boolean   getTextBold()              { return textBold; }
    public void      setTextBold(Boolean v)    { this.textBold = v; }
    public Boolean   getTextItalic()           { return textItalic; }
    public void      setTextItalic(Boolean v)  { this.textItalic = v; }
    public Integer   getTextSize()             { return textSize; }
    public void      setTextSize(Integer v)    { this.textSize = v; }
    public User      getCreatedBy()            { return createdBy; }
    public void      setCreatedBy(User u)      { this.createdBy = u; }
    public LocalDateTime getCreatedAt()        { return createdAt; }
    public LocalDateTime getUpdatedAt()        { return updatedAt; }
}
