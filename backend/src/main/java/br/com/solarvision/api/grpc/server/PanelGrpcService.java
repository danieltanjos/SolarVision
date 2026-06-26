package br.com.solarvision.api.grpc.server;

import br.com.solarvision.api.grpc.panel.PanelAvailabilityRequest;
import br.com.solarvision.api.grpc.panel.PanelAvailabilityResponse;
import br.com.solarvision.api.grpc.panel.PanelServiceGrpc;
import br.com.solarvision.api.service.GrpcOperationsService;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Service;

/**
 * Servidor gRPC para o serviço PanelService (panel-service.proto).
 * O Spring gRPC registra automaticamente os beans que estendem um ImplBase
 * (io.grpc.BindableService). Também é possível usar @GrpcService no lugar de @Service.
 */
@Service
public class PanelGrpcService extends PanelServiceGrpc.PanelServiceImplBase {

    private final GrpcOperationsService operations;

    public PanelGrpcService(GrpcOperationsService operations) {
        this.operations = operations;
    }

    @Override
    public void checarPlaca(PanelAvailabilityRequest request,
                            StreamObserver<PanelAvailabilityResponse> responseObserver) {
        GrpcOperationsService.PanelCheckResult result = operations.checarPlaca(request.getPanelId());

        PanelAvailabilityResponse response = PanelAvailabilityResponse.newBuilder()
                .setPanelId(request.getPanelId())
                .setTimestamp(result.timestamp().toString())
                .setSuccess(result.found())
                .setReadingId(result.readingId())
                .setMessage(result.message())
                .setStatus(result.active())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
