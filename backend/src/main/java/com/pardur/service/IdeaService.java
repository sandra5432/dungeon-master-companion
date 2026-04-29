package com.pardur.service;

import com.pardur.dto.request.CreateIdeaCommentRequest;
import com.pardur.dto.request.CreateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaRequest;
import com.pardur.dto.request.UpdateIdeaStatusRequest;
import com.pardur.dto.response.IdeaActivityDto;
import com.pardur.dto.response.IdeaCommentDto;
import com.pardur.dto.response.IdeaDto;
import com.pardur.dto.response.TagCountDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.*;
import com.pardur.repository.*;
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
 */
@Service
public class IdeaService {

    private final IdeaRepository ideaRepository;
    private final IdeaCommentRepository commentRepository;
    private final IdeaActivityRepository activityRepository;
    private final IdeaVoteRepository voteRepository;
    private final WorldRepository worldRepository;
    private final UserRepository userRepository;
    private final WikiEntryRepository wikiEntryRepository;

    public IdeaService(IdeaRepository ideaRepository,
                       IdeaCommentRepository commentRepository,
                       IdeaActivityRepository activityRepository,
                       IdeaVoteRepository voteRepository,
                       WorldRepository worldRepository,
                       UserRepository userRepository,
                       WikiEntryRepository wikiEntryRepository) {
        this.ideaRepository = ideaRepository;
        this.commentRepository = commentRepository;
        this.activityRepository = activityRepository;
        this.voteRepository = voteRepository;
        this.worldRepository = worldRepository;
        this.userRepository = userRepository;
        this.wikiEntryRepository = wikiEntryRepository;
    }

    private World requireWorld(Integer worldId) {
        return worldRepository.findById(worldId)
                .orElseThrow(() -> new ResourceNotFoundException("World not found: " + worldId));
    }

    private Idea requireIdea(Integer worldId, Integer ideaId) {
        Idea idea = ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found: " + ideaId));
        if (!idea.getWorld().getId().equals(worldId)) {
            throw new ResourceNotFoundException("Idea " + ideaId + " does not belong to world " + worldId);
        }
        return idea;
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

    @Transactional(readOnly = true)
    public List<IdeaDto> getIdeas(Integer worldId, Authentication auth) {
        requireWorld(worldId);
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        Integer myUserId = WorldPermissionChecker.resolveUserId(auth);
        return ideaRepository.findAllByWorldId(worldId)
                .stream().map(i -> toDto(i, myUserId)).toList();
    }

    @Transactional(readOnly = true)
    public IdeaDto getIdea(Integer worldId, Integer ideaId, Authentication auth) {
        requireWorld(worldId);
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        Integer myUserId = WorldPermissionChecker.resolveUserId(auth);
        Idea idea = requireIdea(worldId, ideaId);
        return toDto(idea, myUserId);
    }

    @Transactional
    public IdeaDto createIdea(Integer worldId, CreateIdeaRequest req, Authentication auth) {
        World world = requireWorld(worldId);
        User creator = requireLogin(auth);

        Idea idea = new Idea();
        idea.setWorld(world);
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

    @Transactional
    public IdeaDto updateIdea(Integer worldId, Integer ideaId, UpdateIdeaRequest req, Authentication auth) {
        requireWorld(worldId);
        requireLogin(auth);
        Idea idea = requireIdea(worldId, ideaId);
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

    @Transactional
    public IdeaDto updateStatus(Integer worldId, Integer ideaId, UpdateIdeaStatusRequest req, Authentication auth) {
        requireWorld(worldId);
        User actor = requireLogin(auth);
        Idea idea = requireIdea(worldId, ideaId);
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
            stubCreated = createWikiStubIfAbsent(idea.getWorld(), idea.getTitle(), actor);
        }

        IdeaDto dto = toDto(idea, actor.getId());
        dto.setWikiStubCreated(stubCreated);
        return dto;
    }

    @Transactional
    public void deleteIdea(Integer worldId, Integer ideaId, Authentication auth) {
        requireWorld(worldId);
        requireLogin(auth);
        Idea idea = requireIdea(worldId, ideaId);
        requireOwnerOrAdmin(idea, auth);
        ideaRepository.delete(idea);
    }

    @Transactional
    public IdeaDto toggleVote(Integer worldId, Integer ideaId, Authentication auth) {
        requireWorld(worldId);
        User user = requireLogin(auth);
        Idea idea = requireIdea(worldId, ideaId);

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

    @Transactional(readOnly = true)
    public List<IdeaCommentDto> getComments(Integer worldId, Integer ideaId, Authentication auth) {
        requireWorld(worldId);
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        requireIdea(worldId, ideaId);
        return commentRepository.findAllByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toCommentDto).toList();
    }

    @Transactional
    public IdeaCommentDto addComment(Integer worldId, Integer ideaId, CreateIdeaCommentRequest req, Authentication auth) {
        requireWorld(worldId);
        User user = requireLogin(auth);
        Idea idea = requireIdea(worldId, ideaId);

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

    @Transactional(readOnly = true)
    public List<IdeaActivityDto> getActivity(Integer worldId, Integer ideaId, Authentication auth) {
        requireWorld(worldId);
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        requireIdea(worldId, ideaId);
        return activityRepository.findAllByIdeaIdOrderByCreatedAtDesc(ideaId)
                .stream().map(this::toActivityDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TagCountDto> getTagCounts(Integer worldId, Authentication auth) {
        requireWorld(worldId);
        if (!WorldPermissionChecker.isAuthenticated(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Login required");
        }
        List<Object[]> rows = ideaRepository.findTagCountsByWorldId(worldId);
        List<TagCountDto> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(new TagCountDto((String) row[0], ((Number) row[1]).longValue()));
        }
        return result;
    }

    /** Creates a wiki stub for the given title if no entry with that title already exists. Returns true if created. */
    private boolean createWikiStubIfAbsent(World world, String title, User actor) {
        boolean exists = wikiEntryRepository.findDuplicateTitle(world.getId(), title, 0).isPresent();
        if (exists) return false;
        WikiEntry stub = new WikiEntry();
        stub.setWorld(world);
        stub.setTitle(title);
        stub.setType(WikiEntryType.OTHER);
        stub.setBody("");
        stub.setCreatedBy(actor);
        wikiEntryRepository.save(stub);
        return true;
    }

    private IdeaDto toDto(Idea idea, Integer myUserId) {
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
        dto.setTags(new ArrayList<>(idea.getTags()));
        dto.setVoteCount(idea.getVotes().size());
        dto.setVotedByMe(myUserId != null && idea.getVotes().stream()
                .anyMatch(v -> v.getId().getUserId().equals(myUserId)));
        dto.setCommentCount(idea.getComments().size());
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
