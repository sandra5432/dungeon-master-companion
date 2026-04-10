package com.pardur.repository;

import com.pardur.model.MapPoi;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MapPoiRepository extends JpaRepository<MapPoi, Integer> {
    List<MapPoi> findAllByWorldIdOrderByCreatedAtAsc(Integer worldId);
}
