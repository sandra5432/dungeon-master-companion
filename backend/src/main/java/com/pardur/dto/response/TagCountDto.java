package com.pardur.dto.response;

public class TagCountDto {
    private String tagName;
    private Long count;

    public TagCountDto(String tagName, Long count) {
        this.tagName = tagName;
        this.count = count;
    }

    public String getTagName() { return tagName; }
    public Long getCount() { return count; }
}
