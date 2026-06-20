package br.com.solarvision.api.service;

import br.com.solarvision.api.dao.CleaningDAO;
import br.com.solarvision.api.dao.PanelDAO;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.Cleaning;
import br.com.solarvision.api.model.CleaningDtos;
import br.com.solarvision.api.model.Panel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CleaningService {

    private final CleaningDAO cleaningDAO;
    private final PanelDAO panelDAO;

    public CleaningService(CleaningDAO cleaningDAO, PanelDAO panelDAO) {
        this.cleaningDAO = cleaningDAO;
        this.panelDAO = panelDAO;
    }

    @Transactional(readOnly = true)
    public List<CleaningDtos.CleaningResponse> listCleanings() {
        return cleaningDAO.listarTodos().stream()
                .map(this::toCleaningResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CleaningDtos.CleaningResponse getCleaning(Long cleaningId) {
        Cleaning cleaning = cleaningDAO.buscarPorId(cleaningId)
                .orElseThrow(() -> new NotFoundException("Limpeza não encontrada."));

        return toCleaningResponse(cleaning);
    }

    @Transactional
    public CleaningDtos.CleaningResponse createCleaning(CleaningDtos.CreateCleaningRequest request) {
        Panel panel = panelDAO.buscarPorId(request.placaId())
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));

        Cleaning cleaning = new Cleaning();
        cleaning.setPlaca(panel);
        cleaning.setDataLimpeza(request.dataLimpeza());
        cleaning.setObservacao(request.observacao() == null ? null : request.observacao().trim());

        Cleaning savedCleaning = cleaningDAO.salvar(cleaning);
        return toCleaningResponse(savedCleaning);
    }

    @Transactional
    public CleaningDtos.CleaningResponse updateCleaning(Long cleaningId, CleaningDtos.UpdateCleaningRequest request) {
        Cleaning cleaning = cleaningDAO.buscarPorId(cleaningId)
                .orElseThrow(() -> new NotFoundException("Limpeza não encontrada."));
        Panel panel = panelDAO.buscarPorId(request.placaId())
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));

        cleaning.setPlaca(panel);
        cleaning.setDataLimpeza(request.dataLimpeza());
        cleaning.setObservacao(request.observacao() == null ? null : request.observacao().trim());

        cleaningDAO.alterar(cleaning);
        return getCleaning(cleaningId);
    }

    @Transactional
    public void deleteCleaning(Long cleaningId) {
        if (!cleaningDAO.excluir(cleaningId)) {
            throw new NotFoundException("Limpeza não encontrada.");
        }
    }

    private CleaningDtos.CleaningResponse toCleaningResponse(Cleaning cleaning) {
        return new CleaningDtos.CleaningResponse(
                cleaning.getId(),
                cleaning.getPlaca().getId(),
                cleaning.getPlaca().getModel(),
                cleaning.getDataLimpeza(),
                cleaning.getObservacao(),
                cleaning.getCriadoEm()
        );
    }
}
