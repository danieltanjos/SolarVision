package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.Cleaning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface CleaningRepository extends JpaRepository<Cleaning, Long> {

    List<Cleaning> findAllByOrderByDataLimpezaDescIdDesc();

    Optional<Cleaning> findFirstByOrderByDataLimpezaDescIdDesc();

    @Query("""
            SELECT c FROM Cleaning c
            WHERE (:placaId IS NULL OR c.placa.id = :placaId)
              AND (:dataInicio IS NULL OR c.dataLimpeza >= :dataInicio)
              AND (:dataFim IS NULL OR c.dataLimpeza <= :dataFim)
            ORDER BY c.dataLimpeza DESC, c.id DESC
            """)
    List<Cleaning> buscar(@Param("placaId") Long placaId,
                          @Param("dataInicio") OffsetDateTime dataInicio,
                          @Param("dataFim") OffsetDateTime dataFim);
}
