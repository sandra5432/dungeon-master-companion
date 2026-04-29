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
        return ResponseEntity.ok(wikiService.list(worldId, q, auth));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<WikiEntryListItemDto>> recent(Authentication auth) {
        return ResponseEntity.ok(wikiService.recent(auth));
    }

    @GetMapping("/titles")
    public ResponseEntity<List<Map<String, Object>>> titles(Authentication auth) {
        return ResponseEntity.ok(wikiService.getAllTitles(auth));
    }

    /**
     * Returns a short plain-text preview of the entry body (first 1–2 sentences).
     * Access follows the world's read permission.
     *
     * @param id   entry ID
     * @param auth caller's authentication (may be null for guests)
     * @return map with a single {@code preview} key
     */
    @GetMapping("/{id}/preview")
    public ResponseEntity<Map<String, String>> preview(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(Map.of("preview", wikiService.getPreview(id, auth)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WikiEntryDto> get(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(wikiService.get(id, auth));
    }

    @PostMapping
    public ResponseEntity<WikiEntryDto> create(@Valid @RequestBody CreateWikiEntryRequest req,
                                                Authentication auth) {
        return ResponseEntity.status(201).body(wikiService.create(req, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WikiEntryDto> update(@PathVariable Integer id,
                                                @Valid @RequestBody UpdateWikiEntryRequest req,
                                                Authentication auth) {
        return ResponseEntity.ok(wikiService.update(id, req, auth));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id, Authentication auth) {
        wikiService.delete(id, auth);
        return ResponseEntity.noContent().build();
    }

    // ── Auto-linking ─────────────────────────────────────────────────────────

    @GetMapping("/{id}/linked-events")
    public ResponseEntity<List<EventDto>> linkedEvents(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(wikiService.getLinkedEvents(id, auth));
    }

    @GetMapping("/{id}/linked-entries")
    public ResponseEntity<List<WikiEntryListItemDto>> linkedEntries(@PathVariable Integer id, Authentication auth) {
        return ResponseEntity.ok(wikiService.getLinkedEntries(id, auth));
    }

    @GetMapping("/graph")
    public ResponseEntity<WikiGraphDto> graph(@RequestParam Integer worldId, Authentication auth) {
        return ResponseEntity.ok(wikiService.getGraph(worldId, auth));
    }

    // ── Images ───────────────────────────────────────────────────────────────

    @PostMapping("/{id}/images")
    public ResponseEntity<WikiImageDto> uploadImage(@PathVariable Integer id,
                                                     @RequestParam("file") MultipartFile file,
                                                     @RequestParam(value = "caption", required = false) String caption,
                                                     Authentication auth) throws IOException {
        PardurUserDetails user = (PardurUserDetails) auth.getPrincipal();
        boolean isAdmin = "ADMIN".equals(user.getRole());
        return ResponseEntity.status(201).body(imageService.upload(id, file, caption, user.getUserId(), isAdmin));
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
        return ResponseEntity.ok(wikiService.getSpoilerReaders(id, auth));
    }

    @PostMapping("/{id}/spoiler-readers/{userId}")
    public ResponseEntity<Void> addSpoilerReader(@PathVariable Integer id,
                                                  @PathVariable Integer userId,
                                                  Authentication auth) {
        wikiService.addSpoilerReader(id, userId, auth);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/spoiler-readers/{userId}")
    public ResponseEntity<Void> removeSpoilerReader(@PathVariable Integer id,
                                                     @PathVariable Integer userId,
                                                     Authentication auth) {
        wikiService.removeSpoilerReader(id, userId, auth);
        return ResponseEntity.noContent().build();
    }
}
