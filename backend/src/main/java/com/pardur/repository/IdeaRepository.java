package com.pardur.repository;

import com.pardur.model.Idea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IdeaRepository extends JpaRepository<Idea, Integer> {

    @Query("SELECT i FROM Idea i WHERE i.world.id = :worldId ORDER BY i.createdAt DESC")
    List<Idea> findAllByWorldId(@Param("worldId") Integer worldId);

    @Query("SELECT t, COUNT(t) as cnt FROM Idea i JOIN i.tags t WHERE i.world.id = :worldId GROUP BY t ORDER BY cnt DESC")
    List<Object[]> findTagCountsByWorldId(@Param("worldId") Integer worldId);

    @Query("SELECT COUNT(v) FROM IdeaVote v WHERE v.idea.id = :ideaId")
    long countVotes(@Param("ideaId") Integer ideaId);

    @Query("SELECT COUNT(c) FROM IdeaComment c WHERE c.idea.id = :ideaId")
    long countComments(@Param("ideaId") Integer ideaId);
}
