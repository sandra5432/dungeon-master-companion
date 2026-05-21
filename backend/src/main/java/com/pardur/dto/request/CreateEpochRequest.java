package com.pardur.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request body for creating a new timeline epoch. */
public class CreateEpochRequest {

    @NotBlank
    @Size(max = 100)
    public String label;

    @NotBlank
    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "color must be a 6-digit hex string like #c8a84b")
    public String color;

    /** ID of the oldest event in the epoch (required). */
    @NotNull
    public Integer startAtEventId;

    /** ID of the newest event in the epoch; null = open-ended. */
    public Integer endAfterEventId;
}
