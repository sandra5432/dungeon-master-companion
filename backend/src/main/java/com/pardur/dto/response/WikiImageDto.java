package com.pardur.dto.response;

public class WikiImageDto {
    private Integer id;
    private String caption;
    private Integer sortOrder;

    public WikiImageDto() {}

    public WikiImageDto(Integer id, String caption, Integer sortOrder) {
        this.id = id;
        this.caption = caption;
        this.sortOrder = sortOrder;
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
