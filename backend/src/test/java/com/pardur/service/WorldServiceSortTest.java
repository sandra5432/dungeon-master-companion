package com.pardur.service;

import com.pardur.dto.response.WorldDto;
import com.pardur.model.World;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifies that {@link WorldService#getAllWorlds(Authentication)} returns worlds sorted by
 * the sequence rule: sortOrder &gt; 0 first (ascending), tie-broken
 * case-insensitively by name; sortOrder == 0 worlds come last, also sorted
 * case-insensitively by name.
 */
class WorldServiceSortTest {

    WorldRepository        worldRepository;
    WikiEntryRepository    wikiEntryRepository;
    WorldPermissionChecker checker;
    WorldService           service;

    @BeforeEach
    void setUp() {
        worldRepository     = mock(WorldRepository.class);
        wikiEntryRepository = mock(WikiEntryRepository.class);
        checker             = mock(WorldPermissionChecker.class);
        // All worlds readable in these sort tests — permissions are not under test here
        when(checker.canRead(any(World.class), isNull())).thenReturn(true);
        service = new WorldService(worldRepository, wikiEntryRepository, checker);
    }

    /**
     * Builds a World with the given name and sortOrder without touching the DB.
     */
    private World world(String name, int sortOrder) {
        World w = new World();
        w.setName(name);
        w.setSortOrder(sortOrder);
        return w;
    }

    @Test
    void sort_bySequence_then_alphabetical_then_noSequenceLast() {
        List<World> unsorted = List.of(
                world("Eldorheim", 2),
                world("Regeln",    0),
                world("Pardur",    1),
                world("draigval",  2)
        );
        when(worldRepository.findAll()).thenReturn(unsorted);

        List<WorldDto> result = service.getAllWorlds(null);

        assertThat(result).extracting(WorldDto::getName)
                .containsExactly("Pardur", "draigval", "Eldorheim", "Regeln");
    }

    @Test
    void sort_noSequenceWorlds_sortedAlphabeticallyIgnoringCase() {
        List<World> unsorted = List.of(
                world("Zebra",  0),
                world("alpha",  0),
                world("Mango",  0)
        );
        when(worldRepository.findAll()).thenReturn(unsorted);

        List<WorldDto> result = service.getAllWorlds(null);

        assertThat(result).extracting(WorldDto::getName)
                .containsExactly("alpha", "Mango", "Zebra");
    }

    @Test
    void sort_sequencedWorlds_sortedAlphabeticallyIgnoringCase_withinSameSequence() {
        List<World> unsorted = List.of(
                world("Zebra",  1),
                world("apple",  1),
                world("Mango",  1)
        );
        when(worldRepository.findAll()).thenReturn(unsorted);

        List<WorldDto> result = service.getAllWorlds(null);

        assertThat(result).extracting(WorldDto::getName)
                .containsExactly("apple", "Mango", "Zebra");
    }

    @Test
    void sort_allWorldsSequenced_sortedBySequenceFirst() {
        List<World> unsorted = List.of(
                world("Beta",  3),
                world("Alpha", 1),
                world("Gamma", 2)
        );
        when(worldRepository.findAll()).thenReturn(unsorted);

        List<WorldDto> result = service.getAllWorlds(null);

        assertThat(result).extracting(WorldDto::getName)
                .containsExactly("Alpha", "Gamma", "Beta");
    }

    @Test
    void sort_singleWorld_returnedAsIs() {
        when(worldRepository.findAll()).thenReturn(List.of(world("Solo", 0)));

        List<WorldDto> result = service.getAllWorlds(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Solo");
    }
}
