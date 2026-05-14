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
            select c
            from Cleaning c
            join fetch c.placa p
            where (:placaId is null or p.id = :placaId)
              and (:dataInicio is null or c.dataLimpeza >= :dataInicio)
              and (:dataFim is null or c.dataLimpeza <= :dataFim)
            order by c.dataLimpeza desc, c.id desc
            """)
    List<Cleaning> search(@Param("placaId") Long placaId,
                          @Param("dataInicio") OffsetDateTime dataInicio,
                          @Param("dataFim") OffsetDateTime dataFim);
}
