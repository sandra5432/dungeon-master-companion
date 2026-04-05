package com.pardur.repository;

import com.pardur.model.WikiImage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WikiImageRepository extends JpaRepository<WikiImage, Integer> {
}
