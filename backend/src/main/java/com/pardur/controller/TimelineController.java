package com.pardur.controller;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
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
    public ResponseEntity<List<EventDto>> getPositioned(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(timelineService.getPositionedEvents(worldId, auth));
    }

    @GetMapping("/unpositioned")
    public ResponseEntity<List<EventDto>> getUnpositioned(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(timelineService.getUnpositionedEvents(worldId, auth));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> getTags(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(timelineService.getTagCounts(worldId, auth));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDto> getOne(@PathVariable Integer worldId, @PathVariable Integer id,
                                           Authentication auth) {
        return ResponseEntity.ok(timelineService.getEvent(worldId, id, auth));
    }

    @PostMapping
    public ResponseEntity<EventDto> create(@PathVariable Integer worldId,
                                           @Valid @RequestBody CreateEventRequest req,
                                           Authentication auth) {
        return ResponseEntity.status(201).body(timelineService.createEvent(worldId, req, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventDto> update(@PathVariable Integer worldId, @PathVariable Integer id,
                                           @Valid @RequestBody UpdateEventRequest req,
                                           Authentication auth) {
        return ResponseEntity.ok(timelineService.updateEvent(worldId, id, req, auth));
    }

    @PatchMapping("/{id}/assign-position")
    public ResponseEntity<EventDto> assignPosition(@PathVariable Integer worldId, @PathVariable Integer id,
                                                    @RequestBody AssignPositionRequest req,
                                                    Authentication auth) {
        return ResponseEntity.ok(timelineService.assignPosition(worldId, id, req, auth));
    }

    @DeleteMapping("/{id}/position")
    public ResponseEntity<Void> unplace(@PathVariable Integer worldId, @PathVariable Integer id,
                                        Authentication auth) {
        timelineService.unplaceEvent(worldId, id, auth);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer worldId, @PathVariable Integer id,
                                       Authentication auth) {
        timelineService.deleteEvent(worldId, id, auth);
        return ResponseEntity.noContent().build();
    }
}
