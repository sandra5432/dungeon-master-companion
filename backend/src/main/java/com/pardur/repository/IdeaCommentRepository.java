package com.pardur.repository;

import com.pardur.model.IdeaComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IdeaCommentRepository extends JpaRepository<IdeaComment, Integer> {

    List<IdeaComment> findAllByIdeaIdOrderByCreatedAtDesc(Integer ideaId);
}
