package br.com.solarvision.api.model;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
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
            PanelStatus status,
            @DecimalMin(value = "0.0", message = "Potência (Wp) não pode ser negativa.")
            BigDecimal potenciaWp,
            Double inclinacao,
            Double azimute,
            Double coefTemperatura,
            LocalDate dataInstalacao
    ) {
    }

    public record UpdatePanelRequest(
            @NotNull(message = "grupoId é obrigatório.")
            Long grupoId,
            @NotBlank(message = "Modelo da placa é obrigatório.")
            @Size(max = 120, message = "Modelo da placa deve ter no máximo 120 caracteres.")
            String modelo,
            PanelStatus status,
            @DecimalMin(value = "0.0", message = "Potência (Wp) não pode ser negativa.")
            BigDecimal potenciaWp,
            Double inclinacao,
            Double azimute,
            Double coefTemperatura,
            LocalDate dataInstalacao
    ) {
    }

    public record PanelResponse(
            Long id,
            Long grupoId,
            String grupoNome,
            String modelo,
            String status,
            BigDecimal potenciaWp,
            Double inclinacao,
            Double azimute,
            Double coefTemperatura,
            LocalDate dataInstalacao,
            OffsetDateTime criadoEm
    ) {
    }
}
