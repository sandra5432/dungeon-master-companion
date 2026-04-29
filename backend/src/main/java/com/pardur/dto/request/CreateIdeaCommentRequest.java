package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateIdeaCommentRequest {

    @NotBlank
    private String body;

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
