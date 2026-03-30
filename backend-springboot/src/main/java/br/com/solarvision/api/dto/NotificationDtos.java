package br.com.solarvision.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public class NotificationDtos {

    public record InternalEmailRequest(
            @NotBlank String to,
            @NotBlank String subject,
            @NotBlank String template,
            @NotNull Map<String, Object> data
    ) {}

    public record MessageResponse(String message) {}
}
