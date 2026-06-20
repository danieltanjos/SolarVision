package br.com.solarvision.api.model;

import br.com.solarvision.api.model.GroupStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public final class GroupDtos {

    private GroupDtos() {
    }

    public record CreateGroupRequest(
            @NotBlank(message = "Nome do grupo é obrigatório.")
            @Size(max = 120, message = "Nome do grupo deve ter no máximo 120 caracteres.")
            String nome,
            GroupStatus status
    ) {
    }

    public record UpdateGroupRequest(
            @NotBlank(message = "Nome do grupo é obrigatório.")
            @Size(max = 120, message = "Nome do grupo deve ter no máximo 120 caracteres.")
            String nome,
            GroupStatus status
    ) {
    }

    public record GroupResponse(
            Long id,
            String nome,
            String status,
            OffsetDateTime criadoEm,
            int totalPlacas
    ) {
    }
}
