package com.pardur.service;

import com.pardur.dto.request.CreateWorldRequest;
import com.pardur.dto.request.UpdateWorldRequest;
import com.pardur.dto.response.WorldDto;
import com.pardur.exception.LastWorldException;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.World;
import com.pardur.repository.WorldRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class WorldService {

    private final WorldRepository worldRepository;

    public WorldService(WorldRepository worldRepository) {
        this.worldRepository = worldRepository;
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
        return toDto(worldRepository.save(world));
    }

    @Transactional
    public WorldDto updateWorld(Integer id, UpdateWorldRequest req) {
        World world = worldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + id));
        world.setName(req.getName());
        world.setDescription(req.getDescription());
        return toDto(worldRepository.save(world));
    }

    @Transactional
    public void deleteWorld(Integer id) {
        if (worldRepository.count() <= 1) {
            throw new LastWorldException("Cannot delete the last world");
        }
        worldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("World not found with id: " + id));
        worldRepository.deleteById(id);
    }

    private WorldDto toDto(World w) {
        return new WorldDto(w.getId(), w.getName(), w.getDescription(), w.getSortOrder());
    }
}
