package com.pardur.dto.response;

public class WikiChildDto {
    private Integer id;
    private String title;
    private String type;

    public WikiChildDto(Integer id, String title, String type) {
        this.id = id;
        this.title = title;
        this.type = type;
    }

    public Integer getId() { return id; }
    public String getTitle() { return title; }
    public String getType() { return type; }
}
