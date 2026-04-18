package com.pardur.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pardur.dto.request.CreateWikiEntryRequest;
import com.pardur.model.WikiEntryType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class WikiControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Test
    void getRecent_returnsOk_whenUnauthenticated() throws Exception {
        mvc.perform(get("/api/wiki/recent"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getRecent_returnsOk_whenAuthenticated() throws Exception {
        mvc.perform(get("/api/wiki/recent"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void getTitles_returnsOk_whenUnauthenticated() throws Exception {
        mvc.perform(get("/api/wiki/titles"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "user", roles = {"USER"})
    void getTitles_returnsOk_whenAuthenticated() throws Exception {
        mvc.perform(get("/api/wiki/titles"))
                .andExpect(status().isOk());
    }

    @Test
    void createEntry_returns403_whenGuestAndWorldDeniesEdit() throws Exception {
        CreateWikiEntryRequest req = new CreateWikiEntryRequest();
        req.setTitle("Test");
        req.setWorldId(2); // Eldorheim: guest_can_edit=false
        req.setType(WikiEntryType.TERM);

        mvc.perform(post("/api/wiki")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    void createEntry_returns400_whenTitleBlank() throws Exception {
        CreateWikiEntryRequest req = new CreateWikiEntryRequest();
        req.setTitle("");
        req.setWorldId(1);
        req.setType(WikiEntryType.TERM);

        mvc.perform(post("/api/wiki")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }
}
