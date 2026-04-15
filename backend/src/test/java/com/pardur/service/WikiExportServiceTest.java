package com.pardur.service;

import com.pardur.model.User;
import com.pardur.model.WikiEntry;
import com.pardur.model.WikiEntryType;
import com.pardur.model.World;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.*;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class WikiExportServiceTest {

    WikiEntryRepository wikiEntryRepo;
    WorldRepository worldRepo;
    WikiExportService service;

    @BeforeEach
    void setUp() {
        wikiEntryRepo = mock(WikiEntryRepository.class);
        worldRepo     = mock(WorldRepository.class);
        service       = new WikiExportService(wikiEntryRepo, worldRepo);
    }

    // ── sanitize ─────────────────────────────────────────────────────────────

    @Test
    void sanitize_lowercasesInput() {
        assertThat(WikiExportService.sanitize("ODIN")).isEqualTo("odin");
    }

    @Test
    void sanitize_replacesSpacesWithUnderscores() {
        assertThat(WikiExportService.sanitize("Der Dunkle Wald")).isEqualTo("der_dunkle_wald");
    }

    @Test
    void sanitize_replacesUmlauts() {
        assertThat(WikiExportService.sanitize("Über")).isEqualTo("ueber");
        assertThat(WikiExportService.sanitize("Öde")).isEqualTo("oede");
        assertThat(WikiExportService.sanitize("Güte")).isEqualTo("guete");
        assertThat(WikiExportService.sanitize("Straße")).isEqualTo("strasse");
    }

    @Test
    void sanitize_stripsSpecialChars() {
        assertThat(WikiExportService.sanitize("Ä böser Wald!")).isEqualTo("ae_boeser_wald");
    }

    @Test
    void sanitize_collapsesMultipleUnderscores() {
        assertThat(WikiExportService.sanitize("a  b")).isEqualTo("a_b");
    }

    @Test
    void sanitize_trimsLeadingTrailingUnderscores() {
        assertThat(WikiExportService.sanitize("!test!")).isEqualTo("test");
    }

    // ── renderMarkdown ───────────────────────────────────────────────────────

    @Test
    void renderMarkdown_includesTitleAsH1() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "Allvater.");
        assertThat(WikiExportService.renderMarkdown(e)).startsWith("# Odin");
    }

    @Test
    void renderMarkdown_includesTypeAndAuthor() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "Allvater.");
        String md = WikiExportService.renderMarkdown(e);
        assertThat(md).contains("**Type:** PERSON");
        assertThat(md).contains("**Created by:** admin");
    }

    @Test
    void renderMarkdown_includesBodyVerbatimIncludingSpoilers() {
        String body = "Allvater.\n\n:::spoiler Secret\nHidden\n:::";
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", body);
        assertThat(WikiExportService.renderMarkdown(e)).contains(body);
    }

    @Test
    void renderMarkdown_showsPlaceholderWhenBodyIsNull() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", null);
        assertThat(WikiExportService.renderMarkdown(e)).contains("*(no content)*");
    }

    @Test
    void renderMarkdown_showsPlaceholderWhenBodyIsBlank() {
        WikiEntry e = buildEntry("Odin", WikiEntryType.PERSON, "admin", "   ");
        assertThat(WikiExportService.renderMarkdown(e)).contains("*(no content)*");
    }

    // ── exportWikiAsZip ──────────────────────────────────────────────────────

    @Test
    void exportWikiAsZip_returnsEmptyZip_whenNoEntries() throws Exception {
        World world = buildWorld(1, "Leer");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of());

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip)).isEmpty();
    }

    @Test
    void exportWikiAsZip_flatEntry_appearsAtRoot() throws Exception {
        World world = buildWorld(1, "Testworld");
        WikiEntry entry = buildEntry(10, "Odin", null, WikiEntryType.PERSON, "admin", "Allvater");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(entry));

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip)).containsExactly("odin.md");
    }

    @Test
    void exportWikiAsZip_parentWithChild_usesFolder() throws Exception {
        World world = buildWorld(1, "Testworld");
        WikiEntry parent = buildEntry(10, "Gods",  null,   WikiEntryType.OTHER,   "admin", "Die Götter");
        WikiEntry child  = buildEntry(20, "Odin",  parent, WikiEntryType.PERSON,  "admin", "Allvater");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(parent, child));

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip))
                .containsExactlyInAnyOrder("gods/gods.md", "gods/odin.md");
    }

    @Test
    void exportWikiAsZip_threeGenerations_usesNestedFolders() throws Exception {
        World world    = buildWorld(1, "Testworld");
        WikiEntry root = buildEntry(1, "Gods",     null,  WikiEntryType.OTHER,     "admin", "Götter");
        WikiEntry mid  = buildEntry(2, "Odin",     root,  WikiEntryType.PERSON,    "admin", "Allvater");
        WikiEntry leaf = buildEntry(3, "Valhalla",  mid,  WikiEntryType.LOCATION,  "admin", "Halle der Toten");
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(wikiEntryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(root, mid, leaf));

        byte[] zip = service.exportWikiAsZip(1);

        assertThat(readZipEntryNames(zip))
                .containsExactlyInAnyOrder("gods/gods.md", "gods/odin/odin.md", "gods/odin/valhalla.md");
    }

    // ── buildZipFilename ─────────────────────────────────────────────────────

    @Test
    void buildZipFilename_sanitizesWorldName() throws Exception {
        World world = buildWorld(5, "Pardur");
        when(worldRepo.findById(5)).thenReturn(Optional.of(world));

        assertThat(service.buildZipFilename(5)).isEqualTo("pardur-wiki-export.zip");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private WikiEntry buildEntry(String title, WikiEntryType type, String username, String body) {
        User u = new User();
        u.setUsername(username);
        WikiEntry e = new WikiEntry();
        e.setTitle(title);
        e.setType(type);
        e.setBody(body);
        e.setCreatedBy(u);
        return e;
    }

    private WikiEntry buildEntry(int id, String title, WikiEntry parent, WikiEntryType type,
                                  String username, String body) throws Exception {
        WikiEntry e = buildEntry(title, type, username, body);
        setPrivateId(e, WikiEntry.class, id);
        e.setParent(parent);
        return e;
    }

    private World buildWorld(int id, String name) throws Exception {
        World w = new World();
        w.setName(name);
        setPrivateId(w, World.class, id);
        return w;
    }

    private void setPrivateId(Object obj, Class<?> clazz, int id) throws Exception {
        var f = clazz.getDeclaredField("id");
        f.setAccessible(true);
        f.set(obj, id);
    }

    private Set<String> readZipEntryNames(byte[] zip) throws IOException {
        Set<String> names = new LinkedHashSet<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zip))) {
            java.util.zip.ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                names.add(ze.getName());
                zis.closeEntry();
            }
        }
        return names;
    }
}
