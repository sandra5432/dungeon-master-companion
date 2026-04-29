# Ideenkammer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a kanban-style Idea Board (Ideenkammer) with three columns (Entwurf → In Arbeit → Vollendet), comments, votes, activity log, and automatic wiki stub creation when an idea reaches Vollendet.

**Architecture:** New `ideas.*` slice following existing patterns exactly — Flyway migration, JPA entities with `user_id INT` FKs (not creator_code), service + controller pair, plus a new `ideas.js` frontend module loaded after `users.js`. The page is hidden from guests via `user-action-only` class on the nav link and a guard in `showPage`.

**Tech Stack:** Java 21 / Spring Boot 3 / Spring Data JPA / MySQL; Vanilla JS + marked.js (already loaded); existing CSS token system.

---

## File Map

**Create:**
- `backend/src/main/resources/db/migration/V23__ideenkammer.sql`
- `backend/src/main/java/com/pardur/model/Idea.java`
- `backend/src/main/java/com/pardur/model/IdeaStatus.java`
- `backend/src/main/java/com/pardur/model/IdeaComment.java`
- `backend/src/main/java/com/pardur/model/IdeaActivity.java`
- `backend/src/main/java/com/pardur/model/IdeaActivityType.java`
- `backend/src/main/java/com/pardur/model/IdeaVote.java`
- `backend/src/main/java/com/pardur/model/IdeaVoteId.java`
- `backend/src/main/java/com/pardur/repository/IdeaRepository.java`
- `backend/src/main/java/com/pardur/repository/IdeaCommentRepository.java`
- `backend/src/main/java/com/pardur/repository/IdeaActivityRepository.java`
- `backend/src/main/java/com/pardur/repository/IdeaVoteRepository.java`
- `backend/src/main/java/com/pardur/dto/request/CreateIdeaRequest.java`
- `backend/src/main/java/com/pardur/dto/request/UpdateIdeaRequest.java`
- `backend/src/main/java/com/pardur/dto/request/UpdateIdeaStatusRequest.java`
- `backend/src/main/java/com/pardur/dto/request/CreateIdeaCommentRequest.java`
- `backend/src/main/java/com/pardur/dto/response/IdeaDto.java`
- `backend/src/main/java/com/pardur/dto/response/IdeaCommentDto.java`
- `backend/src/main/java/com/pardur/dto/response/IdeaActivityDto.java`
- `backend/src/main/java/com/pardur/service/IdeaService.java`
- `backend/src/main/java/com/pardur/controller/IdeaController.java`
- `backend/src/main/resources/static/js/ideas.js`

**Modify:**
- `backend/src/main/java/com/pardur/config/SecurityConfig.java` — add idea endpoint rules
- `backend/src/main/resources/static/js/core.js` — add `state.ideas`, guard in `showPage`, load ideas in `init`
- `backend/src/main/resources/static/css/app.css` — status tokens + idea board CSS
- `backend/src/main/resources/static/index.html` — nav link, page HTML, detail panel, modal, toast, script tag

---

## Task 1: DB Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V23__ideenkammer.sql`

- [ ] **Step 1: Write migration**

```sql
-- V23__ideenkammer.sql
CREATE TABLE ideas (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  world_id        INT           NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  description     TEXT,
  status          ENUM('draft','doing','done') NOT NULL DEFAULT 'draft',
  creator_user_id INT           NOT NULL,
  due_at          DATE          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_idea_world   FOREIGN KEY (world_id)        REFERENCES worlds(id) ON DELETE CASCADE,
  CONSTRAINT fk_idea_creator FOREIGN KEY (creator_user_id) REFERENCES users(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_tags (
  idea_id  INT         NOT NULL,
  tag_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (idea_id, tag_name),
  CONSTRAINT fk_itag_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_idea_tags_name ON idea_tags(tag_name);

CREATE TABLE idea_votes (
  idea_id     INT NOT NULL,
  user_id     INT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idea_id, user_id),
  CONSTRAINT fk_ivote_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ivote_user FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_comments (
  id              INT  AUTO_INCREMENT PRIMARY KEY,
  idea_id         INT  NOT NULL,
  creator_user_id INT  NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_icmt_idea    FOREIGN KEY (idea_id)         REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_icmt_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idea_activity (
  id              INT  AUTO_INCREMENT PRIMARY KEY,
  idea_id         INT  NOT NULL,
  actor_user_id   INT  NOT NULL,
  type            ENUM('created','status','comment') NOT NULL,
  from_status     VARCHAR(20) NULL,
  to_status       VARCHAR(20) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iact_idea  FOREIGN KEY (idea_id)       REFERENCES ideas(id) ON DELETE CASCADE,
  CONSTRAINT fk_iact_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Verify migration applies cleanly** — start the app once, confirm no Flyway errors in logs.

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/resources/db/migration/V23__ideenkammer.sql
git commit -m "feat(db): add ideenkammer migration V23"
```

---

## Task 2: Models + Enums

**Files:**
- Create: `model/IdeaStatus.java`, `model/IdeaActivityType.java`, `model/IdeaVoteId.java`, `model/Idea.java`, `model/IdeaComment.java`, `model/IdeaActivity.java`, `model/IdeaVote.java`

- [ ] **Step 1: IdeaStatus enum**

```java
// backend/src/main/java/com/pardur/model/IdeaStatus.java
package com.pardur.model;
public enum IdeaStatus { draft, doing, done }
```

- [ ] **Step 2: IdeaActivityType enum**

```java
// backend/src/main/java/com/pardur/model/IdeaActivityType.java
package com.pardur.model;
public enum IdeaActivityType { created, status, comment }
```

- [ ] **Step 3: IdeaVoteId composite key**

```java
// backend/src/main/java/com/pardur/model/IdeaVoteId.java
package com.pardur.model;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class IdeaVoteId implements Serializable {
    private Integer ideaId;
    private Integer userId;
    public IdeaVoteId() {}
    public IdeaVoteId(Integer ideaId, Integer userId) { this.ideaId = ideaId; this.userId = userId; }
    public Integer getIdeaId() { return ideaId; }
    public void setIdeaId(Integer ideaId) { this.ideaId = ideaId; }
    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }
    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof IdeaVoteId that)) return false;
        return Objects.equals(ideaId, that.ideaId) && Objects.equals(userId, that.userId);
    }
    @Override public int hashCode() { return Objects.hash(ideaId, userId); }
}
```

- [ ] **Step 4: Idea entity**

```java
// backend/src/main/java/com/pardur/model/Idea.java
package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Represents a player idea on the Ideenkammer board. */
@Entity
@Table(name = "ideas")
public class Idea {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "world_id", nullable = false)
    private World world;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private IdeaStatus status = IdeaStatus.draft;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_user_id", nullable = false)
    private User createdBy;

    @Column(name = "due_at")
    private LocalDate dueAt;

    @ElementCollection
    @CollectionTable(name = "idea_tags", joinColumns = @JoinColumn(name = "idea_id"))
    @Column(name = "tag_name")
    private List<String> tags = new ArrayList<>();

    @OneToMany(mappedBy = "idea", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<IdeaVote> votes = new ArrayList<>();

    @OneToMany(mappedBy = "idea", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private List<IdeaComment> comments = new ArrayList<>();

    @OneToMany(mappedBy = "idea", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt DESC")
    private List<IdeaActivity> activities = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public World getWorld() { return world; }
    public void setWorld(World world) { this.world = world; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public IdeaStatus getStatus() { return status; }
    public void setStatus(IdeaStatus status) { this.status = status; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public LocalDate getDueAt() { return dueAt; }
    public void setDueAt(LocalDate dueAt) { this.dueAt = dueAt; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public List<IdeaVote> getVotes() { return votes; }
    public List<IdeaComment> getComments() { return comments; }
    public List<IdeaActivity> getActivities() { return activities; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
```

- [ ] **Step 5: IdeaVote entity**

```java
// backend/src/main/java/com/pardur/model/IdeaVote.java
package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "idea_votes")
public class IdeaVote {

    @EmbeddedId
    private IdeaVoteId id = new IdeaVoteId();

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("ideaId")
    @JoinColumn(name = "idea_id")
    private Idea idea;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public IdeaVote() {}
    public IdeaVote(Idea idea, User user) {
        this.idea = idea;
        this.user = user;
        this.id = new IdeaVoteId(idea.getId(), user.getId());
    }

    public IdeaVoteId getId() { return id; }
    public Idea getIdea() { return idea; }
    public User getUser() { return user; }
}
```

- [ ] **Step 6: IdeaComment entity**

