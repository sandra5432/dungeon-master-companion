package com.pardur.service;

import com.pardur.model.World;
import com.pardur.security.PardurUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Centralises world-level access decisions for read, edit, and delete actions.
 * Admin users bypass all checks. Authenticated non-admin users are checked against
 * user_can_* flags; unauthenticated callers against guest_can_* flags.
 */
@Component
public class WorldPermissionChecker {

    /**
     * Throws 403 if the caller cannot read content in the given world.
     * Edit or delete permission implicitly grants read.
     */
    public void requireRead(World world, Authentication auth) {
        if (isAdmin(auth)) return;
        boolean ok = isAuthenticated(auth)
                ? (world.isUserCanRead() || world.isUserCanEdit() || world.isUserCanDelete())
                : (world.isGuestCanRead() || world.isGuestCanEdit() || world.isGuestCanDelete());
        if (!ok) deny();
    }

    /**
     * Throws 403 if the caller cannot create or modify content in the given world.
     */
    public void requireEdit(World world, Authentication auth) {
        if (isAdmin(auth)) return;
        boolean ok = isAuthenticated(auth) ? world.isUserCanEdit() : world.isGuestCanEdit();
        if (!ok) deny();
    }

    /**
     * Throws 403 if the caller cannot delete content in the given world.
     */
    public void requireDelete(World world, Authentication auth) {
        if (isAdmin(auth)) return;
        boolean ok = isAuthenticated(auth) ? world.isUserCanDelete() : world.isGuestCanDelete();
        if (!ok) deny();
    }

    /**
     * Returns true if the caller can read content in the given world (non-throwing variant for filtering).
     */
    public boolean canRead(World world, Authentication auth) {
        if (isAdmin(auth)) return true;
        return isAuthenticated(auth)
                ? (world.isUserCanRead() || world.isUserCanEdit() || world.isUserCanDelete())
                : (world.isGuestCanRead() || world.isGuestCanEdit() || world.isGuestCanDelete());
    }

    /** Returns true if auth represents a fully authenticated non-anonymous principal. */
    public static boolean isAuthenticated(Authentication auth) {
        return auth != null && auth.isAuthenticated()
                && auth.getPrincipal() instanceof PardurUserDetails;
    }

    /** Returns true if the authenticated principal has the ADMIN role. */
    public static boolean isAdmin(Authentication auth) {
        if (!isAuthenticated(auth)) return false;
        return "ADMIN".equals(((PardurUserDetails) auth.getPrincipal()).getRole());
    }

    /**
     * Extracts the user ID from an authenticated principal; returns null for guests.
     */
    public static Integer resolveUserId(Authentication auth) {
        if (!isAuthenticated(auth)) return null;
        return ((PardurUserDetails) auth.getPrincipal()).getUserId();
    }

    private void deny() {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }
}
