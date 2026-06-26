package br.com.solarvision.api.model;

import java.time.OffsetDateTime;

public final class UserDtos {

    private UserDtos() {
    }

    public record CurrentUserResponse(
            Long id,
            String nome,
            String email,
            String role,
            OffsetDateTime criadoEm
    ) {
    }
}
