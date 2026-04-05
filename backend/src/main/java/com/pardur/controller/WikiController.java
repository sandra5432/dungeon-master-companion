package com.pardur.controller;

import com.pardur.dto.request.CreateWikiEntryRequest;
import com.pardur.dto.request.UpdateWikiEntryRequest;
import com.pardur.dto.request.UpdateWikiImageRequest;
import com.pardur.dto.response.*;
import com.pardur.security.PardurUserDetails;
import com.pardur.service.WikiImageService;
import com.pardur.service.WikiService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wiki")
public class WikiController {

    private final WikiService wikiService;
    private final WikiImageService imageService;

    public WikiController(WikiService wikiService, WikiImageService imageService) {
        this.wikiService = wikiService;
        this.imageService = imageService;
    }

    // ── Entries ──────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<WikiEntryListItemDto>> list(
            @RequestParam(required = false) Integer worldId,
            @RequestParam(required = false) String q,
            Authentication auth) {
        PardurUserDetails user = resolve(auth);
        Integer userId = user != null ? user.getUserId() : null;
        boolean isAdmin = user != null && "ADMIN".equals(user.getRole());
        return ResponseEntity.ok(wikiService.list(worldId, q, userId, isAdmin));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<WikiEntryListItemDto>> recent() {
        return ResponseEntity.ok(wikiService.recent());
    }

    @GetMapping("/titles")
    public ResponseEntity<List<Map<String, Object>>> titles() {
        return ResponseEntity.ok(wikiService.getAllTitles());
    }

    @GetMapping("/{id}")
    public ResponseEntity<WikiEntryDto> get(@PathVariable Integer id, Authentication auth) {
        PardurUserDetails user = resolve(auth);
        Integer userId = user != null ? user.getUserId() : null;
        boolean isAdmin = user != null && "ADMIN".equals(user.getRole());
        return ResponseEntity.ok(wikiService.get(id, userId, isAdmin));
    }

    @PostMapping
    public ResponseEntity<WikiEntryDto> create(@Valid @RequestBody CreateWikiEntryRequest req,
                                                Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        return ResponseEntity.status(201).body(wikiService.create(req, user.getUserId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WikiEntryDto> update(@PathVariable Integer id,
                                                @Valid @RequestBody UpdateWikiEntryRequest req,
                                                Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        return ResponseEntity.ok(wikiService.update(id, req, user.getUserId(), isAdmin));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        wikiService.delete(id, user.getUserId(), isAdmin);
        return ResponseEntity.noContent().build();
    }

    // ── Auto-linking ─────────────────────────────────────────────────────────

    @GetMapping("/{id}/linked-events")
    public ResponseEntity<List<EventDto>> linkedEvents(@PathVariable Integer id) {
        return ResponseEntity.ok(wikiService.getLinkedEvents(id));
    }

    @GetMapping("/{id}/linked-entries")
    public ResponseEntity<List<WikiEntryListItemDto>> linkedEntries(@PathVariable Integer id) {
        return ResponseEntity.ok(wikiService.getLinkedEntries(id));
    }

    @GetMapping("/graph")
    public ResponseEntity<WikiGraphDto> graph(@RequestParam Integer worldId) {
        return ResponseEntity.ok(wikiService.getGraph(worldId));
    }

    // ── Images ───────────────────────────────────────────────────────────────

    @PostMapping("/{id}/images")
    public ResponseEntity<WikiImageDto> uploadImage(@PathVariable Integer id,
                                                     @RequestParam("file") MultipartFile file,
                                                     Authentication auth) throws IOException {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        return ResponseEntity.status(201).body(imageService.upload(id, file, user.getUserId(), isAdmin));
    }

    @GetMapping(value = "/images/{imageId}")
    public ResponseEntity<byte[]> getImage(@PathVariable Integer imageId) {
        byte[] data = imageService.getImageData(imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("image/webp"))
                .body(data);
    }

    @PutMapping("/images/{imageId}")
    public ResponseEntity<WikiImageDto> updateImage(@PathVariable Integer imageId,
                                                     @RequestBody UpdateWikiImageRequest req,
                                                     Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        return ResponseEntity.ok(imageService.update(imageId, req, user.getUserId(), isAdmin));
    }

    @DeleteMapping("/images/{imageId}")
    public ResponseEntity<Void> deleteImage(@PathVariable Integer imageId, Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        imageService.delete(imageId, user.getUserId(), isAdmin);
        return ResponseEntity.noContent().build();
    }

    // ── Spoiler readers ──────────────────────────────────────────────────────

    @GetMapping("/{id}/spoiler-readers")
    public ResponseEntity<List<Integer>> getSpoilerReaders(@PathVariable Integer id, Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        return ResponseEntity.ok(wikiService.getSpoilerReaders(id, user.getUserId(), isAdmin));
    }

    @PostMapping("/{id}/spoiler-readers/{userId}")
    public ResponseEntity<Void> addSpoilerReader(@PathVariable Integer id,
                                                  @PathVariable Integer userId,
                                                  Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        wikiService.addSpoilerReader(id, userId, user.getUserId(), isAdmin);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/spoiler-readers/{userId}")
    public ResponseEntity<Void> removeSpoilerReader(@PathVariable Integer id,
                                                     @PathVariable Integer userId,
                                                     Authentication auth) {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        wikiService.removeSpoilerReader(id, userId, user.getUserId(), isAdmin);
        return ResponseEntity.noContent().build();
    }

    // ── Util ─────────────────────────────────────────────────────────────────

    private PardurUserDetails resolve(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return null;
        Object p = auth.getPrincipal();
        return p instanceof PardurUserDetails d ? d : null;
    }
}
