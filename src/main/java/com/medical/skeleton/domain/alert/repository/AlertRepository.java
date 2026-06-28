package com.medical.skeleton.domain.alert.repository;

import com.medical.skeleton.domain.alert.entity.Alert;
import com.medical.skeleton.domain.alert.dto.AlertMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByWardIdAndResolvedFalseOrderByOccurredAtDesc(Long wardId);
    List<Alert> findByPatientIdAndResolvedFalseOrderByOccurredAtDesc(Long patientId);
    long countByPatientIdAndResolvedFalse(Long patientId);
    boolean existsByPatientIdAndAlertTypeAndResolvedFalse(
            Long patientId, AlertMessage.AlertType alertType);
    Optional<Alert> findTopByPatientIdAndAlertTypeOrderByOccurredAtDesc(
            Long patientId, AlertMessage.AlertType alertType);
}
