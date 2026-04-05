package com.pardur.dto.request;

public class UpdateWikiImageRequest {
    private String caption;
    private Integer sortOrder;

    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
