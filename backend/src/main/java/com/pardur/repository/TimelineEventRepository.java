package com.pardur.repository;

import com.pardur.model.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Integer> {

    List<TimelineEvent> findAllByWorldIdAndSequenceOrderIsNotNullOrderBySequenceOrderAsc(Integer worldId);

    List<TimelineEvent> findAllByWorldIdAndSequenceOrderIsNullOrderByCreatedAtAsc(Integer worldId);

    Optional<TimelineEvent> findTopByWorldIdAndSequenceOrderLessThanOrderBySequenceOrderDesc(Integer worldId, BigDecimal seq);

    Optional<TimelineEvent> findTopByWorldIdAndSequenceOrderGreaterThanOrderBySequenceOrderAsc(Integer worldId, BigDecimal seq);

    Optional<TimelineEvent> findFirstByWorldIdOrderBySequenceOrderAsc(Integer worldId);
}
