package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.model.PanelStatus;
import br.com.solarvision.api.model.SolarGroup;
import br.com.solarvision.api.repository.PanelRepository;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PanelService {

    private final PanelRepository panelRepository;
    private final SolarGroupRepository solarGroupRepository;

    public PanelService(PanelRepository panelRepository, SolarGroupRepository solarGroupRepository) {
        this.panelRepository = panelRepository;
        this.solarGroupRepository = solarGroupRepository;
    }

    @Transactional(readOnly = true)
    public List<PanelDtos.PanelResponse> listPanels() {
        return panelRepository.findAllByOrderByIdAsc().stream()
                .map(this::toPanelResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PanelDtos.PanelResponse getPanel(Long panelId) {
        Panel panel = panelRepository.findById(panelId)
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));

        return toPanelResponse(panel);
    }

    @Transactional
    public PanelDtos.PanelResponse createPanel(PanelDtos.CreatePanelRequest request) {
        SolarGroup group = solarGroupRepository.findById(request.grupoId())
                .orElseThrow(() -> new NotFoundException("Grupo solar não encontrado."));

        Panel panel = new Panel();
        panel.setGrupo(group);
        panel.setModel(request.modelo().trim());
        panel.setStatus(request.status() == null ? PanelStatus.ATIVA : request.status());

        Panel savedPanel = panelRepository.save(panel);
        return toPanelResponse(savedPanel);
    }

    @Transactional
    public PanelDtos.PanelResponse updatePanel(Long panelId, PanelDtos.UpdatePanelRequest request) {
        Panel panel = panelRepository.findById(panelId)
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));
        SolarGroup group = solarGroupRepository.findById(request.grupoId())
                .orElseThrow(() -> new NotFoundException("Grupo solar não encontrado."));

        panel.setGrupo(group);
        panel.setModel(request.modelo().trim());
        panel.setStatus(request.status() == null ? PanelStatus.ATIVA : request.status());

        Panel savedPanel = panelRepository.save(panel);
        return toPanelResponse(savedPanel);
    }

    @Transactional
    public void deletePanel(Long panelId) {
        if (!panelRepository.existsById(panelId)) {
            throw new NotFoundException("Placa não encontrada.");
        }
        panelRepository.deleteById(panelId);
    }

    private PanelDtos.PanelResponse toPanelResponse(Panel panel) {
        return new PanelDtos.PanelResponse(
                panel.getId(),
                panel.getGrupo().getId(),
                panel.getGrupo().getNome(),
                panel.getModel(),
                panel.getStatus().name(),
                panel.getCriadoEm()
        );
    }
}
