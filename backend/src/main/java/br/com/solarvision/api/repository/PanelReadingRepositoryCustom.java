package br.com.solarvision.api.repository;

import br.com.solarvision.api.service.DashboardGranularity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

public interface PanelReadingRepositoryCustom {
    List<MetricRow> aggregateMetrics(OffsetDateTime start,
                                     OffsetDateTime end,
                                     DashboardGranularity granularity,
                                     ZoneId zoneId);

    record MetricRow(OffsetDateTime bucket, BigDecimal totalWatts) {
    }
}
