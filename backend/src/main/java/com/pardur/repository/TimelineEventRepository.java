package com.pardur.repository;

import com.pardur.model.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Integer> {

    List<TimelineEvent> findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(Integer worldId);

    List<TimelineEvent> findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(Integer worldId);

    Optional<TimelineEvent> findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(Integer worldId, BigDecimal seq);

    Optional<TimelineEvent> findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(Integer worldId, BigDecimal seq);

    Optional<TimelineEvent> findFirstByWorldIdOrderBySequenceOrderAsc(Integer worldId);

    @Query("SELECT e FROM TimelineEvent e WHERE LOWER(e.title) LIKE LOWER(CONCAT('%', :title, '%')) OR LOWER(e.description) LIKE LOWER(CONCAT('%', :title, '%'))")
    List<TimelineEvent> findByTitleOrDescriptionContainingIgnoreCase(@Param("title") String title);
}