```java
// backend/src/main/java/com/pardur/model/IdeaComment.java
package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "idea_comments")
public class IdeaComment {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "idea_id", nullable = false)
    private Idea idea;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_user_id", nullable = false)
    private User createdBy;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId() { return id; }
    public Idea getIdea() { return idea; }
    public void setIdea(Idea idea) { this.idea = idea; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 7: IdeaActivity entity**

```java
// backend/src/main/java/com/pardur/model/IdeaActivity.java
package com.pardur.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "idea_activity")
public class IdeaActivity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "idea_id", nullable = false)
    private Idea idea;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IdeaActivityType type;

    @Column(name = "from_status", length = 20)
    private String fromStatus;

    @Column(name = "to_status", length = 20)
    private String toStatus;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId() { return id; }
    public Idea getIdea() { return idea; }
    public void setIdea(Idea idea) { this.idea = idea; }
    public User getActor() { return actor; }
    public void setActor(User actor) { this.actor = actor; }
    public IdeaActivityType getType() { return type; }
    public void setType(IdeaActivityType type) { this.type = type; }
    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }
    public String getToStatus() { return toStatus; }
    public void setToStatus(String toStatus) { this.toStatus = toStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 8: Commit**
```bash
git add backend/src/main/java/com/pardur/model/
git commit -m "feat(model): add Idea, IdeaVote, IdeaComment, IdeaActivity entities"
```

---

## Task 3: Repositories + DTOs

**Files:**
- Create: 4 repositories, 3 request DTOs, 3 response DTOs

- [ ] **Step 1: IdeaRepository**

```java
// backend/src/main/java/com/pardur/repository/IdeaRepository.java
package com.pardur.repository;

import com.pardur.model.Idea;
import com.pardur.model.IdeaStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IdeaRepository extends JpaRepository<Idea, Integer> {
    List<Idea> findAllByWorldIdOrderByCreatedAtDesc(Integer worldId);
    List<Idea> findAllByWorldIdAndStatusOrderByCreatedAtDesc(Integer worldId, IdeaStatus status);
}
```

- [ ] **Step 2: IdeaCommentRepository**

```java
// backend/src/main/java/com/pardur/repository/IdeaCommentRepository.java
package com.pardur.repository;

import com.pardur.model.IdeaComment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IdeaCommentRepository extends JpaRepository<IdeaComment, Integer> {
    List<IdeaComment> findAllByIdeaIdOrderByCreatedAtDesc(Integer ideaId);
}
```

- [ ] **Step 3: IdeaActivityRepository**

```java
// backend/src/main/java/com/pardur/repository/IdeaActivityRepository.java
package com.pardur.repository;

import com.pardur.model.IdeaActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IdeaActivityRepository extends JpaRepository<IdeaActivity, Integer> {
    List<IdeaActivity> findAllByIdeaIdOrderByCreatedAtDesc(Integer ideaId);
}
```

- [ ] **Step 4: IdeaVoteRepository**

```java
// backend/src/main/java/com/pardur/repository/IdeaVoteRepository.java
package com.pardur.repository;

import com.pardur.model.IdeaVote;
import com.pardur.model.IdeaVoteId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface IdeaVoteRepository extends JpaRepository<IdeaVote, IdeaVoteId> {
    Optional<IdeaVote> findByIdeaIdAndUserId(Integer ideaId, Integer userId);
}
```

- [ ] **Step 5: IdeaDto response**

```java
// backend/src/main/java/com/pardur/dto/response/IdeaDto.java
package com.pardur.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class IdeaDto {
    private Integer id;
    private Integer worldId;
    private String title;
    private String description;
    private String status;
    private Integer createdByUserId;
    private String creatorUsername;
    private String creatorColorHex;
    private LocalDate dueAt;
    private List<String> tags;
    private List<Integer> voterIds;
    private int voteCount;
    private int commentCount;
    private boolean wikiStubCreated;
    private LocalDateTime createdAt;

    public IdeaDto() {}
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getWorldId() { return worldId; }
    public void setWorldId(Integer worldId) { this.worldId = worldId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Integer createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getCreatorUsername() { return creatorUsername; }
    public void setCreatorUsername(String creatorUsername) { this.creatorUsername = creatorUsername; }
    public String getCreatorColorHex() { return creatorColorHex; }
    public void setCreatorColorHex(String creatorColorHex) { this.creatorColorHex = creatorColorHex; }
    public LocalDate getDueAt() { return dueAt; }
    public void setDueAt(LocalDate dueAt) { this.dueAt = dueAt; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public List<Integer> getVoterIds() { return voterIds; }
    public void setVoterIds(List<Integer> voterIds) { this.voterIds = voterIds; }
    public int getVoteCount() { return voteCount; }
    public void setVoteCount(int voteCount) { this.voteCount = voteCount; }
    public int getCommentCount() { return commentCount; }
    public void setCommentCount(int commentCount) { this.commentCount = commentCount; }
    public boolean isWikiStubCreated() { return wikiStubCreated; }
    public void setWikiStubCreated(boolean wikiStubCreated) { this.wikiStubCreated = wikiStubCreated; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
```

- [ ] **Step 6: IdeaCommentDto**

```java
// backend/src/main/java/com/pardur/dto/response/IdeaCommentDto.java
package com.pardur.dto.response;

import java.time.LocalDateTime;

public class IdeaCommentDto {
    private Integer id;
    private Integer createdByUserId;
    private String creatorUsername;
    private String creatorColorHex;
    private String body;
    private LocalDateTime createdAt;

    public IdeaCommentDto() {}
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Integer v) { this.createdByUserId = v; }
    public String getCreatorUsername() { return creatorUsername; }
    public void setCreatorUsername(String v) { this.creatorUsername = v; }
    public String getCreatorColorHex() { return creatorColorHex; }
    public void setCreatorColorHex(String v) { this.creatorColorHex = v; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }
}
```

- [ ] **Step 7: IdeaActivityDto**

```java
// backend/src/main/java/com/pardur/dto/response/IdeaActivityDto.java
package com.pardur.dto.response;

import java.time.LocalDateTime;

public class IdeaActivityDto {
    private Integer id;
    private Integer actorUserId;
    private String actorUsername;
    private String actorColorHex;
    private String type;
    private String fromStatus;
    private String toStatus;
    private LocalDateTime createdAt;

    public IdeaActivityDto() {}
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getActorUserId() { return actorUserId; }
    public void setActorUserId(Integer v) { this.actorUserId = v; }
    public String getActorUsername() { return actorUsername; }
    public void setActorUsername(String v) { this.actorUsername = v; }
    public String getActorColorHex() { return actorColorHex; }
    public void setActorColorHex(String v) { this.actorColorHex = v; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String v) { this.fromStatus = v; }
    public String getToStatus() { return toStatus; }
    public void setToStatus(String v) { this.toStatus = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }
}
```

- [ ] **Step 8: Request DTOs**

```java
// backend/src/main/java/com/pardur/dto/request/CreateIdeaRequest.java
package com.pardur.dto.request;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public class CreateIdeaRequest {
    @NotBlank @Size(max = 255)
    private String title;
    private String description;
    private LocalDate dueAt;
    private List<String> tags;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDate getDueAt() { return dueAt; }
    public void setDueAt(LocalDate dueAt) { this.dueAt = dueAt; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
```

```java
// backend/src/main/java/com/pardur/dto/request/UpdateIdeaRequest.java
package com.pardur.dto.request;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public class UpdateIdeaRequest {
    @NotBlank @Size(max = 255)
    private String title;
    private String description;
    private LocalDate dueAt;
    private List<String> tags;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDate getDueAt() { return dueAt; }
    public void setDueAt(LocalDate dueAt) { this.dueAt = dueAt; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
```

```java
// backend/src/main/java/com/pardur/dto/request/UpdateIdeaStatusRequest.java
package com.pardur.dto.request;
import jakarta.validation.constraints.NotBlank;

public class UpdateIdeaStatusRequest {
    @NotBlank
    private String status;
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
```

```java
// backend/src/main/java/com/pardur/dto/request/CreateIdeaCommentRequest.java
package com.pardur.dto.request;
import jakarta.validation.constraints.NotBlank;

public class CreateIdeaCommentRequest {
    @NotBlank
    private String body;
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
```

- [ ] **Step 9: Commit**
```bash
git add backend/src/main/java/com/pardur/
git commit -m "feat(model): add idea repositories and DTOs"
```

---

## Task 4: IdeaService

**Files:**
- Create: `service/IdeaService.java`

- [ ] **Step 1: Write IdeaService**

```java
// backend/src/main/java/com/pardur/service/IdeaService.java
package com.pardur.service;

import com.pardur.dto.request.*;
import com.pardur.dto.response.*;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

/**
 * Business logic for Ideenkammer: ideas, votes, comments, activity log, wiki stub creation.
 */
@Service
public class IdeaService {

    private final IdeaRepository ideaRepo;
    private final IdeaCommentRepository commentRepo;
    private final IdeaActivityRepository activityRepo;
    private final IdeaVoteRepository voteRepo;
    private final WorldRepository worldRepo;
    private final UserRepository userRepo;
    private final WikiEntryRepository wikiRepo;
    private final WorldPermissionChecker checker;

    public IdeaService(IdeaRepository ideaRepo,
                       IdeaCommentRepository commentRepo,
                       IdeaActivityRepository activityRepo,
                       IdeaVoteRepository voteRepo,
                       WorldRepository worldRepo,
                       UserRepository userRepo,
                       WikiEntryRepository wikiRepo,
                       WorldPermissionChecker checker) {
        this.ideaRepo    = ideaRepo;
        this.commentRepo = commentRepo;
        this.activityRepo = activityRepo;
        this.voteRepo    = voteRepo;
        this.worldRepo   = worldRepo;
        this.userRepo    = userRepo;
        this.wikiRepo    = wikiRepo;
        this.checker     = checker;
    }

    // ── READ ────────────────────────────────────────────────────────────────

    /**
     * Returns all ideas for the given world, ordered newest-first.
     *
     * @param worldId target world
     * @param auth    caller authentication
     * @return list of idea DTOs
     */
    @Transactional(readOnly = true)
    public List<IdeaDto> listIdeas(Integer worldId, Authentication auth) {
        requireAuth(auth);
        requireWorld(worldId);
        return ideaRepo.findAllByWorldIdOrderByCreatedAtDesc(worldId)
                .stream().map(this::toDto).toList();
    }

    /**
     * Returns a single idea by ID.
     *
     * @param worldId target world
     * @param ideaId  idea ID
     * @param auth    caller authentication
     * @return idea DTO
     * @throws ResourceNotFoundException if idea does not exist in world
     */
    @Transactional(readOnly = true)
    public IdeaDto getIdea(Integer worldId, Integer ideaId, Authentication auth) {
        requireAuth(auth);
        return toDto(requireIdea(worldId, ideaId));
    }

    /**
     * Returns all comments for an idea, newest-first.
     */
    @Transactional(readOnly = true)
    public List<IdeaCommentDto> listComments(Integer worldId, Integer ideaId, Authentication auth) {
        requireAuth(auth);
        requireIdea(worldId, ideaId);
        return commentRepo.findAllByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toCommentDto).toList();
    }

    /**
     * Returns the activity log for an idea, newest-first.
     */
    @Transactional(readOnly = true)
    public List<IdeaActivityDto> listActivity(Integer worldId, Integer ideaId, Authentication auth) {
        requireAuth(auth);
        requireIdea(worldId, ideaId);
        return activityRepo.findAllByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toActivityDto).toList();
    }

    /**
     * Returns all distinct tag names used in the given world's ideas, with counts.
     */
    @Transactional(readOnly = true)
    public List<TagCountDto> listTags(Integer worldId, Authentication auth) {
        requireAuth(auth);
        requireWorld(worldId);
        return ideaRepo.findAllByWorldIdOrderByCreatedAtDesc(worldId).stream()
                .flatMap(i -> i.getTags().stream())
                .collect(java.util.stream.Collectors.groupingBy(t -> t, java.util.stream.Collectors.counting()))
                .entrySet().stream()
                .map(e -> new TagCountDto(e.getKey(), e.getValue().intValue()))
                .sorted(java.util.Comparator.comparing(TagCountDto::getTag))
                .toList();
    }

    // ── WRITE ───────────────────────────────────────────────────────────────

    /**
     * Creates a new idea with status=draft and logs a 'created' activity entry.
     *
     * @param worldId target world
     * @param req     validated request body
     * @param auth    caller authentication (must be logged in)
     * @return created idea DTO
     */
    @Transactional
    public IdeaDto createIdea(Integer worldId, CreateIdeaRequest req, Authentication auth) {
        requireAuth(auth);
        World world = requireWorld(worldId);
        User creator = requireUser(auth);

        Idea idea = new Idea();
        idea.setWorld(world);
        idea.setTitle(req.getTitle());
        idea.setDescription(req.getDescription());
        idea.setDueAt(req.getDueAt());
        idea.setCreatedBy(creator);
        if (req.getTags() != null) idea.getTags().addAll(req.getTags());

        Idea saved = ideaRepo.save(idea);

        IdeaActivity act = new IdeaActivity();
        act.setIdea(saved);
        act.setActor(creator);
        act.setType(IdeaActivityType.created);
        activityRepo.save(act);

        return toDto(saved);
    }

    /**
     * Updates title, description, dueAt, and tags of an idea.
     * Only the creator or an admin may edit.
     */
    @Transactional
    public IdeaDto updateIdea(Integer worldId, Integer ideaId, UpdateIdeaRequest req, Authentication auth) {
        requireAuth(auth);
        Idea idea = requireIdea(worldId, ideaId);
        requireOwnerOrAdmin(idea, auth);

        idea.setTitle(req.getTitle());
        idea.setDescription(req.getDescription());
        idea.setDueAt(req.getDueAt());
        idea.getTags().clear();
        if (req.getTags() != null) idea.getTags().addAll(req.getTags());

        return toDto(ideaRepo.save(idea));
    }

    /**
     * Changes the status of an idea. Only creator or admin.
     * If transitioning to 'done', creates a wiki stub (INSERT IGNORE semantics via existence check).
     *
     * @param worldId target world
     * @param ideaId  idea ID
     * @param req     new status
     * @param auth    caller
     * @return updated idea DTO; {@code wikiStubCreated=true} if a new wiki page was created
     */
    @Transactional
    public IdeaDto updateStatus(Integer worldId, Integer ideaId, UpdateIdeaStatusRequest req, Authentication auth) {
        requireAuth(auth);
        Idea idea = requireIdea(worldId, ideaId);
        requireOwnerOrAdmin(idea, auth);

        IdeaStatus newStatus;
        try {
            newStatus = IdeaStatus.valueOf(req.getStatus());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + req.getStatus());
        }

        String oldStatusStr = idea.getStatus().name();
        idea.setStatus(newStatus);
        ideaRepo.save(idea);

        User actor = requireUser(auth);
        IdeaActivity act = new IdeaActivity();
        act.setIdea(idea);
        act.setActor(actor);
        act.setType(IdeaActivityType.status);
        act.setFromStatus(oldStatusStr);
        act.setToStatus(newStatus.name());
        activityRepo.save(act);

        boolean stubCreated = false;
        if (newStatus == IdeaStatus.done) {
            stubCreated = createWikiStubIfAbsent(idea.getWorld(), idea.getTitle(), actor);
        }

        IdeaDto dto = toDto(idea);
        dto.setWikiStubCreated(stubCreated);
        return dto;
    }

    /**
     * Deletes an idea. Only creator or admin.
     */
    @Transactional
    public void deleteIdea(Integer worldId, Integer ideaId, Authentication auth) {
        requireAuth(auth);
        Idea idea = requireIdea(worldId, ideaId);
        requireOwnerOrAdmin(idea, auth);
        ideaRepo.delete(idea);
    }

    /**
     * Toggles a vote: adds if not present, removes if already voted.
     *
     * @return updated idea DTO
     */
    @Transactional
    public IdeaDto toggleVote(Integer worldId, Integer ideaId, Authentication auth) {
        requireAuth(auth);
        Idea idea = requireIdea(worldId, ideaId);
        User user = requireUser(auth);

        Optional<IdeaVote> existing = voteRepo.findByIdeaIdAndUserId(ideaId, user.getId());
        if (existing.isPresent()) {
            voteRepo.delete(existing.get());
        } else {
            voteRepo.save(new IdeaVote(idea, user));
        }
        // Reload to get fresh vote list
        ideaRepo.flush();
        return toDto(ideaRepo.findById(ideaId).orElseThrow());
    }

    /**
     * Adds a comment to an idea and logs a 'comment' activity entry.
     */
    @Transactional
    public IdeaCommentDto addComment(Integer worldId, Integer ideaId, CreateIdeaCommentRequest req, Authentication auth) {
        requireAuth(auth);
        Idea idea = requireIdea(worldId, ideaId);
        User user = requireUser(auth);

        IdeaComment comment = new IdeaComment();
        comment.setIdea(idea);
        comment.setCreatedBy(user);
        comment.setBody(req.getBody());
        IdeaComment saved = commentRepo.save(comment);

        IdeaActivity act = new IdeaActivity();
        act.setIdea(idea);
        act.setActor(user);
        act.setType(IdeaActivityType.comment);
        activityRepo.save(act);

        return toCommentDto(saved);
    }

    // ── PRIVATE HELPERS ─────────────────────────────────────────────────────

    private World requireWorld(Integer worldId) {
        return worldRepo.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    }

    private Idea requireIdea(Integer worldId, Integer ideaId) {
        Idea idea = ideaRepo.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found: " + ideaId));
        if (!idea.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Idea " + ideaId + " not in world " + worldId);
        }
        return idea;
    }

    private User requireUser(Authentication auth) {
        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        return userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private void requireAuth(Authentication auth) {
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
    }

    private void requireOwnerOrAdmin(Idea idea, Authentication auth) {
        if (WorldPermissionChecker.isAdmin(auth)) return;
        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        if (!idea.getCreatedBy().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not idea owner");
        }
    }

    /**
     * Creates a wiki stub page for the idea title if none exists yet.
     * @return true if a new page was created, false if one already existed
     */
    private boolean createWikiStubIfAbsent(World world, String title, User creator) {
        boolean exists = wikiRepo.findAll().stream()
                .anyMatch(e -> e.getWorld().getId().equals(world.getId())
                        && e.getTitle().equalsIgnoreCase(title));
        if (exists) return false;

        WikiEntry stub = new WikiEntry();
        stub.setWorld(world);
        stub.setTitle(title);
        stub.setType(WikiEntryType.MISC);
        stub.setBody("*(Automatisch angelegt aus der Ideenkammer)*");
        stub.setCreatedBy(creator);
        wikiRepo.save(stub);
        return true;
    }

    private IdeaDto toDto(Idea idea) {
        IdeaDto dto = new IdeaDto();
        dto.setId(idea.getId());
        dto.setWorldId(idea.getWorld().getId());
        dto.setTitle(idea.getTitle());
        dto.setDescription(idea.getDescription());
        dto.setStatus(idea.getStatus().name());
        dto.setCreatedByUserId(idea.getCreatedBy().getId());
        dto.setCreatorUsername(idea.getCreatedBy().getUsername());
        dto.setCreatorColorHex(idea.getCreatedBy().getColorHex());
        dto.setDueAt(idea.getDueAt());
        dto.setTags(List.copyOf(idea.getTags()));
        List<Integer> voterIds = idea.getVotes().stream()
                .map(v -> v.getUser().getId()).toList();
        dto.setVoterIds(voterIds);
        dto.setVoteCount(voterIds.size());
        dto.setCommentCount(idea.getComments().size());
        dto.setCreatedAt(idea.getCreatedAt());
        return dto;
    }

    private IdeaCommentDto toCommentDto(IdeaComment c) {
        IdeaCommentDto dto = new IdeaCommentDto();
        dto.setId(c.getId());
        dto.setCreatedByUserId(c.getCreatedBy().getId());
        dto.setCreatorUsername(c.getCreatedBy().getUsername());
        dto.setCreatorColorHex(c.getCreatedBy().getColorHex());
        dto.setBody(c.getBody());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }

    private IdeaActivityDto toActivityDto(IdeaActivity a) {
        IdeaActivityDto dto = new IdeaActivityDto();
        dto.setId(a.getId());
        dto.setActorUserId(a.getActor().getId());
        dto.setActorUsername(a.getActor().getUsername());
        dto.setActorColorHex(a.getActor().getColorHex());
        dto.setType(a.getType().name());
        dto.setFromStatus(a.getFromStatus());
        dto.setToStatus(a.getToStatus());
        dto.setCreatedAt(a.getCreatedAt());
        return dto;
    }
}
```

- [ ] **Step 2: Check WikiEntryType enum values** — open `WikiEntryType.java`, find the right constant for a generic entry (look for `MISC`, `MISC`, `OTHER`, or whichever is the catch-all value). Update `createWikiStubIfAbsent` if needed.

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/java/com/pardur/service/IdeaService.java
git commit -m "feat(service): add IdeaService"
```

---

## Task 5: IdeaController + Security

**Files:**
- Create: `controller/IdeaController.java`
- Modify: `config/SecurityConfig.java`

- [ ] **Step 1: Write IdeaController**

```java
// backend/src/main/java/com/pardur/controller/IdeaController.java
package com.pardur.controller;

import com.pardur.dto.request.*;
import com.pardur.dto.response.*;
import com.pardur.service.IdeaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** REST endpoints for the Ideenkammer board. All operations require an authenticated session. */
@RestController
@RequestMapping("/api/worlds/{worldId}/ideas")
public class IdeaController {

    private final IdeaService ideaService;

    public IdeaController(IdeaService ideaService) {
        this.ideaService = ideaService;
    }

    @GetMapping
    public ResponseEntity<List<IdeaDto>> list(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(ideaService.listIdeas(worldId, auth));
    }

    @GetMapping("/{ideaId}")
    public ResponseEntity<IdeaDto> get(@PathVariable Integer worldId,
                                       @PathVariable Integer ideaId,
                                       Authentication auth) {
        return ResponseEntity.ok(ideaService.getIdea(worldId, ideaId, auth));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<TagCountDto>> tags(@PathVariable Integer worldId, Authentication auth) {
        return ResponseEntity.ok(ideaService.listTags(worldId, auth));
    }

    @PostMapping
    public ResponseEntity<IdeaDto> create(@PathVariable Integer worldId,
                                          @Valid @RequestBody CreateIdeaRequest req,
                                          Authentication auth) {
        return ResponseEntity.status(201).body(ideaService.createIdea(worldId, req, auth));
    }

    @PutMapping("/{ideaId}")
    public ResponseEntity<IdeaDto> update(@PathVariable Integer worldId,
                                          @PathVariable Integer ideaId,
                                          @Valid @RequestBody UpdateIdeaRequest req,
                                          Authentication auth) {
        return ResponseEntity.ok(ideaService.updateIdea(worldId, ideaId, req, auth));
    }

    @PatchMapping("/{ideaId}/status")
    public ResponseEntity<IdeaDto> updateStatus(@PathVariable Integer worldId,
                                                @PathVariable Integer ideaId,
                                                @Valid @RequestBody UpdateIdeaStatusRequest req,
                                                Authentication auth) {
        return ResponseEntity.ok(ideaService.updateStatus(worldId, ideaId, req, auth));
    }

    @DeleteMapping("/{ideaId}")
    public ResponseEntity<Void> delete(@PathVariable Integer worldId,
                                       @PathVariable Integer ideaId,
                                       Authentication auth) {
        ideaService.deleteIdea(worldId, ideaId, auth);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{ideaId}/votes")
    public ResponseEntity<IdeaDto> toggleVote(@PathVariable Integer worldId,
                                              @PathVariable Integer ideaId,
                                              Authentication auth) {
        return ResponseEntity.ok(ideaService.toggleVote(worldId, ideaId, auth));
    }

    @GetMapping("/{ideaId}/comments")
    public ResponseEntity<List<IdeaCommentDto>> listComments(@PathVariable Integer worldId,
                                                              @PathVariable Integer ideaId,
                                                              Authentication auth) {
        return ResponseEntity.ok(ideaService.listComments(worldId, ideaId, auth));
    }

    @PostMapping("/{ideaId}/comments")
    public ResponseEntity<IdeaCommentDto> addComment(@PathVariable Integer worldId,
                                                      @PathVariable Integer ideaId,
                                                      @Valid @RequestBody CreateIdeaCommentRequest req,
                                                      Authentication auth) {
        return ResponseEntity.status(201).body(ideaService.addComment(worldId, ideaId, req, auth));
    }

    @GetMapping("/{ideaId}/activity")
    public ResponseEntity<List<IdeaActivityDto>> listActivity(@PathVariable Integer worldId,
                                                               @PathVariable Integer ideaId,
                                                               Authentication auth) {
        return ResponseEntity.ok(ideaService.listActivity(worldId, ideaId, auth));
    }
}
```

- [ ] **Step 2: Add security rules for ideas** — in `SecurityConfig.java`, inside the `authorizeHttpRequests` chain, add before the `anyRequest().authenticated()` line:

```java
// Ideas — require login for all operations (guests never see the board)
.requestMatchers("/api/worlds/*/ideas/**").hasRole("USER")
.requestMatchers(HttpMethod.GET, "/api/worlds/*/ideas").hasRole("USER")
```

- [ ] **Step 3: Build to confirm no compile errors**
```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**
```bash
git add backend/src/main/java/com/pardur/controller/IdeaController.java \
        backend/src/main/java/com/pardur/config/SecurityConfig.java
git commit -m "feat(api): add IdeaController and security rules"
```

---

## Task 6: Frontend CSS

**Files:**
- Modify: `backend/src/main/resources/static/css/app.css`

- [ ] **Step 1: Add status CSS tokens to both theme blocks**

In `:root[data-theme="dark"]` after the last rarity variable, add:
```css
  /* Ideenkammer status */
  --draft: #8a7a44; --draft2: #b89a54;
  --doing: #4a8ab8; --doing2: #6aaad8;
  --done:  #4a8a6a; --done2:  #8ac8a0;
  --overdue: #b85a4a;
```

In `:root[data-theme="light"]` after the last rarity variable, add:
```css
  /* Ideenkammer status */
  --draft: #7a5820; --draft2: #a07830;
  --doing: #2060a0; --doing2: #3880c8;
  --done:  #2a7a4a; --done2:  #3a9a6a;
  --overdue: #a83a2a;
```

- [ ] **Step 2: Append idea board CSS at the end of app.css**

```css
/* ══════════════════════════════════════
   IDEENKAMMER
══════════════════════════════════════ */

/* ── Tag filter bar ── */
.tag-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 18px 6px;
  border-bottom: 1px solid var(--bd);
  background: var(--bg-s);
}
.tag-filter-bar .tfb-label {
  font-family: 'Cinzel', serif;
  font-size: 0.56rem;
  color: var(--t3);
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-right: 2px;
}
.tfb {
  font-family: 'Cinzel', serif;
  font-size: 0.56rem;
  padding: 3px 9px;
  border: 1px solid var(--bd);
  background: transparent;
  color: var(--t2);
  border-radius: 2px;
  cursor: pointer;
  letter-spacing: .06em;
  transition: background var(--transition), border-color var(--transition), color var(--transition);
}
.tfb:hover { border-color: var(--bd-s); color: var(--t1); }
.tfb.active { background: var(--tag-bg); border-color: var(--tag-bd); color: var(--blue2); }
.sort-btn {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  padding: 3px 9px;
  border: 1px solid var(--bd);
  background: transparent;
  color: var(--t3);
  border-radius: 2px;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
}
.sort-btn.active { color: var(--gold); border-color: var(--gold); }

/* ── Rope rail ── */
.ideas-rope-wrap { padding: 20px 16px 40px; overflow-x: auto; }
.ideas-rope-rail {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  position: relative;
  min-width: 560px;
}
.ideas-rope-rail::before {
  content: '';
  position: absolute;
  top: 29px;
  left: calc(50% / 3);
  right: calc(50% / 3);
  height: 3px;
  background: repeating-linear-gradient(90deg, var(--rope) 0 6px, var(--rope2) 6px 10px);
  border-radius: 2px;
  pointer-events: none;
}
@media (max-width: 680px) {
  .ideas-rope-rail { grid-template-columns: 1fr; }
  .ideas-rope-rail::before { display: none; }
}

/* ── Column knot ── */
.ideas-rope-col { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ideas-rope-knot {
  width: 58px; height: 58px;
  border-radius: 50%;
  background: var(--bg-sb);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ideas-rope-knot.draft { box-shadow: 0 0 0 2.5px var(--draft2); }
.ideas-rope-knot.doing  { box-shadow: 0 0 0 2.5px var(--doing2); }
.ideas-rope-knot.done   { box-shadow: 0 0 0 2.5px var(--done2); }
.ideas-knot-inner {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--bg);
}
.draft .ideas-knot-inner  { background: var(--draft); }
.doing .ideas-knot-inner  { background: var(--doing); }
.done  .ideas-knot-inner  { background: var(--done); }
.ideas-col-lbl {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  color: var(--t2);
  letter-spacing: .08em;
  text-transform: uppercase;
}
.ideas-col-cnt {
  display: flex; align-items: center; gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--t3);
}
.ideas-rope-add {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1px solid var(--gold);
  background: transparent;
  color: var(--gold);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background var(--transition);
}
.ideas-rope-add:hover { background: rgba(200,168,75,.15); }

/* ── Cards container + drop zone ── */
.ideas-cards {
  width: 100%;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ideas-cards.drop-over {
  background: rgba(200,168,75,.05);
  border: 1px dashed var(--gold);
  border-radius: 5px;
}

/* ── Idea card ── */
.icard {
  background: var(--bg-c);
  border: 1px solid var(--bd);
  border-radius: 5px;
  padding: 12px 13px 11px;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition), transform var(--transition), box-shadow var(--transition);
  position: relative;
}
.icard:hover { background: var(--bg-ch); border-color: var(--bd-s); transform: translateY(-2px); box-shadow: var(--sh); }
.icard.active { box-shadow: 0 0 0 1px var(--gold); }
.icard.dragging { opacity: 0.45; cursor: grabbing; }
[draggable="true"].icard { cursor: grab; }
.icard-header { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 5px; }
.icard-title {
  flex: 1;
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  color: var(--t1);
  line-height: 1.35;
}
.icard-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.icard-dot.draft { background: var(--draft); box-shadow: 0 0 0 2px var(--draft2); }
.icard-dot.doing  { background: var(--doing); box-shadow: 0 0 0 2px var(--doing2); }
.icard-dot.done   { background: var(--done);  box-shadow: 0 0 0 2px var(--done2); }
.icard-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 5px; }
.icard-tag {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  background: var(--tag-bg);
  border: 1px solid var(--tag-bd);
  color: var(--blue2);
  padding: 2px 7px;
  border-radius: 2px;
}
.icard-desc {
  font-family: 'Crimson Pro', Georgia, serif;
  font-style: italic;
  font-size: 0.78rem;
  color: var(--t2);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 7px;
}
.icard-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--t3);
}
.icard-av {
  width: 18px; height: 18px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--bg);
  flex-shrink: 0;
}
.icard-sep { color: var(--bd); }
.vote-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px solid var(--bd);
  background: var(--bg-s);
  color: var(--t3);
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition), color var(--transition);
}
.vote-btn:hover { border-color: var(--bd-s); color: var(--t2); }
.vote-btn.voted { background: rgba(200,168,75,.12); border-color: var(--gold); color: var(--gold2); }

/* compact mode */
.icard.compact .icard-tags,
.icard.compact .icard-desc,
.icard.compact .icard-meta { display: none; }
.icard.compact .icard-title { font-size: 0.72rem; }

/* ── Detail panel ── */
.ideas-detail-panel {
  position: fixed;
  top: 60px;
  right: 0;
  width: 440px;
  height: calc(100vh - 60px);
  background: var(--bg-s);
  border-left: 1px solid var(--bd);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(.4,0,.2,1);
  z-index: 200;
  overflow: hidden;
}
.ideas-detail-panel.open { transform: translateX(0); }
.ideas-dp-scroll { flex: 1; overflow-y: auto; padding: 20px 22px 40px; }
.ideas-dp-close {
  position: absolute;
  top: 12px; right: 14px;
  background: transparent;
  border: none;
  color: var(--t3);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 3px;
}
.ideas-dp-close:hover { color: var(--t1); background: var(--bg-c); }
.ideas-dp-overdue {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--overdue);
  margin-bottom: 10px;
}
.ideas-dp-title {
  font-family: 'Cinzel', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--t1);
  margin-bottom: 10px;
  padding-right: 28px;
}
.ideas-dp-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  color: var(--t3);
  margin-bottom: 14px;
}
.ideas-dp-av {
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--bg);
  flex-shrink: 0;
}
.ideas-dp-section { margin-top: 18px; }
.ideas-dp-section-lbl {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 8px;
}

/* ── Progress bar ── */
.dp-progress { display: flex; gap: 4px; margin-bottom: 10px; }
.dp-progress-seg {
  flex: 1; height: 4px; border-radius: 2px;
  background: var(--bd);
}
.dp-progress-seg.filled.draft { background: var(--draft); }
.dp-progress-seg.filled.doing  { background: var(--doing); }
.dp-progress-seg.filled.done   { background: var(--done); }
.dp-steps { display: flex; gap: 6px; }
.dp-step-btn {
  flex: 1;
  padding: 5px 4px;
  border: 1px solid var(--bd);
  background: transparent;
  color: var(--t2);
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: .06em;
  border-radius: 3px;
  cursor: pointer;
  transition: all var(--transition);
}
.dp-step-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dp-step-btn.current.draft { background: rgba(138,122,68,.14); border-color: var(--draft2); color: var(--draft2); }
.dp-step-btn.current.doing  { background: rgba(74,138,184,.14); border-color: var(--doing2); color: var(--doing2); }
.dp-step-btn.current.done   { background: rgba(74,138,106,.14); border-color: var(--done2);  color: var(--done2); }

/* ── Markdown body ── */
.md-body { font-family: 'Crimson Pro', Georgia, serif; font-size: 0.92rem; color: var(--t1); line-height: 1.6; }
.md-body h1,.md-body h2,.md-body h3 { font-family: 'Cinzel',serif; color: var(--t1); margin: 12px 0 6px; }
.md-body h1 { font-size: 1.1rem; } .md-body h2 { font-size: 0.95rem; } .md-body h3 { font-size: 0.82rem; }
.md-body p { margin: 0 0 8px; }
.md-body ul,.md-body ol { padding-left: 20px; margin: 0 0 8px; }
.md-body blockquote { border-left: 3px solid var(--gold); padding-left: 10px; color: var(--t2); margin: 8px 0; }
.md-body code { font-family: 'JetBrains Mono',monospace; font-size: 0.78rem; background: var(--bg-c); padding: 1px 4px; border-radius: 3px; }
.md-body hr { border: none; border-top: 1px solid var(--bd); margin: 12px 0; }
.md-body a.wiki { color: var(--blue2); text-decoration: underline; }

/* ── Comments ── */
.ideas-cmt-list { display: flex; flex-direction: column; gap: 12px; }
.ideas-cmt {
  display: flex; gap: 10px;
}
.ideas-cmt-av {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--bg);
  flex-shrink: 0;
  margin-top: 2px;
}
.ideas-cmt-body { flex: 1; }
.ideas-cmt-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--t3);
  margin-bottom: 4px;
}
.ideas-cmt-expand {
  background: transparent; border: none;
  color: var(--blue2); font-size: 0.7rem;
  cursor: pointer; padding: 4px 0;
}
.ideas-cmt-compose { margin-top: 14px; }
.ideas-cmt-compose textarea {
  width: 100%; box-sizing: border-box;
  background: var(--inp);
  border: 1px solid var(--bd);
  border-radius: 4px;
  color: var(--t1);
  font-family: 'Crimson Pro', serif;
  font-size: 0.88rem;
  padding: 8px 10px;
  resize: vertical;
  min-height: 64px;
}
.ideas-cmt-compose textarea:focus { outline: none; border-color: var(--bd-s); }
.ideas-cmt-actions { display: flex; justify-content: flex-end; margin-top: 6px; }
.ideas-login-note { font-style: italic; font-size: 0.78rem; color: var(--t3); margin-top: 10px; }

/* ── Activity log ── */
.act-log { display: flex; flex-direction: column; gap: 8px; }
.act-entry { display: flex; gap: 8px; align-items: flex-start; }
.act-ico {
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem;
  flex-shrink: 0;
}
.act-ico.created { background: rgba(200,168,75,.18); color: var(--gold); }
.act-ico.status-doing  { background: rgba(74,138,184,.18); color: var(--doing2); }
.act-ico.status-done   { background: rgba(74,138,106,.18); color: var(--done2); }
.act-ico.comment { font-size: 0.5rem; overflow: hidden; }
.act-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  color: var(--t2);
  line-height: 1.4;
}
.act-text strong { color: var(--t1); }
.act-time { font-size: 0.55rem; color: var(--t3); }

/* ── Edit/delete bar ── */
.ideas-dp-actions { display: flex; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--bd); }

/* ── Wiki stub toast ── */
.wiki-toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--bg-s);
  border: 1px solid var(--done2);
  border-radius: 6px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--t1);
  box-shadow: var(--sh);
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: 500;
  pointer-events: none;
  white-space: nowrap;
}
.wiki-toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
.wiki-toast-link { color: var(--done2); text-decoration: underline; cursor: pointer; }
.wiki-toast-close {
  background: transparent; border: none;
  color: var(--t3); cursor: pointer; font-size: 0.9rem; padding: 0 2px;
}
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/resources/static/css/app.css
git commit -m "feat(css): add ideenkammer status tokens and board styles"
```

---

## Task 7: Frontend HTML

**Files:**
- Modify: `backend/src/main/resources/static/index.html`

- [ ] **Step 1: Add nav link** — after the `nav-items` button (line 31), add:
```html
    <button class="nav-link user-action-only" id="nav-ideas" onclick="showPage('ideas')">Ideenkammer</button>
```

- [ ] **Step 2: Add page HTML** — before the closing `</div>` of the last page, add:
```html
<!-- ══ IDEENKAMMER ══ -->
<div class="page" id="page-ideas">
  <div id="ideas-tag-filter-bar"></div>
  <div class="ideas-rope-wrap">
    <div class="ideas-rope-rail" id="ideas-rope-rail">
      <div class="ideas-rope-col" id="ideas-col-draft">
        <div class="ideas-rope-knot draft"><div class="ideas-knot-inner">I</div></div>
        <div class="ideas-col-lbl">Entwurf</div>
        <div class="ideas-col-cnt">
          <span id="ideas-cnt-draft">0</span>
          <button class="ideas-rope-add user-action-only" id="ideas-add-btn" title="Neue Idee">+</button>
        </div>
        <div class="ideas-cards" id="ideas-cards-draft" data-status="draft"></div>
      </div>
      <div class="ideas-rope-col" id="ideas-col-doing">
        <div class="ideas-rope-knot doing"><div class="ideas-knot-inner">II</div></div>
        <div class="ideas-col-lbl">In Arbeit</div>
        <div class="ideas-col-cnt"><span id="ideas-cnt-doing">0</span></div>
        <div class="ideas-cards" id="ideas-cards-doing" data-status="doing"></div>
      </div>
      <div class="ideas-rope-col" id="ideas-col-done">
        <div class="ideas-rope-knot done"><div class="ideas-knot-inner">III</div></div>
        <div class="ideas-col-lbl">Vollendet</div>
        <div class="ideas-col-cnt"><span id="ideas-cnt-done">0</span></div>
        <div class="ideas-cards" id="ideas-cards-done" data-status="done"></div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add detail panel** — before `</body>`:
```html
<!-- ══ IDEAS DETAIL PANEL ══ -->
<div class="ideas-detail-panel" id="ideas-detail-panel">
  <button class="ideas-dp-close" onclick="closeIdeasDetail()">✕</button>
  <div class="ideas-dp-scroll" id="ideas-dp-scroll"></div>
</div>
```

- [ ] **Step 4: Add create/edit modal** — before `</body>`, after the detail panel:
```html
<!-- ══ IDEAS MODAL ══ -->
<div class="modal-bg" id="ideas-modal-bg" style="display:none" onclick="if(event.target===this)closeIdeasModal()">
  <div class="modal" id="ideas-modal">
    <button class="m-close" onclick="closeIdeasModal()">✕</button>
    <h2 class="modal-title" id="ideas-modal-title">Neue Idee</h2>
    <div class="form-row">
      <label class="form-label">Titel *</label>
      <input class="form-input" id="im-title" maxlength="255" placeholder="Idee benennen…">
    </div>
    <div class="form-row">
      <label class="form-label">Beschreibung</label>
      <textarea class="form-input" id="im-desc" rows="4" placeholder="Markdown unterstützt…" style="resize:vertical"></textarea>
    </div>
    <div class="form-row">
      <label class="form-label">Tags <span style="color:var(--t3);font-size:.7rem">(kommagetrennt)</span></label>
      <input class="form-input" id="im-tags" placeholder="pardur, eldorheim, draigval">
    </div>
    <div class="form-row">
      <label class="form-label">Fällig am</label>
      <input class="form-input" id="im-due" type="date">
    </div>
    <p class="modal-err" id="im-err" style="display:none"></p>
    <div class="modal-footer">
      <button class="btn" id="im-save" onclick="saveIdea()">Speichern</button>
      <button class="btn btn-ghost" onclick="closeIdeasModal()">Abbrechen</button>
    </div>
  </div>
</div>

<!-- ══ WIKI STUB TOAST ══ -->
<div class="wiki-toast" id="wiki-stub-toast">
  <span style="color:var(--done2)">◈</span>
  <span id="wiki-toast-msg">Wiki-Stub angelegt</span>
  <button class="wiki-toast-close" id="wiki-toast-close">✕</button>
</div>
```

- [ ] **Step 5: Add ideas.js script tag** — after `users.js` and before `</body>`:
```html
<script src="/js/ideas.js?v=27"></script>
```

- [ ] **Step 6: Commit**
```bash
git add backend/src/main/resources/static/index.html
git commit -m "feat(html): add ideenkammer page, detail panel, modal, toast"
```

---

## Task 8: Frontend JS — State + Init + showPage

**Files:**
- Modify: `backend/src/main/resources/static/js/core.js`

- [ ] **Step 1: Add `ideas` to state object** — after `wikiAllEntries: null,` in `state`, add:
```js
  ideas: {
    list: [],
    tagFilter: new Set(),
    sortByVotes: false,
    detailId: null,
  },
```

- [ ] **Step 2: Guard `showPage` for ideas** — in `showPage(p)`, after the `users` guard, add:
```js
  if (p === 'ideas' && !state.auth.loggedIn) return;
```

Then add after `if (p === 'map') initMapPage();`:
```js
  if (p === 'ideas') initIdeasPage();
```

- [ ] **Step 3: Add active-nav for ideas** — in `showPage`, in the `if (p === 'items')` block's else chain, handle ideas nav:

The current code sets active nav only for `items` and world pages. The ideas nav link uses `id="nav-ideas"`, so add before `renderSectionTabs()`:
```js
  if (p === 'ideas') {
    const navEl = document.getElementById('nav-ideas');
    if (navEl) navEl.classList.add('active');
  }
```

- [ ] **Step 4: Load ideas in init** — in `users.js` `init()`, inside the `if (state.ui.activeWorldId)` block, add ideas to the `Promise.all`:
```js
// Change:
const [events, undated, items, tagCounts] = await Promise.all([
  api('GET', `/worlds/${state.ui.activeWorldId}/events`),
  api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
  api('GET', '/items'),
  api('GET', '/items/tags'),
]);
// To (only fetch ideas when logged in):
const ideaFetch = state.auth.loggedIn
  ? api('GET', `/worlds/${state.ui.activeWorldId}/ideas`)
  : Promise.resolve([]);
const [events, undated, items, tagCounts, ideas] = await Promise.all([
  api('GET', `/worlds/${state.ui.activeWorldId}/events`),
  api('GET', `/worlds/${state.ui.activeWorldId}/events/unpositioned`),
  api('GET', '/items'),
  api('GET', '/items/tags'),
  ideaFetch,
]);
state.events  = events  || [];
state.undated = undated || [];
state.items   = items   || [];
itemTagCounts = tagCounts || [];
state.ideas.list = ideas || [];
```

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/resources/static/js/core.js \
        backend/src/main/resources/static/js/users.js
git commit -m "feat(frontend): wire ideas state, showPage guard, init fetch"
```

---

## Task 9: Frontend JS — ideas.js

**Files:**
- Create: `backend/src/main/resources/static/js/ideas.js`

- [ ] **Step 1: Write ideas.js**

```js
/* ══════════════════════════════════════
   IDEAS — TAG FILTER BAR
══════════════════════════════════════ */

/**
 * Renders the tag filter bar above the rope rail.
 * Reads: state.ideas.list, state.ideas.tagFilter, state.ideas.sortByVotes
 * Writes: #ideas-tag-filter-bar
 */
function renderIdeasTagFilter() {
  console.debug('[renderIdeasTagFilter] →');
  const bar = document.getElementById('ideas-tag-filter-bar');
  if (!bar) return;

  const allTags = [...new Set(state.ideas.list.flatMap(i => i.tags || []))].sort();
  const { tagFilter, sortByVotes } = state.ideas;

  bar.innerHTML =
    '<span class="tfb-label">Tags</span>' +
    '<button class="tfb' + (tagFilter.size === 0 ? ' active' : '') + '" onclick="clearIdeaTagFilter()">Alle</button>' +
    allTags.map(t =>
      `<button class="tfb${tagFilter.has(t) ? ' active' : ''}" onclick="toggleIdeaTag(${JSON.stringify(t)})">${escHtml(t)}</button>`
    ).join('') +
    `<button class="sort-btn${sortByVotes ? ' active' : ''}" onclick="toggleIdeaSort()">◆ Nach Beliebtheit</button>`;

  console.debug('[renderIdeasTagFilter] ← tags:', allTags.length);
}

/** Toggles a tag in the filter set and re-renders the board. */
function toggleIdeaTag(tag) {
  console.debug('[toggleIdeaTag] →', tag);
  if (state.ideas.tagFilter.has(tag)) {
    state.ideas.tagFilter.delete(tag);
  } else {
    state.ideas.tagFilter.add(tag);
  }
  renderIdeasBoard();
  renderIdeasTagFilter();
  console.debug('[toggleIdeaTag] ←');
}

/** Clears all active tag filters and re-renders. */
function clearIdeaTagFilter() {
  console.debug('[clearIdeaTagFilter] →');
  state.ideas.tagFilter.clear();
  renderIdeasBoard();
  renderIdeasTagFilter();
  console.debug('[clearIdeaTagFilter] ←');
}

/** Toggles sort-by-votes and re-renders. */
function toggleIdeaSort() {
  console.debug('[toggleIdeaSort] →');
  state.ideas.sortByVotes = !state.ideas.sortByVotes;
  renderIdeasBoard();
  renderIdeasTagFilter();
  console.debug('[toggleIdeaSort] ←');
}

/* ══════════════════════════════════════
   IDEAS — BOARD RENDER
══════════════════════════════════════ */

/**
 * Renders all three kanban columns from state.ideas.list, applying tag filter and sort.
 * Reads: state.ideas.list, state.ideas.tagFilter, state.ideas.sortByVotes, state.auth
 * Writes: #ideas-cards-draft, #ideas-cards-doing, #ideas-cards-done, count spans
 */
function renderIdeasBoard() {
  console.debug('[renderIdeasBoard] →');
  const { tagFilter, sortByVotes, detailId } = state.ideas;

  let filtered = state.ideas.list.filter(idea => {
    if (tagFilter.size === 0) return true;
    return (idea.tags || []).some(t => tagFilter.has(t));
  });

  if (sortByVotes) {
    filtered = [...filtered].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
  }

  for (const status of ['draft', 'doing', 'done']) {
    const col = document.getElementById('ideas-cards-' + status);
    const cnt = document.getElementById('ideas-cnt-' + status);
    if (!col) continue;
    const colIdeas = filtered.filter(i => i.status === status);
    if (cnt) cnt.textContent = colIdeas.length;
    col.innerHTML = colIdeas.map(idea => renderIdeaCard(idea, detailId)).join('');
    wireDropZone(col);
  }

  if (state.auth.loggedIn) {
    wireCardDrag();
  }
  console.debug('[renderIdeasBoard] ← ideas:', filtered.length);
}

/**
 * Returns the HTML string for a single idea card.
 * @param {object} idea  IdeaDto
 * @param {number|null} activeId  currently open detail ID
 * @returns {string}
 */
function renderIdeaCard(idea, activeId) {
  const isOwner = state.auth.isAdmin || idea.createdByUserId === state.auth.userId;
  const voted   = (idea.voterIds || []).includes(state.auth.userId);
  const active  = idea.id === activeId ? ' active' : '';
  const draggable = state.auth.loggedIn ? ' draggable="true"' : '';
  const initials = (idea.creatorUsername || '?').slice(0, 2).toUpperCase();

  const tagsHtml = (idea.tags || []).length
    ? `<div class="icard-tags">${(idea.tags).map(t => `<span class="icard-tag">${escHtml(t)}</span>`).join('')}</div>`
    : '';

  const descHtml = idea.description
    ? `<div class="icard-desc">${escHtml(idea.description)}</div>`
    : '';

  const voteLabel = `◆ ${idea.voteCount || 0}`;
  const voteClass = voted ? ' voted' : '';
  const voteClick = state.auth.loggedIn
    ? `onclick="event.stopPropagation();doIdeaVote(${idea.id})"`
    : 'disabled title="Anmelden zum Abstimmen"';

  return `<div class="icard${active}" id="icard-${idea.id}" data-id="${idea.id}"${draggable}
    onclick="openIdeasDetail(${idea.id})">
    <div class="icard-header">
      <div class="icard-title">${escHtml(idea.title)}</div>
      <div class="icard-dot ${idea.status}"></div>
    </div>
    ${tagsHtml}
    ${descHtml}
    <div class="icard-meta">
      <div class="icard-av" style="background:${escHtml(idea.creatorColorHex || '#888')}">${escHtml(initials)}</div>
      <span>${escHtml(idea.creatorUsername || '')}</span>
      <span class="icard-sep">·</span>
      <span>💬${idea.commentCount || 0}</span>
      <button class="vote-btn${voteClass}" ${voteClick}>${voteLabel}</button>
    </div>
  </div>`;
}

/* ══════════════════════════════════════
   IDEAS — DRAG AND DROP
══════════════════════════════════════ */

/** Attaches dragstart listeners to all rendered idea cards. */
function wireCardDrag() {
  document.querySelectorAll('.icard[draggable="true"]').forEach(card => {
    card.ondragstart = e => {
      state.ui.dragId = parseInt(card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
      console.debug('[dragstart] ideaId:', state.ui.dragId);
    };
    card.ondragend = () => {
      card.classList.remove('dragging');
      state.ui.dragId = null;
    };
  });
}

/**
 * Attaches dragover and drop listeners to a column drop zone.
 * @param {HTMLElement} col  .ideas-cards element
 */
function wireDropZone(col) {
  col.ondragover = e => {
    e.preventDefault();
    col.classList.add('drop-over');
  };
  col.ondragleave = () => col.classList.remove('drop-over');
  col.ondrop = async e => {
    e.preventDefault();
    col.classList.remove('drop-over');
    const ideaId = state.ui.dragId;
    const newStatus = col.dataset.status;
    if (!ideaId || !newStatus) return;
    const idea = state.ideas.list.find(i => i.id === ideaId);
    if (!idea || idea.status === newStatus) return;
    console.debug('[drop] ideaId:', ideaId, 'status:', newStatus);
    try {
      const updated = await api('PATCH', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/status`, { status: newStatus });
      updateIdeaInState(updated);
      renderIdeasBoard();
      renderIdeasTagFilter();
      if (updated.wikiStubCreated) showWikiStubToast(updated.title);
    } catch (e) { console.error('[drop] failed', e); alert('Fehler: ' + e.message); }
  };
}

