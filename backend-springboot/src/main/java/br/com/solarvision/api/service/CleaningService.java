package br.com.solarvision.api.service;

import br.com.solarvision.api.domain.entity.Cleaning;
import br.com.solarvision.api.dto.CleaningDtos;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.repository.CleaningRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@Transactional
public class CleaningService {

    private final CleaningRepository cleaningRepository;
    private final PanelService panelService;

    public CleaningService(CleaningRepository cleaningRepository, PanelService panelService) {
        this.cleaningRepository = cleaningRepository;
        this.panelService = panelService;
    }

    public List<CleaningDtos.CleaningResponse> listByPanel(Long panelId) {
        panelService.findEntity(panelId);
        return cleaningRepository.findByPanelIdOrderByPerformedAtDesc(panelId).stream().map(this::toResponse).toList();
    }

    public CleaningDtos.CleaningResponse create(CleaningDtos.CleaningRequest request) {
        Cleaning cleaning = new Cleaning();
        apply(cleaning, request);
        return toResponse(cleaningRepository.save(cleaning));
    }

    public CleaningDtos.CleaningResponse update(Long id, CleaningDtos.CleaningRequest request) {
        Cleaning cleaning = findEntity(id);
        apply(cleaning, request);
        return toResponse(cleaningRepository.save(cleaning));
    }

    public CleaningDtos.CleaningDeleteResponse delete(Long id) {
        findEntity(id);
        cleaningRepository.deleteById(id);
        return new CleaningDtos.CleaningDeleteResponse("Limpeza deletada com sucesso.", id, OffsetDateTime.now());
    }

    public Cleaning findEntity(Long id) {
        return cleaningRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Limpeza não encontrada: " + id));
    }

    private void apply(Cleaning cleaning, CleaningDtos.CleaningRequest request) {
        cleaning.setPanel(panelService.findEntity(request.panel_id()));
        cleaning.setPerformedAt(request.performed_at());
        cleaning.setWaterUsedLiters(request.water_used_liters());
        cleaning.setPerformedBy(request.performed_by());
        cleaning.setNotes(request.notes());
    }

    private CleaningDtos.CleaningResponse toResponse(Cleaning cleaning) {
        return new CleaningDtos.CleaningResponse(
                cleaning.getId(),
                cleaning.getPanel().getId(),
                cleaning.getPerformedAt(),
                cleaning.getWaterUsedLiters(),
                cleaning.getPerformedBy(),
                cleaning.getNotes()
        );
    }
}
