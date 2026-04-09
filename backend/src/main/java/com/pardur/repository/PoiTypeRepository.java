package com.pardur.repository;

import com.pardur.model.PoiType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PoiTypeRepository extends JpaRepository<PoiType, Integer> {
    List<PoiType> findAllByOrderByIsDefaultDescNameAsc();
}