/* ══════════════════════════════════════
   IDEAS — DETAIL PANEL
══════════════════════════════════════ */

/**
 * Opens the idea detail panel for the given idea ID.
 * Fetches comments and activity, then renders the panel.
 * @param {number} ideaId
 */
async function openIdeasDetail(ideaId) {
  console.debug('[openIdeasDetail] →', ideaId);
  state.ideas.detailId = ideaId;
  document.getElementById('ideas-detail-panel')?.classList.add('open');

  const idea = state.ideas.list.find(i => i.id === ideaId);
  if (!idea) return;

  // Mark active card
  document.querySelectorAll('.icard').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('icard-' + ideaId);
  if (card) card.classList.add('active');

  // Render immediately with cached data, then load comments/activity
  renderIdeasDetailContent(idea, [], []);

  try {
    const [comments, activity] = await Promise.all([
      api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/comments`),
      api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/activity`),
    ]);
    renderIdeasDetailContent(idea, comments || [], activity || []);
  } catch (e) { console.error('[openIdeasDetail] load failed', e); }

  console.debug('[openIdeasDetail] ←');
}

/** Closes the ideas detail panel. */
function closeIdeasDetail() {
  console.debug('[closeIdeasDetail] →');
  state.ideas.detailId = null;
  document.getElementById('ideas-detail-panel')?.classList.remove('open');
  document.querySelectorAll('.icard.active').forEach(c => c.classList.remove('active'));
  console.debug('[closeIdeasDetail] ←');
}

