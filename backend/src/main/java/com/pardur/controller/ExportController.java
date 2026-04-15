package com.pardur.controller;

import com.pardur.service.WikiExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

/**
 * Handles data export operations. All endpoints require ADMIN role (enforced by SecurityConfig).
 * Both session-based auth and HTTP Basic Auth are accepted.
 */
@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final WikiExportService wikiExportService;

    public ExportController(WikiExportService wikiExportService) {
        this.wikiExportService = wikiExportService;
    }

    /**
     * Exports all wiki entries for the given world as a ZIP of Markdown files,
     * organized by parent/child hierarchy.
     *
     * @param worldId the world to export; must exist
     * @return ZIP bytes with Content-Disposition attachment header
     * @throws IOException if ZIP serialization fails
     */
    @GetMapping(value = "/worlds/{worldId}/wiki", produces = "application/zip")
    public ResponseEntity<byte[]> exportWiki(@PathVariable Integer worldId) throws IOException {
        byte[] zip = wikiExportService.exportWikiAsZip(worldId);
        String filename = wikiExportService.buildZipFilename(worldId);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(zip);
    }
}
