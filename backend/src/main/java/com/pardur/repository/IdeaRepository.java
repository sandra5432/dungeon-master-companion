package com.pardur.repository;

import com.pardur.model.Idea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IdeaRepository extends JpaRepository<Idea, Integer> {

    @Query("SELECT COUNT(v) FROM IdeaVote v WHERE v.idea.id = :ideaId")
    long countVotes(@Param("ideaId") Integer ideaId);

    @Query("SELECT COUNT(c) FROM IdeaComment c WHERE c.idea.id = :ideaId")
    long countComments(@Param("ideaId") Integer ideaId);
}
