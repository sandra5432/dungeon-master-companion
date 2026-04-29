package com.pardur.service;

import com.pardur.dto.request.CreateMapPoiRequest;
import com.pardur.dto.request.UpdateMapPoiRequest;
import com.pardur.dto.response.MapPoiDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MapPoiService {

    private final MapPoiRepository     poiRepo;
    private final PoiTypeRepository    typeRepo;
    private final WorldRepository      worldRepo;
    private final UserRepository       userRepo;
    private final WorldPermissionChecker checker;

    public MapPoiService(MapPoiRepository poiRepo, PoiTypeRepository typeRepo,
                         WorldRepository worldRepo, UserRepository userRepo,
                         WorldPermissionChecker checker) {
        this.poiRepo   = poiRepo;
        this.typeRepo  = typeRepo;
        this.worldRepo = worldRepo;
        this.userRepo  = userRepo;
        this.checker   = checker;
    }

    /**
     * Returns all POIs on the world's map. Requires read permission on the world.
     *
     * @param worldId target world
     * @param auth    caller's authentication (may be null for guests)
     * @return list of POI DTOs ordered by creation time
     * @throws ResourceNotFoundException if the world does not exist
     */
    @Transactional(readOnly = true)
    public List<MapPoiDto> listPois(Integer worldId, Authentication auth) {
        World world = requireWorld(worldId);
        checker.requireRead(world, auth);
        return poiRepo.findAllByWorldIdOrderByCreatedAtAsc(worldId)
                .stream().map(this::toDto).toList();
    }

    /**
     * Places a new POI on the world's map. Requires edit permission on the world.
     * Anonymous creates (guests with edit permission) are stored with a null creator.
     *
     * @param worldId target world
     * @param req     validated create request
     * @param auth    caller's authentication (may be null for guests with edit permission)
     * @return the persisted POI as a DTO
     * @throws ResourceNotFoundException if the world or POI type does not exist
     */
    @Transactional
    public MapPoiDto createPoi(Integer worldId, CreateMapPoiRequest req, Authentication auth) {
        World   world = requireWorld(worldId);
        checker.requireEdit(world, auth);
        PoiType type  = typeRepo.findById(req.getPoiTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("POI type not found: " + req.getPoiTypeId()));

        Integer creatorId = WorldPermissionChecker.resolveUserId(auth);

        MapPoi poi = new MapPoi();
        poi.setWorld(world);
        poi.setPoiType(type);
        poi.setXPct(req.getXPct());
        poi.setYPct(req.getYPct());
        poi.setLabel(req.getLabel());
        poi.setGesinnung(type.isHasGesinnung() && req.getGesinnung() != null
                ? MapPoi.Gesinnung.valueOf(req.getGesinnung()) : null);
        if ("TEXT".equals(type.getShape())) {
            poi.setTextBold(req.getTextBold() != null ? req.getTextBold() : false);
            poi.setTextItalic(req.getTextItalic() != null ? req.getTextItalic() : false);
            poi.setTextSize(req.getTextSize() != null ? req.getTextSize() : 14);
        }

        if (creatorId != null) {
            User creator = userRepo.findById(creatorId)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + creatorId));
            poi.setCreatedBy(creator);
        }

        return toDto(poiRepo.save(poi));
    }

    /**
     * Updates an existing POI. Requires edit permission on the POI's world.
     * Any user with world edit permission may update any POI.
     *
     * @param worldId target world
     * @param poiId   POI to update
     * @param req     partial update request
     * @param auth    caller's authentication
     * @return the updated POI as a DTO
     * @throws ResourceNotFoundException if the POI does not exist
     */
    @Transactional
    public MapPoiDto updatePoi(Integer worldId, Integer poiId,
                               UpdateMapPoiRequest req, Authentication auth) {
        MapPoi poi = poiRepo.findById(poiId)
                .orElseThrow(() -> new ResourceNotFoundException("POI not found: " + poiId));
        checker.requireEdit(poi.getWorld(), auth);

        // Ownership: only the POI creator (matched by user ID) or an admin may move it.
        // Guest-created POIs (createdBy = null) are movable by any guest (callerId = null).
        if (!WorldPermissionChecker.isAdmin(auth)) {
            Integer callerId  = WorldPermissionChecker.resolveUserId(auth);
            Integer creatorId = poi.getCreatedBy() != null ? poi.getCreatedBy().getId() : null;
            if (!Objects.equals(callerId, creatorId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your POI");
            }
        }

        if (req.getXPct()      != null) poi.setXPct(req.getXPct());
        if (req.getYPct()      != null) poi.setYPct(req.getYPct());
        if (req.getLabel()     != null) poi.setLabel(req.getLabel());
        if (req.getGesinnung() != null) {
            poi.setGesinnung(poi.getPoiType().isHasGesinnung()
                    ? MapPoi.Gesinnung.valueOf(req.getGesinnung()) : null);
        }
        if ("TEXT".equals(poi.getPoiType().getShape())) {
            if (req.getTextBold()   != null) poi.setTextBold(req.getTextBold());
            if (req.getTextItalic() != null) poi.setTextItalic(req.getTextItalic());
            if (req.getTextSize()   != null) poi.setTextSize(req.getTextSize());
        }
        return toDto(poiRepo.save(poi));
    }

    /**
     * Deletes a POI. Requires delete permission on the POI's world.
     * Any user with world delete permission may delete any POI.
     *
     * @param worldId target world
     * @param poiId   POI to delete
     * @param auth    caller's authentication
     * @throws ResourceNotFoundException if the POI does not exist
     */
    @Transactional
    public void deletePoi(Integer worldId, Integer poiId, Authentication auth) {
        MapPoi poi = poiRepo.findById(poiId)
                .orElseThrow(() -> new ResourceNotFoundException("POI not found: " + poiId));
        checker.requireDelete(poi.getWorld(), auth);
        poiRepo.delete(poi);
    }

    private World requireWorld(Integer id) {
        return worldRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + id));
    }

    private MapPoiDto toDto(MapPoi p) {
        Integer creatorId = p.getCreatedBy() != null ? p.getCreatedBy().getId() : null;
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
            creatorId,
            p.getTextBold(),
            p.getTextItalic(),
            p.getTextSize()
        );
    }
}
