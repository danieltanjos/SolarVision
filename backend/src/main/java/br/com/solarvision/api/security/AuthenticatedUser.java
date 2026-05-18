package br.com.solarvision.api.security;

public record AuthenticatedUser(
        Long id,
        String email,
        String nome,
        String role
) {
}
