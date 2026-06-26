package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.model.AuthDtos;
import br.com.solarvision.api.model.UserRole;
import br.com.solarvision.api.repository.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(AppUserRepository appUserRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AuthDtos.AuthResponse register(AuthDtos.RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        if (appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BadRequestException("Já existe um usuário cadastrado com este email.");
        }

        AppUser user = new AppUser();
        user.setNome(request.nome().trim());
        user.setEmail(normalizedEmail);
        user.setSenhaHash(passwordEncoder.encode(request.senha()));
        user.setRole(UserRole.USER);

        AppUser savedUser = appUserRepository.save(user);
        return new AuthDtos.AuthResponse(jwtService.gerarToken(savedUser), toUserResponse(savedUser));
    }

    @Transactional(readOnly = true)
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        AppUser user = appUserRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NotFoundException("Usuário não encontrado."));

        if (!passwordEncoder.matches(request.senha(), user.getSenhaHash())) {
            throw new BadRequestException("Credenciais inválidas.");
        }

        return new AuthDtos.AuthResponse(jwtService.gerarToken(user), toUserResponse(user));
    }

    private AuthDtos.AuthUserResponse toUserResponse(AppUser user) {
        return new AuthDtos.AuthUserResponse(
                user.getId(),
                user.getNome(),
                user.getEmail(),
                user.getRole().name()
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }
}
