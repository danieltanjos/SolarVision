package br.com.solarvision.api.service;

import br.com.solarvision.api.dto.GraphqlDtos;
import br.com.solarvision.api.repository.AlertRepository;
import br.com.solarvision.api.repository.CleaningRepository;
import br.com.solarvision.api.repository.PanelRepository;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class GraphqlQueryService {

    private final DashboardService dashboardService;
    private final SolarGroupRepository solarGroupRepository;
    private final PanelRepository panelRepository;
    private final AlertRepository alertRepository;
    private final CleaningRepository cleaningRepository;

    public GraphqlQueryService(DashboardService dashboardService,
                               SolarGroupRepository solarGroupRepository,
                               PanelRepository panelRepository,
                               AlertRepository alertRepository,
                               CleaningRepository cleaningRepository) {
        this.dashboardService = dashboardService;
        this.solarGroupRepository = solarGroupRepository;
        this.panelRepository = panelRepository;
        this.alertRepository = alertRepository;
        this.cleaningRepository = cleaningRepository;
    }

    public br.com.solarvision.api.dto.DashboardDtos.GraphqlDashboardResponse dashboard() {
        return dashboardService.graphqlDashboard();
    }

    public List<GraphqlDtos.GraphqlGroupResponse> groups() {
        return solarGroupRepository.findAll().stream()
                .map(group -> new GraphqlDtos.GraphqlGroupResponse(
                        group.getId(),
                        group.getName(),
                        group.getLocation(),
                        group.getStatus().name(),
                        group.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                ))
                .toList();
    }

    public List<GraphqlDtos.GraphqlPanelResponse> panels() {
        return panelRepository.findAll().stream()
                .map(panel -> new GraphqlDtos.GraphqlPanelResponse(
                        panel.getId(),
                        panel.getSolarGroup().getId(),
                        panel.getSerialNumber(),
                        panel.getModel(),
                        panel.getStatus().name()
                ))
                .toList();
    }

    public List<GraphqlDtos.GraphqlAlertResponse> alerts() {
        return alertRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(alert -> new GraphqlDtos.GraphqlAlertResponse(
                        alert.getId(),
                        alert.getPanel().getId(),
                        alert.getType(),
                        alert.getSeverity().name(),
                        alert.getSoilingIndex(),
                        alert.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                        alert.isActive()
                ))
                .toList();
    }

    public List<GraphqlDtos.GraphqlCleaningResponse> cleanings() {
        return cleaningRepository.findAll().stream()
                .map(cleaning -> new GraphqlDtos.GraphqlCleaningResponse(
                        cleaning.getId(),
                        cleaning.getPanel().getId(),
                        cleaning.getPerformedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                        cleaning.getWaterUsedLiters(),
                        cleaning.getPerformedBy(),
                        cleaning.getNotes()
                ))
                .toList();
    }
}
