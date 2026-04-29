package com.pardur.repository;

import com.pardur.model.IdeaVote;
import com.pardur.model.IdeaVoteId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface IdeaVoteRepository extends JpaRepository<IdeaVote, IdeaVoteId> {

    @Query("SELECT v FROM IdeaVote v WHERE v.idea.id = :ideaId AND v.user.id = :userId")
    Optional<IdeaVote> findByIdeaAndUser(@Param("ideaId") Integer ideaId, @Param("userId") Integer userId);

    @Modifying
    @Query("DELETE FROM IdeaVote v WHERE v.idea.id = :ideaId AND v.user.id = :userId")
    void deleteByIdeaAndUser(@Param("ideaId") Integer ideaId, @Param("userId") Integer userId);
}
