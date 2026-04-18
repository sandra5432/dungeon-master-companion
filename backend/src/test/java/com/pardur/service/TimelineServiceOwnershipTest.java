package com.pardur.service;

import com.pardur.dto.request.UpdateEventRequest;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import com.pardur.security.PardurUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

/**
 * Verifies that world-level permissions gate timeline event mutations.
 * Ownership checks were removed in favour of world permission flags.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TimelineServiceOwnershipTest {

    @Mock private TimelineEventRepository eventRepository;
    @Mock private EventTagRepository eventTagRepository;
    @Mock private WorldRepository worldRepository;
    @Mock private UserRepository userRepository;
    @Mock private WorldPermissionChecker checker;

    private TimelineService timelineService;

    private World world;
    private User owner;
    private TimelineEvent event;

    @BeforeEach
    void setUp() {
        timelineService = new TimelineService(eventRepository, eventTagRepository,
                worldRepository, userRepository, checker);

        world = new World();
        world.setUserCanEdit(true);
        world.setUserCanDelete(true);
        world.setUserCanRead(true);
        setId(world, 1);

        owner = new User();
        setId(owner, 10);
        owner.setUsername("owner");

        event = new TimelineEvent();
        setId(event, 100);
        event.setWorld(world);
        event.setCreatedBy(owner);
        event.setTitle("Test Event");
        event.setType(EventType.WORLD);

        when(worldRepository.findById(1)).thenReturn(Optional.of(world));
        when(eventRepository.findById(100)).thenReturn(Optional.of(event));
    }

    private Authentication userAuth(int userId) {
        PardurUserDetails d = new PardurUserDetails(userId, "user" + userId, "", "USER", "#fff", false,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(d, null, d.getAuthorities());
    }

    private Authentication adminAuth() {
        PardurUserDetails d = new PardurUserDetails(99, "admin", "", "ADMIN", "#fff", false,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return new UsernamePasswordAuthenticationToken(d, null, d.getAuthorities());
    }

    @Test
    void updateEvent_userCanEditAnyEventWhenWorldAllows() {
        Authentication auth = userAuth(20); // not the owner
        UpdateEventRequest req = updateReq();
        when(eventRepository.save(event)).thenReturn(event);
        // checker.requireEdit passes (no exception)

        assertThatCode(() -> timelineService.updateEvent(1, 100, req, auth))
                .doesNotThrowAnyException();
        verify(checker).requireEdit(world, auth);
    }

    @Test
    void updateEvent_blockedWhenWorldDeniesEdit() {
        Authentication auth = userAuth(10);
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Access denied"))
                .when(checker).requireEdit(world, auth);

        assertThatThrownBy(() -> timelineService.updateEvent(1, 100, updateReq(), auth))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void updateEvent_adminCanEditAnyEvent() {
        Authentication auth = adminAuth();
        UpdateEventRequest req = updateReq();
        when(eventRepository.save(event)).thenReturn(event);

        assertThatCode(() -> timelineService.updateEvent(1, 100, req, auth))
                .doesNotThrowAnyException();
        verify(checker).requireEdit(world, auth);
    }

    @Test
    void deleteEvent_userCanDeleteAnyEventWhenWorldAllows() {
        Authentication auth = userAuth(20); // not the owner

        assertThatCode(() -> timelineService.deleteEvent(1, 100, auth))
                .doesNotThrowAnyException();
        verify(checker).requireDelete(world, auth);
        verify(eventRepository).delete(event);
    }

    @Test
    void deleteEvent_blockedWhenWorldDeniesDelete() {
        Authentication auth = userAuth(20);
        doThrow(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Access denied"))
                .when(checker).requireDelete(world, auth);

        assertThatThrownBy(() -> timelineService.deleteEvent(1, 100, auth))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void deleteEvent_adminCanDeleteAnyEvent() {
        Authentication auth = adminAuth();

        assertThatCode(() -> timelineService.deleteEvent(1, 100, auth))
                .doesNotThrowAnyException();
        verify(eventRepository).delete(event);
    }

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
