package com.pardur.service;

import com.pardur.dto.request.CreateEpochRequest;
import com.pardur.dto.request.UpdateEpochRequest;
import com.pardur.dto.response.EpochDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TimelineEpochServiceTest {

    TimelineEventRepository    eventRepository  = mock(TimelineEventRepository.class);
    EventTagRepository         tagRepository    = mock(EventTagRepository.class);
    WorldRepository            worldRepository  = mock(WorldRepository.class);
    UserRepository             userRepository   = mock(UserRepository.class);
    WorldPermissionChecker     checker          = mock(WorldPermissionChecker.class);
    TimelineEpochRepository    epochRepository  = mock(TimelineEpochRepository.class);

    TimelineService service;

    World world;
    TimelineEvent ev1, ev2, ev3;

    @BeforeEach
    void setup() throws Exception {
        service = new TimelineService(eventRepository, tagRepository, worldRepository,
                                      userRepository, checker, epochRepository);

        world = new World(); setId(world, World.class, 1);

        ev1 = new TimelineEvent(); setId(ev1, TimelineEvent.class, 10);
        ev1.setWorld(world); ev1.setSequenceOrder(new BigDecimal("1000"));

        ev2 = new TimelineEvent(); setId(ev2, TimelineEvent.class, 20);
        ev2.setWorld(world); ev2.setSequenceOrder(new BigDecimal("2000"));

        ev3 = new TimelineEvent(); setId(ev3, TimelineEvent.class, 30);
        ev3.setWorld(world); ev3.setSequenceOrder(new BigDecimal("3000"));
    }

    @Test
    void getEpochs_returnsEpochsOrderedByStartPosition() {
        TimelineEpoch ep = buildEpoch(1, world, "Test", "#c8a84b",
                                      new BigDecimal("500"), new BigDecimal("1500"));
        when(epochRepository.findAllByWorldIdOrderByStartPositionAsc(1)).thenReturn(List.of(ep));

        List<EpochDto> result = service.getEpochs(1);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).label).isEqualTo("Test");
    }

    @Test
    void createEpoch_computesPositionsAndPersists() {
        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(10)).thenReturn(Optional.of(ev1));
        when(eventRepository.findById(20)).thenReturn(Optional.of(ev2));
        when(eventRepository.findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(1, new BigDecimal("1000")))
            .thenReturn(Optional.empty());
        when(eventRepository.findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(1, new BigDecimal("2000")))
            .thenReturn(Optional.of(ev3));
        when(epochRepository.existsOverlap(eq(1), eq(-1), any(), any())).thenReturn(false);
        TimelineEpoch saved = buildEpoch(99, world, "Era", "#3c6fa8",
                                         new BigDecimal("0"), new BigDecimal("2500"));
        when(epochRepository.save(any())).thenReturn(saved);

        CreateEpochRequest req = new CreateEpochRequest();
        req.label = "Era"; req.color = "#3c6fa8";
        req.startAtEventId = 10; req.endAfterEventId = 20;

        EpochDto dto = service.createEpoch(1, req, null);

        assertThat(dto.id).isEqualTo(99);
        verify(epochRepository).save(any(TimelineEpoch.class));
    }

    @Test
    void createEpoch_openEnded_setsNullEndPosition() {
        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(10)).thenReturn(Optional.of(ev1));
        when(eventRepository.findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(1, new BigDecimal("1000")))
            .thenReturn(Optional.empty());
        when(epochRepository.existsOverlap(eq(1), eq(-1), any(), isNull())).thenReturn(false);
        TimelineEpoch saved = buildEpoch(1, world, "Open", "#4a9b6f", new BigDecimal("0"), null);
        when(epochRepository.save(any())).thenReturn(saved);

        CreateEpochRequest req = new CreateEpochRequest();
        req.label = "Open"; req.color = "#4a9b6f";
        req.startAtEventId = 10; req.endAfterEventId = null;

        EpochDto dto = service.createEpoch(1, req, null);
        assertThat(dto.endPosition).isNull();
    }

    @Test
    void createEpoch_throwsWhenEndPrecedesStart() {
        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(20)).thenReturn(Optional.of(ev2)); // start = seq 2000
        when(eventRepository.findById(10)).thenReturn(Optional.of(ev1)); // end   = seq 1000
        when(eventRepository.findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(1, new BigDecimal("2000")))
            .thenReturn(Optional.empty());
        when(epochRepository.existsOverlap(any(), any(), any(), any())).thenReturn(false);

        CreateEpochRequest req = new CreateEpochRequest();
        req.label = "Bad"; req.color = "#c8a84b";
        req.startAtEventId = 20; req.endAfterEventId = 10;

        assertThatThrownBy(() -> service.createEpoch(1, req, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Letztes Ereignis muss nach dem ersten liegen");
    }

    @Test
    void createEpoch_throwsWhenOverlapDetected() {
        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(10)).thenReturn(Optional.of(ev1));
        when(eventRepository.findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(1, new BigDecimal("1000")))
            .thenReturn(Optional.empty());
        when(epochRepository.existsOverlap(eq(1), eq(-1), any(), isNull())).thenReturn(true);

        CreateEpochRequest req = new CreateEpochRequest();
        req.label = "Clash"; req.color = "#c8a84b";
        req.startAtEventId = 10; req.endAfterEventId = null;

        assertThatThrownBy(() -> service.createEpoch(1, req, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("überschneidet");
    }

    @Test
    void deleteEpoch_removesEpoch() {
        TimelineEpoch ep = buildEpoch(5, world, "Del", "#c8a84b", BigDecimal.ONE, BigDecimal.TEN);
        when(epochRepository.findById(5)).thenReturn(Optional.of(ep));

        service.deleteEpoch(1, 5);

        verify(epochRepository).delete(ep);
    }

    @Test
    void deleteEpoch_throwsWhenEpochBelongsToDifferentWorld() {
        World other = new World(); setIdSilent(other, World.class, 99);
        TimelineEpoch ep = buildEpoch(5, other, "Other", "#c8a84b", BigDecimal.ONE, BigDecimal.TEN);
        when(epochRepository.findById(5)).thenReturn(Optional.of(ep));

        assertThatThrownBy(() -> service.deleteEpoch(1, 5))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private TimelineEpoch buildEpoch(int id, World w, String label, String color,
                                     BigDecimal start, BigDecimal end) {
        TimelineEpoch ep = new TimelineEpoch();
        ep.setWorld(w); ep.setLabel(label); ep.setColor(color);
        ep.setStartPosition(start); ep.setEndPosition(end);
        setIdSilent(ep, TimelineEpoch.class, id);
        return ep;
    }

    private <T> void setId(T obj, Class<T> cls, int id) throws Exception {
        var f = cls.getDeclaredField("id");
        f.setAccessible(true); f.set(obj, id);
    }

    private <T> void setIdSilent(T obj, Class<T> cls, int id) {
        try { setId(obj, cls, id); } catch (Exception ignored) {}
    }
}
