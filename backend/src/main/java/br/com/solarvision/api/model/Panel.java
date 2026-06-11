package br.com.solarvision.api.model;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class Panel {

    private Long id;
    private SolarGroup grupo;
    private String model;
    private PanelStatus status = PanelStatus.ATIVA;
    private OffsetDateTime criadoEm;
    private List<Cleaning> limpezas = new ArrayList<>();
    private List<PanelReading> leituras = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public SolarGroup getGrupo() {
        return grupo;
    }

    public void setGrupo(SolarGroup grupo) {
        this.grupo = grupo;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public PanelStatus getStatus() {
        return status;
    }

    public void setStatus(PanelStatus status) {
        this.status = status;
    }

    public OffsetDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(OffsetDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    public List<Cleaning> getLimpezas() {
        return limpezas;
    }

    public void setLimpezas(List<Cleaning> limpezas) {
        this.limpezas = limpezas;
    }

    public List<PanelReading> getLeituras() {
        return leituras;
    }

    public void setLeituras(List<PanelReading> leituras) {
        this.leituras = leituras;
    }
}
