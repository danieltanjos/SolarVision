package br.com.solarvision.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "nome é obrigatório")
            @Size(max = 100, message = "nome deve ter no máximo 100 caracteres")
            String nome,
            @NotBlank(message = "email é obrigatório")
            @Email(message = "email inválido")
            String email,
            @NotBlank(message = "senha é obrigatória")
            @Size(min = 8, max = 255, message = "senha deve ter entre 8 e 255 caracteres")
            String senha
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "email é obrigatório")
            @Email(message = "email inválido")
            String email,
            @NotBlank(message = "senha é obrigatória")
            String senha
    ) {
    }

    public record AuthUserResponse(Long id, String nome, String email, String role) {
    }

    public record AuthResponse(String token, AuthUserResponse user) {
    }
}
