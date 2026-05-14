package br.com.solarvision.api.dto;

public final class GraphqlDtos {

    private GraphqlDtos() {
    }

    public record PanelFilter(
            Long grupoId,
            String status,
            String modelo
    ) {
    }

    public record CleaningFilter(
            Long placaId,
            String dataInicio,
            String dataFim
    ) {
    }

    public record CreatePanelInput(
            Long grupoId,
            String modelo,
            String status
    ) {
    }

    public record CreateCleaningInput(
            Long placaId,
            String dataLimpeza,
            String observacao
    ) {
    }

    public record GraphqlPanelResponse(
            Long id,
            Long grupoId,
            String grupoNome,
            String modelo,
            String status,
            String criadoEm
    ) {
    }

    public record GraphqlCleaningResponse(
            Long id,
            Long placaId,
            String placaModelo,
            String dataLimpeza,
            String observacao,
            String criadoEm
    ) {
    }
}
