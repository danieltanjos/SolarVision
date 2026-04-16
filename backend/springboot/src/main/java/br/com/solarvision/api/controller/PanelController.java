package br.com.solarvision.api.controller;

import br.com.solarvision.api.dto.GroupDtos;
import br.com.solarvision.api.dto.PanelDtos;
import br.com.solarvision.api.service.PanelService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/panels")
public class PanelController {

    private final PanelService panelService;

    public PanelController(PanelService panelService) {
        this.panelService = panelService;
    }

    @GetMapping
    public List<PanelDtos.PanelResponse> list() {
        return panelService.listAll();
    }

    @PostMapping
    public PanelDtos.PanelResponse create(@Valid @RequestBody PanelDtos.PanelRequest request) {
        return panelService.create(request);
    }

    @GetMapping("/{panelId}")
    public PanelDtos.PanelResponse getById(@PathVariable Long panelId) {
        return panelService.getById(panelId);
    }

    @PatchMapping("/{panelId}")
    public PanelDtos.PanelResponse update(@PathVariable Long panelId, @Valid @RequestBody PanelDtos.PanelRequest request) {
        return panelService.update(panelId, request);
    }

    @DeleteMapping("/{panelId}")
    public GroupDtos.DeleteResponse delete(@PathVariable Long panelId) {
        return panelService.delete(panelId);
    }
}
