package com.medical.skeleton;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 스켈레톤 기반 의료 서비스 백엔드 메인 클래스.
 *
 * <h3>주요 활성화 어노테이션</h3>
 * <ul>
 *   <li>{@code @SpringBootApplication} — 컴포넌트 스캔, 자동 설정, 빈 등록 활성화</li>
 *   <li>{@code @EnableScheduling}      — {@link com.medical.skeleton.domain.medication.scheduler.MedicationScheduler}
 *       등 {@code @Scheduled} 메서드 실행 활성화</li>
 * </ul>
 *
 * <h3>실행 전 확인사항</h3>
 * <ol>
 *   <li>MySQL 실행 확인: {@code CREATE DATABASE medical_db CHARACTER SET utf8mb4;}</li>
 *   <li>application.yml의 DB 비밀번호, JWT secret 설정 확인</li>
 *   <li>포트 8080이 사용 중이면 {@code server.port} 변경</li>
 * </ol>
 *
 * <h3>Swagger UI</h3>
 * 서버 실행 후 http://localhost:8080/swagger-ui.html 접속
 */
@SpringBootApplication
@EnableScheduling
public class SkeletonMedicalApplication {
    public static void main(String[] args) {
        SpringApplication.run(SkeletonMedicalApplication.class, args);
    }
}
