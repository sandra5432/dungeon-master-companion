package com.pardur.controller;

import com.pardur.dto.request.CreateWorldRequest;
import com.pardur.dto.request.UpdateWorldRequest;
import com.pardur.dto.response.WorldDto;
import com.pardur.service.WorldService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/worlds")
public class WorldController {

    private final WorldService worldService;

    public WorldController(WorldService worldService) {
        this.worldService = worldService;
    }

    @GetMapping
    public ResponseEntity<List<WorldDto>> getAll() {
        return ResponseEntity.ok(worldService.getAllWorlds());
    }

    @PostMapping
    public ResponseEntity<WorldDto> create(@Valid @RequestBody CreateWorldRequest req) {
        return ResponseEntity.status(201).body(worldService.createWorld(req));
    }

    @PutMapping("/{worldId}")
    public ResponseEntity<WorldDto> update(@PathVariable Integer worldId,
                                           @Valid @RequestBody UpdateWorldRequest req) {
        return ResponseEntity.ok(worldService.updateWorld(worldId, req));
    }

    @DeleteMapping("/{worldId}")
    public ResponseEntity<Void> delete(@PathVariable Integer worldId) {
        worldService.deleteWorld(worldId);
        return ResponseEntity.noContent().build();
    }
}
