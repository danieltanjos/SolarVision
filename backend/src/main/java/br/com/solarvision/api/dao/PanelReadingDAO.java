package br.com.solarvision.api.dao;

import br.com.solarvision.api.service.DashboardGranularity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@Component
public class PanelReadingDAO {

    private final JdbcClient jdbcClient;

    public PanelReadingDAO(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<MetricRow> agruparMetricas(OffsetDateTime start,
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

        return jdbcClient.sql(sql)
                .param("start", start)
                .param("end", end)
                .query((rs, rowNum) -> new MetricRow(
                        toLocalDateTime(rs.getObject("bucket")).atZone(zoneId).toOffsetDateTime(),
                        rs.getBigDecimal("total_watts")
                ))
                .list();
    }

    public BigDecimal somarPorPeriodo(OffsetDateTime start, OffsetDateTime end) {
        BigDecimal total = jdbcClient.sql("""
                        SELECT COALESCE(SUM(wats_gerados), 0)
                        FROM leituras_energia
                        WHERE data_hora BETWEEN :start AND :end
                        """)
                .param("start", start)
                .param("end", end)
                .query(BigDecimal.class)
                .single();

        return total == null ? BigDecimal.ZERO : total;
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

    public record MetricRow(OffsetDateTime bucket, BigDecimal totalWatts) {
    }
}
