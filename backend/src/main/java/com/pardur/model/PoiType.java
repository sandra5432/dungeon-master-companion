package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "poi_type")
public class PoiType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 255)
    private String icon;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(name = "has_gesinnung", nullable = false)
    private boolean hasGesinnung = true;

    @Column(name = "has_label", nullable = false)
    private boolean hasLabel = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId()                   { return id; }
    public String  getName()                 { return name; }
    public void    setName(String n)         { this.name = n; }
    public String  getIcon()                 { return icon; }
    public void    setIcon(String i)         { this.icon = i; }
    public boolean isDefault()               { return isDefault; }
    public void    setDefault(boolean d)     { this.isDefault = d; }
    public boolean isHasGesinnung()          { return hasGesinnung; }
    public void    setHasGesinnung(boolean v){ this.hasGesinnung = v; }
    public boolean isHasLabel()              { return hasLabel; }
    public void    setHasLabel(boolean v)    { this.hasLabel = v; }
    public LocalDateTime getCreatedAt()      { return createdAt; }
}
