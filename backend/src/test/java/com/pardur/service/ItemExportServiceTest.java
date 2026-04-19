package com.pardur.service;

import com.pardur.model.Item;
import com.pardur.model.ItemTag;
import com.pardur.repository.ItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ItemExportServiceTest {

    ItemRepository itemRepo;
    ItemExportService service;

    @BeforeEach
    void setUp() {
        itemRepo = mock(ItemRepository.class);
        service  = new ItemExportService(itemRepo);
    }

    // ── renderMarkdownTable ────────────────────────────────────────────────────

    @Test
    void renderMarkdownTable_containsHeader() {
        String md = ItemExportService.renderMarkdownTable(List.of());
        assertThat(md).contains("# Marktplatz");
        assertThat(md).contains("| Name |");
        assertThat(md).contains("| Preis ⚜ |");
        assertThat(md).contains("| Tags |");
        assertThat(md).contains("| Link |");
    }

    @Test
    void renderMarkdownTable_emptyList_hasNoDataRows() {
        String md = ItemExportService.renderMarkdownTable(List.of());
        // header row + separator row only — no third | row
        long tableRows = md.lines()
                .filter(l -> l.startsWith("|") && !l.startsWith("|---"))
                .count();
        assertThat(tableRows).isEqualTo(1); // only the header row
    }

    @Test
    void renderMarkdownTable_itemWithAllFields_renderedCorrectly() {
        Item item = buildItem("Heiltrank", "50.00", List.of("trank", "heilung"), "https://example.com");
        String md = ItemExportService.renderMarkdownTable(List.of(item));
        assertThat(md).contains("| Heiltrank |");
        assertThat(md).contains("50.00");
        assertThat(md).contains("trank, heilung");
        assertThat(md).contains("[Link](https://example.com)");
    }

    @Test
    void renderMarkdownTable_itemWithNoTags_rendersDash() {
        Item item = buildItem("Schwert", "120.00", List.of(), null);
        String md = ItemExportService.renderMarkdownTable(List.of(item));
        assertThat(md).contains("| — |"); // tags cell
    }

    @Test
    void renderMarkdownTable_itemWithNoUrl_rendersDash() {
        Item item = buildItem("Schwert", "120.00", List.of(), null);
        String md = ItemExportService.renderMarkdownTable(List.of(item));
        assertThat(md).contains("— |");
    }

    @Test
    void renderMarkdownTable_multipleItems_allPresent() {
        Item a = buildItem("Apfel", "1.00", List.of(), null);
        Item b = buildItem("Brot",  "2.00", List.of(), null);
        String md = ItemExportService.renderMarkdownTable(List.of(a, b));
        assertThat(md).contains("| Apfel |");
        assertThat(md).contains("| Brot |");
    }

    // ── exportItemsAsMarkdown ─────────────────────────────────────────────────

    @Test
    void exportItemsAsMarkdown_queriesRepoSortedByNameAsc() {
        when(itemRepo.findAll(Sort.by(Sort.Direction.ASC, "name"))).thenReturn(List.of());
        service.exportItemsAsMarkdown();
        verify(itemRepo).findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Item buildItem(String name, String price, List<String> tagNames, String url) {
        Item item = new Item();
        item.setName(name);
        item.setPrice(new BigDecimal(price));
        item.setUrl(url);
        for (String t : tagNames) {
            item.getTags().add(new ItemTag(item, t));
        }
        return item;
    }
}
