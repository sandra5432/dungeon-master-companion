package com.pardur.service;

import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.WikiEntry;
import com.pardur.model.World;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Builds wiki export ZIP archives for a given world.
 */
@Service
public class WikiExportService {

    private final WikiEntryRepository wikiEntryRepository;
    private final WorldRepository worldRepository;

    public WikiExportService(WikiEntryRepository wikiEntryRepository,
                             WorldRepository worldRepository) {
        this.wikiEntryRepository = wikiEntryRepository;
        this.worldRepository = worldRepository;
    }

    /**
     * Exports all wiki entries for the given world as an in-memory ZIP.
     * Entries are organized by parent/child hierarchy; spoiler blocks are included verbatim.
     *
     * @param worldId target world; must exist
     * @return ZIP bytes
     * @throws ResourceNotFoundException if the world does not exist
     * @throws IOException if ZIP serialization fails
     */
    @Transactional(readOnly = true)
    public byte[] exportWikiAsZip(Integer worldId) throws IOException {
        loadWorld(worldId); // validates existence
        List<WikiEntry> entries = wikiEntryRepository.findAllByWorldIdOrderByTitleAsc(worldId);

        Map<Integer, List<WikiEntry>> childrenMap = new HashMap<>();
        List<WikiEntry> roots = new ArrayList<>();
        for (WikiEntry e : entries) {
            if (e.getParent() == null) {
                roots.add(e);
            } else {
                childrenMap
                        .computeIfAbsent(e.getParent().getId(), k -> new ArrayList<>())
                        .add(e);
            }
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (WikiEntry root : roots) {
                addEntryToZip(zos, root, "", childrenMap);
            }
        }
        return baos.toByteArray();
    }

    /**
     * Returns the ZIP download filename for the given world.
     *
     * @param worldId target world; must exist
     * @return e.g. {@code "pardur-wiki-export.zip"}
     */
    @Transactional(readOnly = true)
    public String buildZipFilename(Integer worldId) {
        World world = loadWorld(worldId);
        return sanitize(world.getName()) + "-wiki-export.zip";
    }

    /**
     * Sanitizes a title into a safe filename segment (no extension, no path separators).
     * Lowercases, replaces German umlauts, collapses non-alphanumeric chars to underscores.
     *
     * @param title raw title
     * @return sanitized string
     */
    static String sanitize(String title) {
        String s = title.toLowerCase();
        s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss");
        s = s.replaceAll("[\\s\\-]+", "_");
        s = s.replaceAll("[^a-z0-9_]", "");
        s = s.replaceAll("_+", "_");
        s = s.replaceAll("^_+|_+$", "");
        return s;
    }

    /**
     * Renders the Markdown file content for a single wiki entry.
     * Spoiler blocks are included verbatim.
     *
     * @param entry the wiki entry
     * @return Markdown string
     */
    static String renderMarkdown(WikiEntry entry) {
        StringBuilder sb = new StringBuilder();
        sb.append("# ").append(entry.getTitle()).append("\n\n");
        sb.append("**Type:** ").append(entry.getType().name()).append("\n");
        sb.append("**Created by:** ").append(entry.getCreatedBy().getUsername()).append("\n");
        String date = entry.getUpdatedAt() != null
                ? entry.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE)
                : "—";
        sb.append("**Last updated:** ").append(date).append("\n\n");
        sb.append("---\n\n");
        String body = entry.getBody();
        sb.append((body == null || body.isBlank()) ? "*(no content)*" : body);
        return sb.toString();
    }

    // ── private ───────────────────────────────────────────────────────────────

    private void addEntryToZip(ZipOutputStream zos, WikiEntry entry, String prefix,
                                Map<Integer, List<WikiEntry>> childrenMap) throws IOException {
        String safeName = sanitize(entry.getTitle());
        List<WikiEntry> children = childrenMap.getOrDefault(entry.getId(), Collections.emptyList());
        boolean hasChildren = !children.isEmpty();

        String filePath;
        String childPrefix;
        if (hasChildren) {
            childPrefix = prefix + safeName + "/";
            filePath = childPrefix + safeName + ".md";
        } else {
            childPrefix = prefix;
            filePath = prefix + safeName + ".md";
        }

        zos.putNextEntry(new ZipEntry(filePath));
        zos.write(renderMarkdown(entry).getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();

        for (WikiEntry child : children) {
            addEntryToZip(zos, child, childPrefix, childrenMap);
        }
    }

    private World loadWorld(Integer worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    }
}
