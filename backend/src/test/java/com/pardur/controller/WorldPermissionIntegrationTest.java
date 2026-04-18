package com.pardur.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests verifying that world-level guest/user permission flags
 * are enforced end-to-end through the full Spring MVC stack.
 *
 * Each test creates its own world with specific permission flags so that
 * scenarios are self-contained and independent of import.sql seed data.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class WorldPermissionIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired WorldRepository worldRepo;
    @Autowired WikiEntryRepository wikiRepo;
    @Autowired PoiTypeRepository poiTypeRepo;

    private World openWorld;   // guest: read+edit+delete
    private World readWorld;   // guest: read only
    private World closedWorld; // guest: nothing

    @BeforeEach
    void setUp() {
        openWorld   = worldRepo.save(world("Open",   true,  true,  true));
        readWorld   = worldRepo.save(world("Read",   true,  false, false));
        closedWorld = worldRepo.save(world("Closed", false, false, false));
    }

    // ── Timeline events ───────────────────────────────────────────────────────

    @Test
    void getEvents_guest_200_whenGuestCanRead() throws Exception {
        mvc.perform(get("/api/worlds/" + openWorld.getId() + "/events"))
                .andExpect(status().isOk());
    }

    @Test
    void getEvents_guest_200_whenGuestCanReadOnly() throws Exception {
        mvc.perform(get("/api/worlds/" + readWorld.getId() + "/events"))
                .andExpect(status().isOk());
    }

    @Test
    void getEvents_guest_403_whenWorldClosed() throws Exception {
        mvc.perform(get("/api/worlds/" + closedWorld.getId() + "/events"))
                .andExpect(status().isForbidden());
    }

    @Test
    void createEvent_guest_201_whenGuestCanEdit() throws Exception {
        String body = mapper.writeValueAsString(Map.of("title", "Gastereignis", "type", "WORLD"));
        mvc.perform(post("/api/worlds/" + openWorld.getId() + "/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void createEvent_guest_403_whenGuestReadOnly() throws Exception {
        String body = mapper.writeValueAsString(Map.of("title", "Gastereignis", "type", "WORLD"));
        mvc.perform(post("/api/worlds/" + readWorld.getId() + "/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void createEvent_guest_403_whenWorldClosed() throws Exception {
        String body = mapper.writeValueAsString(Map.of("title", "Gastereignis", "type", "WORLD"));
        mvc.perform(post("/api/worlds/" + closedWorld.getId() + "/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void createEvent_loggedInUser_201_whenUserCanEdit() throws Exception {
        String body = mapper.writeValueAsString(Map.of("title", "Userereignis", "type", "WORLD"));
        mvc.perform(post("/api/worlds/" + openWorld.getId() + "/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    // ── Wiki entries ──────────────────────────────────────────────────────────

    @Test
    void listWiki_guest_200_whenGuestCanRead() throws Exception {
        mvc.perform(get("/api/wiki").param("worldId", String.valueOf(openWorld.getId())))
                .andExpect(status().isOk());
    }

    @Test
    void listWiki_guest_403_whenWorldClosed() throws Exception {
        mvc.perform(get("/api/wiki").param("worldId", String.valueOf(closedWorld.getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void createWikiEntry_guest_201_whenGuestCanEdit() throws Exception {
        var req = Map.of("title", "Gastseitentitel", "worldId", openWorld.getId(), "type", "TERM");
        mvc.perform(post("/api/wiki")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isCreated());
    }

    @Test
    void createWikiEntry_guest_403_whenGuestReadOnly() throws Exception {
        var req = Map.of("title", "Gastseitentitel", "worldId", readWorld.getId(), "type", "TERM");
        mvc.perform(post("/api/wiki")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    void createWikiEntry_guest_403_whenWorldClosed() throws Exception {
        var req = Map.of("title", "Gastseitentitel", "worldId", closedWorld.getId(), "type", "TERM");
        mvc.perform(post("/api/wiki")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteWikiEntry_guest_204_whenGuestCanDelete() throws Exception {
        WikiEntry entry = wikiEntry("Löschbar", openWorld);
        mvc.perform(delete("/api/wiki/" + entry.getId()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteWikiEntry_guest_403_whenGuestReadOnly() throws Exception {
        WikiEntry entry = wikiEntry("NichtLöschbar", readWorld);
        mvc.perform(delete("/api/wiki/" + entry.getId()))
                .andExpect(status().isForbidden());
    }

    // ── Map POIs ──────────────────────────────────────────────────────────────

    @Test
    void listPois_guest_200_whenGuestCanRead() throws Exception {
        mvc.perform(get("/api/worlds/" + openWorld.getId() + "/map/pois"))
                .andExpect(status().isOk());
    }

    @Test
    void listPois_guest_403_whenWorldClosed() throws Exception {
        mvc.perform(get("/api/worlds/" + closedWorld.getId() + "/map/pois"))
                .andExpect(status().isForbidden());
    }

    @Test
    void getWorlds_guest_returnsOnlyReadableWorlds() throws Exception {
        String json = mvc.perform(get("/api/worlds"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(json).doesNotContain(closedWorld.getName());
        org.assertj.core.api.Assertions.assertThat(json).contains(openWorld.getName());
        org.assertj.core.api.Assertions.assertThat(json).contains(readWorld.getName());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private World world(String name, boolean canRead, boolean canEdit, boolean canDelete) {
        World w = new World();
        w.setName(name + "_" + System.nanoTime());
        w.setGuestCanRead(canRead);
        w.setGuestCanEdit(canEdit);
        w.setGuestCanDelete(canDelete);
        w.setUserCanRead(true);
        w.setUserCanEdit(true);
        w.setUserCanDelete(true);
        return w;
    }

    private WikiEntry wikiEntry(String title, World w) {
        WikiEntry e = new WikiEntry();
        e.setTitle(title + "_" + System.nanoTime());
        e.setWorld(w);
        e.setType(WikiEntryType.TERM);
        return wikiRepo.save(e);
    }
}
