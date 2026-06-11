package br.com.solarvision.api.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class CleaningDtos {

    private CleaningDtos() {
    }

    public record CreateCleaningRequest(
            @NotNull(message = "placaId é obrigatório.")
            Long placaId,
            @NotNull(message = "dataLimpeza é obrigatória.")
            OffsetDateTime dataLimpeza,
            @Size(max = 1000, message = "Observação deve ter no máximo 1000 caracteres.")
            String observacao
    ) {
    }

    public record CleaningResponse(
            Long id,
            Long placaId,
            String placaModelo,
            OffsetDateTime dataLimpeza,
            String observacao,
            OffsetDateTime criadoEm
    ) {
    }
}
