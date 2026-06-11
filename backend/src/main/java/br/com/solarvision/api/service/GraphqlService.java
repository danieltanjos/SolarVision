package br.com.solarvision.api.service;

import br.com.solarvision.api.dao.CleaningDAO;
import br.com.solarvision.api.dao.PanelDAO;
import br.com.solarvision.api.exception.BadRequestException;
import br.com.solarvision.api.model.Cleaning;
import br.com.solarvision.api.model.CleaningDtos;
import br.com.solarvision.api.model.GraphqlDtos;
import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelDtos;
import br.com.solarvision.api.model.PanelStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class GraphqlService {

    private static final DateTimeFormatter ISO_DATE_TIME = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final PanelDAO panelDAO;
    private final CleaningDAO cleaningDAO;
    private final PanelService panelService;
    private final CleaningService cleaningService;

    public GraphqlService(PanelDAO panelDAO,
                          CleaningDAO cleaningDAO,
                          PanelService panelService,
                          CleaningService cleaningService) {
        this.panelDAO = panelDAO;
        this.cleaningDAO = cleaningDAO;
        this.panelService = panelService;
        this.cleaningService = cleaningService;
    }

    @Transactional(readOnly = true)
    public List<GraphqlDtos.GraphqlPanelResponse> findPanels(GraphqlDtos.PanelFilter filter) {
        GraphqlDtos.PanelFilter effectiveFilter = filter == null
                ? new GraphqlDtos.PanelFilter(null, null, null)
                : filter;

        PanelStatus status = parsePanelStatus(effectiveFilter.status());
        String modelo = normalizeNullable(effectiveFilter.modelo());

        return loadPanels(effectiveFilter.grupoId()).stream()
                .filter(panel -> status == null || panel.getStatus() == status)
                .filter(panel -> modelo == null || containsIgnoreCase(panel.getModel(), modelo))
                .map(this::toGraphqlPanelResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GraphqlDtos.GraphqlCleaningResponse> findCleanings(GraphqlDtos.CleaningFilter filter) {
        GraphqlDtos.CleaningFilter effectiveFilter = filter == null
                ? new GraphqlDtos.CleaningFilter(null, null, null)
                : filter;

        OffsetDateTime dataInicio = parseOffsetDateTime(effectiveFilter.dataInicio(), "dataInicio");
        OffsetDateTime dataFim = parseOffsetDateTime(effectiveFilter.dataFim(), "dataFim");
        if (dataInicio != null && dataFim != null && dataInicio.isAfter(dataFim)) {
            throw new BadRequestException("dataInicio deve ser anterior ou igual a dataFim.");
        }

        return cleaningDAO.buscar(effectiveFilter.placaId(), dataInicio, dataFim).stream()
                .map(this::toGraphqlCleaningResponse)
                .toList();
    }

    @Transactional
    public GraphqlDtos.GraphqlPanelResponse createPanel(GraphqlDtos.CreatePanelInput input) {
        if (input == null) {
            throw new BadRequestException("Input de criação da placa é obrigatório.");
        }

        PanelDtos.PanelResponse response = panelService.createPanel(
                new PanelDtos.CreatePanelRequest(
                        input.grupoId(),
                        input.modelo(),
                        parsePanelStatus(input.status())
                )
        );

        return new GraphqlDtos.GraphqlPanelResponse(
                response.id(),
                response.grupoId(),
                response.grupoNome(),
                response.modelo(),
                response.status(),
                response.criadoEm().format(ISO_DATE_TIME)
        );
    }

    @Transactional
    public GraphqlDtos.GraphqlCleaningResponse createCleaning(GraphqlDtos.CreateCleaningInput input) {
        if (input == null) {
            throw new BadRequestException("Input de criação da limpeza é obrigatório.");
        }

        CleaningDtos.CleaningResponse response = cleaningService.createCleaning(
                new CleaningDtos.CreateCleaningRequest(
                        input.placaId(),
                        parseRequiredOffsetDateTime(input.dataLimpeza(), "dataLimpeza"),
                        input.observacao()
                )
        );

        return new GraphqlDtos.GraphqlCleaningResponse(
                response.id(),
                response.placaId(),
                response.placaModelo(),
                response.dataLimpeza().format(ISO_DATE_TIME),
                response.observacao(),
                response.criadoEm().format(ISO_DATE_TIME)
        );
    }

    private GraphqlDtos.GraphqlPanelResponse toGraphqlPanelResponse(Panel panel) {
        return new GraphqlDtos.GraphqlPanelResponse(
                panel.getId(),
                panel.getGrupo().getId(),
                panel.getGrupo().getNome(),
                panel.getModel(),
                panel.getStatus().name(),
                panel.getCriadoEm().format(ISO_DATE_TIME)
        );
    }

    private GraphqlDtos.GraphqlCleaningResponse toGraphqlCleaningResponse(Cleaning cleaning) {
        return new GraphqlDtos.GraphqlCleaningResponse(
                cleaning.getId(),
                cleaning.getPlaca().getId(),
                cleaning.getPlaca().getModel(),
                cleaning.getDataLimpeza().format(ISO_DATE_TIME),
                cleaning.getObservacao(),
                cleaning.getCriadoEm().format(ISO_DATE_TIME)
        );
    }

    private PanelStatus parsePanelStatus(String value) {
        String normalizedValue = normalizeNullable(value);
        if (normalizedValue == null) {
            return null;
        }

        try {
            return PanelStatus.valueOf(normalizedValue.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Status de placa inválido. Use ATIVA, INATIVA ou MANUTENCAO.");
        }
    }

    private OffsetDateTime parseRequiredOffsetDateTime(String value, String fieldName) {
        OffsetDateTime parsed = parseOffsetDateTime(value, fieldName);
        if (parsed == null) {
            throw new BadRequestException(fieldName + " é obrigatório.");
        }
        return parsed;
    }

    private OffsetDateTime parseOffsetDateTime(String value, String fieldName) {
        String normalizedValue = normalizeNullable(value);
        if (normalizedValue == null) {
            return null;
        }

        try {
            return OffsetDateTime.parse(normalizedValue);
        } catch (Exception ex) {
            throw new BadRequestException(fieldName + " deve estar no formato ISO-8601 com offset.");
        }
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private List<Panel> loadPanels(Long grupoId) {
        if (grupoId == null) {
            return panelDAO.listarTodos();
        }
        return panelDAO.listarPorGrupo(grupoId);
    }

    private boolean containsIgnoreCase(String source, String target) {
        return source != null && source.toLowerCase().contains(target.toLowerCase());
    }
}