/**
 * Renders the full detail panel content for an idea.
 * @param {object} idea       IdeaDto
 * @param {Array}  comments   IdeaCommentDto[]
 * @param {Array}  activity   IdeaActivityDto[]
 */
function renderIdeasDetailContent(idea, comments, activity) {
  const scroll = document.getElementById('ideas-dp-scroll');
  if (!scroll) return;

  const canEdit = state.auth.isAdmin || idea.createdByUserId === state.auth.userId;
  const now = new Date();
  const overdue = idea.dueAt && idea.status !== 'done' && new Date(idea.dueAt) < now;
  const initials = (idea.creatorUsername || '?').slice(0, 2).toUpperCase();

  // Progress bar
  const statuses = ['draft', 'doing', 'done'];
  const si = statuses.indexOf(idea.status);
  const progressSegs = statuses.map((s, i) =>
    `<div class="dp-progress-seg${i <= si ? ' filled ' + s : ''}"></div>`
  ).join('');

  const stepBtns = [
    { key: 'draft', label: 'Entwurf' },
    { key: 'doing', label: 'In Arbeit' },
    { key: 'done',  label: 'Vollendet' },
  ].map(({ key, label }) => {
    const isCurrent = idea.status === key;
    const disabled = !canEdit ? ' disabled' : '';
    const cls = isCurrent ? ` current ${key}` : '';
    return `<button class="dp-step-btn${cls}"${disabled}
      onclick="changeIdeaStatus(${idea.id},'${key}')">${label}</button>`;
  }).join('');

  // Markdown body
  const mdBody = idea.description
    ? `<div class="md-body">${renderIdeaMd(idea.description)}</div>`
    : `<p style="color:var(--t3);font-style:italic;font-size:.82rem">Keine Beschreibung.</p>`;

  // Comments
  const cmtHtml = renderIdeasComments(comments, idea.id);

  // Activity
  const actHtml = renderIdeasActivity(activity);

  // Due date label
  const dueLabel = idea.dueAt
    ? `<span>Fällig: ${idea.dueAt}</span>`
    : `<span style="color:var(--t3)">ohne Frist</span>`;

  scroll.innerHTML = `
    ${overdue ? '<div class="ideas-dp-overdue">● Frist überschritten</div>' : ''}
    <div class="ideas-dp-title">${escHtml(idea.title)}</div>
    <div class="ideas-dp-meta">
      <div class="ideas-dp-av" style="background:${escHtml(idea.creatorColorHex || '#888')}">${escHtml(initials)}</div>
      <span>${escHtml(idea.creatorUsername || '')}</span>
      <span>·</span>
      <span>angelegt ${fmtDate(idea.createdAt)}</span>
      <span>·</span>
      ${dueLabel}
    </div>
    <div class="dp-progress">${progressSegs}</div>
    <div class="dp-steps">${stepBtns}</div>

    <div class="ideas-dp-section">
      <div class="ideas-dp-section-lbl">Beschreibung</div>
      ${mdBody}
    </div>

    <div class="ideas-dp-section">
      <div class="ideas-dp-section-lbl">Kommentare</div>
      ${cmtHtml}
    </div>

    <div class="ideas-dp-section">
      <div class="ideas-dp-section-lbl">Aktivität</div>
      ${actHtml}
    </div>

    ${canEdit ? `
    <div class="ideas-dp-actions">
      <button class="btn btn-sm" onclick="openEditIdeaModal(${idea.id})">Bearbeiten</button>
      <button class="btn btn-sm btn-danger" onclick="deleteIdea(${idea.id})">Löschen</button>
    </div>` : ''}
  `;
}

