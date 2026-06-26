package br.com.solarvision.api.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record MetricPointResponse(
            OffsetDateTime x,
            BigDecimal y
    ) {
    }

    public record LastCleaningResponse(
            Long id,
            Long placaId,
            String placaModelo,
            OffsetDateTime dataLimpeza,
            String observacao
    ) {
    }

    public record SummaryResponse(
            BigDecimal totalGeradoHoje,
            long placasAtivas,
            LastCleaningResponse ultimaLimpeza
    ) {
    }

    public record RangeResponse(
            OffsetDateTime primeiraLeitura,
            OffsetDateTime ultimaLeitura
    ) {
    }
}
