package com.medical.skeleton.domain.note.service;

import com.medical.skeleton.domain.note.ai.NoteAiAnalyzer;
import com.medical.skeleton.domain.note.dto.NoteRequest;
import com.medical.skeleton.domain.note.entity.Note;
import com.medical.skeleton.domain.note.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;
    private final NoteAiAnalyzer noteAiAnalyzer;

    @Transactional(readOnly = true)
    public List<Note> getNotes(Long patientId) {
        return noteRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    @Transactional
    public Note create(Long patientId, NoteRequest request) {
        // AI 분석 — 메모 내용에서 긴급도·관련 태그·요약 코멘트를 자동 산출하여 함께 저장
        NoteAiAnalyzer.AnalysisResult analysis = noteAiAnalyzer.analyze(request.getContent());

        Note note = Note.builder()
                .patientId(patientId)
                .noteType(request.getNoteType())
                .content(request.getContent())
                .createdBy(request.getCreatedBy())
                .aiUrgency(analysis.urgency())
                .aiTags(analysis.tags())
                .aiSummary(analysis.summary())
                .build();
        return noteRepository.save(note);
    }

    @Transactional
    public Note update(Long patientId, Long noteId, NoteRequest request) {
        Note note = findNote(noteId, patientId);
        note.updateContent(request.getContent());

        // 내용이 바뀌었으므로 AI 분석도 다시 수행해 최신 상태로 갱신
        NoteAiAnalyzer.AnalysisResult analysis = noteAiAnalyzer.analyze(request.getContent());
        note.applyAiAnalysis(analysis.urgency(), analysis.tags(), analysis.summary());
        return note;
    }

    @Transactional
    public void delete(Long patientId, Long noteId) {
        Note note = findNote(noteId, patientId);
        noteRepository.delete(note);
    }

    private Note findNote(Long noteId, Long patientId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("메모를 찾을 수 없습니다: " + noteId));
        if (!note.getPatientId().equals(patientId)) {
            throw new IllegalArgumentException("해당 환자의 메모가 아닙니다.");
        }
        return note;
    }
}