/**
 * Renders the comments section HTML.
 * @param {Array}  comments   IdeaCommentDto[]
 * @param {number} ideaId
 * @returns {string}
 */
function renderIdeasComments(comments, ideaId) {
  const MAX_VISIBLE = 2;
  const visible = comments.slice(0, MAX_VISIBLE);
  const hidden  = comments.slice(MAX_VISIBLE);

  const cmtItems = (list) => list.map(c => {
    const ini = (c.creatorUsername || '?').slice(0, 2).toUpperCase();
    return `<div class="ideas-cmt">
      <div class="ideas-cmt-av" style="background:${escHtml(c.creatorColorHex || '#888')}">${escHtml(ini)}</div>
      <div class="ideas-cmt-body">
        <div class="ideas-cmt-meta">${escHtml(c.creatorUsername || '')} · ${fmtDate(c.createdAt)}</div>
        <div class="md-body">${renderIdeaMd(c.body)}</div>
      </div>
    </div>`;
  }).join('');

  const expandBtn = hidden.length
    ? `<button class="ideas-cmt-expand" onclick="expandIdeasComments(${ideaId})">▾ ${hidden.length} ältere anzeigen</button>`
    : '';

  const compose = state.auth.loggedIn
    ? `<div class="ideas-cmt-compose">
        <textarea id="ideas-cmt-input-${ideaId}" placeholder="Kommentar schreiben…"></textarea>
        <div class="ideas-cmt-actions">
          <button class="btn btn-sm" onclick="submitIdeaComment(${ideaId})">Senden</button>
        </div>
      </div>`
    : `<p class="ideas-login-note">Melde dich an um zu kommentieren.</p>`;

  return `<div class="ideas-cmt-list" id="ideas-cmt-list-${ideaId}">${cmtItems(visible)}</div>
    ${expandBtn}${compose}`;
}

