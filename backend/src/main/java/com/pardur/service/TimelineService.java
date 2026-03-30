package com.pardur.service;

import com.pardur.dto.request.AssignPositionRequest;
import com.pardur.dto.request.CreateEventRequest;
import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.dto.response.EventDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
public class TimelineService {

    private final TimelineEventRepository eventRepository;
    private final EventTagRepository eventTagRepository;
    private final WorldRepository worldRepository;
    private final CreatorRepository creatorRepository;

    public TimelineService(TimelineEventRepository eventRepository,
                           EventTagRepository eventTagRepository,
                           WorldRepository worldRepository,
                           CreatorRepository creatorRepository) {
        this.eventRepository = eventRepository;
        this.eventTagRepository = eventTagRepository;
        this.worldRepository = worldRepository;
        this.creatorRepository = creatorRepository;
    }

    private Creator resolveCreator(String code) {
        return creatorRepository.findById(code).orElseGet(() -> {
            Creator c = new Creator();
            c.setCode(code);
            c.setFullName(code);
            return creatorRepository.save(c);
        });
    }

    private World requireWorld(Integer worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + worldId));
    }

    @Transactional(readOnly = true)
    public List<EventDto> getPositionedEvents(Integer worldId) {
        requireWorld(worldId);
        return eventRepository.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<EventDto> getUnpositionedEvents(Integer worldId) {
        requireWorld(worldId);
        return eventRepository.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TagCountDto> getTagCounts(Integer worldId) {
        requireWorld(worldId);
        return eventTagRepository.findTagCountsByWorldId(worldId);
    }

    @Transactional(readOnly = true)
    public EventDto getEvent(Integer worldId, Integer id) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        return toDto(event);
    }

    @Transactional
    public EventDto createEvent(Integer worldId, CreateEventRequest req) {
        World world = requireWorld(worldId);
        Creator creator = resolveCreator(req.getCreatorCode());

        TimelineEvent event = new TimelineEvent();
        event.setWorld(world);
        event.setTitle(req.getTitle());
        event.setDateLabel(req.getDateLabel());
        event.setTimeLabel(req.getTimeLabel());
        event.setType(req.getType());
        event.setDescription(req.getDescription());
        event.setCharacters(joinCharacters(req.getCharacters()));
        event.setCreator(creator);
        event.setSequenceOrder(null);

        TimelineEvent saved = eventRepository.save(event);
        setTags(saved, req.getTags());
        return toDto(eventRepository.save(saved));
    }

    @Transactional
    public EventDto updateEvent(Integer worldId, Integer id, UpdateEventRequest req) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }
        Creator creator = resolveCreator(req.getCreatorCode());

        event.setTitle(req.getTitle());
        event.setDateLabel(req.getDateLabel());
        event.setTimeLabel(req.getTimeLabel());
        event.setType(req.getType());
        event.setDescription(req.getDescription());
        event.setCharacters(joinCharacters(req.getCharacters()));
        event.setCreator(creator);
        setTags(event, req.getTags());
        return toDto(eventRepository.save(event));
    }

    @Transactional
    public EventDto assignPosition(Integer worldId, Integer id, AssignPositionRequest req) {
        requireWorld(worldId);
        TimelineEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + id));
        if (!event.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Event " + id + " does not belong to world " + worldId);
        }

        BigDecimal newOrder;

        if (req.getAfterEventId() == null) {
            Optional<TimelineEvent> first = eventRepository.findFirstByWorldIdOrderBySequenceOrderAsc(worldId);
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
    public void deleteEvent(Integer worldId, Integer id) {
        requireWorld(worldId);
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
        dto.setCreatorCode(e.getCreator().getCode());
        dto.setCreatorName(e.getCreator().getFullName());
        dto.setCreatorColor(e.getCreator().getColorHex());
        dto.setTags(e.getTags().stream().map(t -> t.getId().getTagName()).toList());
        dto.setCharacters(splitCharacters(e.getCharacters()));
        dto.setCreatedAt(e.getCreatedAt());
        return dto;
    }
}
