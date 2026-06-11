package br.com.solarvision.api.model;

import java.time.OffsetDateTime;

public class Cleaning {

    private Long id;
    private Panel placa;
    private OffsetDateTime dataLimpeza;
    private String observacao;
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

    public OffsetDateTime getDataLimpeza() {
        return dataLimpeza;
    }

    public void setDataLimpeza(OffsetDateTime dataLimpeza) {
        this.dataLimpeza = dataLimpeza;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public OffsetDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(OffsetDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }
}
