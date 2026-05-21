package com.pardur.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for TimelineEpochController.
 * Uses the dev MySQL database (via @ActiveProfiles("dev")).
 * @Transactional rolls back any writes after each test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Transactional
class TimelineEpochControllerTest {

    @Autowired MockMvc mvc;

    private static final String BASE = "/api/worlds/1/epochs";

    @Test
    void getEpochs_returnsEmptyListWhenNoneExist() throws Exception {
        mvc.perform(get(BASE))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createEpoch_returns201WithValidPayload() throws Exception {
        // Event 1 is 'Ankunft der Erbauer' seeded in V8, world 1 is Pardur
        String body = """
            {
              "label": "Test Epoch",
              "color": "#c8a84b",
              "startAtEventId": 1,
              "endAfterEventId": null
            }
            """;
        mvc.perform(post(BASE)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.label").value("Test Epoch"))
            .andExpect(jsonPath("$.color").value("#c8a84b"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createEpoch_returns400WhenColorInvalid() throws Exception {
        String body = """
            {
              "label": "Bad",
              "color": "notahex",
              "startAtEventId": 1
            }
            """;
        mvc.perform(post(BASE)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void createEpoch_returns400WhenLabelMissing() throws Exception {
        String body = """
            {
              "color": "#c8a84b",
              "startAtEventId": 1
            }
            """;
        mvc.perform(post(BASE)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void deleteEpoch_returns404ForNonExistentEpoch() throws Exception {
        mvc.perform(delete(BASE + "/999999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void getEpochs_returns200ForNonExistentWorld() throws Exception {
        // World 999 doesn't exist — service returns empty list rather than 404
        mvc.perform(get("/api/worlds/999/epochs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }
}
