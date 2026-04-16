package br.com.solarvision.api.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public class CleaningDtos {

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CleaningRequest(
            @NotNull Long panelId,
            @NotNull OffsetDateTime performedAt,
            @NotNull Double waterUsedLiters,
            @NotBlank String performedBy,
            String notes
    ) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CleaningResponse(
            Long cleaningId,
            Long panelId,
            OffsetDateTime performedAt,
            Double waterUsedLiters,
            String performedBy,
            String notes
    ) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CleaningDeleteResponse(
            String message,
            Long cleaningId,
            OffsetDateTime deletedAt
    ) {}
}
