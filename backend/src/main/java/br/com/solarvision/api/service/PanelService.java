package br.com.solarvision.api.service;

import br.com.solarvision.api.dao.PanelDAO;
import br.com.solarvision.api.dao.SolarGroupDAO;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.model.PanelStatus;
import br.com.solarvision.api.model.SolarGroup;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PanelService {

    private final PanelDAO panelDAO;
    private final SolarGroupDAO solarGroupDAO;

    public PanelService(PanelDAO panelDAO, SolarGroupDAO solarGroupDAO) {
        this.panelDAO = panelDAO;
        this.solarGroupDAO = solarGroupDAO;
    }

    @Transactional(readOnly = true)
    public List<PanelDtos.PanelResponse> listPanels() {
        return panelDAO.listarTodos().stream()
                .map(this::toPanelResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PanelDtos.PanelResponse getPanel(Long panelId) {
        Panel panel = panelDAO.buscarPorId(panelId)
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));

        return toPanelResponse(panel);
    }

    @Transactional
    public PanelDtos.PanelResponse createPanel(PanelDtos.CreatePanelRequest request) {
        SolarGroup group = solarGroupDAO.buscarPorId(request.grupoId())
                .orElseThrow(() -> new NotFoundException("Grupo solar não encontrado."));

        Panel panel = new Panel();
        panel.setGrupo(group);
        panel.setModel(request.modelo().trim());
        panel.setStatus(request.status() == null ? PanelStatus.ATIVA : request.status());

        Panel savedPanel = panelDAO.salvar(panel);
        return toPanelResponse(savedPanel);
    }

    @Transactional
    public PanelDtos.PanelResponse updatePanel(Long panelId, PanelDtos.UpdatePanelRequest request) {
        Panel panel = panelDAO.buscarPorId(panelId)
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));
        SolarGroup group = solarGroupDAO.buscarPorId(request.grupoId())
                .orElseThrow(() -> new NotFoundException("Grupo solar não encontrado."));

        panel.setGrupo(group);
        panel.setModel(request.modelo().trim());
        panel.setStatus(request.status() == null ? PanelStatus.ATIVA : request.status());

        panelDAO.alterar(panel);
        return getPanel(panelId);
    }

    @Transactional
    public void deletePanel(Long panelId) {
        if (!panelDAO.excluir(panelId)) {
            throw new NotFoundException("Placa não encontrada.");
        }
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
