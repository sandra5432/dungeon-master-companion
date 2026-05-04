package com.pardur.service;

import com.pardur.dto.request.CreateIdeaCommentRequest;
import com.pardur.dto.request.CreateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaStatusRequest;
import com.pardur.dto.response.IdeaActivityDto;
import com.pardur.dto.response.IdeaCommentDto;
import com.pardur.dto.response.IdeaDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
import com.pardur.repository.IdeaImageRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Business logic for the Ideenkammer: creating, updating, voting, commenting, and activity logging for ideas.
 * Ideas are world-agnostic; worlds appear only as tag suggestions.
 */
@Service
public class IdeaService {

    private final IdeaRepository ideaRepository;
    private final IdeaCommentRepository commentRepository;
    private final IdeaActivityRepository activityRepository;
    private final IdeaVoteRepository voteRepository;
    private final IdeaImageRepository imageRepository;
    private final WorldRepository worldRepository;
    private final UserRepository userRepository;
    private final WikiEntryRepository wikiEntryRepository;

    public IdeaService(IdeaRepository ideaRepository,
                       IdeaCommentRepository commentRepository,
                       IdeaActivityRepository activityRepository,
                       IdeaVoteRepository voteRepository,
                       IdeaImageRepository imageRepository,
                       WorldRepository worldRepository,
                       UserRepository userRepository,
                       WikiEntryRepository wikiEntryRepository) {
        this.ideaRepository = ideaRepository;
        this.commentRepository = commentRepository;
        this.activityRepository = activityRepository;
        this.voteRepository = voteRepository;
        this.imageRepository = imageRepository;
        this.worldRepository = worldRepository;
        this.userRepository = userRepository;
        this.wikiEntryRepository = wikiEntryRepository;
    }

    private Idea requireIdea(Integer ideaId) {
        return ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found: " + ideaId));
    }

