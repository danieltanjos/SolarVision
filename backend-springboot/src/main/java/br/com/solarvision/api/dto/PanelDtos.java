package br.com.solarvision.api.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class PanelDtos {

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PanelRequest(
            @NotNull Long group,
            @NotBlank String serialNumber,
            @NotBlank String model,
            @NotNull String status
    ) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PanelResponse(
            Long id,
            Long group,
            String serialNumber,
            String model,
            String status
    ) {}
}
