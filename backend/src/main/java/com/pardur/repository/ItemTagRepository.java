package com.pardur.repository;

import com.pardur.dto.response.TagCountDto;
import com.pardur.model.ItemTag;
import com.pardur.model.ItemTagId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ItemTagRepository extends JpaRepository<ItemTag, ItemTagId> {

    @Query("SELECT new com.pardur.dto.response.TagCountDto(t.id.tagName, COUNT(t)) " +
           "FROM ItemTag t GROUP BY t.id.tagName ORDER BY COUNT(t) DESC")
    List<TagCountDto> findAllTagCounts();
}
