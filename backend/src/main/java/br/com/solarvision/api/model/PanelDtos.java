package br.com.solarvision.api.model;

import br.com.solarvision.api.model.PanelStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class PanelDtos {

    private PanelDtos() {
    }

    public record CreatePanelRequest(
            @NotNull(message = "grupoId é obrigatório.")
            Long grupoId,
            @NotBlank(message = "Modelo da placa é obrigatório.")
            @Size(max = 120, message = "Modelo da placa deve ter no máximo 120 caracteres.")
            String modelo,
            PanelStatus status
    ) {
    }

    public record PanelResponse(
            Long id,
            Long grupoId,
            String grupoNome,
            String modelo,
            String status,
            OffsetDateTime criadoEm
    ) {
    }
}
