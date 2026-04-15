package br.com.solarvision.api.service;

import br.com.solarvision.api.model.PanelReading;
import br.com.solarvision.api.dto.DashboardDtos;
import br.com.solarvision.api.repository.AlertRepository;
import br.com.solarvision.api.repository.CleaningRepository;
import br.com.solarvision.api.repository.PanelReadingRepository;
import br.com.solarvision.api.repository.PanelRepository;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class DashboardService {

    private final SolarGroupRepository solarGroupRepository;
    private final PanelRepository panelRepository;
    private final AlertRepository alertRepository;
    private final CleaningRepository cleaningRepository;
    private final PanelReadingRepository panelReadingRepository;

    public DashboardService(SolarGroupRepository solarGroupRepository,
                            PanelRepository panelRepository,
                            AlertRepository alertRepository,
                            CleaningRepository cleaningRepository,
                            PanelReadingRepository panelReadingRepository) {
        this.solarGroupRepository = solarGroupRepository;
        this.panelRepository = panelRepository;
        this.alertRepository = alertRepository;
        this.cleaningRepository = cleaningRepository;
        this.panelReadingRepository = panelReadingRepository;
    }

    public DashboardDtos.DashboardSummaryResponse summary() {
        long totalGroups = solarGroupRepository.count();
        long totalPanels = panelRepository.count();
        long activeAlerts = alertRepository.countByActiveTrue();
        OffsetDateTime start = LocalDate.now().atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime end = start.plusDays(1);
        long cleaningsToday = cleaningRepository.countByPerformedAtBetween(start, end);

        List<PanelReading> readings = panelReadingRepository.findTop100ByOrderByTimestampDesc();
        double avgEfficiency = average(readings.stream().map(PanelReading::getEfficiency).toList());
        double avgSoilingIndex = average(readings.stream().map(PanelReading::getSoilingIndex).toList());
        double waterSavedLiters = readings.stream().map(PanelReading::getWaterReuseLiters).reduce(0.0, Double::sum);

        return new DashboardDtos.DashboardSummaryResponse(
                totalGroups,
                totalPanels,
                activeAlerts,
                cleaningsToday,
                round(avgEfficiency),
                round(avgSoilingIndex),
                round(waterSavedLiters)
        );
    }

    public DashboardDtos.DashboardMetricsResponse metrics() {
        OffsetDateTime end = OffsetDateTime.now();
        OffsetDateTime start = end.minusDays(30);
        List<PanelReading> readings = panelReadingRepository.findByTimestampBetweenOrderByTimestampAsc(start, end);
        DateTimeFormatter formatter = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

        List<DashboardDtos.MetricPointResponse> generationSeries = readings.stream()
                .map(r -> new DashboardDtos.MetricPointResponse(r.getTimestamp().format(formatter), round(r.getGenerationKw())))
                .toList();
        List<DashboardDtos.MetricPointResponse> soilingSeries = readings.stream()
                .map(r -> new DashboardDtos.MetricPointResponse(r.getTimestamp().format(formatter), round(r.getSoilingIndex())))
                .toList();
        List<DashboardDtos.MetricPointResponse> waterReuseSeries = readings.stream()
                .map(r -> new DashboardDtos.MetricPointResponse(r.getTimestamp().format(formatter), round(r.getWaterReuseLiters())))
                .toList();

        return new DashboardDtos.DashboardMetricsResponse(generationSeries, soilingSeries, waterReuseSeries);
    }

    public DashboardDtos.GraphqlDashboardResponse graphqlDashboard() {
        return new DashboardDtos.GraphqlDashboardResponse(
                Math.toIntExact(solarGroupRepository.count()),
                Math.toIntExact(panelRepository.count()),
                Math.toIntExact(alertRepository.countByActiveTrue())
        );
    }

    private double average(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
