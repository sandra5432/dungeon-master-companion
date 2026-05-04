package com.pardur.controller;

import com.pardur.dto.response.IdeaImageDto;
import com.pardur.model.IdeaImage;
import com.pardur.service.IdeaImageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * REST endpoints for uploading, listing, serving, and deleting images attached to ideas.
 */
@RestController
@RequestMapping("/api/ideas/{ideaId}/images")
public class IdeaImageController {

    private final IdeaImageService imageService;

    public IdeaImageController(IdeaImageService imageService) {
        this.imageService = imageService;
    }

    /** Returns metadata for all images of the given idea (no binary data). */
    @GetMapping
    public ResponseEntity<List<IdeaImageDto>> listImages(@PathVariable Integer ideaId, Authentication auth) {
        return ResponseEntity.ok(imageService.listImages(ideaId, auth));
    }

    /**
     * Uploads an image to the given idea.
     *
     * @param file multipart field named {@code file}
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<IdeaImageDto> uploadImage(@PathVariable Integer ideaId,
                                                     @RequestParam("file") MultipartFile file,
                                                     Authentication auth) {
        return ResponseEntity.status(201).body(imageService.uploadImage(ideaId, file, auth));
    }

    /** Serves the binary data for a single image with the correct Content-Type header. */
    @GetMapping("/{imageId}/data")
    public ResponseEntity<byte[]> getImageData(@PathVariable Integer ideaId,
                                                @PathVariable Integer imageId,
                                                Authentication auth) {
        IdeaImage image = imageService.getImageData(ideaId, imageId, auth);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, image.getContentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + image.getOriginalFilename() + "\"")
                .body(image.getData());
    }

    /** Deletes a single image from the given idea. */
    @DeleteMapping("/{imageId}")
    public ResponseEntity<Void> deleteImage(@PathVariable Integer ideaId,
                                             @PathVariable Integer imageId,
                                             Authentication auth) {
        imageService.deleteImage(ideaId, imageId, auth);
        return ResponseEntity.noContent().build();
    }
}
