package br.com.solarvision.api.controller;

import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.service.PanelService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/{panelId}")
    public PanelDtos.PanelResponse getPanel(@PathVariable Long panelId) {
        return panelService.getPanel(panelId);
    }

    @PostMapping
    public PanelDtos.PanelResponse createPanel(@Valid @RequestBody PanelDtos.CreatePanelRequest request) {
        return panelService.createPanel(request);
    }

    @PutMapping("/{panelId}")
    public PanelDtos.PanelResponse updatePanel(@PathVariable Long panelId,
                                               @Valid @RequestBody PanelDtos.UpdatePanelRequest request) {
        return panelService.updatePanel(panelId, request);
    }

    @DeleteMapping("/{panelId}")
    public ResponseEntity<Void> deletePanel(@PathVariable Long panelId) {
        panelService.deletePanel(panelId);
        return ResponseEntity.noContent().build();
    }
}
