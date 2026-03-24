package br.com.solarvision.api.dto;

import java.util.List;

public class DashboardDtos {

    public record DashboardSummaryResponse(
            long total_groups,
            long total_panels,
            long active_alerts,
            long cleanings_today,
            double avg_efficiency,
            double avg_soiling_index,
            double water_saved_liters
    ) {}

    public record MetricPointResponse(String timestamp, double value) {}

    public record DashboardMetricsResponse(
            List<MetricPointResponse> generation_series,
            List<MetricPointResponse> soiling_series,
            List<MetricPointResponse> water_reuse_series
    ) {}

    public record GraphqlDashboardResponse(int totalGroups, int totalPanels, int activeAlerts) {}
}
