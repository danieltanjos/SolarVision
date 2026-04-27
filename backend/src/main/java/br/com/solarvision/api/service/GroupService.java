package br.com.solarvision.api.service;

import br.com.solarvision.api.model.SolarGroup;
import br.com.solarvision.api.model.GroupStatus;
import br.com.solarvision.api.dto.GroupDtos;
import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@Transactional
public class GroupService {

    private final SolarGroupRepository solarGroupRepository;

    public GroupService(SolarGroupRepository solarGroupRepository) {
        this.solarGroupRepository = solarGroupRepository;
    }

    public List<GroupDtos.GroupResponse> listAll() {
        return solarGroupRepository.findAll().stream().map(this::toResponse).toList();
    }

    public GroupDtos.GroupResponse getById(Long id) {
        return toResponse(findEntity(id));
    }

    public GroupDtos.GroupResponse create(GroupDtos.GroupRequest request) {
        SolarGroup group = new SolarGroup();
        apply(group, request);
        return toResponse(solarGroupRepository.save(group));
    }

    public GroupDtos.GroupResponse update(Long id, GroupDtos.GroupRequest request) {
        SolarGroup group = findEntity(id);
        apply(group, request);
        return toResponse(solarGroupRepository.save(group));
    }

    public GroupDtos.DeleteResponse delete(Long id) {
        SolarGroup group = findEntity(id);
        solarGroupRepository.delete(group);
        return new GroupDtos.DeleteResponse("Grupo deletado com sucesso.", id, OffsetDateTime.now());
    }

    public SolarGroup findEntity(Long id) {
        return solarGroupRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Grupo não encontrado: " + id));
    }

    private void apply(SolarGroup group, GroupDtos.GroupRequest request) {
        group.setName(request.name());
        group.setLocation(request.location());
        group.setStatus(parseStatus(request.status()));
    }

    private GroupStatus parseStatus(String status) {
        try {
            return GroupStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Status de grupo inválido: " + status);
        }
    }

    private GroupDtos.GroupResponse toResponse(SolarGroup group) {
        return new GroupDtos.GroupResponse(
                group.getId(),
                group.getName(),
                group.getLocation(),
                group.getStatus().name(),
                group.getCreatedAt()
        );
    }
}
