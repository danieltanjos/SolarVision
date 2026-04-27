package br.com.solarvision.api.dto;

import jakarta.validation.constraints.NotBlank;

public class AuthDtos {

    public record GoogleAuthRequest(@NotBlank String google_token) {}

    public record AuthUserResponse(Long id, String name, String email) {}

    public record AuthResponse(String access_token, AuthUserResponse user) {}

    public record UserMeResponse(Long id, String name, String email, String role) {}
}
