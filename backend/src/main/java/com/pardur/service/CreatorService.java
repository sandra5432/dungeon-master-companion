package com.pardur.service;

import com.pardur.dto.response.CreatorDto;
import com.pardur.repository.CreatorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CreatorService {

    private final CreatorRepository creatorRepository;

    public CreatorService(CreatorRepository creatorRepository) {
        this.creatorRepository = creatorRepository;
    }

    @Transactional(readOnly = true)
    public List<CreatorDto> getAllCreators() {
        return creatorRepository.findAllByOrderByCodeAsc().stream()
                .map(c -> new CreatorDto(c.getCode(), c.getFullName(), c.getColorHex()))
                .toList();
    }
}
