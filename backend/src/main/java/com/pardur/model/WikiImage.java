package com.pardur.model;

import jakarta.persistence.*;

@Entity
@Table(name = "wiki_images")
public class WikiImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id", nullable = false)
    private WikiEntry entry;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] data;

    @Column(length = 255)
    private String caption;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    public Integer getId() { return id; }
    public WikiEntry getEntry() { return entry; }
    public void setEntry(WikiEntry entry) { this.entry = entry; }
    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }
    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
