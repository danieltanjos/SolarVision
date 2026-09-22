package br.com.solarvision.api.controller;

import br.com.solarvision.api.exception.*;
import br.com.solarvision.api.model.CleaningDtos;
import br.com.solarvision.api.service.CleaningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

// Contrato MVC com serviço simulado; não inclui filtros de autenticação nem banco.
class CleaningControllerTest {
    CleaningService service;
    MockMvc mvc;
    @BeforeEach void setup() {
        service = mock(CleaningService.class);
        mvc = standaloneSetup(new CleaningController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test void rejeitaCamposObrigatoriosAusentes() throws Exception {
        mvc.perform(post("/api/cleanings").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.placaId").exists())
                .andExpect(jsonPath("$.errors.dataLimpeza").exists());
        verifyNoInteractions(service);
    }

    @Test void rejeitaObservacaoAcimaDoLimite() throws Exception {
        mvc.perform(post("/api/cleanings").contentType(MediaType.APPLICATION_JSON)
                .content(payload(1001)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.observacao").exists());
        verifyNoInteractions(service);
    }

    @ParameterizedTest @ValueSource(ints = {0, 1000})
    void aceitaObservacaoNosLimites(int size) throws Exception {
        mvc.perform(post("/api/cleanings").contentType(MediaType.APPLICATION_JSON).content(payload(size)))
                .andExpect(status().isOk());
        verify(service).createCleaning(argThat(r -> r.placaId() == 1L && r.observacao().length() == size));
    }

    @Test void recursoAusenteRetorna404() throws Exception {
        when(service.getCleaning(99L)).thenThrow(new NotFoundException("Limpeza não encontrada."));
        mvc.perform(get("/api/cleanings/99")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test void exclusaoRetorna204SemCorpo() throws Exception {
        mvc.perform(delete("/api/cleanings/1")).andExpect(status().isNoContent())
                .andExpect(content().string(""));
        verify(service).deleteCleaning(1L);
    }

    private String payload(int size) {
        return "{\"placaId\":1,\"dataLimpeza\":\"2026-09-01T10:00:00-03:00\",\"observacao\":\"" + "a".repeat(size) + "\"}";
    }
}
