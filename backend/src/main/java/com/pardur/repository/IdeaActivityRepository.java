package com.pardur.repository;

import com.pardur.model.IdeaActivity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IdeaActivityRepository extends JpaRepository<IdeaActivity, Integer> {

    List<IdeaActivity> findAllByIdeaIdOrderByCreatedAtDesc(Integer ideaId);
}
