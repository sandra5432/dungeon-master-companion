package com.pardur.controller;

import com.pardur.dto.request.CreateItemRequest;
import com.pardur.dto.request.UpdateItemRequest;
import com.pardur.dto.response.ItemDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.service.ItemService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/items")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping
    public ResponseEntity<List<ItemDto>> getAll() {
        return ResponseEntity.ok(itemService.getAllItems());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ItemDto> getOne(@PathVariable Integer id) {
        return ResponseEntity.ok(itemService.getItem(id));
    }

    @PostMapping
    public ResponseEntity<ItemDto> create(@Valid @RequestBody CreateItemRequest req) {
        return ResponseEntity.status(201).body(itemService.createItem(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ItemDto> update(@PathVariable Integer id,
                                          @Valid @RequestBody UpdateItemRequest req) {
        return ResponseEntity.ok(itemService.updateItem(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        itemService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> getTags() {
        return ResponseEntity.ok(itemService.getTagCounts());
    }
}
