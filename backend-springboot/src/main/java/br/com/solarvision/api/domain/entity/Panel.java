package br.com.solarvision.api.domain.entity;

import br.com.solarvision.api.domain.enums.PanelStatus;
import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "panels")
public class Panel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private SolarGroup solarGroup;

    @Column(name = "serial_number", nullable = false, unique = true)
    private String serialNumber;

    @Column(nullable = false)
    private String model;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PanelStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "panel", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Cleaning> cleanings = new ArrayList<>();

    @OneToMany(mappedBy = "panel", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Alert> alerts = new ArrayList<>();

    @OneToMany(mappedBy = "panel", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PanelReading> readings = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public SolarGroup getSolarGroup() { return solarGroup; }
    public void setSolarGroup(SolarGroup solarGroup) { this.solarGroup = solarGroup; }
    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public PanelStatus getStatus() { return status; }
    public void setStatus(PanelStatus status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public List<Cleaning> getCleanings() { return cleanings; }
    public void setCleanings(List<Cleaning> cleanings) { this.cleanings = cleanings; }
    public List<Alert> getAlerts() { return alerts; }
    public void setAlerts(List<Alert> alerts) { this.alerts = alerts; }
    public List<PanelReading> getReadings() { return readings; }
    public void setReadings(List<PanelReading> readings) { this.readings = readings; }
}
