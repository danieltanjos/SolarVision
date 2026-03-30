package br.com.solarvision.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public class GroupDtos {

    public record GroupRequest(
            @NotBlank String name,
            @NotBlank String location,
            @NotNull String status
    ) {}

    public record GroupResponse(
            Long id,
            String name,
            String location,
            String status,
            OffsetDateTime created_at
    ) {}

    public record DeleteResponse(
            String message,
            Long deleted_id,
            OffsetDateTime deleted_at
    ) {}
}
