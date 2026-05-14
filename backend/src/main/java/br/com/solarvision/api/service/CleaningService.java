package br.com.solarvision.api.service;

import br.com.solarvision.api.dto.CleaningDtos;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.Cleaning;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.repository.CleaningRepository;
import br.com.solarvision.api.repository.PanelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CleaningService {

    private final CleaningRepository cleaningRepository;
    private final PanelRepository panelRepository;

    public CleaningService(CleaningRepository cleaningRepository, PanelRepository panelRepository) {
        this.cleaningRepository = cleaningRepository;
        this.panelRepository = panelRepository;
    }

    @Transactional(readOnly = true)
    public List<CleaningDtos.CleaningResponse> listCleanings() {
        return cleaningRepository.findAllByOrderByDataLimpezaDescIdDesc().stream()
                .map(this::toCleaningResponse)
                .toList();
    }

    @Transactional
    public CleaningDtos.CleaningResponse createCleaning(CleaningDtos.CreateCleaningRequest request) {
        Panel panel = panelRepository.findById(request.placaId())
                .orElseThrow(() -> new NotFoundException("Placa não encontrada."));

        Cleaning cleaning = new Cleaning();
        cleaning.setPlaca(panel);
        cleaning.setDataLimpeza(request.dataLimpeza());
        cleaning.setObservacao(request.observacao() == null ? null : request.observacao().trim());

        Cleaning savedCleaning = cleaningRepository.save(cleaning);
        return toCleaningResponse(savedCleaning);
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
