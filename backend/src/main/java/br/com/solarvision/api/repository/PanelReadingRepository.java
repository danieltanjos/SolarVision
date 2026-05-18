package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.PanelReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public interface PanelReadingRepository extends JpaRepository<PanelReading, Long>, PanelReadingRepositoryCustom {
    @Query("""
            select coalesce(sum(pr.watsGerados), 0)
            from PanelReading pr
            where pr.dataHora between :start and :end
            """)
    BigDecimal sumByDataHoraBetween(OffsetDateTime start, OffsetDateTime end);
}
