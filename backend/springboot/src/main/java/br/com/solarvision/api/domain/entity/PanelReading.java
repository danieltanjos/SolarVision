package br.com.solarvision.api.domain.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "panel_readings")
public class PanelReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "panel_id", nullable = false)
    private Panel panel;

    @Column(nullable = false)
    private OffsetDateTime timestamp;

    @Column(name = "generation_kw", nullable = false)
    private Double generationKw;

    @Column(name = "soiling_index", nullable = false)
    private Double soilingIndex;

    @Column(name = "water_reuse_liters", nullable = false)
    private Double waterReuseLiters;

    @Column(nullable = false)
    private Double efficiency;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Panel getPanel() { return panel; }
    public void setPanel(Panel panel) { this.panel = panel; }
    public OffsetDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(OffsetDateTime timestamp) { this.timestamp = timestamp; }
    public Double getGenerationKw() { return generationKw; }
    public void setGenerationKw(Double generationKw) { this.generationKw = generationKw; }
    public Double getSoilingIndex() { return soilingIndex; }
    public void setSoilingIndex(Double soilingIndex) { this.soilingIndex = soilingIndex; }
    public Double getWaterReuseLiters() { return waterReuseLiters; }
    public void setWaterReuseLiters(Double waterReuseLiters) { this.waterReuseLiters = waterReuseLiters; }
    public Double getEfficiency() { return efficiency; }
    public void setEfficiency(Double efficiency) { this.efficiency = efficiency; }
}
