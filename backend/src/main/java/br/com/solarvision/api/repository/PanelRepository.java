package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PanelRepository extends JpaRepository<Panel, Long> {
    List<Panel> findAllByOrderByIdAsc();
    List<Panel> findAllByGrupoIdOrderByIdAsc(Long grupoId);
    long countByStatus(PanelStatus status);

    @Query("""
            select p
            from Panel p
            join fetch p.grupo g
            where (:grupoId is null or g.id = :grupoId)
              and (:status is null or p.status = :status)
              and (:modelo is null or lower(p.model) like lower(concat('%', :modelo, '%')))
            order by p.id asc
            """)
    List<Panel> search(@Param("grupoId") Long grupoId,
                       @Param("status") PanelStatus status,
                       @Param("modelo") String modelo);
}
