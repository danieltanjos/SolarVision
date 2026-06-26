package br.com.solarvision.api.service;

import br.com.solarvision.api.model.Alert;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelReading;
import br.com.solarvision.api.model.PanelStatus;
import br.com.solarvision.api.repository.AlertRepository;
import br.com.solarvision.api.repository.PanelReadingRepository;
import br.com.solarvision.api.repository.PanelRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GrpcOperationsServiceTest {

    @Mock
    private PanelRepository panelRepository;

    @Mock
    private PanelReadingRepository panelReadingRepository;

    @Mock
    private AlertRepository alertRepository;

    @InjectMocks
    private GrpcOperationsService service;

    private Panel panelAtiva() {
        Panel panel = new Panel();
        panel.setId(1L);
        panel.setModel("Modelo X");
        panel.setStatus(PanelStatus.ATIVA);
        return panel;
    }

    @Test
    void checarPlacaDeveRegistrarLeituraQuandoPlacaExiste() {
        when(panelRepository.findById(1L)).thenReturn(Optional.of(panelAtiva()));
        when(panelReadingRepository.save(any(PanelReading.class))).thenAnswer(invocation -> {
            PanelReading r = invocation.getArgument(0);
            r.setId(5L);
            return r;
        });

        GrpcOperationsService.PanelCheckResult result = service.checarPlaca(1L);

        assertThat(result.found()).isTrue();
        assertThat(result.active()).isTrue();
        assertThat(result.readingId()).isEqualTo(5L);
    }

    @Test
    void checarPlacaDeveFalharQuandoPlacaNaoExiste() {
        when(panelRepository.findById(404L)).thenReturn(Optional.empty());

        GrpcOperationsService.PanelCheckResult result = service.checarPlaca(404L);

        assertThat(result.found()).isFalse();
        assertThat(result.readingId()).isZero();
        verify(panelReadingRepository, never()).save(any());
    }

    @Test
    void gerarAlertaDevePersistirQuandoPlacaExiste() {
        when(panelRepository.findById(1L)).thenReturn(Optional.of(panelAtiva()));
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId(7L);
            a.setCriadoEm(OffsetDateTime.now());
            return a;
        });

        GrpcOperationsService.AlertResult result = service.gerarAlerta(1L, "SOILING", "ALTA");

        assertThat(result.found()).isTrue();
        assertThat(result.alertId()).isEqualTo(7L);
    }

    @Test
    void gerarAlertaDeveFalharQuandoPlacaNaoExiste() {
        when(panelRepository.findById(404L)).thenReturn(Optional.empty());

        GrpcOperationsService.AlertResult result = service.gerarAlerta(404L, "SOILING", "ALTA");

        assertThat(result.found()).isFalse();
        assertThat(result.alertId()).isZero();
        verify(alertRepository, never()).save(any());
    }

    @Test
    void dispararEmailDevePersistirAlertaQuandoPlacaExiste() {
        when(panelRepository.findById(1L)).thenReturn(Optional.of(panelAtiva()));
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId(9L);
            return a;
        });

        GrpcOperationsService.EmailResult result = service.dispararEmailAlerta(
                "ops@solar.com", 1L, "ALTA", 0.42f, "Alerta", "default");

        assertThat(result.success()).isTrue();
        assertThat(result.alertId()).isEqualTo(9L);
    }
}
