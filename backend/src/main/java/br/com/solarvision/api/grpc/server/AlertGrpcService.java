package br.com.solarvision.api.grpc.server;

import br.com.solarvision.api.grpc.alert.AlertServiceGrpc;
import br.com.solarvision.api.grpc.alert.DispatchAlertEmailRequest;
import br.com.solarvision.api.grpc.alert.DispatchAlertEmailResponse;
import br.com.solarvision.api.grpc.alert.GenerateAlertRequest;
import br.com.solarvision.api.grpc.alert.GenerateAlertResponse;
import br.com.solarvision.api.service.GrpcOperationsService;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;

/**
 * Servidor gRPC para o serviço AlertService (alert-service.proto).
 */
@Service
public class AlertGrpcService extends AlertServiceGrpc.AlertServiceImplBase {

    private final GrpcOperationsService operations;

    public AlertGrpcService(GrpcOperationsService operations) {
        this.operations = operations;
    }

    @Override
    public void gerarAlerta(GenerateAlertRequest request,
                            StreamObserver<GenerateAlertResponse> responseObserver) {
        GrpcOperationsService.AlertResult result = operations.gerarAlerta(
                request.getPanelId(),
                request.getType(),
                request.getSeverity()
        );

        GenerateAlertResponse response = GenerateAlertResponse.newBuilder()
                .setPanelId(request.getPanelId())
                .setType(request.getType())
                .setSuccess(result.found())
                .setAlertId(result.alertId())
                .setCreatedAt(result.createdAt().toString())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void dispararEmailAlerta(DispatchAlertEmailRequest request,
                                    StreamObserver<DispatchAlertEmailResponse> responseObserver) {
        GrpcOperationsService.EmailResult result = operations.dispararEmailAlerta(
                request.getTo(),
                request.getPanelId(),
                request.getSeverity(),
                request.getSoilingIndex(),
                request.getSubject(),
                request.getTemplate()
        );

        DispatchAlertEmailResponse response = DispatchAlertEmailResponse.newBuilder()
                .setTo(request.getTo())
                .setSuccess(result.success())
                .setAlertId(result.alertId())
                .setCreatedAt(result.createdAt().toString())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
