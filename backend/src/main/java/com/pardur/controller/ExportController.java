package com.pardur.controller;

import com.pardur.service.ItemExportService;
import com.pardur.service.WikiExportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Handles data export operations. All endpoints require ADMIN role (enforced by SecurityConfig).
 * Both session-based auth and HTTP Basic Auth are accepted.
 */
@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final WikiExportService wikiExportService;
    private final ItemExportService itemExportService;

    public ExportController(WikiExportService wikiExportService,
                            ItemExportService itemExportService) {
        this.wikiExportService = wikiExportService;
        this.itemExportService = itemExportService;
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

    /**
     * Exports all marketplace items as a single Markdown file with a table.
     * Items are sorted by name ascending; no filters are applied.
     *
     * @return Markdown bytes with Content-Disposition attachment header
     */
    @GetMapping(value = "/items", produces = "text/markdown;charset=UTF-8")
    public ResponseEntity<byte[]> exportItems() {
        byte[] bytes = itemExportService.exportItemsAsMarkdown()
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"items-export.md\"")
                .body(bytes);
    }
}
