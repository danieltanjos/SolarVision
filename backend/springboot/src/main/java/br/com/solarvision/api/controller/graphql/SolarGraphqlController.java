package br.com.solarvision.api.controller.graphql;

import br.com.solarvision.api.dto.DashboardDtos;
import br.com.solarvision.api.dto.GraphqlDtos;
import br.com.solarvision.api.service.GraphqlQueryService;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class SolarGraphqlController {

    private final GraphqlQueryService graphqlQueryService;

    public SolarGraphqlController(GraphqlQueryService graphqlQueryService) {
        this.graphqlQueryService = graphqlQueryService;
    }

    @QueryMapping
    public DashboardDtos.GraphqlDashboardResponse dashboard() {
        return graphqlQueryService.dashboard();
    }

    @QueryMapping
    public List<GraphqlDtos.GraphqlGroupResponse> groups() {
        return graphqlQueryService.groups();
    }

    @QueryMapping
    public List<GraphqlDtos.GraphqlPanelResponse> panels() {
        return graphqlQueryService.panels();
    }

    @QueryMapping
    public List<GraphqlDtos.GraphqlAlertResponse> alerts() {
        return graphqlQueryService.alerts();
    }

    @QueryMapping
    public List<GraphqlDtos.GraphqlCleaningResponse> cleanings() {
        return graphqlQueryService.cleanings();
    }
}