/**
 * Renders the activity log HTML.
 * @param {Array} activity  IdeaActivityDto[]
 * @returns {string}
 */
function renderIdeasActivity(activity) {
  if (!activity.length) return '<p style="color:var(--t3);font-size:.78rem">Noch keine Aktivität.</p>';
  return `<div class="act-log">${activity.map(a => {
    let ico, text;
    const name = `<strong>${escHtml(a.actorUsername || '')}</strong>`;
    if (a.type === 'created') {
      ico = '<div class="act-ico created">✦</div>';
      text = `${name} hat diese Idee angelegt`;
    } else if (a.type === 'status') {
      const toDone = a.toStatus === 'done';
      ico = `<div class="act-ico status-${a.toStatus}">${toDone ? '✓' : '⇢'}</div>`;
      const fromLbl = { draft: 'Entwurf', doing: 'In Arbeit', done: 'Vollendet' };
      text = `${name} hat Status geändert: ${fromLbl[a.fromStatus] || a.fromStatus} → ${fromLbl[a.toStatus] || a.toStatus}`;
    } else {
      const ini = (a.actorUsername || '?').slice(0, 2).toUpperCase();
      ico = `<div class="act-ico comment ideas-cmt-av" style="background:${escHtml(a.actorColorHex || '#888')};width:22px;height:22px;font-size:.5rem">${escHtml(ini)}</div>`;
      text = `${name} hat kommentiert`;
    }
    return `<div class="act-entry">${ico}<div><div class="act-text">${text}</div><div class="act-time">${fmtDate(a.createdAt)}</div></div></div>`;
  }).join('')}</div>`;
}

