package com.medical.skeleton.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 30)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // 담당 병동 (NURSE/DOCTOR는 특정 병동에 배정)
    @Column(name = "ward_id")
    private Long wardId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // ─── 도메인 메서드 (마이페이지 정보 수정용) ──────────────────

    /** 이름 변경 */
    public void changeName(String name) {
        this.name = name;
    }

    /** 비밀번호 변경 — 반드시 인코딩된 값을 전달할 것 */
    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }
}
