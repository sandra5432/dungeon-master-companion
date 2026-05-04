package com.pardur.controller;

import com.pardur.dto.request.CreateIdeaCommentRequest;
import com.pardur.dto.request.CreateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaStatusRequest;
import com.pardur.dto.response.IdeaActivityDto;
import com.pardur.dto.response.IdeaCommentDto;
import com.pardur.dto.response.IdeaDto;
import com.pardur.service.IdeaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for the Ideenkammer. Ideas are world-agnostic; all endpoints live under /api/ideas.
 */
@RestController
@RequestMapping("/api/ideas")
public class IdeaController {

    private final IdeaService ideaService;

    public IdeaController(IdeaService ideaService) {
        this.ideaService = ideaService;
    }

    @GetMapping
    public ResponseEntity<List<IdeaDto>> getAllIdeas(Authentication auth) {
        return ResponseEntity.ok(ideaService.getAllIdeas(auth));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IdeaDto> getIdea(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(ideaService.getIdea(id, auth));
    }

    @PostMapping
    public ResponseEntity<IdeaDto> createIdea(@Valid @RequestBody CreateIdeaRequest req, Authentication auth) {
        return ResponseEntity.status(201).body(ideaService.createIdea(req, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<IdeaDto> updateIdea(@PathVariable Integer id,
                                               @Valid @RequestBody UpdateIdeaRequest req,
                                               Authentication auth) {
        return ResponseEntity.ok(ideaService.updateIdea(id, req, auth));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<IdeaDto> updateStatus(@PathVariable Integer id,
                                                 @Valid @RequestBody UpdateIdeaStatusRequest req,
                                                 Authentication auth) {
        return ResponseEntity.ok(ideaService.updateStatus(id, req, auth));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIdea(@PathVariable Integer id, Authentication auth) {
        ideaService.deleteIdea(id, auth);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/votes")
    public ResponseEntity<IdeaDto> toggleVote(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(ideaService.toggleVote(id, auth));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<IdeaCommentDto>> getComments(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(ideaService.getComments(id, auth));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<IdeaCommentDto> addComment(@PathVariable Integer id,
                                                      @Valid @RequestBody CreateIdeaCommentRequest req,
                                                      Authentication auth) {
        return ResponseEntity.status(201).body(ideaService.addComment(id, req, auth));
    }

    @GetMapping("/{id}/activity")
    public ResponseEntity<List<IdeaActivityDto>> getActivity(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(ideaService.getActivity(id, auth));
    }
}