/**
 * Expands all hidden comments for the given idea by re-fetching.
 * @param {number} ideaId
 */
async function expandIdeasComments(ideaId) {
  console.debug('[expandIdeasComments] →', ideaId);
  try {
    const comments = await api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/comments`);
    const list = document.getElementById('ideas-cmt-list-' + ideaId);
    if (list) {
      list.innerHTML = (comments || []).map(c => {
        const ini = (c.creatorUsername || '?').slice(0, 2).toUpperCase();
        return `<div class="ideas-cmt">
          <div class="ideas-cmt-av" style="background:${escHtml(c.creatorColorHex || '#888')}">${escHtml(ini)}</div>
          <div class="ideas-cmt-body">
            <div class="ideas-cmt-meta">${escHtml(c.creatorUsername || '')} · ${fmtDate(c.createdAt)}</div>
            <div class="md-body">${renderIdeaMd(c.body)}</div>
          </div>
        </div>`;
      }).join('');
    }
    // remove the expand button
    const btn = list?.nextElementSibling;
    if (btn?.classList.contains('ideas-cmt-expand')) btn.remove();
  } catch(e) { console.error('[expandIdeasComments] failed', e); }
  console.debug('[expandIdeasComments] ←');
}

/* ══════════════════════════════════════
   IDEAS — STATUS CHANGE
══════════════════════════════════════ */

/**
 * Changes the status of an idea via the detail panel step buttons.
 * @param {number} ideaId
 * @param {string} newStatus  'draft'|'doing'|'done'
 */
async function changeIdeaStatus(ideaId, newStatus) {
  console.debug('[changeIdeaStatus] →', { ideaId, newStatus });
  const idea = state.ideas.list.find(i => i.id === ideaId);
  if (!idea || idea.status === newStatus) return;
  try {
    const updated = await api('PATCH', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/status`, { status: newStatus });
    updateIdeaInState(updated);
    renderIdeasBoard();
    renderIdeasTagFilter();
    if (state.ideas.detailId === ideaId) {
      const [comments, activity] = await Promise.all([
        api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/comments`),
        api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/activity`),
      ]);
      renderIdeasDetailContent(updated, comments || [], activity || []);
    }
    if (updated.wikiStubCreated) showWikiStubToast(updated.title);
  } catch (e) { console.error('[changeIdeaStatus] failed', e); alert('Fehler: ' + e.message); }
  console.debug('[changeIdeaStatus] ←');
}

/* ══════════════════════════════════════
   IDEAS — VOTES
══════════════════════════════════════ */

/**
 * Toggles the current user's vote on an idea.
 * @param {number} ideaId
 */
async function doIdeaVote(ideaId) {
  console.debug('[doIdeaVote] →', ideaId);
  if (!state.auth.loggedIn) return;
  try {
    const updated = await api('POST', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/votes`);
    updateIdeaInState(updated);
    renderIdeasBoard();
  } catch (e) { console.error('[doIdeaVote] failed', e); alert('Fehler: ' + e.message); }
  console.debug('[doIdeaVote] ←');
}

/* ══════════════════════════════════════
   IDEAS — COMMENTS
══════════════════════════════════════ */

/**
 * Submits a new comment on the given idea.
 * @param {number} ideaId
 */
async function submitIdeaComment(ideaId) {
  console.debug('[submitIdeaComment] →', ideaId);
  const input = document.getElementById('ideas-cmt-input-' + ideaId);
  const body = input?.value?.trim();
  if (!body) return;
  try {
    await api('POST', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/comments`, { body });
    input.value = '';
    // Reload detail
    const idea = state.ideas.list.find(i => i.id === ideaId);
    if (!idea) return;
    const [comments, activity] = await Promise.all([
      api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/comments`),
      api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}/activity`),
    ]);
    // update comment count
    idea.commentCount = (comments || []).length;
    renderIdeasDetailContent(idea, comments || [], activity || []);
    renderIdeasBoard();
  } catch (e) { console.error('[submitIdeaComment] failed', e); alert('Fehler: ' + e.message); }
  console.debug('[submitIdeaComment] ←');
}

