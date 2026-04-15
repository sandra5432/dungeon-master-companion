package com.pardur.controller;

import com.pardur.model.User;
import com.pardur.model.WikiEntry;
import com.pardur.model.WikiEntryType;
import com.pardur.model.World;
import com.pardur.repository.UserRepository;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ExportControllerTest {

    @Autowired MockMvc mvc;
    @Autowired WorldRepository worldRepository;
    @Autowired WikiEntryRepository wikiEntryRepository;
    @Autowired UserRepository userRepository;
    @Autowired BCryptPasswordEncoder passwordEncoder;

    World testWorld;
    User adminUser;

    @BeforeEach
    void setUp() {
        User u = new User();
        u.setUsername("export-admin-" + System.nanoTime());
        u.setPassword(passwordEncoder.encode("export-pass"));
        u.setRole("ADMIN");
        adminUser = userRepository.save(u);

        World w = new World();
        w.setName("ExportTestWorld-" + System.nanoTime());
        testWorld = worldRepository.save(w);
    }

    @AfterEach
    void tearDown() {
        if (testWorld != null) {
            wikiEntryRepository.deleteAll(
                    wikiEntryRepository.findAllByWorldIdOrderByTitleAsc(testWorld.getId()));
            worldRepository.delete(testWorld);
        }
        if (adminUser != null) {
            userRepository.delete(adminUser);
        }
    }

    // ── auth / error cases ────────────────────────────────────────────────────

    @Test
    void exportWiki_returns4xx_whenUnauthenticated() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void exportWiki_returns403_whenNonAdmin() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_returns404_whenWorldNotFound() throws Exception {
        mvc.perform(get("/api/export/worlds/999999/wiki"))
                .andExpect(status().isNotFound());
    }

    // ── ZIP content tests ─────────────────────────────────────────────────────

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_returnsValidEmptyZip_whenWorldHasNoEntries() throws Exception {
        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/zip"))
                .andReturn();

        assertThat(readZip(result)).isEmpty();
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_flatEntries_appearAtZipRoot() throws Exception {
        saveEntry("Odin", null);
        saveEntry("Thor", null);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(readZip(result).keySet()).containsExactlyInAnyOrder("odin.md", "thor.md");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_parentWithChildren_usesFolder() throws Exception {
        WikiEntry gods = saveEntry("Gods", null);
        saveEntry("Odin", gods);
        saveEntry("Thor", gods);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(readZip(result).keySet())
                .containsExactlyInAnyOrder("gods/gods.md", "gods/odin.md", "gods/thor.md");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_markdownContainsFrontmatterAndBody() throws Exception {
        WikiEntry e = saveEntry("Allvater", null);
        e.setBody("Der Allvater regiert.");
        e.setType(WikiEntryType.PERSON);
        wikiEntryRepository.save(e);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        String content = readZip(result).get("allvater.md");
        assertThat(content).isNotNull();
        assertThat(content).contains("# Allvater");
        assertThat(content).contains("**Type:** PERSON");
        assertThat(content).contains("**Created by:** " + adminUser.getUsername());
        assertThat(content).contains("Der Allvater regiert.");
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void exportWiki_sanitizesFilenames() throws Exception {
        saveEntry("Ä böser Wald!", null);

        MvcResult result = mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId()))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(readZip(result).keySet()).containsExactly("ae_boeser_wald.md");
    }

    // ── Basic Auth tests ──────────────────────────────────────────────────────

    @Test
    void exportWiki_returns200_withValidBasicAuth() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId())
                        .with(httpBasic(adminUser.getUsername(), "export-pass")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/zip"));
    }

    @Test
    void exportWiki_returns401_withWrongBasicAuthPassword() throws Exception {
        mvc.perform(get("/api/export/worlds/{id}/wiki", testWorld.getId())
                        .with(httpBasic(adminUser.getUsername(), "wrong-password")))
                .andExpect(status().isUnauthorized());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Reads all ZIP entries from a response body into a filename→content map. */
    Map<String, String> readZip(MvcResult result) throws IOException {
        byte[] body = result.getResponse().getContentAsByteArray();
        Map<String, String> files = new LinkedHashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(body))) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                files.put(ze.getName(), new String(zis.readAllBytes(), StandardCharsets.UTF_8));
                zis.closeEntry();
            }
        }
        return files;
    }

    /** Saves a wiki entry to testWorld, created by adminUser. */
    WikiEntry saveEntry(String title, WikiEntry parent) {
        WikiEntry e = new WikiEntry();
        e.setTitle(title);
        e.setType(WikiEntryType.OTHER);
        e.setBody("Body of " + title);
        e.setWorld(testWorld);
        e.setCreatedBy(adminUser);
        e.setParent(parent);
        return wikiEntryRepository.save(e);
    }
}
