package com.pardur.service;

import com.pardur.dto.request.CreateUserRequest;
import com.pardur.dto.response.UserDto;
import com.pardur.model.User;
import com.pardur.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private BCryptPasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private CreateUserRequest createReq;

    @BeforeEach
    void setUp() {
        createReq = new CreateUserRequest();
        createReq.setUsername("alice");
        createReq.setRole("USER");
        createReq.setColorHex("#123456");
    }

    @Test
    void createUser_setsMustChangePasswordTrue() {
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(passwordEncoder.encode("alice")).thenReturn("$hashed");
        User saved = new User();
        saved.setUsername("alice");
        saved.setRole("USER");
        saved.setColorHex("#123456");
        saved.setMustChangePassword(true);
        when(userRepository.save(any())).thenReturn(saved);

        UserDto result = userService.createUser(createReq);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().isMustChangePassword()).isTrue();
        assertThat(captor.getValue().getPassword()).isEqualTo("$hashed");
    }

    @Test
    void createUser_throwsConflict_whenUsernameExists() {
        when(userRepository.existsByUsername("alice")).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser(createReq))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Username already exists");
    }

    @Test
    void deleteUser_throwsBadRequest_whenDeletingOwnAccount() {
        assertThatThrownBy(() -> userService.deleteUser(5, 5))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Cannot delete your own account");
    }

    @Test
    void deleteUser_succeeds_whenDifferentUser() {
        User user = new User();
        when(userRepository.findById(3)).thenReturn(Optional.of(user));

        userService.deleteUser(3, 5);

        verify(userRepository).delete(user);
    }

    @Test
    void changePassword_throwsBadRequest_whenCurrentPasswordWrong() {
        User user = new User();
        user.setPassword("$stored");
        when(userRepository.findById(1)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "$stored")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(1, "wrong", "newpass"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Current password incorrect");
    }

    @Test
    void changePassword_clearsMustChangePassword() {
        User user = new User();
        user.setPassword("$stored");
        user.setMustChangePassword(true);
        when(userRepository.findById(1)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct", "$stored")).thenReturn(true);
        when(passwordEncoder.encode("newpass")).thenReturn("$newstored");

        userService.changePassword(1, "correct", "newpass");

        assertThat(user.isMustChangePassword()).isFalse();
        assertThat(user.getPassword()).isEqualTo("$newstored");
        verify(userRepository).save(user);
    }
}
