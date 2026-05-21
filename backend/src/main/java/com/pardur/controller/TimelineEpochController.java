package com.pardur.controller;

import com.pardur.dto.request.CreateEpochRequest;
import com.pardur.dto.request.UpdateEpochRequest;
import com.pardur.dto.response.EpochDto;
import com.pardur.service.TimelineService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for timeline epoch management.
 * Mapped under /api/worlds/{worldId}/epochs.
 */
@RestController
@RequestMapping("/api/worlds/{worldId}/epochs")
public class TimelineEpochController {

    private final TimelineService timelineService;

    public TimelineEpochController(TimelineService timelineService) {
        this.timelineService = timelineService;
    }

    /**
     * Returns all epochs for a world, ordered by start position.
     *
     * @param worldId target world
     * @return list of epoch DTOs
     */
    @GetMapping
    public ResponseEntity<List<EpochDto>> getEpochs(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getEpochs(worldId));
    }

    /**
     * Creates a new epoch.
     *
     * @param worldId target world
     * @param req     validated request body
     * @param auth    authenticated principal
     * @return the created epoch with HTTP 201
     */
    @PostMapping
    public ResponseEntity<EpochDto> createEpoch(
            @PathVariable Integer worldId,
            @Valid @RequestBody CreateEpochRequest req,
            Authentication auth) {
        Integer userId = resolveUserId(auth);
        EpochDto created = timelineService.createEpoch(worldId, req, userId);
        return ResponseEntity.status(201).body(created);
    }

    /**
     * Updates an existing epoch's label, colour, and boundaries.
     *
     * @param worldId target world
     * @param epochId epoch to update
     * @param req     validated request body
     * @return the updated epoch
     */
    @PutMapping("/{epochId}")
    public ResponseEntity<EpochDto> updateEpoch(
            @PathVariable Integer worldId,
            @PathVariable Integer epochId,
            @Valid @RequestBody UpdateEpochRequest req) {
        return ResponseEntity.ok(timelineService.updateEpoch(worldId, epochId, req));
    }

    /**
     * Deletes an epoch. Events are not affected.
     *
     * @param worldId target world
     * @param epochId epoch to delete
     * @return HTTP 204
     */
    @DeleteMapping("/{epochId}")
    public ResponseEntity<Void> deleteEpoch(
            @PathVariable Integer worldId,
            @PathVariable Integer epochId) {
        timelineService.deleteEpoch(worldId, epochId);
        return ResponseEntity.noContent().build();
    }

    /** Extracts the numeric user ID from the Authentication principal, or null for guests. */
    private Integer resolveUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return null;
        try { return Integer.parseInt(auth.getName()); }
        catch (NumberFormatException e) { return null; }
    }
}
