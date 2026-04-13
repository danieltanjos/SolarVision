package br.com.solarvision.api.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@JsonTest
class DtoJsonNamingTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldDeserializeSnakeCaseRequestFieldsIntoCamelCaseRecords() throws Exception {
        String json = """
                {
                  "google_token": "Daniel|daniel@solarvision.com"
                }
                """;

        AuthDtos.GoogleAuthRequest request = objectMapper.readValue(json, AuthDtos.GoogleAuthRequest.class);

        assertThat(request.googleToken()).isEqualTo("Daniel|daniel@solarvision.com");
    }

    @Test
    void shouldSerializeSnakeCaseResponseFields() throws Exception {
        GroupDtos.DeleteResponse response = new GroupDtos.DeleteResponse(
                "Grupo deletado com sucesso.",
                10L,
                OffsetDateTime.parse("2026-04-02T20:00:00Z")
        );

        String json = objectMapper.writeValueAsString(response);

        assertThat(json).contains("deleted_id");
        assertThat(json).contains("deleted_at");
        assertThat(json).doesNotContain("deletedId");
        assertThat(json).doesNotContain("deletedAt");
    }

    @Test
    void shouldSerializeDashboardCollectionsUsingSnakeCaseContract() throws Exception {
        DashboardDtos.DashboardMetricsResponse response = new DashboardDtos.DashboardMetricsResponse(
                List.of(new DashboardDtos.MetricPointResponse("2026-04-02T20:00:00Z", 12.5)),
                List.of(),
                List.of()
        );

        String json = objectMapper.writeValueAsString(response);

        assertThat(json).contains("generation_series");
        assertThat(json).contains("soiling_series");
        assertThat(json).contains("water_reuse_series");
    }
}
