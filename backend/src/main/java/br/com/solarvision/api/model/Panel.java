package br.com.solarvision.api.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "placas")
public class Panel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "grupo_id", nullable = false)
    private SolarGroup grupo;

    @Column(name = "modelo", nullable = false, length = 120)
    private String model;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private PanelStatus status = PanelStatus.ATIVA;

    @CreationTimestamp
    @Column(name = "criado_em", nullable = false, updatable = false)
    private OffsetDateTime criadoEm;

    @OneToMany(mappedBy = "placa", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Cleaning> limpezas = new ArrayList<>();

    @OneToMany(mappedBy = "placa", cascade = CascadeType.ALL, orphanRemoval = true)
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
