package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;

public class UpdateIdeaStatusRequest {

    @NotBlank
    private String status;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
