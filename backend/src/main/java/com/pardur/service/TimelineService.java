package com.pardur.service;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEpochRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEpochRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EpochDto;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
public class TimelineService {

    private static final BigDecimal TWO = new BigDecimal("2");

    private final TimelineEventRepository eventRepository;
    private final EventTagRepository eventTagRepository;
    private final WorldRepository worldRepository;
    private final UserRepository userRepository;
    private final WorldPermissionChecker checker;
    private final TimelineEpochRepository epochRepository;

    public TimelineService(TimelineEventRepository eventRepository,
                           EventTagRepository eventTagRepository,
                           WorldRepository worldRepository,
                           UserRepository userRepository,
                           WorldPermissionChecker checker,
                           TimelineEpochRepository epochRepository) {
        this.eventRepository = eventRepository;
        this.eventTagRepository = eventTagRepository;
        this.worldRepository = worldRepository;
        this.userRepository = userRepository;
        this.checker = checker;
        this.epochRepository = epochRepository;
    }

    private World requireWorld(Integer worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + worldId));
    }

    @Transactional(readOnly = true)
    public List<EventDto> getPositionedEvents(Integer worldId, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireRead(world, auth);
        return eventRepository.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<EventDto> getUnpositionedEvents(Integer worldId, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireRead(world, auth);
        return eventRepository.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TagCountDto> getTagCounts(Integer worldId, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireRead(world, auth);
        return eventTagRepository.findTagCountsByWorldId(worldId);
    }

    @Transactional(readOnly = true)
    public EventDto getEvent(Integer worldId, Integer id, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireRead(world, auth);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        return toDto(event);
    }

    @Transactional
    public EventDto createEvent(Integer worldId, CreateEventRequest req, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireEdit(world, auth);
        Integer creatorId = WorldPermissionChecker.resolveUserId(auth);

        TimelineEvent event = new TimelineEvent();
        event.setWorld(world);
        event.setTitle(req.getTitle());
        event.setDateLabel(req.getDateLabel());
        event.setTimeLabel(req.getTimeLabel());
        event.setType(req.getType());
        event.setDescription(req.getDescription());
        event.setCharacters(joinCharacters(req.getCharacters()));
        event.setSequenceOrder(null);

        if (creatorId != null) {
            User creator = userRepository.findById(creatorId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + creatorId));
            event.setCreatedBy(creator);
        }

        TimelineEvent saved = eventRepository.save(event);
        setTags(saved, req.getTags());
        return toDto(eventRepository.save(saved));
    }

    @Transactional
    public EventDto updateEvent(Integer worldId, Integer id, UpdateEventRequest req, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireEdit(world, auth);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        event.setTitle(req.getTitle());
        event.setDateLabel(req.getDateLabel());
        event.setTimeLabel(req.getTimeLabel());
        event.setType(req.getType());
        event.setDescription(req.getDescription());
        event.setCharacters(joinCharacters(req.getCharacters()));
        setTags(event, req.getTags());
        return toDto(eventRepository.save(event));
    }

    @Transactional
    public EventDto assignPosition(Integer worldId, Integer id, AssignPositionRequest req, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireEdit(world, auth);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }

        BigDecimal newOrder;
        if (req.getAfterEventId() == null) {
            Optional<TimelineEvent> first = eventRepository.findFirstByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId);
            if (first.isEmpty()) {
                newOrder = new BigDecimal("1000");
            } else {
                newOrder = first.get().getSequenceOrder().subtract(new BigDecimal("1000"));
            }
        } else {
            TimelineEvent predecessor = eventRepository.findById(req.getAfterEventId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Predecessor event not found: " + req.getAfterEventId()));
            Optional<TimelineEvent> successor = eventRepository
                    .findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(
                            worldId, predecessor.getSequenceOrder());
            if (successor.isEmpty()) {
                newOrder = predecessor.getSequenceOrder().add(new BigDecimal("1000"));
            } else {
                newOrder = predecessor.getSequenceOrder()
                        .add(successor.get().getSequenceOrder())
                        .divide(new BigDecimal("2"), 10, RoundingMode.HALF_UP);
            }
        }
        event.setSequenceOrder(newOrder);
        return toDto(eventRepository.save(event));
    }

    @Transactional
    public void unplaceEvent(Integer worldId, Integer id, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireEdit(world, auth);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        event.setSequenceOrder(null);
        eventRepository.save(event);
    }

    @Transactional
    public void deleteEvent(Integer worldId, Integer id, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireDelete(world, auth);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        eventRepository.delete(event);
    }

    private String joinCharacters(List<String> characters) {
        if (characters == null || characters.isEmpty()) return null;
        return characters.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .reduce((a, b) -> a + "," + b)
                .orElse(null);
    }

    private List<String> splitCharacters(String characters) {
        if (characters == null || characters.isBlank()) return List.of();
        return java.util.Arrays.stream(characters.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private void setTags(TimelineEvent event, List<String> tagNames) {
        event.getTags().clear();
        if (tagNames != null) {
            for (String tag : tagNames) {
                String normalized = tag.trim().toLowerCase();
                if (!normalized.isEmpty()) {
                    EventTag et = new EventTag(event, normalized);
                    event.getTags().add(et);
                }
            }
        }
    }

    // ── Epoch CRUD ──────────────────────────────────────────────────────────

    /**
     * Returns all epochs for a world, ordered by start position.
     *
     * @param worldId target world
     * @return list of epoch DTOs
     */
    @Transactional(readOnly = true)
    public List<EpochDto> getEpochs(Integer worldId) {
        return epochRepository.findAllByWorldIdOrderByStartPositionAsc(worldId)
            .stream().map(this::toEpochDto).toList();
    }

    /**
     * Creates a new epoch for the given world.
     *
     * @param worldId target world
     * @param req     validated create request
     * @param userId  authenticated user's ID
     * @return the persisted epoch as a DTO
     * @throws ResourceNotFoundException if start/end event not found
     * @throws IllegalArgumentException  if end precedes start or overlap detected
     */
    @Transactional
    public EpochDto createEpoch(Integer worldId, CreateEpochRequest req, Integer userId) {
        World world = worldRepository.findById(worldId)
            .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;

        BigDecimal[] positions = computePositions(worldId, req.startAtEventId, req.endAfterEventId);
        validateNoOverlap(worldId, -1, positions[0], positions[1]);

        TimelineEpoch epoch = new TimelineEpoch();
        epoch.setWorld(world);
        epoch.setLabel(req.label);
        epoch.setColor(req.color);
        epoch.setStartPosition(positions[0]);
        epoch.setEndPosition(positions[1]);
        epoch.setCreatedBy(user);

        return toEpochDto(epochRepository.save(epoch));
    }

    /**
     * Updates an existing epoch's label, colour, and/or boundaries.
     *
     * @param worldId target world
     * @param epochId epoch to update
     * @param req     validated update request
     * @return the updated epoch as a DTO
     * @throws ResourceNotFoundException if epoch or boundary events not found
     * @throws IllegalArgumentException  if end precedes start or overlap detected
     */
    @Transactional
    public EpochDto updateEpoch(Integer worldId, Integer epochId, UpdateEpochRequest req) {
        TimelineEpoch epoch = epochRepository.findById(epochId)
            .orElseThrow(() -> new ResourceNotFoundException("Epoch not found: " + epochId));
        if (!epoch.getWorld().getId().equals(worldId))
            throw new ResourceNotFoundException("Epoch not found in world " + worldId);

        BigDecimal[] positions = computePositions(worldId, req.startAtEventId, req.endAfterEventId);
        validateNoOverlap(worldId, epochId, positions[0], positions[1]);

        epoch.setLabel(req.label);
        epoch.setColor(req.color);
        epoch.setStartPosition(positions[0]);
        epoch.setEndPosition(positions[1]);

        return toEpochDto(epochRepository.save(epoch));
    }

    /**
     * Deletes an epoch. Events are unaffected.
     *
     * @param worldId target world
     * @param epochId epoch to delete
     * @throws ResourceNotFoundException if epoch not found in the given world
     */
    @Transactional
    public void deleteEpoch(Integer worldId, Integer epochId) {
        TimelineEpoch epoch = epochRepository.findById(epochId)
            .orElseThrow(() -> new ResourceNotFoundException("Epoch not found: " + epochId));
        if (!epoch.getWorld().getId().equals(worldId))
            throw new ResourceNotFoundException("Epoch not found in world " + worldId);
        epochRepository.delete(epoch);
    }

    /**
     * Computes start and end fence positions from the given event IDs.
     *
     * @param worldId         target world
     * @param startAtEventId  oldest event in the epoch
     * @param endAfterEventId newest event in the epoch; null = open-ended
     * @return array [startPosition, endPosition] (endPosition may be null)
     * @throws ResourceNotFoundException if an event ID is not found
     * @throws IllegalArgumentException  if end event precedes start event
     */
    private BigDecimal[] computePositions(Integer worldId,
                                          Integer startAtEventId,
                                          Integer endAfterEventId) {
        TimelineEvent startEvent = eventRepository.findById(startAtEventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + startAtEventId));

        Optional<TimelineEvent> pred = eventRepository
            .findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(
                worldId, startEvent.getSequenceOrder());
        BigDecimal startPos = pred.isPresent()
            ? startEvent.getSequenceOrder()
                  .add(pred.get().getSequenceOrder())
                  .divide(TWO, 10, RoundingMode.HALF_UP)
            : startEvent.getSequenceOrder().subtract(new BigDecimal("1000"));

        BigDecimal endPos = null;
        if (endAfterEventId != null) {
            TimelineEvent endEvent = eventRepository.findById(endAfterEventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + endAfterEventId));
            if (endEvent.getSequenceOrder().compareTo(startEvent.getSequenceOrder()) < 0)
                throw new IllegalArgumentException("Letztes Ereignis muss nach dem ersten liegen");

            Optional<TimelineEvent> succ = eventRepository
                .findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(
                    worldId, endEvent.getSequenceOrder());
            endPos = succ.isPresent()
                ? endEvent.getSequenceOrder()
                      .add(succ.get().getSequenceOrder())
                      .divide(TWO, 10, RoundingMode.HALF_UP)
                : endEvent.getSequenceOrder().add(new BigDecimal("1000"));
        }

        return new BigDecimal[]{startPos, endPos};
    }

    /**
     * Throws if any existing epoch (excluding excludeId) overlaps the given range.
     *
     * @param worldId   target world
     * @param excludeId epoch ID to exclude (use -1 for create)
     * @param start     candidate start position
     * @param end       candidate end position (null = open-ended)
     * @throws IllegalArgumentException if overlap detected
     */
    private void validateNoOverlap(Integer worldId, Integer excludeId,
                                   BigDecimal start, BigDecimal end) {
        if (epochRepository.existsOverlap(worldId, excludeId, start, end))
            throw new IllegalArgumentException("Epoche überschneidet sich mit einer bestehenden");
    }

    /** Maps a TimelineEpoch entity to its DTO. */
    private EpochDto toEpochDto(TimelineEpoch e) {
        return new EpochDto(
            e.getId(),
            e.getWorld().getId(),
            e.getLabel(),
            e.getColor(),
            e.getStartPosition(),
            e.getEndPosition(),
            e.getCreatedBy() != null ? e.getCreatedBy().getId() : null
        );
    }

    private EventDto toDto(TimelineEvent e) {
        EventDto dto = new EventDto();
        dto.setId(e.getId());
        dto.setWorldId(e.getWorld().getId());
        dto.setTitle(e.getTitle());
        dto.setDateLabel(e.getDateLabel());
        dto.setTimeLabel(e.getTimeLabel());
        dto.setSequenceOrder(e.getSequenceOrder());
        dto.setType(e.getType().name().toLowerCase());
        dto.setDescription(e.getDescription());
        if (e.getCreatedBy() != null) {
            dto.setCreatedByUserId(e.getCreatedBy().getId());
            dto.setCreatorUsername(e.getCreatedBy().getUsername());
            dto.setCreatorColorHex(e.getCreatedBy().getColorHex());
        } else {
            dto.setCreatorUsername("Anonym");
            dto.setCreatorColorHex("#888888");
        }
        dto.setTags(e.getTags().stream().map(t -> t.getId().getTagName()).toList());
        dto.setCharacters(splitCharacters(e.getCharacters()));
        dto.setCreatedAt(e.getCreatedAt());
        return dto;
    }
}
