package br.com.solarvision.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class PanelDtos {

    public record PanelRequest(
            @NotNull Long group,
            @NotBlank String serial_number,
            @NotBlank String model,
            @NotNull String status
    ) {}

    public record PanelResponse(
            Long id,
            Long group,
            String serial_number,
            String model,
            String status
    ) {}
}
