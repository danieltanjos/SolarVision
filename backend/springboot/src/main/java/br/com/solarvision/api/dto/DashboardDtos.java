package br.com.solarvision.api.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

public class DashboardDtos {

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record DashboardSummaryResponse(
            long totalGroups,
            long totalPanels,
            long activeAlerts,
            long cleaningsToday,
            double avgEfficiency,
            double avgSoilingIndex,
            double waterSavedLiters
    ) {}

    public record MetricPointResponse(String timestamp, double value) {}

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record DashboardMetricsResponse(
            List<MetricPointResponse> generationSeries,
            List<MetricPointResponse> soilingSeries,
            List<MetricPointResponse> waterReuseSeries
    ) {}

    public record GraphqlDashboardResponse(int totalGroups, int totalPanels, int activeAlerts) {}
}
