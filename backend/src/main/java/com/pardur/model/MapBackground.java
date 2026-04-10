package com.pardur.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "map_background")
public class MapBackground {

    @Id
    @Column(name = "world_id")
    private Integer worldId;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] data;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType = "image/webp";

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    @Column(name = "bg_scale", nullable = false)
    private double bgScale = 1.0;

    @PrePersist
    @PreUpdate
    void touch() { uploadedAt = LocalDateTime.now(); }

    public Integer getWorldId()              { return worldId; }
    public void    setWorldId(Integer id)    { this.worldId = id; }
    public byte[]  getData()                 { return data; }
    public void    setData(byte[] d)         { this.data = d; }
    public String  getContentType()          { return contentType; }
    public void    setContentType(String ct) { this.contentType = ct; }
    public LocalDateTime getUploadedAt()     { return uploadedAt; }
    public double  getBgScale()              { return bgScale; }
    public void    setBgScale(double s)      { this.bgScale = s; }
}
