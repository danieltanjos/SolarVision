package br.com.solarvision.api.domain.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "cleanings")
public class Cleaning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "panel_id", nullable = false)
    private Panel panel;

    @Column(name = "performed_at", nullable = false)
    private OffsetDateTime performedAt;

    @Column(name = "water_used_liters", nullable = false)
    private Double waterUsedLiters;

    @Column(name = "performed_by", nullable = false)
    private String performedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Panel getPanel() { return panel; }
    public void setPanel(Panel panel) { this.panel = panel; }
    public OffsetDateTime getPerformedAt() { return performedAt; }
    public void setPerformedAt(OffsetDateTime performedAt) { this.performedAt = performedAt; }
    public Double getWaterUsedLiters() { return waterUsedLiters; }
    public void setWaterUsedLiters(Double waterUsedLiters) { this.waterUsedLiters = waterUsedLiters; }
    public String getPerformedBy() { return performedBy; }
    public void setPerformedBy(String performedBy) { this.performedBy = performedBy; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
