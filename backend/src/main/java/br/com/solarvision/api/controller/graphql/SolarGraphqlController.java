package br.com.solarvision.api.controller.graphql;

import br.com.solarvision.api.model.GraphqlDtos;
import br.com.solarvision.api.service.GraphqlService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class SolarGraphqlController {

    private final GraphqlService graphqlService;

    public SolarGraphqlController(GraphqlService graphqlService) {
        this.graphqlService = graphqlService;
    }

    @QueryMapping
    public List<GraphqlDtos.GraphqlPanelResponse> panels(@Argument("filter") GraphqlDtos.PanelFilter filter) {
        return graphqlService.findPanels(filter);
    }

    @QueryMapping
    public List<GraphqlDtos.GraphqlCleaningResponse> cleanings(@Argument("filter") GraphqlDtos.CleaningFilter filter) {
        return graphqlService.findCleanings(filter);
    }

    @MutationMapping
    public GraphqlDtos.GraphqlPanelResponse createPanel(@Argument("input") GraphqlDtos.CreatePanelInput input) {
        return graphqlService.createPanel(input);
    }

    @MutationMapping
    public GraphqlDtos.GraphqlCleaningResponse createCleaning(@Argument("input") GraphqlDtos.CreateCleaningInput input) {
        return graphqlService.createCleaning(input);
    }
}
