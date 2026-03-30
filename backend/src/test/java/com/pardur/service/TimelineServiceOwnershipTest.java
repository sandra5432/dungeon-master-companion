package com.pardur.service;

import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TimelineServiceOwnershipTest {

    @Mock private TimelineEventRepository eventRepository;
    @Mock private EventTagRepository eventTagRepository;
    @Mock private WorldRepository worldRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private TimelineService timelineService;

    private World world;
    private User owner;
    private User otherUser;
    private TimelineEvent event;

    @BeforeEach
    void setUp() {
        world = new World();
        setId(world, 1);

        owner = new User();
        setId(owner, 10);
        owner.setUsername("owner");

        otherUser = new User();
        setId(otherUser, 20);
        otherUser.setUsername("other");

        event = new TimelineEvent();
        setId(event, 100);
        event.setWorld(world);
        event.setCreatedBy(owner);
        event.setTitle("Test Event");
        event.setType(EventType.WORLD);

        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(100)).thenReturn(Optional.of(event));
    }

    @Test
    void updateEvent_userCanEditOwnEvent() {
        UpdateEventRequest req = updateReq();
        when(eventRepository.save(event)).thenReturn(event);

        assertThatCode(() -> timelineService.updateEvent(1, 100, req, 10, false))
                .doesNotThrowAnyException();
    }

    @Test
    void updateEvent_userCannotEditOtherUsersEvent() {
        UpdateEventRequest req = updateReq();

        assertThatThrownBy(() -> timelineService.updateEvent(1, 100, req, 20, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Not your event");
    }

    @Test
    void updateEvent_adminCanEditAnyEvent() {
        UpdateEventRequest req = updateReq();
        when(eventRepository.save(event)).thenReturn(event);

        // admin=true, userId=20 (not the owner) — should still succeed
        assertThatCode(() -> timelineService.updateEvent(1, 100, req, 20, true))
                .doesNotThrowAnyException();
    }

    @Test
    void deleteEvent_userCannotDeleteOtherUsersEvent() {
        assertThatThrownBy(() -> timelineService.deleteEvent(1, 100, 20, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Not your event");
    }

    @Test
    void deleteEvent_adminCanDeleteAnyEvent() {
        assertThatCode(() -> timelineService.deleteEvent(1, 100, 20, true))
                .doesNotThrowAnyException();
        verify(eventRepository).delete(event);
    }

    @Test
    void updateEvent_nullOwner_userCannotEdit() {
        event.setCreatedBy(null);

        assertThatThrownBy(() -> timelineService.updateEvent(1, 100, updateReq(), 10, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Not your event");
    }

    // helpers

    private UpdateEventRequest updateReq() {
        UpdateEventRequest req = new UpdateEventRequest();
        req.setTitle("Updated");
        req.setType(EventType.WORLD);
        return req;
    }

    @SuppressWarnings("unchecked")
    private <T> void setId(T entity, int id) {
        try {
            var field = entity.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
