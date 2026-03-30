package com.pardur.service;

import com.pardur.dto.request.CreateItemRequest;
import com.pardur.dto.request.UpdateItemRequest;
import com.pardur.dto.response.ItemDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.Item;
import com.pardur.model.ItemTag;
import com.pardur.repository.ItemRepository;
import com.pardur.repository.ItemTagRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ItemService {

    private final ItemRepository itemRepository;
    private final ItemTagRepository itemTagRepository;

    public ItemService(ItemRepository itemRepository, ItemTagRepository itemTagRepository) {
        this.itemRepository = itemRepository;
        this.itemTagRepository = itemTagRepository;
    }

    @Transactional(readOnly = true)
    public List<ItemDto> getAllItems() {
        return itemRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ItemDto getItem(Integer id) {
        return itemRepository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found with id: " + id));
    }

    @Transactional
    public ItemDto createItem(CreateItemRequest req) {
        Item item = new Item();
        item.setName(req.getName());
        item.setPrice(req.getPrice());
        item.setUrl(req.getUrl());
        item = itemRepository.save(item);
        setTags(item, req.getTags());
        return toDto(item);
    }

    @Transactional
    public ItemDto updateItem(Integer id, UpdateItemRequest req) {
        Item item = itemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found with id: " + id));
        item.setName(req.getName());
        item.setPrice(req.getPrice());
        item.setUrl(req.getUrl());
        setTags(item, req.getTags());
        return toDto(itemRepository.save(item));
    }

    @Transactional
    public void deleteItem(Integer id) {
        itemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found with id: " + id));
        itemRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<TagCountDto> getTagCounts() {
        return itemTagRepository.findAllTagCounts();
    }

    private void setTags(Item item, List<String> tagNames) {
        item.getTags().clear();
        if (tagNames != null) {
            for (String tag : tagNames) {
                String normalized = tag.trim().toLowerCase().replace(' ', '-');
                if (!normalized.isEmpty()) {
                    item.getTags().add(new ItemTag(item, normalized));
                }
            }
        }
    }

    private ItemDto toDto(Item i) {
        ItemDto dto = new ItemDto();
        dto.setId(i.getId());
        dto.setName(i.getName());
        dto.setPrice(i.getPrice());
        dto.setUrl(i.getUrl());
        dto.setTags(i.getTags().stream().map(t -> t.getId().getTagName()).toList());
        return dto;
    }
}
