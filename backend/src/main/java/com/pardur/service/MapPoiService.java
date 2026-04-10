package com.pardur.service;

import com.pardur.dto.request.CreateMapPoiRequest;
import com.pardur.dto.request.UpdateMapPoiRequest;
import com.pardur.dto.response.MapPoiDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class MapPoiService {

    private final MapPoiRepository  poiRepo;
    private final PoiTypeRepository typeRepo;
    private final WorldRepository   worldRepo;
    private final UserRepository    userRepo;

    public MapPoiService(MapPoiRepository poiRepo, PoiTypeRepository typeRepo,
                         WorldRepository worldRepo, UserRepository userRepo) {
        this.poiRepo   = poiRepo;
        this.typeRepo  = typeRepo;
        this.worldRepo = worldRepo;
        this.userRepo  = userRepo;
    }

    @Transactional(readOnly = true)
    public List<MapPoiDto> listPois(Integer worldId) {
        return poiRepo.findAllByWorldIdOrderByCreatedAtAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public MapPoiDto createPoi(Integer worldId, CreateMapPoiRequest req, Integer userId) {
        World   world = worldRepo.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
        PoiType type  = typeRepo.findById(req.getPoiTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("POI type not found: " + req.getPoiTypeId()));
        User    user  = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        MapPoi poi = new MapPoi();
        poi.setWorld(world);
        poi.setPoiType(type);
        poi.setXPct(req.getXPct());
        poi.setYPct(req.getYPct());
        poi.setLabel(req.getLabel());
        poi.setGesinnung(type.isHasGesinnung() && req.getGesinnung() != null
                ? MapPoi.Gesinnung.valueOf(req.getGesinnung()) : null);
        poi.setCreatedBy(user);
        return toDto(poiRepo.save(poi));
    }

    @Transactional
    public MapPoiDto updatePoi(Integer worldId, Integer poiId,
                               UpdateMapPoiRequest req, Integer userId, boolean isAdmin) {
        MapPoi poi = poiRepo.findById(poiId)
                .orElseThrow(() -> new ResourceNotFoundException("POI not found: " + poiId));
        checkOwnership(poi, userId, isAdmin);

        if (req.getXPct()      != null) poi.setXPct(req.getXPct());
        if (req.getYPct()      != null) poi.setYPct(req.getYPct());
        if (req.getLabel()     != null) poi.setLabel(req.getLabel());
        if (req.getGesinnung() != null) {
            poi.setGesinnung(poi.getPoiType().isHasGesinnung()
                    ? MapPoi.Gesinnung.valueOf(req.getGesinnung()) : null);
        }
        return toDto(poiRepo.save(poi));
    }

    @Transactional
    public void deletePoi(Integer worldId, Integer poiId, Integer userId, boolean isAdmin) {
        MapPoi poi = poiRepo.findById(poiId)
                .orElseThrow(() -> new ResourceNotFoundException("POI not found: " + poiId));
        checkOwnership(poi, userId, isAdmin);
        poiRepo.delete(poi);
    }

    private void checkOwnership(MapPoi poi, Integer userId, boolean isAdmin) {
        if (isAdmin) return;
        if (!poi.getCreatedBy().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your POI");
        }
    }

    private MapPoiDto toDto(MapPoi p) {
        return new MapPoiDto(
            p.getId(),
            p.getWorld().getId(),
            p.getPoiType().getId(),
            p.getPoiType().getName(),
            p.getPoiType().getIcon(),
            p.getPoiType().getShape(),
            p.getXPct(),
            p.getYPct(),
            p.getLabel(),
            p.getGesinnung() != null ? p.getGesinnung().name() : null,
            p.getCreatedBy().getId()
        );
    }
}
