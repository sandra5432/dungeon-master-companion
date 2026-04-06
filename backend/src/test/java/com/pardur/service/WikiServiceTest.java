package com.pardur.service;

import com.pardur.dto.request.CreateWikiEntryRequest;
import com.pardur.dto.response.WikiGraphDto;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WikiServiceTest {

    WikiEntryRepository entryRepo;
    WikiSpoilerReaderRepository spoilerRepo;
    WorldRepository worldRepo;
    UserRepository userRepo;
    TimelineEventRepository eventRepo;
    WikiService service;

    World world;
    User user;
    User admin;

    @BeforeEach
    void setUp() throws Exception {
        entryRepo   = mock(WikiEntryRepository.class);
        spoilerRepo = mock(WikiSpoilerReaderRepository.class);
        worldRepo   = mock(WorldRepository.class);
        userRepo    = mock(UserRepository.class);
        eventRepo   = mock(TimelineEventRepository.class);
        service = new WikiService(entryRepo, spoilerRepo, worldRepo, userRepo, eventRepo);

        world = new World();
        setId(world, World.class, 1);
        world.setName("Pardur");

        user = new User();
        setId(user, User.class, 10);
        user.setUsername("testuser");
        user.setRole("USER");

        admin = new User();
        setId(admin, User.class, 99);
        admin.setUsername("admin");
        admin.setRole("ADMIN");
    }

    private void setId(Object obj, Class<?> clazz, int id) throws Exception {
        var f = clazz.getDeclaredField("id");
        f.setAccessible(true);
        f.set(obj, id);
    }

    @Test
    void stripSpoilers_removesAllSpoilerBlocks() {
        String body = "Before\n:::spoiler Secret\nHidden text\n:::\nAfter";
        String result = WikiService.stripSpoilers(body);
        assertThat(result).doesNotContain("Hidden text");
        assertThat(result).contains("Before");
        assertThat(result).contains("After");
    }

    @Test
    void stripSpoilers_preservesTextWhenNoSpoilers() {
        String body = "Just normal **markdown** text.";
        assertThat(WikiService.stripSpoilers(body)).isEqualTo(body);
    }

    @Test
    void stripSpoilers_handlesNull() {
        assertThat(WikiService.stripSpoilers(null)).isNull();
    }

    @Test
    void create_throwsConflict_whenDuplicateTitleInSameWorld() {
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(userRepo.findById(10)).thenReturn(Optional.of(user));

        WikiEntry existing = new WikiEntry();
        existing.setTitle("Nerathis");
        when(entryRepo.findDuplicateTitle(eq(1), eq("Nerathis"), eq(-1)))
                .thenReturn(Optional.of(existing));

        CreateWikiEntryRequest req = new CreateWikiEntryRequest();
        req.setTitle("Nerathis");
        req.setWorldId(1);
        req.setType(WikiEntryType.LOCATION);

        assertThatThrownBy(() -> service.create(req, 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void delete_throwsForbidden_whenNotOwnerAndNotAdmin() throws Exception {
        WikiEntry entry = new WikiEntry();
        entry.setCreatedBy(admin);
        setId(entry, WikiEntry.class, 5);
        when(entryRepo.findById(5)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.delete(5, 10, false))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void getGraph_returnsEdge_whenEntryBodyMentionsAnotherEntryTitle() throws Exception {
        WikiEntry nerathis  = buildEntry(1, "Nerathis",  "Home of the Nerathari people.", world);
        WikiEntry nerathari = buildEntry(2, "Nerathari", "Ancient race.", world);

        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(entryRepo.findAllByWorldIdOrderByTitleAsc(1)).thenReturn(List.of(nerathis, nerathari));

        WikiGraphDto graph = service.getGraph(1);
        assertThat(graph.getEdges()).hasSize(1);
        assertThat(graph.getEdges().get(0).source()).isEqualTo(1);
        assertThat(graph.getEdges().get(0).target()).isEqualTo(2);
    }

    @Test
    void create_setsParent_whenValidParentId() throws Exception {
        WikiEntry parent = buildEntry(100, "Glimmquali", null, world);
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(userRepo.findById(10)).thenReturn(Optional.of(user));
        when(entryRepo.findDuplicateTitle(eq(1), eq("Tavari"), eq(-1))).thenReturn(Optional.empty());
        when(entryRepo.findById(100)).thenReturn(Optional.of(parent));
        when(entryRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(entryRepo.findByParentId(any())).thenReturn(List.of());

        CreateWikiEntryRequest req = new CreateWikiEntryRequest();
        req.setTitle("Tavari");
        req.setWorldId(1);
        req.setType(WikiEntryType.LOCATION);
        req.setParentId(100);

        assertThatCode(() -> service.create(req, 10)).doesNotThrowAnyException();
    }

    @Test
    void create_throwsBadRequest_whenParentInDifferentWorld() throws Exception {
        World otherWorld = new World();
        setId(otherWorld, World.class, 99);
        otherWorld.setName("Other");

        WikiEntry parent = buildEntry(100, "OtherEntry", null, otherWorld);
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(userRepo.findById(10)).thenReturn(Optional.of(user));
        when(entryRepo.findDuplicateTitle(eq(1), eq("Child"), eq(-1))).thenReturn(Optional.empty());
        when(entryRepo.findById(100)).thenReturn(Optional.of(parent));

        CreateWikiEntryRequest req = new CreateWikiEntryRequest();
        req.setTitle("Child");
        req.setWorldId(1);
        req.setType(WikiEntryType.TERM);
        req.setParentId(100);

        assertThatThrownBy(() -> service.create(req, 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("gleichen Welt");
    }

    @Test
    void create_throwsBadRequest_whenDepthExceeded() throws Exception {
        WikiEntry grandGrandParent = buildEntry(10, "GGP", null, world);
        WikiEntry grandParent      = buildEntry(11, "GP",  null, world);
        WikiEntry parent           = buildEntry(12, "P",   null, world);

        var parentField = WikiEntry.class.getDeclaredField("parent");
        parentField.setAccessible(true);
        parentField.set(grandParent, grandGrandParent);
        parentField.set(parent, grandParent);

        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(userRepo.findById(10)).thenReturn(Optional.of(user));
        when(entryRepo.findDuplicateTitle(eq(1), eq("TooDeep"), eq(-1))).thenReturn(Optional.empty());
        when(entryRepo.findById(12)).thenReturn(Optional.of(parent));

        CreateWikiEntryRequest req = new CreateWikiEntryRequest();
        req.setTitle("TooDeep");
        req.setWorldId(1);
        req.setType(WikiEntryType.TERM);
        req.setParentId(12);

        assertThatThrownBy(() -> service.create(req, 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Verschachtelungstiefe");
    }

    private WikiEntry buildEntry(int id, String title, String body, World w) throws Exception {
        WikiEntry e = new WikiEntry();
        setId(e, WikiEntry.class, id);
        e.setTitle(title);
        e.setBody(body);
        e.setWorld(w);
        e.setCreatedBy(user);
        e.setType(WikiEntryType.OTHER);
        return e;
    }
}
