package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.model.AuthDtos;
import br.com.solarvision.api.model.UserRole;
import br.com.solarvision.api.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    @Test
    void deveRegistrarNovoUsuario() {
        var request = new AuthDtos.RegisterRequest("Maria", "Maria@Solar.com", "senhaForte123");
        when(appUserRepository.existsByEmailIgnoreCase("maria@solar.com")).thenReturn(false);
        when(passwordEncoder.encode("senhaForte123")).thenReturn("hash");
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> {
            AppUser u = invocation.getArgument(0);
            u.setId(10L);
            return u;
        });
        when(jwtService.gerarToken(any(AppUser.class))).thenReturn("jwt-token");

        AuthDtos.AuthResponse response = authService.register(request);

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.user().id()).isEqualTo(10L);
        assertThat(response.user().email()).isEqualTo("maria@solar.com");
        assertThat(response.user().role()).isEqualTo(UserRole.USER.name());
    }

    @Test
    void naoDeveRegistrarComEmailDuplicado() {
        var request = new AuthDtos.RegisterRequest("Maria", "maria@solar.com", "senhaForte123");
        when(appUserRepository.existsByEmailIgnoreCase("maria@solar.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BadRequestException.class);

        verify(appUserRepository, never()).save(any());
    }

    @Test
    void deveAutenticarComCredenciaisValidas() {
        var request = new AuthDtos.LoginRequest("maria@solar.com", "senhaForte123");
        AppUser user = new AppUser();
        user.setId(10L);
        user.setNome("Maria");
        user.setEmail("maria@solar.com");
        user.setSenhaHash("hash");
        user.setRole(UserRole.USER);
        when(appUserRepository.findByEmailIgnoreCase("maria@solar.com")).thenReturn(java.util.Optional.of(user));
        when(passwordEncoder.matches("senhaForte123", "hash")).thenReturn(true);
        when(jwtService.gerarToken(user)).thenReturn("jwt-token");

        AuthDtos.AuthResponse response = authService.login(request);

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.user().email()).isEqualTo("maria@solar.com");
    }

    @Test
    void naoDeveAutenticarUsuarioInexistente() {
        var request = new AuthDtos.LoginRequest("naoexiste@solar.com", "qualquer");
        when(appUserRepository.findByEmailIgnoreCase("naoexiste@solar.com")).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void naoDeveAutenticarComSenhaIncorreta() {
        var request = new AuthDtos.LoginRequest("maria@solar.com", "errada");
        AppUser user = new AppUser();
        user.setSenhaHash("hash");
        when(appUserRepository.findByEmailIgnoreCase("maria@solar.com")).thenReturn(java.util.Optional.of(user));
        when(passwordEncoder.matches("errada", "hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadRequestException.class);

        verify(jwtService, never()).gerarToken(any(AppUser.class));
    }
}
