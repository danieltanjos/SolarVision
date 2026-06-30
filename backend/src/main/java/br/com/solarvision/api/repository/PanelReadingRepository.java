package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.PanelReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public interface PanelReadingRepository extends JpaRepository<PanelReading, Long> {

    /**
     * Agrupa a geração por janela de tempo (date_trunc) já convertida para o fuso do dashboard.
     * Usa AVG para representar a POTÊNCIA MÉDIA (W) do balde, já que cada leitura é uma
     * amostra instantânea de potência (wats5min). Retorna linhas [bucket (timestamp), potencia_media (numeric)].
     */
    @Query(value = """
            SELECT date_trunc(:granularity, timezone(:zoneId, data_hora)) AS bucket,
                   COALESCE(AVG(wats_gerados), 0) AS potencia_media
            FROM leituras_energia
            WHERE data_hora >= :start AND data_hora <= :end
            GROUP BY bucket
            ORDER BY bucket
            """, nativeQuery = true)
    List<Object[]> agruparMetricas(@Param("granularity") String granularity,
                                   @Param("zoneId") String zoneId,
                                   @Param("start") OffsetDateTime start,
                                   @Param("end") OffsetDateTime end);

    @Query("""
            SELECT COALESCE(SUM(r.watsGerados), 0)
            FROM PanelReading r
            WHERE r.dataHora BETWEEN :start AND :end
            """)
    BigDecimal somarPorPeriodo(@Param("start") OffsetDateTime start,
                               @Param("end") OffsetDateTime end);

    @Query("SELECT MIN(r.dataHora) FROM PanelReading r")
    OffsetDateTime buscarPrimeiraLeitura();

    @Query("SELECT MAX(r.dataHora) FROM PanelReading r")
    OffsetDateTime buscarUltimaLeitura();
}
