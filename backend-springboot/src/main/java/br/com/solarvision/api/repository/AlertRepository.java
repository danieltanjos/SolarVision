package br.com.solarvision.api.repository;

import br.com.solarvision.api.domain.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, Long> {
    long countByActiveTrue();
    List<Alert> findAllByOrderByCreatedAtDesc();
}
