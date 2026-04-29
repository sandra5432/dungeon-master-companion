package com.pardur.controller;

import com.pardur.dto.request.CreateIdeaCommentRequest;
import com.pardur.dto.request.CreateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaStatusRequest;
import com.pardur.dto.response.IdeaActivityDto;
import com.pardur.dto.response.IdeaCommentDto;
import com.pardur.dto.response.IdeaDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.service.IdeaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for the Ideenkammer: ideas, votes, comments, activity, and tag counts per world.
 */
@RestController
@RequestMapping("/api/worlds/{worldId}/ideas")
public class IdeaController {

    private final IdeaService ideaService;

    public IdeaController(IdeaService ideaService) {
        this.ideaService = ideaService;
    }

    @GetMapping
    public ResponseEntity<List<IdeaDto>> getIdeas(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(ideaService.getIdeas(worldId, auth));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> getTags(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(ideaService.getTagCounts(worldId, auth));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IdeaDto> getIdea(@PathVariable Integer worldId, @PathVariable Integer id,
                                            Authentication auth) {
        return ResponseEntity.ok(ideaService.getIdea(worldId, id, auth));
    }

    @PostMapping
    public ResponseEntity<IdeaDto> createIdea(@PathVariable Integer worldId,
                                               @Valid @RequestBody CreateIdeaRequest req,
                                               Authentication auth) {
        return ResponseEntity.status(201).body(ideaService.createIdea(worldId, req, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<IdeaDto> updateIdea(@PathVariable Integer worldId, @PathVariable Integer id,
                                               @Valid @RequestBody UpdateIdeaRequest req,
                                               Authentication auth) {
        return ResponseEntity.ok(ideaService.updateIdea(worldId, id, req, auth));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<IdeaDto> updateStatus(@PathVariable Integer worldId, @PathVariable Integer id,
                                                 @Valid @RequestBody UpdateIdeaStatusRequest req,
                                                 Authentication auth) {
        return ResponseEntity.ok(ideaService.updateStatus(worldId, id, req, auth));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIdea(@PathVariable Integer worldId, @PathVariable Integer id,
                                            Authentication auth) {
        ideaService.deleteIdea(worldId, id, auth);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/votes")
    public ResponseEntity<IdeaDto> toggleVote(@PathVariable Integer worldId, @PathVariable Integer id,
                                               Authentication auth) {
        return ResponseEntity.ok(ideaService.toggleVote(worldId, id, auth));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<IdeaCommentDto>> getComments(@PathVariable Integer worldId, @PathVariable Integer id,
                                                             Authentication auth) {
        return ResponseEntity.ok(ideaService.getComments(worldId, id, auth));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<IdeaCommentDto> addComment(@PathVariable Integer worldId, @PathVariable Integer id,
                                                      @Valid @RequestBody CreateIdeaCommentRequest req,
                                                      Authentication auth) {
        return ResponseEntity.status(201).body(ideaService.addComment(worldId, id, req, auth));
    }

    @GetMapping("/{id}/activity")
    public ResponseEntity<List<IdeaActivityDto>> getActivity(@PathVariable Integer worldId, @PathVariable Integer id,
                                                              Authentication auth) {
        return ResponseEntity.ok(ideaService.getActivity(worldId, id, auth));
    }
}
