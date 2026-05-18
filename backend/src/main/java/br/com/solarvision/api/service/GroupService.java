package br.com.solarvision.api.service;

import br.com.solarvision.api.dto.GroupDtos;
import br.com.solarvision.api.dto.PanelDtos;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.GroupStatus;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.SolarGroup;
import br.com.solarvision.api.repository.PanelRepository;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class GroupService {

    private final SolarGroupRepository solarGroupRepository;
    private final PanelRepository panelRepository;

    public GroupService(SolarGroupRepository solarGroupRepository, PanelRepository panelRepository) {
        this.solarGroupRepository = solarGroupRepository;
        this.panelRepository = panelRepository;
    }

    @Transactional(readOnly = true)
    public List<GroupDtos.GroupResponse> listGroups() {
        return solarGroupRepository.findAllByOrderByIdAsc().stream()
                .map(this::toGroupResponse)
                .toList();
    }

    @Transactional
    public GroupDtos.GroupResponse createGroup(GroupDtos.CreateGroupRequest request) {
        SolarGroup group = new SolarGroup();
        group.setNome(request.nome().trim());
        group.setStatus(request.status() == null ? GroupStatus.ATIVO : request.status());

        SolarGroup savedGroup = solarGroupRepository.save(group);
        return toGroupResponse(savedGroup);
    }

    @Transactional(readOnly = true)
    public List<PanelDtos.PanelResponse> listPanelsByGroup(Long groupId) {
        SolarGroup group = solarGroupRepository.findById(groupId)
                .orElseThrow(() -> new NotFoundException("Grupo solar não encontrado."));

        return panelRepository.findAllByGrupoIdOrderByIdAsc(group.getId()).stream()
                .map(this::toPanelResponse)
                .toList();
    }

    private GroupDtos.GroupResponse toGroupResponse(SolarGroup group) {
        return new GroupDtos.GroupResponse(
                group.getId(),
                group.getNome(),
                group.getStatus().name(),
                group.getCriadoEm(),
                group.getPlacas().size()
        );
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
