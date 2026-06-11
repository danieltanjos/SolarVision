package br.com.solarvision.api.model;

import java.time.OffsetDateTime;
import java.math.BigDecimal;

public class PanelReading {

    private Long id;
    private Panel placa;
    private OffsetDateTime dataHora;
    private BigDecimal watsGerados;
    private OffsetDateTime criadoEm;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Panel getPlaca() {
        return placa;
    }

    public void setPlaca(Panel placa) {
        this.placa = placa;
    }

    public OffsetDateTime getDataHora() {
        return dataHora;
    }

    public void setDataHora(OffsetDateTime dataHora) {
        this.dataHora = dataHora;
    }

    public BigDecimal getWatsGerados() {
        return watsGerados;
    }

    public void setWatsGerados(BigDecimal watsGerados) {
        this.watsGerados = watsGerados;
    }

    public OffsetDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(OffsetDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }
}
