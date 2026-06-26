package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.SolarGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SolarGroupRepository extends JpaRepository<SolarGroup, Long> {

    List<SolarGroup> findAllByOrderByIdAsc();
}
