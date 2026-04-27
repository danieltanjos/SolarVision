package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.SolarGroup;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SolarGroupRepository extends JpaRepository<SolarGroup, Long> {
}
