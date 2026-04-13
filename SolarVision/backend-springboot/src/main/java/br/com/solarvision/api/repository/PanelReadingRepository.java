package br.com.solarvision.api.repository;

import br.com.solarvision.api.domain.entity.PanelReading;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

public interface PanelReadingRepository extends JpaRepository<PanelReading, Long> {
    List<PanelReading> findByTimestampBetweenOrderByTimestampAsc(OffsetDateTime start, OffsetDateTime end);
    List<PanelReading> findTop100ByOrderByTimestampDesc();
}
