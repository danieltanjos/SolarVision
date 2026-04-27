package br.com.solarvision.api.service;

import br.com.solarvision.api.model.AppUser;
import br.com.solarvision.api.model.UserRole;
import br.com.solarvision.api.dto.AuthDtos;
import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.repository.AppUserRepository;
import br.com.solarvision.api.security.JwtTokenProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.util.Optional;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(AppUserRepository appUserRepository, JwtTokenProvider jwtTokenProvider) {
        this.appUserRepository = appUserRepository;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public AuthDtos.AuthResponse loginWithGoogle(String googleToken) {
        GoogleProfile profile = parseGoogleToken(googleToken);
        AppUser user = appUserRepository.findByEmail(profile.email())
                .map(existing -> updateGoogleUser(existing, profile))
                .orElseGet(() -> createGoogleUser(profile));
        String jwt = jwtTokenProvider.generateToken(user);
        return new AuthDtos.AuthResponse(jwt, new AuthDtos.AuthUserResponse(user.getId(), user.getName(), user.getEmail()));
    }

    public AuthDtos.UserMeResponse me(Principal principal) {
        if (principal == null || principal.getName() == null) {
            throw new NotFoundException("Usuário autenticado não encontrado.");
        }
        AppUser user = appUserRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new NotFoundException("Usuário autenticado não encontrado."));
        return new AuthDtos.UserMeResponse(user.getId(), user.getName(), user.getEmail(), user.getRole().name());
    }

    private AppUser updateGoogleUser(AppUser user, GoogleProfile profile) {
        user.setName(profile.name());
        user.setGoogleSubject(profile.subject());
        return appUserRepository.save(user);
    }

    private AppUser createGoogleUser(GoogleProfile profile) {
        AppUser user = new AppUser();
        user.setName(profile.name());
        user.setEmail(profile.email());
        user.setGoogleSubject(profile.subject());
        user.setRole(UserRole.ADMIN);
        return appUserRepository.save(user);
    }

    private GoogleProfile parseGoogleToken(String token) {
        if (token == null || token.isBlank()) {
            throw new BadRequestException("google_token é obrigatório.");
        }
        String[] parts = token.split("\\|");
        if (parts.length >= 2 && parts[1].contains("@")) {
            return new GoogleProfile(parts[0].isBlank() ? deriveName(parts[1]) : parts[0], parts[1].trim().toLowerCase(), "stub-google-subject");
        }
        if (token.contains("@")) {
            String email = token.trim().toLowerCase();
            return new GoogleProfile(deriveName(email), email, "stub-google-subject");
        }
        String normalized = token.trim().replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        if (normalized.isBlank()) {
            throw new BadRequestException("Não foi possível interpretar o google_token informado.");
        }
        String email = normalized + "@solarvision.local";
        return new GoogleProfile(deriveName(email), email, "stub-google-subject");
    }

    private String deriveName(String email) {
        String local = Optional.ofNullable(email).orElse("user").split("@")[0];
        String sanitized = local.replace('.', ' ').replace('_', ' ').trim();
        if (sanitized.isBlank()) {
            return "SolarVision User";
        }
        return Character.toUpperCase(sanitized.charAt(0)) + sanitized.substring(1);
    }

    private record GoogleProfile(String name, String email, String subject) {}
}
