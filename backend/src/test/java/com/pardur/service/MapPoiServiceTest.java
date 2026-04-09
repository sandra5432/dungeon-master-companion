package com.pardur.service;

import com.pardur.dto.request.CreateMapPoiRequest;
import com.pardur.dto.request.UpdateMapPoiRequest;
import com.pardur.dto.response.MapPoiDto;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MapPoiServiceTest {

    MapPoiRepository     poiRepo;
    PoiTypeRepository    typeRepo;
    WorldRepository      worldRepo;
    UserRepository       userRepo;
    MapPoiService        service;

    World   world;
    User    user;
    PoiType type;

    @BeforeEach
    void setUp() throws Exception {
        poiRepo   = mock(MapPoiRepository.class);
        typeRepo  = mock(PoiTypeRepository.class);
        worldRepo = mock(WorldRepository.class);
        userRepo  = mock(UserRepository.class);
        service   = new MapPoiService(poiRepo, typeRepo, worldRepo, userRepo);

        world = new World(); setId(world, World.class, 1);
        world.setName("Pardur");

        type = new PoiType(); setId(type, PoiType.class, 1);
        type.setName("Großer POI"); type.setIcon("⭐");
        type.setHasGesinnung(true); type.setHasLabel(true);

        user = new User(); setId(user, User.class, 10);
        user.setUsername("player"); user.setRole("USER");
    }

    @Test
    void listPois_returnsDtoList() {
        MapPoi poi = buildPoi(1, world, type, user, 0.5, 0.5, "Nerathys", "FRIENDLY");
        when(poiRepo.findAllByWorldIdOrderByCreatedAtAsc(1)).thenReturn(List.of(poi));

        List<MapPoiDto> result = service.listPois(1);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).label()).isEqualTo("Nerathys");
        assertThat(result.get(0).gesinnung()).isEqualTo("FRIENDLY");
        assertThat(result.get(0).xPct()).isEqualTo(0.5);
    }

    @Test
    void createPoi_persistsAndReturnsDto() {
        when(worldRepo.findById(1)).thenReturn(Optional.of(world));
        when(typeRepo.findById(1)).thenReturn(Optional.of(type));
        when(userRepo.findById(10)).thenReturn(Optional.of(user));
        when(poiRepo.save(any())).thenAnswer(inv -> {
            MapPoi p = inv.getArgument(0);
            setId(p, MapPoi.class, 42);
            return p;
        });

        CreateMapPoiRequest req = new CreateMapPoiRequest();
        req.setPoiTypeId(1); req.setXPct(0.3); req.setYPct(0.7);
        req.setLabel("Nerathys"); req.setGesinnung("FRIENDLY");

        MapPoiDto dto = service.createPoi(1, req, 10);

        assertThat(dto.id()).isEqualTo(42);
        assertThat(dto.label()).isEqualTo("Nerathys");
        assertThat(dto.gesinnung()).isEqualTo("FRIENDLY");
    }

    @Test
    void updatePoi_ownerCanUpdate() {
        MapPoi poi = buildPoi(5, world, type, user, 0.5, 0.5, "Old", "NEUTRAL");
        when(poiRepo.findById(5)).thenReturn(Optional.of(poi));
        when(poiRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateMapPoiRequest req = new UpdateMapPoiRequest();
        req.setLabel("New"); req.setXPct(0.8); req.setYPct(0.2);

        MapPoiDto dto = service.updatePoi(1, 5, req, 10, false);

        assertThat(dto.label()).isEqualTo("New");
        assertThat(dto.xPct()).isEqualTo(0.8);
    }

    @Test
    void updatePoi_nonOwnerNonAdminThrows403() throws Exception {
        User other = new User(); setId(other, User.class, 99);
        MapPoi poi = buildPoi(5, world, type, other, 0.5, 0.5, "Old", "NEUTRAL");
        when(poiRepo.findById(5)).thenReturn(Optional.of(poi));

        UpdateMapPoiRequest req = new UpdateMapPoiRequest();
        assertThatThrownBy(() -> service.updatePoi(1, 5, req, 10, false))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("403");
    }

    @Test
    void deletePoi_adminCanDeleteAnyPoi() {
        MapPoi poi = buildPoi(5, world, type, user, 0.5, 0.5, "X", "NEUTRAL");
        when(poiRepo.findById(5)).thenReturn(Optional.of(poi));

        assertThatCode(() -> service.deletePoi(1, 5, 99, true))
            .doesNotThrowAnyException();
        verify(poiRepo).delete(poi);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private MapPoi buildPoi(int id, World w, PoiType t, User u,
                            double x, double y, String label, String gesinnung) {
        try {
            MapPoi p = new MapPoi();
            setId(p, MapPoi.class, id);
            p.setWorld(w); p.setPoiType(t); p.setCreatedBy(u);
            p.setXPct(x);  p.setYPct(y);
            p.setLabel(label);
            if (gesinnung != null) p.setGesinnung(MapPoi.Gesinnung.valueOf(gesinnung));
            return p;
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private static <T> void setId(T obj, Class<T> clazz, int id) throws Exception {
        Field f = clazz.getDeclaredField("id");
        f.setAccessible(true);
        f.set(obj, id);
    }
}
