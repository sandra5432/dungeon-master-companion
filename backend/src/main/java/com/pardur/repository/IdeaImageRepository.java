package com.pardur.repository;

import com.pardur.model.IdeaImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Repository for idea images. */
public interface IdeaImageRepository extends JpaRepository<IdeaImage, Integer> {

    List<IdeaImage> findAllByIdeaIdOrderByCreatedAtAsc(Integer ideaId);

    long countByIdeaId(Integer ideaId);

    Optional<IdeaImage> findFirstByIdeaIdOrderByCreatedAtAsc(Integer ideaId);
}
