package com.pardur.service;

import com.pardur.model.Item;
import com.pardur.repository.ItemRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Builds a Markdown export document for all marketplace items.
 */
@Service
public class ItemExportService {

    private final ItemRepository itemRepository;

    public ItemExportService(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    /**
     * Exports all items from the database as a Markdown document with a table.
     * Items are sorted by name ascending.
     *
     * @return Markdown string ready to be written to a .md file
     */
    @Transactional(readOnly = true)
    public String exportItemsAsMarkdown() {
        List<Item> items = itemRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        return renderMarkdownTable(items);
    }

    /**
     * Renders the Markdown table for the given list of items.
     * Static to allow direct unit testing without Spring context.
     *
     * @param items items to render; may be empty
     * @return Markdown string
     */
    static String renderMarkdownTable(List<Item> items) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Marktplatz — Export\n\n");
        sb.append("_Exportiert: ").append(LocalDate.now()).append("_\n\n");
        sb.append("| Name | Preis ⚜ | Tags | Link |\n");
        sb.append("|------|---------|------|------|\n");
        for (Item item : items) {
            String tags = item.getTags().isEmpty()
                    ? "—"
                    : item.getTags().stream()
                            .map(t -> t.getId().getTagName())
                            .collect(Collectors.joining(", "));
            String url = (item.getUrl() != null && !item.getUrl().isBlank())
                    ? "[Link](" + item.getUrl() + ")"
                    : "—";
            sb.append("| ").append(escape(item.getName())).append(" | ")
              .append(item.getPrice().toPlainString()).append(" | ")
              .append(tags).append(" | ")
              .append(url).append(" |\n");
        }
        return sb.toString();
    }

    /** Escapes Markdown pipe characters inside cell values. */
    private static String escape(String value) {
        return value == null ? "" : value.replace("|", "\\|");
    }
}
