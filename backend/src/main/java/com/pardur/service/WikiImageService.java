package com.pardur.service;

import com.pardur.dto.request.UpdateWikiImageRequest;
import com.pardur.dto.response.WikiImageDto;
import com.pardur.exception.ResourceNotFoundException;
import com.pardur.model.WikiEntry;
import com.pardur.model.WikiImage;
import com.pardur.repository.WikiEntryRepository;
import com.pardur.repository.WikiImageRepository;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Service
public class WikiImageService {

    private static final long MAX_BYTES = 10L * 1024 * 1024; // 10 MB

    private final WikiImageRepository imageRepository;
    private final WikiEntryRepository entryRepository;

    public WikiImageService(WikiImageRepository imageRepository, WikiEntryRepository entryRepository) {
        this.imageRepository = imageRepository;
        this.entryRepository = entryRepository;
    }

    @Transactional
    public WikiImageDto upload(Integer entryId, MultipartFile file, String caption,
                               Integer currentUserId, boolean isAdmin) throws IOException {
        WikiEntry entry = entryRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Wiki entry not found: " + entryId));
        checkOwnership(entry, currentUserId, isAdmin);

        byte[] webpBytes = convertToWebP(file.getBytes());

        WikiImage image = new WikiImage();
        image.setEntry(entry);
        image.setData(webpBytes);
        image.setCaption(caption);
        image.setSortOrder(entry.getImages().size());
        WikiImage saved = imageRepository.save(image);
        return new WikiImageDto(saved.getId(), saved.getCaption(), saved.getSortOrder());
    }

    @Transactional(readOnly = true)
    public byte[] getImageData(Integer imageId) {
        WikiImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found: " + imageId));
        return image.getData();
    }

    @Transactional
    public WikiImageDto update(Integer imageId, UpdateWikiImageRequest req,
                               Integer currentUserId, boolean isAdmin) {
        WikiImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found: " + imageId));
        checkOwnership(image.getEntry(), currentUserId, isAdmin);
        if (req.getCaption() != null) image.setCaption(req.getCaption());
        if (req.getSortOrder() != null) image.setSortOrder(req.getSortOrder());
        WikiImage saved = imageRepository.save(image);
        return new WikiImageDto(saved.getId(), saved.getCaption(), saved.getSortOrder());
    }

    @Transactional
    public void delete(Integer imageId, Integer currentUserId, boolean isAdmin) {
        WikiImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found: " + imageId));
        checkOwnership(image.getEntry(), currentUserId, isAdmin);
        imageRepository.delete(image);
    }

    private void checkOwnership(WikiEntry entry, Integer currentUserId, boolean isAdmin) {
        if (isAdmin) return;
        if (!entry.getCreatedBy().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your wiki entry");
        }
    }

    private byte[] convertToWebP(byte[] inputBytes) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(inputBytes));
        if (image == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image format");
        }

        byte[] webpBytes = writeWebP(image);

        // If still over 10 MB, progressively downscale
        double scale = 0.9;
        while (webpBytes.length > MAX_BYTES && scale > 0.1) {
            int newWidth  = (int) (image.getWidth()  * scale);
            int newHeight = (int) (image.getHeight() * scale);
            BufferedImage scaled = Thumbnails.of(image)
                    .size(newWidth, newHeight)
                    .asBufferedImage();
            webpBytes = writeWebP(scaled);
            scale -= 0.1;
        }

        if (webpBytes.length > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Image too large even after compression");
        }
        return webpBytes;
    }

    private byte[] writeWebP(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "webp", out);
        return out.toByteArray();
    }
}
