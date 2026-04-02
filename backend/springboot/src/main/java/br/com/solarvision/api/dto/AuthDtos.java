package br.com.solarvision.api.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;

public class AuthDtos {

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record GoogleAuthRequest(@NotBlank String googleToken) {}

    public record AuthUserResponse(Long id, String name, String email) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AuthResponse(String accessToken, AuthUserResponse user) {}

    public record UserMeResponse(Long id, String name, String email, String role) {}
}
