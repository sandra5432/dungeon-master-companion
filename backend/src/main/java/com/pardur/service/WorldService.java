package com.pardur.service;

import com.pardur.dto.request.CreateWorldRequest;
import com.pardur.dto.request.UpdateWorldRequest;
import com.pardur.dto.response.WorldDto;
import com.pardur.exception.LastWorldException;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.World;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WorldRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class WorldService {

    private final WorldRepository worldRepository;
    private final WikiEntryRepository wikiEntryRepository;

    public WorldService(WorldRepository worldRepository, WikiEntryRepository wikiEntryRepository) {
        this.worldRepository = worldRepository;
        this.wikiEntryRepository = wikiEntryRepository;
    }

    @Transactional(readOnly = true)
    public List<WorldDto> getAllWorlds() {
        return worldRepository.findAllByOrderBySortOrderAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public WorldDto createWorld(CreateWorldRequest req) {
        World world = new World();
        world.setName(req.getName());
        world.setDescription(req.getDescription());
        world.setMilesPerCell(req.getMilesPerCell() != null ? req.getMilesPerCell() : 5);
        world.setChronicleEnabled(req.getChronicleEnabled() == null || req.getChronicleEnabled());
        world.setWikiEnabled(req.getWikiEnabled() == null || req.getWikiEnabled());
        world.setMapEnabled(req.getMapEnabled() == null || req.getMapEnabled());
        return toDto(worldRepository.save(world));
    }

    @Transactional
    public WorldDto updateWorld(Integer id, UpdateWorldRequest req) {
        World world = worldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + id));
        world.setName(req.getName());
        world.setDescription(req.getDescription());
        if (req.getMilesPerCell() != null) world.setMilesPerCell(req.getMilesPerCell());
        if (req.getChronicleEnabled() != null) world.setChronicleEnabled(req.getChronicleEnabled());
        if (req.getWikiEnabled() != null) world.setWikiEnabled(req.getWikiEnabled());
        if (req.getMapEnabled() != null) world.setMapEnabled(req.getMapEnabled());
        return toDto(worldRepository.save(world));
    }

    @Transactional
    public void deleteWorld(Integer id) {
        if (worldRepository.count() <= 1) {
            throw new LastWorldException("Cannot delete the last world");
        }
        worldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + id));
        // Delete wiki entries (cascades to images and spoiler readers) before deleting the world
        wikiEntryRepository.deleteAll(wikiEntryRepository.findAllByWorldIdOrderByTitleAsc(id));
        worldRepository.deleteById(id);
    }

    private WorldDto toDto(World w) {
        return new WorldDto(w.getId(), w.getName(), w.getDescription(), w.getSortOrder(), w.getMilesPerCell(),
                w.isChronicleEnabled(), w.isWikiEnabled(), w.isMapEnabled());
    }
}
