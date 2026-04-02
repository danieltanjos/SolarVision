package br.com.solarvision.api.repository;

import br.com.solarvision.api.domain.entity.SolarGroup;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SolarGroupRepository extends JpaRepository<SolarGroup, Long> {
}
