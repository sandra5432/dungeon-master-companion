package com.pardur.service;

import com.pardur.model.EventTag;
import com.pardur.model.TimelineEvent;
import com.pardur.repository.TimelineEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

class ChronicleExportServiceTest {

    TimelineEventRepository eventRepo;
    ChronicleExportService service;

    @BeforeEach
    void setUp() {
        eventRepo = mock(TimelineEventRepository.class);
        service   = new ChronicleExportService(eventRepo);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(anyInt()))
                .thenReturn(List.of());
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(anyInt()))
                .thenReturn(List.of());
    }

    @Test
    void returnsNull_whenWorldHasNoEvents() {
        assertThat(service.buildChronicleMarkdown(1)).isNull();
    }

    @Test
    void includesH2HeaderWithDateAndTitle() {
        TimelineEvent e = buildEvent(1, "Der Große Krieg", "5. Mond", null, null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(1))
                .thenReturn(List.of(e));

        assertThat(service.buildChronicleMarkdown(1)).contains("## 5. Mond Der Große Krieg\n");
    }

    @Test
    void includesH2HeaderWithTitleOnly_whenNoDateLabel() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, null, null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        String md = service.buildChronicleMarkdown(1);
        assertThat(md).contains("## Sturmfall\n");
        assertThat(md).doesNotContain("null");
    }

    @Test
    void includesDescription() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, "Die Stadt fiel.", null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        assertThat(service.buildChronicleMarkdown(1)).contains("Die Stadt fiel.");
    }

    @Test
    void omitsDescriptionLine_whenBlank() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, "   ", null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        // Only the header and the trailing blank line; no stray whitespace content line
        String md = service.buildChronicleMarkdown(1);
        assertThat(md.trim()).isEqualTo("## Sturmfall");
    }

    @Test
    void includesCharacters() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, null, "Odin, Thor");
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        assertThat(service.buildChronicleMarkdown(1)).contains("Beteiligte Charaktere: Odin, Thor");
    }

    @Test
    void omitsCharactersLine_whenBlank() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, null, "  ");
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        assertThat(service.buildChronicleMarkdown(1)).doesNotContain("Beteiligte Charaktere");
    }

    @Test
    void includesTags_sortedAlphabetically() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, null, null);
        e.getTags().add(new EventTag(e, "krieg"));
        e.getTags().add(new EventTag(e, "abenteuer"));
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        assertThat(service.buildChronicleMarkdown(1)).contains("Tags: abenteuer, krieg");
    }

    @Test
    void omitsTagsLine_whenNone() {
        TimelineEvent e = buildEvent(1, "Sturmfall", null, null, null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(e));

        assertThat(service.buildChronicleMarkdown(1)).doesNotContain("Tags:");
    }

    @Test
    void separatesEventsWithBlankLine() {
        TimelineEvent a = buildEvent(1, "Erstes",  null, null, null);
        TimelineEvent b = buildEvent(2, "Zweites", null, null, null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(1))
                .thenReturn(List.of(a, b));

        String md = service.buildChronicleMarkdown(1);
        assertThat(md).contains("## Erstes\n\n## Zweites");
    }

    @Test
    void orderedEventsPrecedeUnorderedEvents() {
        TimelineEvent ordered   = buildEvent(1, "Erster",  null, null, null);
        TimelineEvent unordered = buildEvent(2, "Später", null, null, null);
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(1))
                .thenReturn(List.of(ordered));
        when(eventRepo.findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(1))
                .thenReturn(List.of(unordered));

        String md = service.buildChronicleMarkdown(1);
        assertThat(md.indexOf("## Erster")).isLessThan(md.indexOf("## Später"));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private TimelineEvent buildEvent(int id, String title, String dateLabel,
                                     String description, String characters) {
        TimelineEvent e = new TimelineEvent();
        setId(e, id);
        e.setTitle(title);
        e.setDateLabel(dateLabel);
        e.setDescription(description);
        e.setCharacters(characters);
        return e;
    }

    private void setId(TimelineEvent e, int id) {
        try {
            var f = TimelineEvent.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(e, id);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }
}
