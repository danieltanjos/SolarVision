package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.model.Cleaning;
import br.com.solarvision.api.model.DashboardDtos;
import br.com.solarvision.api.model.PanelStatus;
import br.com.solarvision.api.repository.CleaningRepository;
import br.com.solarvision.api.repository.PanelReadingRepository;
import br.com.solarvision.api.repository.PanelRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class DashboardService {

    private final PanelReadingRepository panelReadingRepository;
    private final PanelRepository panelRepository;
    private final CleaningRepository cleaningRepository;
    private final ZoneId dashboardZoneId;

    public DashboardService(PanelReadingRepository panelReadingRepository,
                            PanelRepository panelRepository,
                            CleaningRepository cleaningRepository,
                            @Value("${app.dashboard.zone-id:America/Sao_Paulo}") String dashboardZoneId) {
        this.panelReadingRepository = panelReadingRepository;
        this.panelRepository = panelRepository;
        this.cleaningRepository = cleaningRepository;
        this.dashboardZoneId = ZoneId.of(dashboardZoneId);
    }

    @Transactional(readOnly = true)
    public List<DashboardDtos.MetricPointResponse> getMetrics(OffsetDateTime start,
                                                              OffsetDateTime end,
                                                              String granularityParam) {
        OffsetDateTime effectiveStart = start == null ? defaultStart() : start;
        OffsetDateTime effectiveEnd = end == null ? now().toOffsetDateTime() : end;
        if (effectiveStart.isAfter(effectiveEnd)) {
            throw new BadRequestException("dataInicio deve ser anterior ou igual a dataFim.");
        }

        DashboardGranularity granularity = DashboardGranularity.fromParam(granularityParam);
        return panelReadingRepository
                .agruparMetricas(granularity.sqlToken(), dashboardZoneId.getId(), effectiveStart, effectiveEnd)
                .stream()
                .map(row -> new DashboardDtos.MetricPointResponse(
                        toOffsetDateTime(row[0]),
                        toBigDecimal(row[1])
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public DashboardDtos.RangeResponse getRange() {
        return new DashboardDtos.RangeResponse(
                panelReadingRepository.buscarPrimeiraLeitura(),
                panelReadingRepository.buscarUltimaLeitura()
        );
    }

    @Transactional(readOnly = true)
    public DashboardDtos.SummaryResponse getSummary() {
        ZonedDateTime now = now();
        OffsetDateTime startOfDay = now.toLocalDate().atStartOfDay(dashboardZoneId).toOffsetDateTime();
        BigDecimal totalGeradoHoje = panelReadingRepository.somarPorPeriodo(startOfDay, now.toOffsetDateTime());
        long placasAtivas = panelRepository.countByStatus(PanelStatus.ATIVA);
        DashboardDtos.LastCleaningResponse ultimaLimpeza = cleaningRepository
                .findFirstByOrderByDataLimpezaDescIdDesc()
                .map(this::toLastCleaningResponse)
                .orElse(null);

        return new DashboardDtos.SummaryResponse(
                totalGeradoHoje == null ? BigDecimal.ZERO : totalGeradoHoje,
                placasAtivas,
                ultimaLimpeza
        );
    }

    private OffsetDateTime defaultStart() {
        return now().minusDays(7).toOffsetDateTime();
    }

    private ZonedDateTime now() {
        return ZonedDateTime.now(dashboardZoneId).truncatedTo(ChronoUnit.SECONDS);
    }

    private OffsetDateTime toOffsetDateTime(Object bucket) {
        return toLocalDateTime(bucket).atZone(dashboardZoneId).toOffsetDateTime();
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        throw new IllegalStateException("Tipo inesperado para bucket do dashboard: "
                + (value == null ? "null" : value.getClass().getName()));
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        return new BigDecimal(value.toString());
    }

    private DashboardDtos.LastCleaningResponse toLastCleaningResponse(Cleaning cleaning) {
        return new DashboardDtos.LastCleaningResponse(
                cleaning.getId(),
                cleaning.getPlaca().getId(),
                cleaning.getPlaca().getModel(),
                cleaning.getDataLimpeza(),
                cleaning.getObservacao()
        );
    }
}
