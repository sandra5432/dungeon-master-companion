package com.pardur.controller;

import com.pardur.dto.response.CreatorDto;
import com.pardur.service.CreatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/creators")
public class CreatorController {

    private final CreatorService creatorService;

    public CreatorController(CreatorService creatorService) {
        this.creatorService = creatorService;
    }

    @GetMapping
    public ResponseEntity<List<CreatorDto>> getAll() {
        return ResponseEntity.ok(creatorService.getAllCreators());
    }
}