    private User requireLogin(Authentication auth) {
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    /** Throws 403 if the caller is neither admin nor the idea's creator. */
    private void requireOwnerOrAdmin(Idea idea, Authentication auth) {
        if (WorldPermissionChecker.isAdmin(auth)) return;
        Integer userId = WorldPermissionChecker.resolveUserId(auth);
        if (!idea.getCreatedBy().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your idea");
        }
    }

    /**
     * Returns all ideas ordered by creation date descending.
     *
     * @param auth authenticated user
     * @return list of all ideas as DTOs
     */
    @Transactional(readOnly = true)
    public List<IdeaDto> getAllIdeas(Authentication auth) {
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        Integer myUserId = WorldPermissionChecker.resolveUserId(auth);
        return ideaRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream().map(i -> toDto(i, myUserId)).toList();
    }

    /**
     * Returns a single idea by ID.
     *
     * @param ideaId idea to retrieve
     * @param auth   authenticated user
     * @return idea DTO
     */
    @Transactional(readOnly = true)
    public IdeaDto getIdea(Integer ideaId, Authentication auth) {
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        Integer myUserId = WorldPermissionChecker.resolveUserId(auth);
        return toDto(requireIdea(ideaId), myUserId);
    }

    /**
     * Creates a new idea with status {@code draft}.
     *
     * @param req  validated request body
     * @param auth authenticated user (becomes the creator)
     * @return the persisted idea as a DTO
     */
    @Transactional
    public IdeaDto createIdea(CreateIdeaRequest req, Authentication auth) {
        User creator = requireLogin(auth);

        Idea idea = new Idea();
        idea.setCreatedBy(creator);
        idea.setTitle(req.getTitle().trim());
        idea.setDescription(req.getDescription());
        if (req.getDueAt() != null && !req.getDueAt().isBlank()) {
            idea.setDueAt(LocalDate.parse(req.getDueAt()));
        }
        if (req.getTags() != null) {
            idea.getTags().addAll(req.getTags().stream().map(String::trim).filter(t -> !t.isBlank()).distinct().toList());
        }
        Idea saved = ideaRepository.save(idea);

        IdeaActivity activity = new IdeaActivity();
        activity.setIdea(saved);
        activity.setActor(creator);
        activity.setType(IdeaActivityType.created);
        activityRepository.save(activity);

        return toDto(saved, creator.getId());
    }

    /**
     * Updates title, description, due date, and tags of an existing idea.
     *
     * @param ideaId ID of the idea to update
     * @param req    validated request body
     * @param auth   authenticated user (must be creator or admin)
     * @return updated idea as a DTO
     */
    @Transactional
    public IdeaDto updateIdea(Integer ideaId, UpdateIdeaRequest req, Authentication auth) {
        requireLogin(auth);
        Idea idea = requireIdea(ideaId);
        requireOwnerOrAdmin(idea, auth);

        idea.setTitle(req.getTitle().trim());
        idea.setDescription(req.getDescription());
        idea.setDueAt(null);
        if (req.getDueAt() != null && !req.getDueAt().isBlank()) {
            idea.setDueAt(LocalDate.parse(req.getDueAt()));
        }
        idea.getTags().clear();
        if (req.getTags() != null) {
            idea.getTags().addAll(req.getTags().stream().map(String::trim).filter(t -> !t.isBlank()).distinct().toList());
        }
        Integer myUserId = WorldPermissionChecker.resolveUserId(auth);
        return toDto(ideaRepository.save(idea), myUserId);
    }

    /**
     * Changes the status of an idea. If moved to {@code done}, a wiki stub is created in the
     * first world whose name matches one of the idea's tags.
     *
     * @param ideaId ID of the idea to update
     * @param req    validated status request
     * @param auth   authenticated user (must be creator or admin)
     * @return updated idea as a DTO, with {@code wikiStubCreated} flag set when applicable
     */
    @Transactional
    public IdeaDto updateStatus(Integer ideaId, UpdateIdeaStatusRequest req, Authentication auth) {
        User actor = requireLogin(auth);
        Idea idea = requireIdea(ideaId);
        requireOwnerOrAdmin(idea, auth);

        IdeaStatus newStatus;
        try {
            newStatus = IdeaStatus.valueOf(req.getStatus());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + req.getStatus());
        }

        String previousStatus = idea.getStatus().name();
        idea.setStatus(newStatus);
        ideaRepository.save(idea);

        IdeaActivity activity = new IdeaActivity();
        activity.setIdea(idea);
        activity.setActor(actor);
        activity.setType(IdeaActivityType.status);
        activity.setFromStatus(previousStatus);
        activity.setToStatus(newStatus.name());
        activityRepository.save(activity);

        boolean stubCreated = false;
        if (newStatus == IdeaStatus.done) {
            stubCreated = createWikiStubIfAbsent(idea, actor);
        }

        IdeaDto dto = toDto(idea, actor.getId());
        dto.setWikiStubCreated(stubCreated);
        return dto;
    }

    /**
     * Deletes an idea and all its associated data.
     *
     * @param ideaId ID of the idea to delete
     * @param auth   authenticated user (must be creator or admin)
     */
    @Transactional
    public void deleteIdea(Integer ideaId, Authentication auth) {
        requireLogin(auth);
        Idea idea = requireIdea(ideaId);
        requireOwnerOrAdmin(idea, auth);
        ideaRepository.delete(idea);
    }

    /**
     * Toggles the current user's vote on an idea.
     *
     * @param ideaId ID of the idea to vote on
     * @param auth   authenticated user
     * @return updated idea DTO with new vote count
     */
    @Transactional
    public IdeaDto toggleVote(Integer ideaId, Authentication auth) {
        User user = requireLogin(auth);
        Idea idea = requireIdea(ideaId);

        Optional<IdeaVote> existing = voteRepository.findByIdeaAndUser(ideaId, user.getId());
        if (existing.isPresent()) {
            voteRepository.delete(existing.get());
        } else {
            IdeaVote vote = new IdeaVote();
            vote.getId().setIdeaId(ideaId);
            vote.getId().setUserId(user.getId());
            vote.setIdea(idea);
            vote.setUser(user);
            voteRepository.save(vote);
        }
        ideaRepository.flush();
        Idea refreshed = ideaRepository.findById(ideaId).orElseThrow();
        return toDto(refreshed, user.getId());
    }

