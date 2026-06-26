package br.com.solarvision.api.controller;

import br.com.solarvision.api.grpc.alert.AlertServiceGrpc;
import br.com.solarvision.api.grpc.alert.DispatchAlertEmailRequest;
import br.com.solarvision.api.grpc.alert.DispatchAlertEmailResponse;
import br.com.solarvision.api.grpc.alert.GenerateAlertRequest;
import br.com.solarvision.api.grpc.alert.GenerateAlertResponse;
import br.com.solarvision.api.grpc.panel.PanelAvailabilityRequest;
import br.com.solarvision.api.grpc.panel.PanelAvailabilityResponse;
import br.com.solarvision.api.grpc.panel.PanelServiceGrpc;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ponte REST -> gRPC: expõe os serviços gRPC internos (in-process) por HTTP,
 * demonstrando a comunicação ponta a ponta dentro do backend.
 */
@RestController
@RequestMapping("/api/internal/grpc")
public class GrpcBridgeController {

    private final PanelServiceGrpc.PanelServiceBlockingStub panelStub;
    private final AlertServiceGrpc.AlertServiceBlockingStub alertStub;

    public GrpcBridgeController(PanelServiceGrpc.PanelServiceBlockingStub panelStub,
                               AlertServiceGrpc.AlertServiceBlockingStub alertStub) {
        this.panelStub = panelStub;
        this.alertStub = alertStub;
    }

    @PostMapping("/panels/{panelId}/check")
    public PanelCheckResponse checarPlaca(@PathVariable Long panelId) {
        PanelAvailabilityResponse response = panelStub.checarPlaca(
                PanelAvailabilityRequest.newBuilder().setPanelId(panelId).build());

        return new PanelCheckResponse(
                response.getPanelId(),
                response.getSuccess(),
                response.getStatus(),
                response.getReadingId(),
                response.getMessage(),
                response.getTimestamp()
        );
    }

    @PostMapping("/alerts")
    public AlertCreatedResponse gerarAlerta(@Valid @RequestBody GenerateAlertBody body) {
        GenerateAlertResponse response = alertStub.gerarAlerta(
                GenerateAlertRequest.newBuilder()
                        .setPanelId(body.panelId())
                        .setType(body.type() == null ? "" : body.type())
                        .setSeverity(body.severity() == null ? "" : body.severity())
                        .build());

        return new AlertCreatedResponse(
                response.getPanelId(),
                response.getType(),
                response.getSuccess(),
                response.getAlertId(),
                response.getCreatedAt()
        );
    }

    @PostMapping("/alerts/email")
    public EmailDispatchResponse dispararEmail(@Valid @RequestBody DispatchEmailBody body) {
        DispatchAlertEmailRequest.Builder request = DispatchAlertEmailRequest.newBuilder()
                .setTo(body.to() == null ? "" : body.to())
                .setTemplate(body.template() == null ? "" : body.template())
                .setSubject(body.subject() == null ? "" : body.subject())
                .setPanelId(body.panelId())
                .setSeverity(body.severity() == null ? "" : body.severity())
                .setSoilingIndex(body.soilingIndex() == null ? 0f : body.soilingIndex());

        DispatchAlertEmailResponse response = alertStub.dispararEmailAlerta(request.build());

        return new EmailDispatchResponse(
                response.getTo(),
                response.getSuccess(),
                response.getAlertId(),
                response.getCreatedAt()
        );
    }

    public record GenerateAlertBody(
            @NotNull(message = "panelId é obrigatório.") Long panelId,
            String type,
            String severity
    ) {
    }

    public record DispatchEmailBody(
            @NotNull(message = "to é obrigatório.") String to,
            String template,
            String subject,
            @NotNull(message = "panelId é obrigatório.") Long panelId,
            String severity,
            Float soilingIndex
    ) {
    }

    public record PanelCheckResponse(long panelId,
                                     boolean success,
                                     boolean ativa,
                                     long readingId,
                                     String message,
                                     String timestamp) {
    }

    public record AlertCreatedResponse(long panelId,
                                       String type,
                                       boolean success,
                                       long alertId,
                                       String createdAt) {
    }

    public record EmailDispatchResponse(String to,
                                        boolean success,
                                        long alertId,
                                        String createdAt) {
    }
}
