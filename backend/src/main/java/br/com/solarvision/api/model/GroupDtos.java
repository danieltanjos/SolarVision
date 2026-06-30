package br.com.solarvision.api.model;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
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
            GroupStatus status,
            @DecimalMin(value = "-90.0", message = "Latitude deve estar entre -90 e 90.")
            @DecimalMax(value = "90.0", message = "Latitude deve estar entre -90 e 90.")
            Double latitude,
            @DecimalMin(value = "-180.0", message = "Longitude deve estar entre -180 e 180.")
            @DecimalMax(value = "180.0", message = "Longitude deve estar entre -180 e 180.")
            Double longitude
    ) {
    }

    public record UpdateGroupRequest(
            @NotBlank(message = "Nome do grupo é obrigatório.")
            @Size(max = 120, message = "Nome do grupo deve ter no máximo 120 caracteres.")
            String nome,
            GroupStatus status,
            @DecimalMin(value = "-90.0", message = "Latitude deve estar entre -90 e 90.")
            @DecimalMax(value = "90.0", message = "Latitude deve estar entre -90 e 90.")
            Double latitude,
            @DecimalMin(value = "-180.0", message = "Longitude deve estar entre -180 e 180.")
            @DecimalMax(value = "180.0", message = "Longitude deve estar entre -180 e 180.")
            Double longitude
    ) {
    }

    public record GroupResponse(
            Long id,
            String nome,
            String status,
            Double latitude,
            Double longitude,
            OffsetDateTime criadoEm,
            int totalPlacas
    ) {
    }
}
