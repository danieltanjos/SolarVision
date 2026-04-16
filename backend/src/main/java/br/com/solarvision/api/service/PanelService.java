package br.com.solarvision.api.service;

import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelStatus;
import br.com.solarvision.api.dto.GroupDtos;
import br.com.solarvision.api.dto.PanelDtos;
import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.repository.PanelRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@Transactional
public class PanelService {

    private final PanelRepository panelRepository;
    private final GroupService groupService;

    public PanelService(PanelRepository panelRepository, GroupService groupService) {
        this.panelRepository = panelRepository;
        this.groupService = groupService;
    }

    public List<PanelDtos.PanelResponse> listAll() {
        return panelRepository.findAll().stream().map(this::toResponse).toList();
    }

    public List<PanelDtos.PanelResponse> listByGroup(Long groupId) {
        groupService.findEntity(groupId);
        return panelRepository.findBySolarGroupId(groupId).stream().map(this::toResponse).toList();
    }

    public PanelDtos.PanelResponse getById(Long id) {
        return toResponse(findEntity(id));
    }

    public PanelDtos.PanelResponse create(PanelDtos.PanelRequest request) {
        Panel panel = new Panel();
        apply(panel, request);
        return toResponse(panelRepository.save(panel));
    }

    public PanelDtos.PanelResponse update(Long id, PanelDtos.PanelRequest request) {
        Panel panel = findEntity(id);
        apply(panel, request);
        return toResponse(panelRepository.save(panel));
    }

    public GroupDtos.DeleteResponse delete(Long id) {
        findEntity(id);
        panelRepository.deleteById(id);
        return new GroupDtos.DeleteResponse("Placa deletada com sucesso.", id, OffsetDateTime.now());
    }

    public Panel findEntity(Long id) {
        return panelRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Placa não encontrada: " + id));
    }

    private void apply(Panel panel, PanelDtos.PanelRequest request) {
        panel.setSolarGroup(groupService.findEntity(request.group()));
        panel.setSerialNumber(request.serial_number());
        panel.setModel(request.model());
        panel.setStatus(parseStatus(request.status()));
    }

    private PanelStatus parseStatus(String status) {
        try {
            return PanelStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Status de placa inválido: " + status);
        }
    }

    private PanelDtos.PanelResponse toResponse(Panel panel) {
        return new PanelDtos.PanelResponse(
                panel.getId(),
                panel.getSolarGroup().getId(),
                panel.getSerialNumber(),
                panel.getModel(),
                panel.getStatus().name()
        );
    }
}
