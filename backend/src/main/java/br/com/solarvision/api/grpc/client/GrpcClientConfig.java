package br.com.solarvision.api.grpc.client;

import br.com.solarvision.api.grpc.alert.AlertServiceGrpc;
import br.com.solarvision.api.grpc.panel.PanelServiceGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.grpc.client.GrpcChannelFactory;

/**
 * Stubs gRPC (cliente) usados pela camada REST para chamar o servidor gRPC in-process.
 * O canal "local" é configurado em application.yml (spring.grpc.client.channels.local).
 */
@Configuration
public class GrpcClientConfig {

    @Bean
    PanelServiceGrpc.PanelServiceBlockingStub panelServiceStub(GrpcChannelFactory channels) {
        return PanelServiceGrpc.newBlockingStub(channels.createChannel("local"));
    }

    @Bean
    AlertServiceGrpc.AlertServiceBlockingStub alertServiceStub(GrpcChannelFactory channels) {
        return AlertServiceGrpc.newBlockingStub(channels.createChannel("local"));
    }
}
