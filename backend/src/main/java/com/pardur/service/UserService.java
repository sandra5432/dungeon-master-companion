package com.pardur.service;

import com.pardur.dto.request.CreateUserRequest;
import com.pardur.dto.request.UpdateUserRequest;
import com.pardur.dto.response.UserDto;
import com.pardur.model.User;
import com.pardur.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserDto> listUsers() {
        return userRepository.findAll().stream()
                .map(u -> new UserDto(u.getId(), u.getUsername(), u.getRole(), u.getColorHex(), u.getCreatedAt()))
                .collect(Collectors.toList());
    }

    @Transactional
    public UserDto createUser(CreateUserRequest req) {
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
        }
        User user = new User();
        user.setUsername(req.getUsername());
        user.setRole(req.getRole());
        user.setColorHex(req.getColorHex());
        user.setPassword(passwordEncoder.encode(req.getUsername()));
        user.setMustChangePassword(true);
        User saved = userRepository.save(user);
        return new UserDto(saved.getId(), saved.getUsername(), saved.getRole(), saved.getColorHex(), saved.getCreatedAt());
    }

    @Transactional
    public UserDto updateUser(Integer id, UpdateUserRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (req.getRole() != null) {
            user.setRole(req.getRole());
        }
        if (req.getColorHex() != null) {
            user.setColorHex(req.getColorHex());
        }
        if (req.isResetPassword()) {
            user.setPassword(passwordEncoder.encode(user.getUsername()));
            user.setMustChangePassword(true);
        }
        User saved = userRepository.save(user);
        return new UserDto(saved.getId(), saved.getUsername(), saved.getRole(), saved.getColorHex(), saved.getCreatedAt());
    }

    @Transactional
    public void deleteUser(Integer id, Integer currentUserId) {
        if (id.equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete your own account");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        userRepository.delete(user);
    }

    @Transactional
    public void changePassword(Integer userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password incorrect");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        userRepository.save(user);
    }
}
