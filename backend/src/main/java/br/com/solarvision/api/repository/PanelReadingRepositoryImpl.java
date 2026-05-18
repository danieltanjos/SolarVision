package br.com.solarvision.api.repository;

import br.com.solarvision.api.service.DashboardGranularity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@Repository
public class PanelReadingRepositoryImpl implements PanelReadingRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<MetricRow> aggregateMetrics(OffsetDateTime start,
                                            OffsetDateTime end,
                                            DashboardGranularity granularity,
                                            ZoneId zoneId) {
        String sqlZoneId = zoneId.getId().replace("'", "''");
        String bucketExpression = "date_trunc('" + granularity.sqlToken() + "', data_hora AT TIME ZONE '" + sqlZoneId + "')";
        String sql = """
                SELECT %s AS bucket, COALESCE(SUM(wats_gerados), 0) AS total_watts
                FROM leituras_energia
                WHERE data_hora >= :start AND data_hora <= :end
                GROUP BY bucket
                ORDER BY bucket
                """.formatted(bucketExpression);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(sql)
                .setParameter("start", start)
                .setParameter("end", end)
                .getResultList();

        return rows.stream()
                .map(row -> toMetricRow(row, zoneId))
                .toList();
    }

    private MetricRow toMetricRow(Object[] row, ZoneId zoneId) {
        LocalDateTime bucketValue = toLocalDateTime(row[0]);
        BigDecimal totalWatts = (BigDecimal) row[1];
        OffsetDateTime bucket = bucketValue.atZone(zoneId).toOffsetDateTime();
        return new MetricRow(bucket, totalWatts);
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        throw new IllegalStateException("Tipo inesperado para bucket do dashboard: " + value.getClass().getName());
    }
}
