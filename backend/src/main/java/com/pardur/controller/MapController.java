package com.pardur.controller;

import com.pardur.dto.request.CreateMapPoiRequest;
import com.pardur.dto.request.CreatePoiTypeRequest;
import com.pardur.dto.request.UpdateMapBgScaleRequest;
import com.pardur.dto.request.UpdateMapPoiRequest;
import com.pardur.dto.request.UpdatePoiTypeRequest;
import com.pardur.dto.response.MapPoiDto;
import com.pardur.dto.response.PoiTypeDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.MapBackground;
import com.pardur.model.PoiType;
import com.pardur.repository.MapBackgroundRepository;
import com.pardur.repository.PoiTypeRepository;
import com.pardur.service.MapPoiService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@RestController
public class MapController {

    private final MapPoiService           poiService;
    private final PoiTypeRepository       typeRepo;
    private final MapBackgroundRepository bgRepo;

    public MapController(MapPoiService poiService,
                         PoiTypeRepository typeRepo,
                         MapBackgroundRepository bgRepo) {
        this.poiService = poiService;
        this.typeRepo   = typeRepo;
        this.bgRepo     = bgRepo;
    }

    // ── POI Types (global) ────────────────────────────────────────────────────

    @GetMapping("/api/poi-types")
    public ResponseEntity<List<PoiTypeDto>> listTypes() {
        return ResponseEntity.ok(
            typeRepo.findAllByOrderByIsDefaultDescNameAsc().stream()
                .map(this::toTypeDto).toList()
        );
    }

    @PostMapping("/api/poi-types")
    public ResponseEntity<PoiTypeDto> createType(@Valid @RequestBody CreatePoiTypeRequest req) {
        PoiType t = new PoiType();
        t.setName(req.getName());
        t.setIcon(req.getIcon());
        t.setHasGesinnung(req.isHasGesinnung());
        t.setHasLabel(req.isHasLabel());
        t.setShape(req.getShape() != null ? req.getShape() : "ICON");
        return ResponseEntity.status(201).body(toTypeDto(typeRepo.save(t)));
    }

    @PutMapping("/api/poi-types/{id}")
    public ResponseEntity<PoiTypeDto> updateType(@PathVariable Integer id,
                                                  @Valid @RequestBody UpdatePoiTypeRequest req) {
        PoiType t = typeRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("POI type not found: " + id));
        if (req.getName()         != null) t.setName(req.getName());
        if (req.getIcon()         != null) t.setIcon(req.getIcon());
        if (req.getHasGesinnung() != null) t.setHasGesinnung(req.getHasGesinnung());
        if (req.getHasLabel()     != null) t.setHasLabel(req.getHasLabel());
        if (req.getShape()        != null) t.setShape(req.getShape());
        return ResponseEntity.ok(toTypeDto(typeRepo.save(t)));
    }

    @DeleteMapping("/api/poi-types/{id}")
    public ResponseEntity<Void> deleteType(@PathVariable Integer id) {
        PoiType t = typeRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("POI type not found: " + id));
        if (t.isDefault()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete default POI type");
        }
        typeRepo.delete(t);
        return ResponseEntity.noContent().build();
    }

    // ── Map POIs (per world) ──────────────────────────────────────────────────

    @GetMapping("/api/worlds/{worldId}/map/pois")
    public ResponseEntity<List<MapPoiDto>> listPois(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(poiService.listPois(worldId, auth));
    }

    @PostMapping("/api/worlds/{worldId}/map/pois")
    public ResponseEntity<MapPoiDto> createPoi(@PathVariable Integer worldId,
                                                @Valid @RequestBody CreateMapPoiRequest req,
                                                Authentication auth) {
        return ResponseEntity.status(201).body(poiService.createPoi(worldId, req, auth));
    }

    @PutMapping("/api/worlds/{worldId}/map/pois/{poiId}")
    public ResponseEntity<MapPoiDto> updatePoi(@PathVariable Integer worldId,
                                                @PathVariable Integer poiId,
                                                @Valid @RequestBody UpdateMapPoiRequest req,
                                                Authentication auth) {
        return ResponseEntity.ok(poiService.updatePoi(worldId, poiId, req, auth));
    }

    @DeleteMapping("/api/worlds/{worldId}/map/pois/{poiId}")
    public ResponseEntity<Void> deletePoi(@PathVariable Integer worldId,
                                           @PathVariable Integer poiId,
                                           Authentication auth) {
        poiService.deletePoi(worldId, poiId, auth);
        return ResponseEntity.noContent().build();
    }

    // ── Map Background (per world) ────────────────────────────────────────────

    @PostMapping(value = "/api/worlds/{worldId}/map/background",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> uploadBackground(@PathVariable Integer worldId,
                                                  @RequestParam("file") MultipartFile file) throws IOException {
        if (file.getSize() > 15L * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File too large (max 15 MB)");
        }
        MapBackground bg = bgRepo.findById(worldId).orElse(new MapBackground());
        bg.setWorldId(worldId);
        bg.setData(file.getBytes());
        bg.setContentType(file.getContentType() != null ? file.getContentType() : "image/jpeg");
        bg.setBgScale(1.0);   // reset scale on every new upload
        bgRepo.save(bg);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/worlds/{worldId}/map/background")
    public ResponseEntity<byte[]> getBackground(@PathVariable Integer worldId) {
        MapBackground bg = bgRepo.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("No background for world: " + worldId));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(bg.getContentType()))
                .header("X-Bg-Scale", String.valueOf(bg.getBgScale()))
                .body(bg.getData());
    }

    @PatchMapping("/api/worlds/{worldId}/map/background/scale")
    public ResponseEntity<Void> updateBackgroundScale(@PathVariable Integer worldId,
                                                       @Valid @RequestBody UpdateMapBgScaleRequest req) {
        MapBackground bg = bgRepo.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("No background for world: " + worldId));
        bg.setBgScale(req.getScale());
        bgRepo.save(bg);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/worlds/{worldId}/map/background")
    public ResponseEntity<Void> deleteBackground(@PathVariable Integer worldId) {
        bgRepo.deleteById(worldId);
        return ResponseEntity.noContent().build();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private PoiTypeDto toTypeDto(PoiType t) {
        return new PoiTypeDto(t.getId(), t.getName(), t.getIcon(), t.getShape(),
                              t.isDefault(), t.isHasGesinnung(), t.isHasLabel());
    }

}
