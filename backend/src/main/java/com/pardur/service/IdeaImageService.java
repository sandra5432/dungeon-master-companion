package com.pardur.service;

import com.pardur.dto.response.IdeaImageDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.Idea;
import com.pardur.model.IdeaImage;
import com.pardur.model.User;
import com.pardur.repository.IdeaImageRepository;
import com.pardur.repository.IdeaRepository;
import com.pardur.repository.UserRepository;
import com.pardur.security.PardurUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

/**
 * Business logic for uploading, listing, serving, and deleting images attached to ideas.
 */
@Service
public class IdeaImageService {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    private final IdeaImageRepository imageRepository;
    private final IdeaRepository ideaRepository;
    private final UserRepository userRepository;

    public IdeaImageService(IdeaImageRepository imageRepository,
                            IdeaRepository ideaRepository,
                            UserRepository userRepository) {
        this.imageRepository = imageRepository;
        this.ideaRepository = ideaRepository;
        this.userRepository = userRepository;
    }

    /**
     * Returns metadata for all images belonging to the given idea.
     *
     * @param ideaId idea to list images for
     * @param auth   authenticated user
     * @return list of image metadata DTOs
     */
    @Transactional(readOnly = true)
    public List<IdeaImageDto> listImages(Integer ideaId, Authentication auth) {
        requireIdea(ideaId);
        return imageRepository.findAllByIdeaIdOrderByCreatedAtAsc(ideaId)
                .stream().map(this::toDto).toList();
    }

    /**
     * Uploads a new image to the given idea.
     *
     * @param ideaId target idea
     * @param file   the uploaded file (must be image/webp, max 5 MB)
     * @param auth   authenticated user (must be idea owner or admin)
     * @return metadata DTO for the created image
     * @throws ResponseStatusException 400 if the file is not a WebP image or exceeds size limit
     * @throws ResponseStatusException 403 if the caller does not own the idea and is not admin
     */
    @Transactional
    public IdeaImageDto uploadImage(Integer ideaId, MultipartFile file, Authentication auth) {
        Idea idea = requireIdea(ideaId);
        requireOwnerOrAdmin(idea, auth);

        String contentType = file.getContentType();
        if (!"image/webp".equals(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only WebP images are allowed");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File exceeds 5 MB limit");
        }

        User uploader = resolveUser(auth);

        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read uploaded file");
        }

        IdeaImage image = new IdeaImage();
        image.setIdea(idea);
        image.setOriginalFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : "image");
        image.setContentType(contentType);
        image.setData(data);
        image.setUploadedBy(uploader);

        return toDto(imageRepository.save(image));
    }

    /**
     * Returns the binary data and content type for a single image.
     *
     * @param ideaId  idea the image belongs to
     * @param imageId image to retrieve
     * @param auth    authenticated user
     * @return the image entity (caller reads {@code getData()} and {@code getContentType()})
     * @throws ResourceNotFoundException if the image does not exist or belongs to a different idea
     */
    @Transactional(readOnly = true)
    public IdeaImage getImageData(Integer ideaId, Integer imageId, Authentication auth) {
        requireIdea(ideaId);
        IdeaImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found: " + imageId));
        if (!image.getIdea().getId().equals(ideaId)) {
            throw new ResourceNotFoundException("Image " + imageId + " does not belong to idea " + ideaId);
        }
        return image;
    }

    /**
     * Deletes a single image from an idea.
     *
     * @param ideaId  idea the image belongs to
     * @param imageId image to delete
     * @param auth    authenticated user (must be idea owner or admin)
     * @throws ResponseStatusException 403 if the caller is neither owner nor admin
     */
    @Transactional
    public void deleteImage(Integer ideaId, Integer imageId, Authentication auth) {
        Idea idea = requireIdea(ideaId);
        requireOwnerOrAdmin(idea, auth);
        IdeaImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found: " + imageId));
        if (!image.getIdea().getId().equals(ideaId)) {
            throw new ResourceNotFoundException("Image " + imageId + " does not belong to idea " + ideaId);
        }
        imageRepository.delete(image);
    }

    private Idea requireIdea(Integer ideaId) {
        return ideaRepository.findById(ideaId)
                .orElseThrow(() -> new ResourceNotFoundException("Idea not found: " + ideaId));
    }

    private void requireOwnerOrAdmin(Idea idea, Authentication auth) {
        if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) return;
        Integer userId = ((PardurUserDetails) auth.getPrincipal()).getUserId();
        if (!idea.getCreatedBy().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your idea");
        }
    }

    private User resolveUser(Authentication auth) {
        Integer userId = ((PardurUserDetails) auth.getPrincipal()).getUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private IdeaImageDto toDto(IdeaImage image) {
        IdeaImageDto dto = new IdeaImageDto();
        dto.setId(image.getId());
        dto.setIdeaId(image.getIdea().getId());
        dto.setOriginalFilename(image.getOriginalFilename());
        dto.setContentType(image.getContentType());
        return dto;
    }
}
