package com.pardur.model;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum EventType {
    WORLD,
    LOCAL;

    @JsonCreator
    public static EventType from(String value) {
        return EventType.valueOf(value.toUpperCase());
    }
}
