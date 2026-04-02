package br.com.solarvision.api.dto;

public class GraphqlDtos {

    public record GraphqlGroupResponse(Long id, String name, String location, String status, String createdAt) {}
    public record GraphqlPanelResponse(Long id, Long groupId, String serialNumber, String model, String status) {}
    public record GraphqlAlertResponse(Long id, Long panelId, String type, String severity, Double soilingIndex, String createdAt, boolean active) {}
    public record GraphqlCleaningResponse(Long id, Long panelId, String performedAt, Double waterUsedLiters, String performedBy, String notes) {}
}
