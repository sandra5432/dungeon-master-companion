package com.pardur.controller;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.TimelineService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/worlds/{worldId}/events")
public class TimelineController {

    private final TimelineService timelineService;

    public TimelineController(TimelineService timelineService) {
        this.timelineService = timelineService;
    }

    @GetMapping
    public ResponseEntity<List<EventDto>> getPositioned(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getPositionedEvents(worldId));
    }

    @GetMapping("/unpositioned")
    public ResponseEntity<List<EventDto>> getUnpositioned(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getUnpositionedEvents(worldId));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> getTags(@PathVariable Integer worldId) {
        return ResponseEntity.ok(timelineService.getTagCounts(worldId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDto> getOne(@PathVariable Integer worldId,
                                           @PathVariable Integer id) {
        return ResponseEntity.ok(timelineService.getEvent(worldId, id));
    }

    @PostMapping
    public ResponseEntity<EventDto> create(@PathVariable Integer worldId,
                                           @Valid @RequestBody CreateEventRequest req,
                                           Authentication authentication) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        return ResponseEntity.status(201).body(
                timelineService.createEvent(worldId, req, details.getUserId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventDto> update(@PathVariable Integer worldId,
                                           @PathVariable Integer id,
                                           @Valid @RequestBody UpdateEventRequest req,
                                           Authentication authentication) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        boolean isAdmin = "ADMIN".equals(details.getRole());
        return ResponseEntity.ok(
                timelineService.updateEvent(worldId, id, req, details.getUserId(), isAdmin));
    }

    @PatchMapping("/{id}/assign-position")
    public ResponseEntity<EventDto> assignPosition(@PathVariable Integer worldId,
                                                    @PathVariable Integer id,
                                                    @RequestBody AssignPositionRequest req) {
        return ResponseEntity.ok(timelineService.assignPosition(worldId, id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer worldId,
                                       @PathVariable Integer id,
                                       Authentication authentication) {
        PardurUserDetails details = (PardurUserDetails) authentication.getPrincipal();
        boolean isAdmin = "ADMIN".equals(details.getRole());
        timelineService.deleteEvent(worldId, id, details.getUserId(), isAdmin);
        return ResponseEntity.noContent().build();
    }
}
