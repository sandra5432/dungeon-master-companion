package com.pardur.service;

import com.pardur.model.EventTag;
import com.pardur.model.TimelineEvent;
import com.pardur.repository.TimelineEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Builds a Markdown chronicle from a world's timeline events, sorted by sequence order.
 */
@Service
public class ChronicleExportService {

    private final TimelineEventRepository timelineEventRepository;

    public ChronicleExportService(TimelineEventRepository timelineEventRepository) {
        this.timelineEventRepository = timelineEventRepository;
    }

    /**
     * Generates the {@code chronic.md} content for the given world.
     * Events are ordered by sequence order, with unsequenced events appended at the end.
     *
     * @param worldId target world ID
     * @return Markdown string, or {@code null} if the world has no timeline events
     */
    @Transactional(readOnly = true)
    public String buildChronicleMarkdown(Integer worldId) {
        List<TimelineEvent> ordered = timelineEventRepository
                .findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(worldId);
        List<TimelineEvent> unordered = timelineEventRepository
                .findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(worldId);

        List<TimelineEvent> all = new ArrayList<>(ordered);
        all.addAll(unordered);

        if (all.isEmpty()) {
            return null;
        }

        StringBuilder sb = new StringBuilder();
        for (TimelineEvent event : all) {
            appendEvent(sb, event);
        }
        return sb.toString();
    }

    // ── private ───────────────────────────────────────────────────────────────

    private void appendEvent(StringBuilder sb, TimelineEvent event) {
        sb.append("## ");
        if (event.getDateLabel() != null && !event.getDateLabel().isBlank()) {
            sb.append(event.getDateLabel()).append(" ");
        }
        sb.append(event.getTitle()).append("\n");

        if (event.getDescription() != null && !event.getDescription().isBlank()) {
            sb.append(event.getDescription()).append("\n");
        }

        if (event.getCharacters() != null && !event.getCharacters().isBlank()) {
            sb.append("Beteiligte Charaktere: ").append(event.getCharacters()).append("\n");
        }

        List<String> tagNames = event.getTags().stream()
                .map(t -> t.getId().getTagName())
                .sorted()
                .collect(Collectors.toList());
        if (!tagNames.isEmpty()) {
            sb.append("Tags: ").append(String.join(", ", tagNames)).append("\n");
        }

        sb.append("\n");
    }
}
