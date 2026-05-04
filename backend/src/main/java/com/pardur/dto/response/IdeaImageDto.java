package com.pardur.dto.response;

/** Metadata for an image attached to an idea (no binary data). */
public class IdeaImageDto {

    private Integer id;
    private Integer ideaId;
    private String originalFilename;
    private String contentType;

    public IdeaImageDto() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getIdeaId() { return ideaId; }
    public void setIdeaId(Integer ideaId) { this.ideaId = ideaId; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
}
