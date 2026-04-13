package br.com.solarvision.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public class CleaningDtos {

    public record CleaningRequest(
            @NotNull Long panel_id,
            @NotNull OffsetDateTime performed_at,
            @NotNull Double water_used_liters,
            @NotBlank String performed_by,
            String notes
    ) {}

    public record CleaningResponse(
            Long cleaning_id,
            Long panel_id,
            OffsetDateTime performed_at,
            Double water_used_liters,
            String performed_by,
            String notes
    ) {}

    public record CleaningDeleteResponse(
            String message,
            Long cleaning_id,
            OffsetDateTime deleted_at
    ) {}
}
