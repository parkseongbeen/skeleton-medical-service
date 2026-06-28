package com.medical.skeleton.domain.note.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "notes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "note_type", nullable = false)
    private NoteType noteType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    /* ── AI 자동 분석 결과 (작성·수정 시 NoteAiAnalyzer가 산출하여 저장) ── */

    /** 긴급도 — "긴급" / "주의" / "일반" */
    @Column(name = "ai_urgency")
    private String aiUrgency;

    /** 감지된 관련 태그 (콤마로 구분된 문자열, 예: "낙상,통증") */
    @Column(name = "ai_tags")
    private String aiTags;

    /** AI가 생성한 한 줄 요약·권장 조치 코멘트 */
    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void updateContent(String content) {
        this.content = content;
    }

    /** AI 분석 결과를 갱신한다 (작성·수정 시 NoteAiAnalyzer 호출 결과 반영). */
    public void applyAiAnalysis(String urgency, String tags, String summary) {
        this.aiUrgency = urgency;
        this.aiTags = tags;
        this.aiSummary = summary;
    }
}
