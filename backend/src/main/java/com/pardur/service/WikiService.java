package com.pardur.service;

import com.pardur.dto.request.CreateWikiEntryRequest;
import com.pardur.dto.request.UpdateWikiEntryRequest;
import com.pardur.dto.response.*;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class WikiService {

    private final WikiEntryRepository entryRepository;
    private final WikiSpoilerReaderRepository spoilerReaderRepository;
    private final WorldRepository worldRepository;
    private final UserRepository userRepository;
    private final TimelineEventRepository eventRepository;

    public WikiService(WikiEntryRepository entryRepository,
                       WikiSpoilerReaderRepository spoilerReaderRepository,
                       WorldRepository worldRepository,
                       UserRepository userRepository,
                       TimelineEventRepository eventRepository) {
        this.entryRepository = entryRepository;
        this.spoilerReaderRepository = spoilerReaderRepository;
        this.worldRepository = worldRepository;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WikiEntryListItemDto> list(Integer worldId, String q, Integer currentUserId, boolean isAdmin) {
        List<WikiEntry> entries;
        if (q != null && !q.isBlank()) {
            String qLower = q.trim().toLowerCase();
            entries = entryRepository.searchByTitleOrBody(q.trim());
            if (worldId != null) {
                entries = entries.stream()
                        .filter(e -> e.getWorld().getId().equals(worldId))
                        .toList();
            }
            // Title matches first, body-only matches second
            entries = entries.stream()
                    .sorted(Comparator.comparing(e -> !e.getTitle().toLowerCase().contains(qLower)))
                    .toList();
        } else if (worldId != null) {
            entries = entryRepository.findAllByWorldIdOrderByTitleAsc(worldId);
        } else {
            entries = entryRepository.findAll();
        }
        return entries.stream().map(this::toListItemDto).toList();
    }

    @Transactional(readOnly = true)
    public List<WikiEntryListItemDto> recent() {
        return entryRepository.findTop20ByOrderByUpdatedAtDesc()
                .stream().map(this::toListItemDto).toList();
    }

    @Transactional(readOnly = true)
    public WikiEntryDto get(Integer id, Integer currentUserId, boolean isAdmin) {
        WikiEntry entry = requireEntry(id);
        boolean canReadSpoilers = isAdmin
                || (currentUserId != null && entry.getCreatedBy().getId().equals(currentUserId))
                || (currentUserId != null && spoilerReaderRepository.existsByIdEntryIdAndIdUserId(id, currentUserId));
        boolean canManageSpoilers = isAdmin
                || (currentUserId != null && entry.getCreatedBy().getId().equals(currentUserId));
        return toDto(entry, canReadSpoilers, canManageSpoilers);
    }

    // ── WRITE ────────────────────────────────────────────────────────────────

    @Transactional
    public WikiEntryDto create(CreateWikiEntryRequest req, Integer currentUserId) {
        World world = worldRepository.findById(req.getWorldId())
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + req.getWorldId()));
        User creator = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + currentUserId));
        checkDuplicate(req.getWorldId(), req.getTitle(), -1);

        WikiEntry entry = new WikiEntry();
        entry.setTitle(req.getTitle());
        entry.setWorld(world);
        entry.setType(req.getType());
        entry.setBody(req.getBody());
        entry.setCreatedBy(creator);
        entry.setParent(resolveParent(req.getParentId(), req.getWorldId(), null));
        WikiEntry saved = entryRepository.save(entry);
        return toDto(saved, true, true);
    }

    @Transactional
    public WikiEntryDto update(Integer id, UpdateWikiEntryRequest req, Integer currentUserId, boolean isAdmin) {
        WikiEntry entry = requireEntry(id);
        checkDuplicate(entry.getWorld().getId(), req.getTitle(), id);

        boolean canReadSpoilers = isAdmin
                || entry.getCreatedBy().getId().equals(currentUserId)
                || spoilerReaderRepository.existsByIdEntryIdAndIdUserId(id, currentUserId);
        boolean canManageSpoilers = isAdmin
                || entry.getCreatedBy().getId().equals(currentUserId);

        entry.setTitle(req.getTitle());
        entry.setType(req.getType());
        entry.setParent(resolveParent(req.getParentId(), entry.getWorld().getId(), id));

        if (canReadSpoilers) {
            entry.setBody(req.getBody());
        } else {
            // User cannot see spoiler blocks — strip any they may have submitted,
            // then reattach the original spoiler blocks from the stored body.
            String preserved = extractSpoilers(entry.getBody());
            String newBody   = stripSpoilers(req.getBody());
            entry.setBody(preserved.isEmpty() ? newBody : newBody + "\n\n" + preserved);
        }

        WikiEntry saved = entryRepository.save(entry);
        return toDto(saved, canReadSpoilers, canManageSpoilers);
    }

    @Transactional
    public void delete(Integer id, Integer currentUserId, boolean isAdmin) {
        WikiEntry entry = requireEntry(id);
        checkOwnership(entry, currentUserId, isAdmin);
        entryRepository.delete(entry);
    }

    // ── SPOILER READERS ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Integer> getSpoilerReaders(Integer entryId, Integer currentUserId, boolean isAdmin) {
        WikiEntry entry = requireEntry(entryId);
        checkOwnership(entry, currentUserId, isAdmin);
        return spoilerReaderRepository.findByIdEntryId(entryId)
                .stream().map(r -> r.getId().getUserId()).toList();
    }

    @Transactional
    public void addSpoilerReader(Integer entryId, Integer targetUserId, Integer currentUserId, boolean isAdmin) {
        WikiEntry entry = requireEntry(entryId);
        checkOwnership(entry, currentUserId, isAdmin);
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + targetUserId));
        if (!spoilerReaderRepository.existsByIdEntryIdAndIdUserId(entryId, targetUserId)) {
            spoilerReaderRepository.save(new WikiSpoilerReader(entry, target));
        }
    }

    @Transactional
    public void removeSpoilerReader(Integer entryId, Integer targetUserId, Integer currentUserId, boolean isAdmin) {
        WikiEntry entry = requireEntry(entryId);
        checkOwnership(entry, currentUserId, isAdmin);
        WikiSpoilerReaderId pk = new WikiSpoilerReaderId(entryId, targetUserId);
        if (spoilerReaderRepository.existsById(pk)) {
            spoilerReaderRepository.deleteById(pk);
        }
    }

    // ── AUTO-LINKING ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<EventDto> getLinkedEvents(Integer entryId) {
        WikiEntry entry = requireEntry(entryId);
        return eventRepository.findByTitleOrDescriptionContainingIgnoreCase(entry.getTitle())
                .stream().map(this::toEventListDto).toList();
    }

    @Transactional(readOnly = true)
    public List<WikiEntryListItemDto> getLinkedEntries(Integer entryId) {
        WikiEntry entry = requireEntry(entryId);
        String title = entry.getTitle();
        String body = entry.getBody() != null ? entry.getBody().toLowerCase() : "";

        List<WikiEntry> mentionThis = entryRepository.findByBodyContainingTitle(title, entryId);

        List<WikiEntry> mentionedByThis = entryRepository.findAllByWorldIdOrderByTitleAsc(entry.getWorld().getId())
                .stream()
                .filter(other -> !other.getId().equals(entryId))
                .filter(other -> body.contains(other.getTitle().toLowerCase()))
                .toList();

        Set<Integer> seen = new HashSet<>();
        List<WikiEntryListItemDto> result = new ArrayList<>();
        for (WikiEntry e : mentionThis) {
            if (seen.add(e.getId())) result.add(toListItemDto(e));
        }
        for (WikiEntry e : mentionedByThis) {
            if (seen.add(e.getId())) result.add(toListItemDto(e));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public WikiGraphDto getGraph(Integer worldId) {
        worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
        List<WikiEntry> entries = entryRepository.findAllByWorldIdOrderByTitleAsc(worldId);

        List<WikiGraphDto.Node> nodes = entries.stream()
                .map(e -> new WikiGraphDto.Node(e.getId(), e.getTitle(), e.getType().name()))
                .toList();

        List<WikiGraphDto.Edge> edges = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < entries.size(); i++) {
            WikiEntry a = entries.get(i);
            String aBody = a.getBody() != null ? a.getBody().toLowerCase() : "";
            for (int j = i + 1; j < entries.size(); j++) {
                WikiEntry b = entries.get(j);
                String bBody = b.getBody() != null ? b.getBody().toLowerCase() : "";
                boolean linked = aBody.contains(b.getTitle().toLowerCase())
                        || bBody.contains(a.getTitle().toLowerCase());
                if (linked) {
                    String key = Math.min(a.getId(), b.getId()) + "-" + Math.max(a.getId(), b.getId());
                    if (seen.add(key)) {
                        edges.add(new WikiGraphDto.Edge(a.getId(), b.getId()));
                    }
                }
            }
        }
        return new WikiGraphDto(nodes, edges);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllTitles() {
        return entryRepository.findAll().stream()
                .map(e -> Map.<String, Object>of("id", e.getId(), "title", e.getTitle()))
                .toList();
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    private WikiEntry requireEntry(Integer id) {
        return entryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Wiki entry not found: " + id));
    }

    private void checkOwnership(WikiEntry entry, Integer currentUserId, boolean isAdmin) {
        if (isAdmin) return;
        if (!entry.getCreatedBy().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your wiki entry");
        }
    }

    private void checkDuplicate(Integer worldId, String title, Integer excludeId) {
        entryRepository.findDuplicateTitle(worldId, title, excludeId).ifPresent(e -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An entry with this title already exists in this world");
        });
    }

    static String stripSpoilers(String body) {
        if (body == null) return null;
        return body.replaceAll("(?s):::spoiler[^\\n]*\\n.*?:::", "").trim();
    }

    static String extractSpoilers(String body) {
        if (body == null) return "";
        StringBuilder sb = new StringBuilder();
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(?s):::spoiler[^\\n]*\\n.*?:::").matcher(body);
        while (m.find()) {
            if (sb.length() > 0) sb.append("\n\n");
            sb.append(m.group());
        }
        return sb.toString();
    }

    private int ancestorDepth(WikiEntry entry) {
        int depth = 0;
        WikiEntry current = entry.getParent();
        while (current != null && depth < 4) {
            depth++;
            current = current.getParent();
        }
        return depth;
    }

    private boolean wouldCreateCycle(WikiEntry potentialParent, Integer entryId) {
        WikiEntry current = potentialParent;
        while (current != null) {
            if (current.getId().equals(entryId)) return true;
            current = current.getParent();
        }
        return false;
    }

    private WikiEntry resolveParent(Integer parentId, Integer worldId, Integer selfId) {
        if (parentId == null) return null;
        WikiEntry parent = entryRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent entry not found: " + parentId));
        if (!parent.getWorld().getId().equals(worldId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Übergeordneter Eintrag muss zur gleichen Welt gehören");
        }
        if (selfId != null && selfId.equals(parentId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ein Eintrag kann nicht sein eigener Elterneintrag sein");
        }
        if (selfId != null && wouldCreateCycle(parent, selfId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Zirkuläre Eltern-Kind-Beziehung nicht erlaubt");
        }
        if (ancestorDepth(parent) >= 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Maximale Verschachtelungstiefe (3) überschritten");
        }
        return parent;
    }

    private WikiEntryDto toDto(WikiEntry e, boolean canReadSpoilers, boolean canManageSpoilers) {
        WikiEntryDto dto = new WikiEntryDto();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setType(e.getType().name());
        dto.setWorldId(e.getWorld().getId());
        dto.setWorldName(e.getWorld().getName());
        dto.setBody(canReadSpoilers ? e.getBody() : stripSpoilers(e.getBody()));
        dto.setCanReadSpoilers(canReadSpoilers);
        dto.setCreatedByUserId(e.getCreatedBy().getId());
        dto.setCreatedByUsername(e.getCreatedBy().getUsername());
        dto.setImages(e.getImages().stream()
                .map(img -> new WikiImageDto(img.getId(), img.getCaption(), img.getSortOrder()))
                .toList());
        if (canManageSpoilers) {
            dto.setSpoilerReaderUserIds(e.getSpoilerReaders().stream()
                    .map(r -> r.getId().getUserId()).toList());
        }
        dto.setCreatedAt(e.getCreatedAt());
        dto.setUpdatedAt(e.getUpdatedAt());
        if (e.getParent() != null) {
            dto.setParentId(e.getParent().getId());
            dto.setParentTitle(e.getParent().getTitle());
            dto.setParentType(e.getParent().getType().name());
        }
        dto.setChildren(entryRepository.findByParentId(e.getId()).stream()
                .map(c -> new WikiChildDto(c.getId(), c.getTitle(), c.getType().name()))
                .sorted(Comparator.comparing(WikiChildDto::getTitle))
                .toList());
        return dto;
    }

    private WikiEntryListItemDto toListItemDto(WikiEntry e) {
        WikiEntryListItemDto dto = new WikiEntryListItemDto();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setType(e.getType().name());
        dto.setWorldId(e.getWorld().getId());
        dto.setWorldName(e.getWorld().getName());
        dto.setUpdatedAt(e.getUpdatedAt());
        if (e.getParent() != null) {
            dto.setParentId(e.getParent().getId());
        }
        return dto;
    }

    private EventDto toEventListDto(TimelineEvent e) {
        EventDto dto = new EventDto();
        dto.setId(e.getId());
        dto.setWorldId(e.getWorld().getId());
        dto.setTitle(e.getTitle());
        dto.setDateLabel(e.getDateLabel());
        dto.setType(e.getType().name().toLowerCase());
        return dto;
    }
}
