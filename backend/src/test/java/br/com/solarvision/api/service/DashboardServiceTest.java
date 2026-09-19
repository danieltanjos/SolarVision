package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {
    @Mock PanelReadingRepository readings;
    @Mock PanelRepository panels;
    @Mock CleaningRepository cleanings;
    DashboardService service;
    final OffsetDateTime start = OffsetDateTime.parse("2026-09-01T00:00:00-03:00");

    @BeforeEach void setup() { service = new DashboardService(readings, panels, cleanings, "America/Sao_Paulo"); }

    @Test void rejeitaPeriodoInvertidoSemConsultarBanco() {
        assertThatThrownBy(() -> service.getMetrics(start.plusDays(1), start, "dia"))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(readings);
    }

    @Test void rejeitaGranularidadeDesconhecida() {
        assertThatThrownBy(() -> service.getMetrics(start, start, "year"))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(readings);
    }

    @ParameterizedTest @CsvSource({"hora,hour", "dia,day", "semana,week", "mes,month", "DIA,day"})
    void selecionaAgrupamentoSeguro(String input, String sql) {
        when(readings.agruparMetricas(sql, "America/Sao_Paulo", start, start)).thenReturn(List.of());
        assertThat(service.getMetrics(start, start, input)).isEmpty();
        verify(readings).agruparMetricas(sql, "America/Sao_Paulo", start, start);
    }

    @Test void converteBucketEValorPreservandoFuso() {
        when(readings.agruparMetricas("day", "America/Sao_Paulo", start, start))
                .thenReturn(Collections.singletonList(new Object[]{LocalDateTime.of(2026,9,1,0,0), new BigDecimal("1500.50")}));
        var point = service.getMetrics(start, start, null).getFirst();
        assertThat(point.x()).isEqualTo(start);
        assertThat(point.y()).isEqualByComparingTo("1500.50");
    }

    @Test void resumoSemDadosRetornaZeroESemLimpeza() {
        var summary = service.getSummary();
        assertThat(summary.totalGeradoHoje()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(summary.placasAtivas()).isZero();
        assertThat(summary.ultimaLimpeza()).isNull();
    }
}
