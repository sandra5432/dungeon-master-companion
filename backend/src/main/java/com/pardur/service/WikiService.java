package com.pardur.service;

import com.pardur.dto.request.CreateWikiEntryRequest;
import com.pardur.dto.request.UpdateWikiEntryRequest;
import com.pardur.dto.response.*;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
    private final WorldPermissionChecker checker;

    public WikiService(WikiEntryRepository entryRepository,
                       WikiSpoilerReaderRepository spoilerReaderRepository,
                       WorldRepository worldRepository,
                       UserRepository userRepository,
                       TimelineEventRepository eventRepository,
                       WorldPermissionChecker checker) {
        this.entryRepository = entryRepository;
        this.spoilerReaderRepository = spoilerReaderRepository;
        this.worldRepository = worldRepository;
        this.userRepository = userRepository;
        this.eventRepository = eventRepository;
        this.checker = checker;
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    /**
     * Lists wiki entries, optionally filtered by world and/or search query.
     * When worldId is given the caller must have read access to that world.
     * When worldId is absent, entries from all worlds the caller can read are returned.
     *
     * @param worldId optional world filter
     * @param q       optional full-text search term
     * @param auth    caller's authentication (may be null for guests)
     * @return list of matching entries as list-item DTOs
     */
    @Transactional(readOnly = true)
    public List<WikiEntryListItemDto> list(Integer worldId, String q, Authentication auth) {
        if (worldId != null) {
            checker.requireRead(requireWorld(worldId), auth);
        }

        List<WikiEntry> entries;
        if (q != null && !q.isBlank()) {
            String qLower = q.trim().toLowerCase();
            entries = entryRepository.searchByTitleOrBody(q.trim());
            if (worldId != null) {
                entries = entries.stream()
                        .filter(e -> e.getWorld().getId().equals(worldId))
                        .toList();
            } else {
                entries = entries.stream()
                        .filter(e -> checker.canRead(e.getWorld(), auth))
                        .toList();
            }
            // Title matches first, body-only matches second
            entries = entries.stream()
                    .sorted(Comparator.comparing(e -> !e.getTitle().toLowerCase().contains(qLower)))
                    .toList();
        } else if (worldId != null) {
            entries = entryRepository.findAllByWorldIdOrderByTitleAsc(worldId);
        } else {
            entries = entryRepository.findAll().stream()
                    .filter(e -> checker.canRead(e.getWorld(), auth))
                    .toList();
        }
        return entries.stream().map(this::toListItemDto).toList();
    }

    /**
     * Returns the 20 most recently updated wiki entries the caller may read.
     *
     * @param auth caller's authentication (may be null for guests)
     * @return list of entries ordered by updatedAt descending
     */
    @Transactional(readOnly = true)
    public List<WikiEntryListItemDto> recent(Authentication auth) {
        return entryRepository.findTop20ByOrderByUpdatedAtDesc()
                .stream()
                .filter(e -> checker.canRead(e.getWorld(), auth))
                .map(this::toListItemDto)
                .toList();
    }

    /**
     * Returns a single wiki entry if the caller has read access to its world.
     * Spoiler blocks are stripped for users who are not admin, the entry creator, or an explicit spoiler reader.
     *
     * @param id   entry ID
     * @param auth caller's authentication (may be null for guests)
     * @return full entry DTO
     * @throws ResourceNotFoundException if the entry does not exist
     */
    @Transactional(readOnly = true)
    public WikiEntryDto get(Integer id, Authentication auth) {
        WikiEntry entry = requireEntry(id);
        checker.requireRead(entry.getWorld(), auth);

        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        boolean isAdmin = WorldPermissionChecker.isAdmin(auth);
        User creator = entry.getCreatedBy();
        boolean isCreator = creator != null && creator.getId().equals(userId);

        boolean canReadSpoilers = isAdmin || isCreator
                || (userId != null && spoilerReaderRepository.existsByIdEntryIdAndIdUserId(id, userId));
        boolean canManageSpoilers = isAdmin || isCreator;
        return toDto(entry, canReadSpoilers, canManageSpoilers);
    }

    // ── WRITE ────────────────────────────────────────────────────────────────

    /**
     * Creates a new wiki entry in the given world.
     * Requires edit permission on the world. Anonymous creates (guests) are stored with a null creator.
     *
     * @param req  validated create request
     * @param auth caller's authentication (may be null for guests with edit permission)
     * @return the persisted entry as a DTO
     * @throws ResourceNotFoundException if the world does not exist
     */
    @Transactional
    public WikiEntryDto create(CreateWikiEntryRequest req, Authentication auth) {
        World world = requireWorld(req.getWorldId());
        checker.requireEdit(world, auth);
        checkDuplicate(req.getWorldId(), req.getTitle(), -1);

        Integer creatorId = WorldPermissionChecker.resolveUserId(auth);
        boolean isAdmin = WorldPermissionChecker.isAdmin(auth);

        WikiEntry entry = new WikiEntry();
        entry.setTitle(req.getTitle());
        entry.setWorld(world);
        entry.setType(req.getType());
        entry.setBody(req.getBody());
        entry.setParent(resolveParent(req.getParentId(), req.getWorldId(), null));

        if (creatorId != null) {
            User creator = userRepository.findById(creatorId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + creatorId));
            entry.setCreatedBy(creator);
        }

        WikiEntry saved = entryRepository.save(entry);
        boolean authenticated = isAdmin || creatorId != null;
        return toDto(saved, authenticated, authenticated);
    }

    /**
     * Updates an existing wiki entry.
     * Requires edit permission on the entry's world. Users who cannot read spoilers have their spoiler
     * blocks stripped from the submitted body and the original spoiler blocks re-appended.
     *
     * @param id   entry ID
     * @param req  validated update request
     * @param auth caller's authentication
     * @return the updated entry as a DTO
     * @throws ResourceNotFoundException if the entry does not exist
     */
    @Transactional
    public WikiEntryDto update(Integer id, UpdateWikiEntryRequest req, Authentication auth) {
        WikiEntry entry = requireEntry(id);
        checker.requireEdit(entry.getWorld(), auth);
        checkDuplicate(entry.getWorld().getId(), req.getTitle(), id);

        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        boolean isAdmin = WorldPermissionChecker.isAdmin(auth);
        User creator = entry.getCreatedBy();
        boolean isCreator = creator != null && creator.getId().equals(userId);

        boolean canReadSpoilers = isAdmin || isCreator
                || (userId != null && spoilerReaderRepository.existsByIdEntryIdAndIdUserId(id, userId));
        boolean canManageSpoilers = isAdmin || isCreator;

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

    /**
     * Deletes a wiki entry. Requires delete permission on the entry's world.
     *
     * @param id   entry ID
     * @param auth caller's authentication
     * @throws ResourceNotFoundException if the entry does not exist
     */
    @Transactional
    public void delete(Integer id, Authentication auth) {
        WikiEntry entry = requireEntry(id);
        checker.requireDelete(entry.getWorld(), auth);
        entryRepository.delete(entry);
    }

    // ── SPOILER READERS ──────────────────────────────────────────────────────

    /**
     * Returns the user IDs that have been granted spoiler-reader access.
     * Only the entry creator or an admin may call this.
     *
     * @param entryId entry ID
     * @param auth    caller's authentication
     * @return list of user IDs with spoiler access
     */
    @Transactional(readOnly = true)
    public List<Integer> getSpoilerReaders(Integer entryId, Authentication auth) {
        WikiEntry entry = requireEntry(entryId);
        requireSpoilerOwner(entry, auth);
        return spoilerReaderRepository.findByIdEntryId(entryId)
                .stream().map(r -> r.getId().getUserId()).toList();
    }

    /**
     * Grants spoiler-reader access to the specified user.
     * Only the entry creator or an admin may call this.
     *
     * @param entryId      entry ID
     * @param targetUserId user to grant access to
     * @param auth         caller's authentication
     */
    @Transactional
    public void addSpoilerReader(Integer entryId, Integer targetUserId, Authentication auth) {
        WikiEntry entry = requireEntry(entryId);
        requireSpoilerOwner(entry, auth);
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + targetUserId));
        if (!spoilerReaderRepository.existsByIdEntryIdAndIdUserId(entryId, targetUserId)) {
            spoilerReaderRepository.save(new WikiSpoilerReader(entry, target));
        }
    }

    /**
     * Revokes spoiler-reader access from the specified user.
     * Only the entry creator or an admin may call this.
     *
     * @param entryId      entry ID
     * @param targetUserId user to revoke access from
     * @param auth         caller's authentication
     */
    @Transactional
    public void removeSpoilerReader(Integer entryId, Integer targetUserId, Authentication auth) {
        WikiEntry entry = requireEntry(entryId);
        requireSpoilerOwner(entry, auth);
        WikiSpoilerReaderId pk = new WikiSpoilerReaderId(entryId, targetUserId);
        if (spoilerReaderRepository.existsById(pk)) {
            spoilerReaderRepository.deleteById(pk);
        }
    }

    // ── AUTO-LINKING ─────────────────────────────────────────────────────────

    /**
     * Returns timeline events that mention the given entry's title.
     * Requires read access to the entry's world.
     *
     * @param entryId entry ID
     * @param auth    caller's authentication (may be null for guests)
     * @return list of matching events as lightweight DTOs
     */
    @Transactional(readOnly = true)
    public List<EventDto> getLinkedEvents(Integer entryId, Authentication auth) {
        WikiEntry entry = requireEntry(entryId);
        checker.requireRead(entry.getWorld(), auth);
        return eventRepository.findByTitleOrDescriptionContainingIgnoreCase(entry.getTitle())
                .stream().map(this::toEventListDto).toList();
    }

    /**
     * Returns wiki entries that mention — or are mentioned by — the given entry.
     * Requires read access to the entry's world.
     *
     * @param entryId entry ID
     * @param auth    caller's authentication (may be null for guests)
     * @return deduplicated list of linked entries
     */
    @Transactional(readOnly = true)
    public List<WikiEntryListItemDto> getLinkedEntries(Integer entryId, Authentication auth) {
        WikiEntry entry = requireEntry(entryId);
        checker.requireRead(entry.getWorld(), auth);
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

    /**
     * Returns a node/edge graph of wiki entries and their body-mention links for the given world.
     * Requires read access to the world.
     *
     * @param worldId target world
     * @param auth    caller's authentication (may be null for guests)
     * @return graph DTO with nodes and edges
     * @throws ResourceNotFoundException if the world does not exist
     */
    @Transactional(readOnly = true)
    public WikiGraphDto getGraph(Integer worldId, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireRead(world, auth);
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

    /**
     * Returns a raw-markdown excerpt of the entry body: the first paragraph, or
     * the first 1–2 sentences if the opening paragraph is long, capped at ~300 chars.
     * The caller is expected to render this as markdown (e.g. via marked.js).
     * Requires read access to the entry's world.
     *
     * @param id   entry ID
     * @param auth caller's authentication (may be null for guests)
     * @return markdown excerpt, empty if the entry has no body
     */
    @Transactional(readOnly = true)
    public String getPreview(Integer id, Authentication auth) {
        WikiEntry entry = requireEntry(id);
        checker.requireRead(entry.getWorld(), auth);
        String body = entry.getBody() != null ? entry.getBody().trim() : "";
        if (body.isEmpty()) return "";

        // Strip spoiler blocks — they should not appear in a preview
        body = body.replaceAll(":::spoiler[^\n]*\n[\\s\\S]*?:::", "").trim();

        // Use the first paragraph (blank-line boundary) if it is reasonably sized
        int paraEnd = body.indexOf("\n\n");
        String para = (paraEnd > 0 && paraEnd <= 400) ? body.substring(0, paraEnd).trim() : body;

        if (para.length() <= 300) return para;

        // Paragraph is long — find end of first or second sentence
        int end = -1;
        for (int i = 60; i < Math.min(para.length(), 350); i++) {
            char c = para.charAt(i);
            if ((c == '.' || c == '!' || c == '?') && (i + 1 >= para.length() || para.charAt(i + 1) == ' ')) {
                end = i;
                if (end >= 120) break;
            }
        }
        return end > 0 ? para.substring(0, end + 1).trim() : para.substring(0, 300).trim() + "…";
    }

    /**
     * Returns all wiki entry titles and their IDs, restricted to worlds the caller can read.
     *
     * @param auth caller's authentication (may be null for guests)
     * @return list of maps containing id, title, and worldId
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllTitles(Authentication auth) {
        return entryRepository.findAll().stream()
                .filter(e -> checker.canRead(e.getWorld(), auth))
                .map(e -> Map.<String, Object>of("id", e.getId(), "title", e.getTitle(), "worldId", e.getWorld().getId()))
                .toList();
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    private World requireWorld(Integer id) {
        return worldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + id));
    }

    private WikiEntry requireEntry(Integer id) {
        return entryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Wiki entry not found: " + id));
    }

    /** Throws 403 unless the caller is admin or the entry's creator. Used only for spoiler management. */
    private void requireSpoilerOwner(WikiEntry entry, Authentication auth) {
        if (WorldPermissionChecker.isAdmin(auth)) return;
        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        User creator = entry.getCreatedBy();
        if (creator == null || !creator.getId().equals(userId)) {
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
        if (e.getCreatedBy() != null) {
            dto.setCreatedByUserId(e.getCreatedBy().getId());
            dto.setCreatedByUsername(e.getCreatedBy().getUsername());
        } else {
            dto.setCreatedByUsername("Anonym");
        }
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
