package br.com.solarvision.api.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "limpezas")
public class Cleaning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "placa_id", nullable = false)
    private Panel placa;

    @Column(name = "data_limpeza", nullable = false)
    private OffsetDateTime dataLimpeza;

    @Column(name = "observacao", columnDefinition = "text")
    private String observacao;

    @CreationTimestamp
    @Column(name = "criado_em", nullable = false, updatable = false)
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
