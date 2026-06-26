package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.model.PanelStatus;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PanelServiceTest {

    @Mock
    private PanelRepository panelRepository;

    @Mock
    private SolarGroupRepository solarGroupRepository;

    @InjectMocks
    private PanelService panelService;

    private SolarGroup grupo() {
        SolarGroup grupo = new SolarGroup();
        grupo.setId(1L);
        grupo.setNome("Grupo 1");
        return grupo;
    }

    @Test
    void deveCriarPlaca() {
        var request = new PanelDtos.CreatePanelRequest(1L, "Modelo X", PanelStatus.ATIVA);
        when(solarGroupRepository.findById(1L)).thenReturn(Optional.of(grupo()));
        when(panelRepository.save(any(Panel.class))).thenAnswer(invocation -> {
            Panel p = invocation.getArgument(0);
            p.setId(99L);
            return p;
        });

        PanelDtos.PanelResponse response = panelService.createPanel(request);

        assertThat(response.id()).isEqualTo(99L);
        assertThat(response.grupoId()).isEqualTo(1L);
        assertThat(response.modelo()).isEqualTo("Modelo X");
        assertThat(response.status()).isEqualTo(PanelStatus.ATIVA.name());
    }

    @Test
    void naoDeveCriarPlacaComGrupoInexistente() {
        var request = new PanelDtos.CreatePanelRequest(404L, "Modelo X", PanelStatus.ATIVA);
        when(solarGroupRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> panelService.createPanel(request))
                .isInstanceOf(NotFoundException.class);

        verify(panelRepository, never()).save(any());
    }

    @Test
    void deveLancarQuandoPlacaNaoEncontrada() {
        when(panelRepository.findById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> panelService.getPanel(7L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void naoDeveExcluirPlacaInexistente() {
        when(panelRepository.existsById(7L)).thenReturn(false);

        assertThatThrownBy(() -> panelService.deletePanel(7L))
                .isInstanceOf(NotFoundException.class);

        verify(panelRepository, never()).deleteById(any());
    }
}