    /**
     * Returns all comments for an idea, ordered newest first.
     *
     * @param ideaId ID of the idea
     * @param auth   authenticated user
     * @return list of comment DTOs
     */
    @Transactional(readOnly = true)
    public List<IdeaCommentDto> getComments(Integer ideaId, Authentication auth) {
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        requireIdea(ideaId);
        return commentRepository.findAllByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toCommentDto).toList();
    }

    /**
     * Adds a comment to an idea.
     *
     * @param ideaId ID of the idea to comment on
     * @param req    validated request body containing the comment text
     * @param auth   authenticated user
     * @return the created comment as a DTO
     */
    @Transactional
    public IdeaCommentDto addComment(Integer ideaId, CreateIdeaCommentRequest req, Authentication auth) {
        User user = requireLogin(auth);
        Idea idea = requireIdea(ideaId);

        IdeaComment comment = new IdeaComment();
        comment.setIdea(idea);
        comment.setCreatedBy(user);
        comment.setBody(req.getBody());
        IdeaComment saved = commentRepository.save(comment);

        IdeaActivity activity = new IdeaActivity();
        activity.setIdea(idea);
        activity.setActor(user);
        activity.setType(IdeaActivityType.comment);
        activityRepository.save(activity);

        return toCommentDto(saved);
    }

    /**
     * Returns the activity log for an idea, ordered newest first.
     *
     * @param ideaId ID of the idea
     * @param auth   authenticated user
     * @return list of activity DTOs
     */
    @Transactional(readOnly = true)
    public List<IdeaActivityDto> getActivity(Integer ideaId, Authentication auth) {
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        requireIdea(ideaId);
        return activityRepository.findAllByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toActivityDto).toList();
    }

    /**
     * Creates a wiki stub for the idea's title in the first world whose name matches one of the
     * idea's tags (case-insensitive). Does nothing if no matching world is found or if the stub
     * already exists.
     *
     * @return true if a stub was created, false otherwise
     */
    private boolean createWikiStubIfAbsent(Idea idea, User actor) {
        List<String> tags = idea.getTags();
        World targetWorld = worldRepository.findAll().stream()
                .filter(w -> tags.stream().anyMatch(t -> t.equalsIgnoreCase(w.getName())))
                .findFirst()
                .orElse(null);

        if (targetWorld == null) return false;

        boolean exists = wikiEntryRepository.findDuplicateTitle(targetWorld.getId(), idea.getTitle(), 0).isPresent();
        if (exists) return false;

        WikiEntry stub = new WikiEntry();
        stub.setWorld(targetWorld);
        stub.setTitle(idea.getTitle());
        stub.setType(WikiEntryType.OTHER);
        stub.setBody("");
        stub.setCreatedBy(actor);
        wikiEntryRepository.save(stub);
        return true;
    }

    private IdeaDto toDto(Idea idea, Integer myUserId) {
        IdeaDto dto = new IdeaDto();
        dto.setId(idea.getId());
        dto.setTitle(idea.getTitle());
        dto.setDescription(idea.getDescription());
        dto.setStatus(idea.getStatus().name());
        dto.setCreatedByUserId(idea.getCreatedBy().getId());
        dto.setCreatorUsername(idea.getCreatedBy().getUsername());
        dto.setCreatorColorHex(idea.getCreatedBy().getColorHex());
        dto.setDueAt(idea.getDueAt());
        dto.setTags(new ArrayList<>(idea.getTags()));
        dto.setVoteCount(idea.getVotes().size());
        dto.setVotedByMe(myUserId != null && idea.getVotes().stream()
                .anyMatch(v -> v.getId().getUserId().equals(myUserId)));
        dto.setCommentCount(idea.getComments().size());
        dto.setImageCount((int) imageRepository.countByIdeaId(idea.getId()));
        imageRepository.findFirstByIdeaIdOrderByCreatedAtAsc(idea.getId())
                .ifPresent(img -> dto.setFirstImageId(img.getId()));
        dto.setCreatedAt(idea.getCreatedAt());
        dto.setUpdatedAt(idea.getUpdatedAt());
        return dto;
    }

    private IdeaCommentDto toCommentDto(IdeaComment c) {
        IdeaCommentDto dto = new IdeaCommentDto();
        dto.setId(c.getId());
        dto.setIdeaId(c.getIdea().getId());
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
