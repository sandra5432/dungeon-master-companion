package com.pardur.service;

import com.pardur.model.World;
import com.pardur.security.PardurUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WorldPermissionCheckerTest {

    private final WorldPermissionChecker checker = new WorldPermissionChecker();

    private World world(boolean gR, boolean gE, boolean gD, boolean uR, boolean uE, boolean uD) {
        World w = new World();
        w.setGuestCanRead(gR); w.setGuestCanEdit(gE); w.setGuestCanDelete(gD);
        w.setUserCanRead(uR);  w.setUserCanEdit(uE);  w.setUserCanDelete(uD);
        return w;
    }

    private Authentication admin() {
        PardurUserDetails d = new PardurUserDetails(1, "admin", "", "ADMIN", "#fff", false,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return new UsernamePasswordAuthenticationToken(d, null, d.getAuthorities());
    }

    private Authentication user() {
        PardurUserDetails d = new PardurUserDetails(2, "user", "", "USER", "#fff", false,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(d, null, d.getAuthorities());
    }

    private Authentication guest() {
        return new AnonymousAuthenticationToken("key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
    }

    // --- admin bypasses all ---

    @Test void admin_can_read_locked_world() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,false,false,false,false), admin()));
    }

    @Test void admin_can_edit_locked_world() {
        assertDoesNotThrow(() -> checker.requireEdit(world(false,false,false,false,false,false), admin()));
    }

    @Test void admin_can_delete_locked_world() {
        assertDoesNotThrow(() -> checker.requireDelete(world(false,false,false,false,false,false), admin()));
    }

    // --- guest permission checks ---

    @Test void guest_blocked_when_no_guest_permissions() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireRead(world(false,false,false,true,true,true), guest()));
    }

    @Test void guest_can_read_when_guest_read_true() {
        assertDoesNotThrow(() -> checker.requireRead(world(true,false,false,true,true,true), guest()));
    }

    @Test void guest_edit_implies_read() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,true,false,true,true,true), guest()));
    }

    @Test void guest_delete_implies_read() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,true,true,true,true), guest()));
    }

    @Test void guest_cannot_edit_without_guest_edit() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireEdit(world(true,false,false,true,true,true), guest()));
    }

    @Test void guest_can_edit_when_guest_edit_true() {
        assertDoesNotThrow(() -> checker.requireEdit(world(false,true,false,true,true,true), guest()));
    }

    @Test void guest_cannot_delete_without_guest_delete() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireDelete(world(true,true,false,true,true,true), guest()));
    }

    @Test void guest_can_delete_when_guest_delete_true() {
        assertDoesNotThrow(() -> checker.requireDelete(world(false,false,true,true,true,true), guest()));
    }

    // --- null auth treated as guest ---

    @Test void null_auth_blocked_on_locked_world() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireRead(world(false,false,false,true,true,true), null));
    }

    @Test void null_auth_can_read_when_guest_read_true() {
        assertDoesNotThrow(() -> checker.requireRead(world(true,false,false,true,true,true), null));
    }

    // --- user permission checks ---

    @Test void user_blocked_when_user_read_false() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireRead(world(false,false,false,false,false,false), user()));
    }

    @Test void user_can_read_when_user_read_true() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,false,true,false,false), user()));
    }

    @Test void user_edit_implies_read() {
        assertDoesNotThrow(() -> checker.requireRead(world(false,false,false,false,true,false), user()));
    }

    @Test void user_cannot_edit_without_user_edit() {
        assertThrows(ResponseStatusException.class,
                () -> checker.requireEdit(world(false,false,false,true,false,false), user()));
    }

    @Test void user_can_edit_when_user_edit_true() {
        assertDoesNotThrow(() -> checker.requireEdit(world(false,false,false,false,true,false), user()));
    }

    // --- canRead boolean variant ---

    @Test void canRead_returns_false_for_locked_guest() {
        assertFalse(checker.canRead(world(false,false,false,true,true,true), guest()));
    }

    @Test void canRead_returns_true_for_admin_on_locked_world() {
        assertTrue(checker.canRead(world(false,false,false,false,false,false), admin()));
    }
}
