package com.pardur.exception;

public class ErrorResponse {
    private String error;
    private int status;

    public ErrorResponse(String error, int status) {
        this.error = error;
        this.status = status;
    }

    public String getError() { return error; }
    public int getStatus() { return status; }
}
