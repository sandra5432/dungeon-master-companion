package com.pardur.repository;

import com.pardur.model.World;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorldRepository extends JpaRepository<World, Integer> {
}
