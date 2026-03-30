package com.pardur.repository;

import com.pardur.dto.response.TagCountDto;
import com.pardur.model.EventTag;
import com.pardur.model.EventTagId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface EventTagRepository extends JpaRepository<EventTag, EventTagId> {

    @Query("SELECT new com.pardur.dto.response.TagCountDto(t.id.tagName, COUNT(t)) " +
           "FROM EventTag t WHERE t.event.world.id = :worldId " +
           "GROUP BY t.id.tagName ORDER BY COUNT(t) DESC")
    List<TagCountDto> findTagCountsByWorldId(@Param("worldId") Integer worldId);
}
