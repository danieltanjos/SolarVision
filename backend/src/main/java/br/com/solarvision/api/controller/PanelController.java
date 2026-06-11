package br.com.solarvision.api.controller;

import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.service.PanelService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/panels")
public class PanelController {

    private final PanelService panelService;

    public PanelController(PanelService panelService) {
        this.panelService = panelService;
    }

    @GetMapping
    public List<PanelDtos.PanelResponse> listPanels() {
        return panelService.listPanels();
    }

    @PostMapping
    public PanelDtos.PanelResponse createPanel(@Valid @RequestBody PanelDtos.CreatePanelRequest request) {
        return panelService.createPanel(request);
    }
}
