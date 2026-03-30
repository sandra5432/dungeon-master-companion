package com.pardur.dto.response;

import java.math.BigDecimal;
import java.util.List;

public class ItemDto {
    private Integer id;
    private String name;
    private BigDecimal price;
    private String url;
    private List<String> tags;

    public ItemDto() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
