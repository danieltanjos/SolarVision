package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.GroupDtos;
import br.com.solarvision.api.model.GroupStatus;
import br.com.solarvision.api.model.SolarGroup;
import br.com.solarvision.api.repository.PanelRepository;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock
    private SolarGroupRepository solarGroupRepository;

    @Mock
    private PanelRepository panelRepository;

    @InjectMocks
    private GroupService groupService;

    @Test
    void deveCriarGrupoEContarPlacas() {
        var request = new GroupDtos.CreateGroupRequest("Grupo Norte", GroupStatus.ATIVO);
        when(solarGroupRepository.save(any(SolarGroup.class))).thenAnswer(invocation -> {
            SolarGroup g = invocation.getArgument(0);
            g.setId(1L);
            return g;
        });
        when(panelRepository.countByGrupoId(1L)).thenReturn(3L);

        GroupDtos.GroupResponse response = groupService.createGroup(request);

        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.nome()).isEqualTo("Grupo Norte");
        assertThat(response.status()).isEqualTo(GroupStatus.ATIVO.name());
        assertThat(response.totalPlacas()).isEqualTo(3);
    }

    @Test
    void deveLancarQuandoGrupoNaoEncontrado() {
        when(solarGroupRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> groupService.getGroup(404L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void naoDeveExcluirGrupoInexistente() {
        when(solarGroupRepository.existsById(404L)).thenReturn(false);

        assertThatThrownBy(() -> groupService.deleteGroup(404L))
                .isInstanceOf(NotFoundException.class);
    }
}
