package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.NotFoundException;
import br.com.solarvision.api.model.*;
import br.com.solarvision.api.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.OffsetDateTime;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CleaningServiceTest {
    @Mock CleaningRepository cleanings;
    @Mock PanelRepository panels;
    @InjectMocks CleaningService service;
    final OffsetDateTime date = OffsetDateTime.parse("2026-09-01T10:00:00-03:00");

    @Test void criaLimpezaNormalizandoObservacao() {
        Panel panel = new Panel(); panel.setId(1L); panel.setModel("Solar");
        when(panels.findById(1L)).thenReturn(Optional.of(panel));
        when(cleanings.save(any(Cleaning.class))).thenAnswer(i -> {
            Cleaning saved = i.getArgument(0); saved.setId(2L); return saved;
        });
        var result = service.createCleaning(new CleaningDtos.CreateCleaningRequest(1L, date, "  Inspeção  "));
        assertThat(result.id()).isEqualTo(2L);
        assertThat(result.placaId()).isEqualTo(1L);
        assertThat(result.dataLimpeza()).isEqualTo(date);
        assertThat(result.observacao()).isEqualTo("Inspeção");
    }

    @Test void naoSalvaLimpezaComPlacaInexistente() {
        assertThatThrownBy(() -> service.createCleaning(new CleaningDtos.CreateCleaningRequest(9L, date, null)))
                .isInstanceOf(NotFoundException.class);
        verify(cleanings, never()).save(any());
    }

    @Test void consultaInexistenteRetornaErro() {
        assertThatThrownBy(() -> service.getCleaning(9L)).isInstanceOf(NotFoundException.class);
    }

    @Test void atualizaPlacaDataEObservacaoNula() {
        Cleaning cleaning = new Cleaning(); cleaning.setId(2L); cleaning.setObservacao("Antiga");
        Panel panel = new Panel(); panel.setId(3L); panel.setModel("Novo");
        when(cleanings.findById(2L)).thenReturn(Optional.of(cleaning));
        when(panels.findById(3L)).thenReturn(Optional.of(panel));
        when(cleanings.save(cleaning)).thenReturn(cleaning);
        var result = service.updateCleaning(2L, new CleaningDtos.UpdateCleaningRequest(3L, date, null));
        assertThat(result.placaId()).isEqualTo(3L);
        assertThat(result.dataLimpeza()).isEqualTo(date);
        assertThat(result.observacao()).isNull();
    }

    @Test void excluiLimpezaExistente() {
        when(cleanings.existsById(2L)).thenReturn(true);
        service.deleteCleaning(2L);
        verify(cleanings).deleteById(2L);
    }

    @Test void naoExcluiLimpezaInexistente() {
        assertThatThrownBy(() -> service.deleteCleaning(9L)).isInstanceOf(NotFoundException.class);
        verify(cleanings, never()).deleteById(any());
    }
}
