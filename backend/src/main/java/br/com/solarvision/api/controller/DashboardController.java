package br.com.solarvision.api.controller;

import br.com.solarvision.api.dto.DashboardDtos;
import br.com.solarvision.api.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public DashboardDtos.DashboardSummaryResponse summary() {
        return dashboardService.summary();
    }

    @GetMapping("/metrics")
    public DashboardDtos.DashboardMetricsResponse metrics() {
        return dashboardService.metrics();
    }
}
