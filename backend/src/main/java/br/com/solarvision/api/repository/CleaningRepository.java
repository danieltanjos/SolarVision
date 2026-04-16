package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.Cleaning;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

public interface CleaningRepository extends JpaRepository<Cleaning, Long> {
    List<Cleaning> findByPanelIdOrderByPerformedAtDesc(Long panelId);
    long countByPerformedAtBetween(OffsetDateTime start, OffsetDateTime end);
}
