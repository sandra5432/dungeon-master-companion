package com.pardur.service;

import com.pardur.dto.request.CreateItemRequest;
import com.pardur.dto.request.UpdateItemRequest;
import com.pardur.dto.response.ItemDto;
import com.pardur.model.Item;
import com.pardur.model.ItemTag;
import com.pardur.repository.ItemRepository;
import com.pardur.repository.ItemTagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ItemServiceTagTest {

    @Mock ItemRepository itemRepository;
    @Mock ItemTagRepository itemTagRepository;
    @InjectMocks ItemService itemService;

    private Item savedItem;

    @BeforeEach
    void setUp() {
        savedItem = new Item();
        try {
            var f = Item.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(savedItem, 1);
        } catch (Exception e) { throw new RuntimeException(e); }
        savedItem.setName("Test Item");
        savedItem.setPrice(BigDecimal.TEN);
        savedItem.setUrl("https://example.com");
    }

    @Test
    void createItem_normalizesTagsToLowercaseWithHyphens() {
        when(itemRepository.save(any())).thenReturn(savedItem);

        CreateItemRequest req = new CreateItemRequest();
        req.setName("Test Item");
        req.setPrice(BigDecimal.TEN);
        req.setUrl("https://example.com");
        req.setTags(List.of("Wild Fire", "  RP-Item  ", "Melee"));

        itemService.createItem(req);

        List<String> tags = savedItem.getTags().stream()
                .map(t -> t.getId().getTagName())
                .sorted()
                .toList();
        assertThat(tags).containsExactly("melee", "rp-item", "wild-fire");
    }

    @Test
    void createItem_withNullTags_storesNoTags() {
        when(itemRepository.save(any())).thenReturn(savedItem);

        CreateItemRequest req = new CreateItemRequest();
        req.setName("Test Item");
        req.setPrice(BigDecimal.TEN);
        req.setTags(null);

        itemService.createItem(req);

        assertThat(savedItem.getTags()).isEmpty();
    }

    @Test
    void createItem_skipsBlankTagsAfterTrim() {
        when(itemRepository.save(any())).thenReturn(savedItem);

        CreateItemRequest req = new CreateItemRequest();
        req.setName("Test Item");
        req.setPrice(BigDecimal.TEN);
        req.setTags(List.of("  ", "valid", ""));

        itemService.createItem(req);

        List<String> tags = savedItem.getTags().stream()
                .map(t -> t.getId().getTagName())
                .toList();
        assertThat(tags).containsExactly("valid");
    }

    @Test
    void updateItem_replacesExistingTags() {
        savedItem.getTags().add(new ItemTag(savedItem, "old-tag"));
        when(itemRepository.findById(1)).thenReturn(Optional.of(savedItem));
        when(itemRepository.save(any())).thenReturn(savedItem);

        UpdateItemRequest req = new UpdateItemRequest();
        req.setName("Updated");
        req.setPrice(BigDecimal.ONE);
        req.setTags(List.of("new-tag"));

        itemService.updateItem(1, req);

        List<String> tags = savedItem.getTags().stream()
                .map(t -> t.getId().getTagName())
                .toList();
        assertThat(tags).containsExactly("new-tag");
        assertThat(tags).doesNotContain("old-tag");
    }
}
