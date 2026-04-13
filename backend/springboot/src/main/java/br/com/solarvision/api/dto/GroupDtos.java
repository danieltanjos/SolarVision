package br.com.solarvision.api.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public class GroupDtos {

    public record GroupRequest(
            @NotBlank String name,
            @NotBlank String location,
            @NotNull String status
    ) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record GroupResponse(
            Long id,
            String name,
            String location,
            String status,
            OffsetDateTime createdAt
    ) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record DeleteResponse(
            String message,
            Long deletedId,
            OffsetDateTime deletedAt
    ) {}
}
