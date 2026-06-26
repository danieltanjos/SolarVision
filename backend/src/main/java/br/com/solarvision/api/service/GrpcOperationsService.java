package br.com.solarvision.api.service;

import br.com.solarvision.api.model.Alert;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelReading;
import br.com.solarvision.api.model.PanelStatus;
import br.com.solarvision.api.repository.AlertRepository;
import br.com.solarvision.api.repository.PanelReadingRepository;
import br.com.solarvision.api.repository.PanelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Regras de negócio acionadas pelos serviços gRPC internos.
 * Mantém as transações na camada de serviço (JPA), deixando os {@code @GrpcService}
 * responsáveis apenas por traduzir mensagens Protobuf.
 */
@Service
public class GrpcOperationsService {

    private static final Logger log = LoggerFactory.getLogger(GrpcOperationsService.class);

    private final PanelRepository panelRepository;
    private final PanelReadingRepository panelReadingRepository;
    private final AlertRepository alertRepository;

    public GrpcOperationsService(PanelRepository panelRepository,
                                 PanelReadingRepository panelReadingRepository,
                                 AlertRepository alertRepository) {
        this.panelRepository = panelRepository;
        this.panelReadingRepository = panelReadingRepository;
        this.alertRepository = alertRepository;
    }

    @Transactional
    public PanelCheckResult checarPlaca(long panelId) {
        OffsetDateTime agora = OffsetDateTime.now();
        Optional<Panel> panelOpt = panelRepository.findById(panelId);

        if (panelOpt.isEmpty()) {
            return new PanelCheckResult(false, false, 0L, "Placa não encontrada.", agora);
        }

        Panel panel = panelOpt.get();
        boolean ativa = panel.getStatus() == PanelStatus.ATIVA;

        // Registra uma leitura de verificação (ping de disponibilidade) via JPA.
        PanelReading leitura = new PanelReading();
        leitura.setPlaca(panel);
        leitura.setDataHora(agora);
        leitura.setWatsGerados(BigDecimal.ZERO);
        PanelReading salva = panelReadingRepository.save(leitura);

        return new PanelCheckResult(
                true,
                ativa,
                salva.getId(),
                "Placa verificada. Status atual: " + panel.getStatus().name(),
                agora
        );
    }

    @Transactional
    public AlertResult gerarAlerta(long panelId, String tipo, String severidade) {
        Optional<Panel> panelOpt = panelRepository.findById(panelId);
        if (panelOpt.isEmpty()) {
            return new AlertResult(false, 0L, OffsetDateTime.now());
        }

        Alert alerta = new Alert();
        alerta.setPlaca(panelOpt.get());
        alerta.setTipo(normalize(tipo, "GENERICO"));
        alerta.setSeveridade(normalize(severidade, "BAIXA"));
        alerta.setCanal("GRPC");
        alerta.setDetalhe("Alerta gerado via gRPC para a placa " + panelId);

        Alert salvo = alertRepository.save(alerta);
        return new AlertResult(true, salvo.getId(), salvo.getCriadoEm());
    }

    @Transactional
    public EmailResult dispararEmailAlerta(String to,
                                           long panelId,
                                           String severidade,
                                           float soilingIndex,
                                           String subject,
                                           String template) {
        OffsetDateTime agora = OffsetDateTime.now();
        long alertId = 0L;

        Optional<Panel> panelOpt = panelRepository.findById(panelId);
        if (panelOpt.isPresent()) {
            Alert alerta = new Alert();
            alerta.setPlaca(panelOpt.get());
            alerta.setTipo("EMAIL");
            alerta.setSeveridade(normalize(severidade, "BAIXA"));
            alerta.setCanal("EMAIL");
            alerta.setDetalhe("Email '" + normalize(subject, "Alerta SolarVision")
                    + "' (template=" + normalize(template, "default")
                    + ", soiling=" + soilingIndex + ") destinado a " + to);
            alertId = alertRepository.save(alerta).getId();
        }

        // Simulação do envio de email (em produção, integraria com um provedor SMTP/API).
        log.info("[SIMULAÇÃO EMAIL] to={} subject={} severidade={} soilingIndex={} panelId={}",
                to, subject, severidade, soilingIndex, panelId);

        return new EmailResult(true, alertId, agora);
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    public record PanelCheckResult(boolean found,
                                   boolean active,
                                   long readingId,
                                   String message,
                                   OffsetDateTime timestamp) {
    }

    public record AlertResult(boolean found, long alertId, OffsetDateTime createdAt) {
    }

    public record EmailResult(boolean success, long alertId, OffsetDateTime createdAt) {
    }
}
