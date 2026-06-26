package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.Panel;
import br.com.solarvision.api.model.PanelStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PanelRepository extends JpaRepository<Panel, Long> {

    List<Panel> findAllByOrderByIdAsc();

    List<Panel> findByGrupoIdOrderByIdAsc(Long grupoId);

    long countByStatus(PanelStatus status);

    long countByGrupoId(Long grupoId);
}
