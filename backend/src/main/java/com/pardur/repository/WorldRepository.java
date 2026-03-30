package com.pardur.repository;

import com.pardur.model.World;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorldRepository extends JpaRepository<World, Integer> {
    List<World> findAllByOrderBySortOrderAsc();
}
