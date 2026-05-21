package com.pardur.repository;

import com.pardur.model.TimelineEpoch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;

/** Data access for timeline epochs. */
public interface TimelineEpochRepository extends JpaRepository<TimelineEpoch, Integer> {

    /**
     * Returns all epochs for a world, ordered oldest-first.
     *
     * @param worldId target world
     * @return epochs sorted by startPosition ASC
     */
    List<TimelineEpoch> findAllByWorldIdOrderByStartPositionAsc(Integer worldId);

    /**
     * Checks whether any epoch in the world (excluding a given ID) overlaps the
     * provided position range.
     *
     * @param worldId   target world
     * @param excludeId epoch to exclude (use -1 for create)
     * @param newStart  candidate start position
     * @param newEnd    candidate end position (null = open-ended)
     * @return true if at least one overlapping epoch exists
     */
    @Query("""
        SELECT COUNT(e) > 0 FROM TimelineEpoch e
        WHERE e.world.id = :worldId
          AND e.id <> :excludeId
          AND e.startPosition < COALESCE(:newEnd, e.startPosition + 1)
          AND (e.endPosition IS NULL OR e.endPosition > :newStart)
        """)
    boolean existsOverlap(
        @Param("worldId")   Integer worldId,
        @Param("excludeId") Integer excludeId,
        @Param("newStart")  BigDecimal newStart,
        @Param("newEnd")    BigDecimal newEnd
    );
}
