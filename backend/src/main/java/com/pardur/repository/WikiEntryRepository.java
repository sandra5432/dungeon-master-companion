package com.pardur.repository;

import com.pardur.model.WikiEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WikiEntryRepository extends JpaRepository<WikiEntry, Integer> {

    List<WikiEntry> findAllByWorldIdOrderByTitleAsc(Integer worldId);

    List<WikiEntry> findTop20ByOrderByUpdatedAtDesc();

    @Query("SELECT e FROM WikiEntry e WHERE LOWER(e.title) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(e.body) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<WikiEntry> searchByTitleOrBody(@Param("q") String q);

    @Query("SELECT e FROM WikiEntry e WHERE LOWER(e.body) LIKE LOWER(CONCAT('%', :title, '%')) AND e.id <> :excludeId")
    List<WikiEntry> findByBodyContainingTitle(@Param("title") String title, @Param("excludeId") Integer excludeId);

    @Query("SELECT e FROM WikiEntry e WHERE e.world.id = :worldId AND LOWER(e.title) = LOWER(:title) AND e.id <> :excludeId")
    Optional<WikiEntry> findDuplicateTitle(@Param("worldId") Integer worldId, @Param("title") String title, @Param("excludeId") Integer excludeId);

    List<WikiEntry> findByParentId(Integer parentId);
}
