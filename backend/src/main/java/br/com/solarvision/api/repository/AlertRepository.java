package br.com.solarvision.api.repository;

import br.com.solarvision.api.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, Long> {
}