/* ══════════════════════════════════════
   IDEAS — MODAL (CREATE / EDIT)
══════════════════════════════════════ */

/** Opens the create-idea modal. */
function openCreateIdeaModal() {
  console.debug('[openCreateIdeaModal] →');
  document.getElementById('ideas-modal-title').textContent = 'Neue Idee';
  document.getElementById('im-title').value = '';
  document.getElementById('im-desc').value  = '';
  document.getElementById('im-tags').value  = 'pardur, eldorheim, draigval';
  document.getElementById('im-due').value   = '';
  const err = document.getElementById('im-err');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  document.getElementById('im-save').dataset.editId = '';
  document.getElementById('ideas-modal-bg').style.display = 'flex';
  document.getElementById('im-title').focus();
  console.debug('[openCreateIdeaModal] ←');
}

/**
 * Opens the edit-idea modal pre-filled with the given idea's data.
 * @param {number} ideaId
 */
function openEditIdeaModal(ideaId) {
  console.debug('[openEditIdeaModal] →', ideaId);
  const idea = state.ideas.list.find(i => i.id === ideaId);
  if (!idea) return;
  document.getElementById('ideas-modal-title').textContent = 'Idee bearbeiten';
  document.getElementById('im-title').value = idea.title || '';
  document.getElementById('im-desc').value  = idea.description || '';
  document.getElementById('im-tags').value  = (idea.tags || []).join(', ');
  document.getElementById('im-due').value   = idea.dueAt || '';
  const err = document.getElementById('im-err');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  document.getElementById('im-save').dataset.editId = ideaId;
  document.getElementById('ideas-modal-bg').style.display = 'flex';
  document.getElementById('im-title').focus();
  console.debug('[openEditIdeaModal] ←');
}

/** Closes the ideas modal. */
function closeIdeasModal() {
  console.debug('[closeIdeasModal] →');
  document.getElementById('ideas-modal-bg').style.display = 'none';
  console.debug('[closeIdeasModal] ←');
}

/** Saves a new or edited idea. Called by the modal save button. */
async function saveIdea() {
  console.debug('[saveIdea] →');
  const title = document.getElementById('im-title').value.trim();
  const desc  = document.getElementById('im-desc').value.trim();
  const tagsRaw = document.getElementById('im-tags').value;
  const due   = document.getElementById('im-due').value || null;
  const editId = document.getElementById('im-save').dataset.editId;

  if (!title) {
    const err = document.getElementById('im-err');
    err.textContent = 'Titel ist erforderlich.';
    err.style.display = 'block';
    return;
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const payload = { title, description: desc || null, dueAt: due, tags };

  try {
    let saved;
    if (editId) {
      saved = await api('PUT', `/worlds/${state.ui.activeWorldId}/ideas/${editId}`, payload);
      updateIdeaInState(saved);
    } else {
      saved = await api('POST', `/worlds/${state.ui.activeWorldId}/ideas`, payload);
      state.ideas.list.unshift(saved);
    }
    closeIdeasModal();
    renderIdeasBoard();
    renderIdeasTagFilter();
    if (editId && state.ideas.detailId === parseInt(editId)) {
      const [comments, activity] = await Promise.all([
        api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${saved.id}/comments`),
        api('GET', `/worlds/${state.ui.activeWorldId}/ideas/${saved.id}/activity`),
      ]);
      renderIdeasDetailContent(saved, comments || [], activity || []);
    }
  } catch (e) {
    console.error('[saveIdea] failed', e);
    const err = document.getElementById('im-err');
    err.textContent = 'Fehler: ' + e.message;
    err.style.display = 'block';
  }
  console.debug('[saveIdea] ←');
}

/**
 * Deletes an idea after confirmation.
 * @param {number} ideaId
 */
async function deleteIdea(ideaId) {
  console.debug('[deleteIdea] →', ideaId);
  if (!confirm('Idee wirklich löschen?')) return;
  try {
    await api('DELETE', `/worlds/${state.ui.activeWorldId}/ideas/${ideaId}`);
    state.ideas.list = state.ideas.list.filter(i => i.id !== ideaId);
    closeIdeasDetail();
    renderIdeasBoard();
    renderIdeasTagFilter();
  } catch (e) { console.error('[deleteIdea] failed', e); alert('Fehler: ' + e.message); }
  console.debug('[deleteIdea] ←');
}

/* ══════════════════════════════════════
   IDEAS — WIKI STUB TOAST
══════════════════════════════════════ */

/**
 * Shows the wiki stub toast for the given idea title, auto-dismisses after 5 s.
 * @param {string} title
 */
function showWikiStubToast(title) {
  console.debug('[showWikiStubToast] →', title);
  const toast = document.getElementById('wiki-stub-toast');
  const msg   = document.getElementById('wiki-toast-msg');
  const closeBtn = document.getElementById('wiki-toast-close');
  if (!toast || !msg) return;
  msg.innerHTML = `Wiki-Stub angelegt: <strong>${escHtml(title)}</strong>`;
  toast.classList.add('show');
  closeBtn.onclick = () => toast.classList.remove('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 5000);
  console.debug('[showWikiStubToast] ←');
}

/* ══════════════════════════════════════
   IDEAS — MARKDOWN RENDERER
══════════════════════════════════════ */

/**
 * Renders a Markdown string to HTML using the loaded marked library.
 * Falls back to escaped plain text if marked is not available.
 * @param {string} md
 * @returns {string} HTML string
 */
function renderIdeaMd(md) {
  if (!md) return '';
  if (typeof marked !== 'undefined') {
    return marked.parse(md, { breaks: true });
  }
  return escHtml(md).replace(/\n/g, '<br>');
}

/* ══════════════════════════════════════
   IDEAS — INIT
══════════════════════════════════════ */

/**
 * Initialises the ideas page: fetches ideas if not loaded, renders board and filter bar.
 * Wires the add button.
 */
async function initIdeasPage() {
  console.debug('[initIdeasPage] →');
  if (!state.auth.loggedIn) return;

  if (!state.ideas.list.length && state.ui.activeWorldId) {
    try {
      state.ideas.list = await api('GET', `/worlds/${state.ui.activeWorldId}/ideas`) || [];
    } catch (e) { console.error('[initIdeasPage] load failed', e); }
  }

  renderIdeasTagFilter();
  renderIdeasBoard();

  const addBtn = document.getElementById('ideas-add-btn');
  if (addBtn) addBtn.onclick = openCreateIdeaModal;

  console.debug('[initIdeasPage] ← ideas:', state.ideas.list.length);
}

/* ══════════════════════════════════════
   IDEAS — UTILITY
══════════════════════════════════════ */

/**
 * Updates or inserts an idea in state.ideas.list in-place.
 * @param {object} updated  IdeaDto from server
 */
function updateIdeaInState(updated) {
  const idx = state.ideas.list.findIndex(i => i.id === updated.id);
  if (idx >= 0) {
    state.ideas.list[idx] = updated;
  } else {
    state.ideas.list.unshift(updated);
  }
}

/**
 * Formats an ISO date/datetime string as a short locale date.
 * @param {string|null} iso
 * @returns {string}
 */
function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}
```

- [ ] **Step 2: Commit**
```bash
git add backend/src/main/resources/static/js/ideas.js
git commit -m "feat(frontend): add ideas.js — board, detail panel, modal, votes, comments, drag-drop"
```

---

## Task 10: WikiEntryType check + build verification

- [ ] **Step 1: Open `WikiEntryType.java`** and find the correct constant name for a general/misc entry.

- [ ] **Step 2: Fix `createWikiStubIfAbsent` in IdeaService** if needed — replace `WikiEntryType.MISC` with the correct value found in Step 1.

- [ ] **Step 3: Full build**
```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" compile -q
```
Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**
```bash
git add backend/src/main/java/com/pardur/service/IdeaService.java
git commit -m "fix(service): use correct WikiEntryType constant in wiki stub creation"
```

---

## Task 11: Smoke test + final commit

- [ ] **Step 1: Start the app**
```bash
cd backend && "/c/Program Files/JetBrains/IntelliJ IDEA 2025.3.3/plugins/maven/lib/maven3/bin/mvn" spring-boot:run -Dspring-boot.run.profiles=dev
```

- [ ] **Step 2: Manual smoke test checklist**
  - [ ] Guest: Ideenkammer nav link is hidden
  - [ ] Admin login: Ideenkammer nav link appears
  - [ ] Idea board loads with three columns
  - [ ] Create idea via + button → appears in Entwurf column
  - [ ] Drag card to "In Arbeit" → status updates
  - [ ] Drag card to "Vollendet" → wiki stub toast appears
  - [ ] Vote button increments count, turns gold on second click undoes vote
  - [ ] Add a comment — appears in detail panel
  - [ ] Edit and delete own idea
  - [ ] Tag filter bar filters cards correctly
  - [ ] Sort by votes reorders cards

- [ ] **Step 3: Commit any fixups found during smoke test**

---

## Self-Review

**Spec coverage check:**
- ✅ Nav link hidden from guests (`user-action-only`)
- ✅ Three-column kanban (Entwurf/In Arbeit/Vollendet)
- ✅ Default tags (pardur, eldorheim, draigval) in modal placeholder
- ✅ Any logged-in user can create ideas
- ✅ Only creator/admin can edit/delete (frontend guard + backend `requireOwnerOrAdmin`)
- ✅ Any logged-in user can comment
- ✅ Any logged-in user can vote (toggle)
- ✅ Admin can do everything
- ✅ Wiki stub auto-created when status → done, toast shown
- ✅ Tag filter (OR logic), sort by votes
- ✅ Drag-and-drop status change
- ✅ Detail panel with progress bar, activity log, comments
- ✅ Markdown rendering via `marked` (already loaded)
- ✅ Existing CSS tokens reused; new status tokens added to both themes
