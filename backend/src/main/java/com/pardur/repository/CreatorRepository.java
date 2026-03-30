package com.pardur.repository;

import com.pardur.model.Creator;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CreatorRepository extends JpaRepository<Creator, String> {
    List<Creator> findAllByOrderByCodeAsc();
}
