package br.com.solarvision.api.model;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class SolarGroup {

    private Long id;
    private String nome;
    private GroupStatus status = GroupStatus.ATIVO;
    private OffsetDateTime criadoEm;
    private List<Panel> placas = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public GroupStatus getStatus() {
        return status;
    }

    public void setStatus(GroupStatus status) {
        this.status = status;
    }

    public OffsetDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(OffsetDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    public List<Panel> getPlacas() {
        return placas;
    }

    public void setPlacas(List<Panel> placas) {
        this.placas = placas;
    }
}
