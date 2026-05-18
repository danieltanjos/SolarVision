package br.com.solarvision.api.service;

import br.com.solarvision.api.exception.BadRequestException;

public enum DashboardGranularity {
    HORA("hour"),
    DIA("day"),
    SEMANA("week"),
    MES("month");

    private final String sqlToken;

    DashboardGranularity(String sqlToken) {
        this.sqlToken = sqlToken;
    }

    public String sqlToken() {
        return sqlToken;
    }

    public static DashboardGranularity fromParam(String value) {
        if (value == null || value.isBlank()) {
            return DIA;
        }

        return switch (value.trim().toLowerCase()) {
            case "hora" -> HORA;
            case "dia" -> DIA;
            case "semana" -> SEMANA;
            case "mes" -> MES;
            default -> throw new BadRequestException("Granularidade inválida. Use hora, dia, semana ou mes.");
        };
    }
}
