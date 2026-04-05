package com.pardur.repository;

import com.pardur.model.WikiSpoilerReader;
import com.pardur.model.WikiSpoilerReaderId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WikiSpoilerReaderRepository extends JpaRepository<WikiSpoilerReader, WikiSpoilerReaderId> {

    List<WikiSpoilerReader> findByIdEntryId(Integer entryId);

    boolean existsByIdEntryIdAndIdUserId(Integer entryId, Integer userId);
}
