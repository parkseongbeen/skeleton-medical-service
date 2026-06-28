package com.medical.skeleton.config;

import com.medical.skeleton.domain.medication.entity.Medication;
import com.medical.skeleton.domain.medication.entity.MedicationRecord;
import com.medical.skeleton.domain.medication.entity.MedicationStatus;
import com.medical.skeleton.domain.medication.repository.MedicationRecordRepository;
import com.medical.skeleton.domain.medication.repository.MedicationRepository;
import com.medical.skeleton.domain.note.entity.Note;
import com.medical.skeleton.domain.note.entity.NoteType;
import com.medical.skeleton.domain.note.repository.NoteRepository;
import com.medical.skeleton.domain.patient.entity.Patient;
import com.medical.skeleton.domain.patient.entity.PatientStatus;
import com.medical.skeleton.domain.patient.repository.PatientRepository;
import com.medical.skeleton.domain.user.entity.Role;
import com.medical.skeleton.domain.user.entity.User;
import com.medical.skeleton.domain.user.repository.UserRepository;
import com.medical.skeleton.domain.vital.entity.VitalSign;
import com.medical.skeleton.domain.vital.repository.VitalSignRepository;
import com.medical.skeleton.domain.ward.entity.Ward;
import com.medical.skeleton.domain.ward.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 애플리케이션 시작 시 DB가 비어있으면 테스트 데이터를 자동으로 삽입합니다.
 *
 * ※ 데이터를 초기화하려면 MySQL에서 아래 실행 후 재시작:
 *    DROP DATABASE medical_db; CREATE DATABASE medical_db CHARACTER SET utf8mb4;
 *
 * 로그인 계정
 *   - 간호사: 123456 / 123456
 *   - 의사:   000000 / 000000
 *   - 긴급 접근 전용: emergency / emergency119  (로그인 화면의 "긴급 접근" 버튼에서 사용)
 *
 * 환자
 *   - 301호 : 이기동 (78세, 남) — 고혈압·심부전
 *   - 302호 : 최진수 (55세, 남) — 제2형 당뇨병·우측 대퇴부 골절
 *   - 303호 : 정유진 (68세, 여) — 지역사회 획득 폐렴
 *   - 304호 : 한도현 (35세, 남) — 교통사고 후 다발성 늑골 골절·흉부 타박상
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository              userRepository;
    private final WardRepository              wardRepository;
    private final PatientRepository           patientRepository;
    private final VitalSignRepository         vitalSignRepository;
    private final MedicationRepository        medicationRepository;
    private final MedicationRecordRepository  medicationRecordRepository;
    private final NoteRepository              noteRepository;
    private final PasswordEncoder             passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("[DataInitializer] 데이터 이미 존재 → 초기화 건너뜀");
            return;
        }
        log.info("[DataInitializer] 테스트 데이터 삽입 시작");

        // ── 병동 ──────────────────────────────────────────────────────
        Ward ward = wardRepository.save(Ward.builder()
                .wardCode("W_3F").wardName("3층 일반병동").floor(3)
                .description("스켈레톤 기반 낙상 감지 모니터링 병동")
                .build());

        // ── 의료진 ────────────────────────────────────────────────────
        User doctor = userRepository.save(User.builder()
                .username("000000").password(passwordEncoder.encode("000000"))
                .name("김재원").role(Role.DOCTOR).wardId(ward.getId()).build());

        User nurse = userRepository.save(User.builder()
                .username("123456").password(passwordEncoder.encode("123456"))
                .name("박지수").role(Role.NURSE).wardId(ward.getId()).build());

        // 긴급 접근 전용 계정 — 로그인 화면의 "긴급 접근" 버튼에서 사용.
        // 응급 상황 시 사번/이메일·비밀번호 입력 없이 즉시 시스템에 들어갈 수 있도록
        // 프런트엔드에서 이 계정으로 곧바로 로그인을 대신 처리한다 (긴급 모드 배너 표시).
        userRepository.save(User.builder()
                .username("emergency").password(passwordEncoder.encode("emergency119"))
                .name("응급 접근").role(Role.NURSE).wardId(ward.getId()).build());

        // ── 환자 A : 이기동 (78세, 고혈압·심부전) ─────────────────────
        Patient pA = patientRepository.save(Patient.builder()
                .name("이기동")
                .birthDate(LocalDate.of(1947, 5, 12))
                .gender("M")
                .wardId(ward.getId()).bedNumber("301-1")
                .admissionDate(LocalDate.now().minusDays(8))
                .status(PatientStatus.ADMITTED)
                .doctorId(doctor.getId())
                .build());

        // ── 환자 B : 최진수 (55세, 당뇨·우측 대퇴부 골절) ───────────
        Patient pB = patientRepository.save(Patient.builder()
                .name("최진수")
                .birthDate(LocalDate.of(1970, 11, 28))
                .gender("M")
                .wardId(ward.getId()).bedNumber("302-1")
                .admissionDate(LocalDate.now().minusDays(3))
                .status(PatientStatus.ADMITTED)
                .doctorId(doctor.getId())
                .build());

        // ── 환자 C : 정유진 (68세, 지역사회 획득 폐렴) ───────────────
        Patient pC = patientRepository.save(Patient.builder()
                .name("정유진")
                .birthDate(LocalDate.of(1958, 3, 22))
                .gender("F")
                .wardId(ward.getId()).bedNumber("303-1")
                .admissionDate(LocalDate.now().minusDays(5))
                .status(PatientStatus.ADMITTED)
                .doctorId(doctor.getId())
                .build());

        // ── 환자 D : 한도현 (35세, 교통사고 후 늑골 골절·흉부 타박상) ─
        Patient pD = patientRepository.save(Patient.builder()
                .name("한도현")
                .birthDate(LocalDate.of(1991, 9, 14))
                .gender("M")
                .wardId(ward.getId()).bedNumber("304-1")
                .admissionDate(LocalDate.now().minusDays(2))
                .status(PatientStatus.ADMITTED)
                .doctorId(doctor.getId())
                .build());

        LocalDateTime now = LocalDateTime.now();

        // ────────────────────────────────────────────────────────────
        // 바이탈 사인 — 이기동 (고혈압·심부전: BP↑, O2↓, HR약간↑)
        // ────────────────────────────────────────────────────────────
        saveVital(pA.getId(), nurse.getId(), now.minusHours(1),
                37.1, 155, 96, 91, 93, 20, "하지 부종 관찰, 상체 거상 유지 중");
        saveVital(pA.getId(), nurse.getId(), now.minusHours(7),
                37.0, 152, 94, 89, 94, 19, null);
        saveVital(pA.getId(), nurse.getId(), now.minusHours(13),
                36.9, 158, 98, 93, 92, 21, "야간 호흡곤란 호소 후 산소 투여");
        saveVital(pA.getId(), nurse.getId(), now.minusHours(19),
                36.8, 148, 90, 88, 95, 18, null);
        saveVital(pA.getId(), nurse.getId(), now.minusHours(25),
                36.7, 153, 93, 90, 93, 20, null);

        // ────────────────────────────────────────────────────────────
        // 바이탈 사인 — 최진수 (수술 후: BP약간↑, 정상 범위)
        // ────────────────────────────────────────────────────────────
        saveVital(pB.getId(), nurse.getId(), now.minusHours(2),
                36.8, 138, 86, 82, 97, 17, "우측 수술 부위 드레싱 교체 완료");
        saveVital(pB.getId(), nurse.getId(), now.minusHours(8),
                37.2, 141, 88, 84, 96, 18, "발열 경향, 냉찜질 적용");
        saveVital(pB.getId(), nurse.getId(), now.minusHours(14),
                36.7, 135, 84, 79, 97, 16, null);
        saveVital(pB.getId(), nurse.getId(), now.minusHours(20),
                36.6, 133, 82, 78, 98, 16, null);

        // ────────────────────────────────────────────────────────────
        // 바이탈 사인 — 정유진 (폐렴: 발열·빈맥·O2↓·빈호흡)
        // ────────────────────────────────────────────────────────────
        saveVital(pC.getId(), nurse.getId(), now.minusHours(1),
                38.3, 128, 82, 102, 90, 24, "고열 지속, 해열제 투여 후 경과 관찰 중");
        saveVital(pC.getId(), nurse.getId(), now.minusHours(7),
                38.6, 130, 84, 105, 89, 25, null);
        saveVital(pC.getId(), nurse.getId(), now.minusHours(13),
                37.9, 126, 80, 98, 91, 23, "객담 배출 위해 체위 변경 및 흉부 물리요법 시행");
        saveVital(pC.getId(), nurse.getId(), now.minusHours(19),
                38.1, 124, 78, 100, 90, 24, null);
        saveVital(pC.getId(), nurse.getId(), now.minusHours(25),
                37.7, 122, 76, 95, 92, 22, null);

        // ────────────────────────────────────────────────────────────
        // 바이탈 사인 — 한도현 (흉부 외상: 통증성 빈맥·얕은 호흡)
        // ────────────────────────────────────────────────────────────
        saveVital(pD.getId(), nurse.getId(), now.minusHours(1),
                36.9, 118, 76, 88, 95, 19, "통증으로 얕은 호흡 양상, 심호흡 격려 및 진통제 투여");
        saveVital(pD.getId(), nurse.getId(), now.minusHours(7),
                37.0, 122, 78, 92, 94, 20, null);
        saveVital(pD.getId(), nurse.getId(), now.minusHours(13),
                36.8, 116, 74, 86, 96, 18, "수면 중 통증으로 자주 깸, 진통제 추가 투여 후 안정됨");
        saveVital(pD.getId(), nurse.getId(), now.minusHours(19),
                36.7, 120, 76, 84, 96, 17, null);
        saveVital(pD.getId(), nurse.getId(), now.minusHours(25),
                36.9, 124, 80, 90, 95, 19, null);

        // ────────────────────────────────────────────────────────────
        // 처방 약물 — 이기동
        // ────────────────────────────────────────────────────────────
        Medication carvedilol = saveMed(pA.getId(), doctor.getId(), "카르베딜롤", 6.25, "mg", 12);
        Medication lisinopril = saveMed(pA.getId(), doctor.getId(), "리시노프릴", 10.0, "mg", 24);
        Medication furosemide = saveMed(pA.getId(), doctor.getId(), "푸로세미드", 40.0, "mg", 24);
        Medication spironolactone = saveMed(pA.getId(), doctor.getId(), "스피로놀락톤", 25.0, "mg", 24);
        Medication aspirinA = saveMed(pA.getId(), doctor.getId(), "아스피린", 100.0, "mg", 24);

        // 이기동 투여 기록 (nextDueAt이 미래 → 대시보드에 다음 투약 표시)
        saveMedRecord(carvedilol, pA.getId(), nurse.getId(), now.minusHours(6),  12);
        saveMedRecord(lisinopril, pA.getId(), nurse.getId(), now.minusHours(10), 24);
        saveMedRecord(furosemide, pA.getId(), nurse.getId(), now.minusHours(10), 24);
        saveMedRecord(spironolactone, pA.getId(), nurse.getId(), now.minusHours(10), 24);
        saveMedRecord(aspirinA, pA.getId(), nurse.getId(), now.minusHours(10), 24);

        // ────────────────────────────────────────────────────────────
        // 처방 약물 — 최진수
        // ────────────────────────────────────────────────────────────
        Medication metformin = saveMed(pB.getId(), doctor.getId(), "메트포르민", 1000.0, "mg", 12);
        Medication insulin    = saveMed(pB.getId(), doctor.getId(), "인슐린 글라진", 20.0, "unit", 24);
        Medication tramadol   = saveMed(pB.getId(), doctor.getId(), "트라마돌", 50.0, "mg", 8);
        Medication cefazolin  = saveMed(pB.getId(), doctor.getId(), "세파졸린", 1000.0, "mg", 8);
        Medication enoxaparin = saveMed(pB.getId(), doctor.getId(), "에녹사파린", 40.0, "mg", 24);

        // 최진수 투여 기록
        saveMedRecord(metformin,  pB.getId(), nurse.getId(), now.minusHours(5),  12);
        saveMedRecord(insulin,    pB.getId(), nurse.getId(), now.minusHours(14), 24);
        saveMedRecord(tramadol,   pB.getId(), nurse.getId(), now.minusHours(3),  8);
        saveMedRecord(cefazolin,  pB.getId(), nurse.getId(), now.minusHours(3),  8);
        saveMedRecord(enoxaparin, pB.getId(), nurse.getId(), now.minusHours(14), 24);

        // ────────────────────────────────────────────────────────────
        // 처방 약물 — 정유진 (폐렴: 항생제·해열진통제·기관지확장제)
        // ────────────────────────────────────────────────────────────
        Medication ceftriaxone = saveMed(pC.getId(), doctor.getId(), "세프트리아손", 1000.0, "mg", 24);
        Medication azithromycin = saveMed(pC.getId(), doctor.getId(), "아지스로마이신", 500.0, "mg", 24);
        Medication acetaminophen = saveMed(pC.getId(), doctor.getId(), "아세트아미노펜", 650.0, "mg", 6);
        Medication salbutamol = saveMed(pC.getId(), doctor.getId(), "살부타몰 네뷸라이저", 2.5, "mg", 8);

        // 정유진 투여 기록
        saveMedRecord(ceftriaxone,  pC.getId(), nurse.getId(), now.minusHours(8),  24);
        saveMedRecord(azithromycin, pC.getId(), nurse.getId(), now.minusHours(12), 24);
        saveMedRecord(acetaminophen,pC.getId(), nurse.getId(), now.minusHours(2),  6);
        saveMedRecord(salbutamol,   pC.getId(), nurse.getId(), now.minusHours(4),  8);

        // ────────────────────────────────────────────────────────────
        // 처방 약물 — 한도현 (흉부 외상: 진통소염제·항응고제·위장보호제)
        // ────────────────────────────────────────────────────────────
        Medication tramadolD    = saveMed(pD.getId(), doctor.getId(), "트라마돌", 50.0, "mg", 8);
        Medication ketorolac    = saveMed(pD.getId(), doctor.getId(), "케토롤락", 30.0, "mg", 12);
        Medication enoxaparinD  = saveMed(pD.getId(), doctor.getId(), "에녹사파린", 40.0, "mg", 24);
        Medication pantoprazole = saveMed(pD.getId(), doctor.getId(), "판토프라졸", 40.0, "mg", 24);

        // 한도현 투여 기록
        saveMedRecord(tramadolD,    pD.getId(), nurse.getId(), now.minusHours(3),  8);
        saveMedRecord(ketorolac,    pD.getId(), nurse.getId(), now.minusHours(6),  12);
        saveMedRecord(enoxaparinD,  pD.getId(), nurse.getId(), now.minusHours(10), 24);
        saveMedRecord(pantoprazole, pD.getId(), nurse.getId(), now.minusHours(10), 24);

        // ────────────────────────────────────────────────────────────
        // 간호 기록 — 이기동
        // ────────────────────────────────────────────────────────────
        saveNote(pA.getId(), nurse.getId(), NoteType.PATIENT,
                "하지 부종 관찰. 양측 발목 부종 2+ 정도. 체중 측정 결과 어제보다 1.2kg 증가. 수분 제한 준수 여부 재교육 실시.");
        saveNote(pA.getId(), nurse.getId(), NoteType.PATIENT,
                "야간 수면 중 호흡곤란 호소하여 상체 거상(30°) 자세 적용. 이후 호흡 안정됨. 담당의(김재원) 보고 완료. 산소 2L/min 투여 중.");
        saveNote(pA.getId(), nurse.getId(), NoteType.PATIENT,
                "청진 시 양측 폐 하엽에서 수포음(crackle) 청진됨. 폐수종 악화 가능성으로 활력징후 1시간 간격 모니터링 시작.");
        saveNote(pA.getId(), nurse.getId(), NoteType.GUARDIAN,
                "보호자(아들 이준호) 방문. 환자 상태 및 치료 계획 설명. 퇴원 일정은 부종 호전 여부에 따라 결정될 예정임을 안내.");
        saveNote(pA.getId(), nurse.getId(), NoteType.CAUTION,
                "페니실린 계열 항생제 알레르기(두드러기). 처방 시 반드시 확인 요망. 낙상 고위험 환자 — 침대 낙상 방지대 항시 올릴 것.");

        // ────────────────────────────────────────────────────────────
        // 간호 기록 — 최진수
        // ────────────────────────────────────────────────────────────
        saveNote(pB.getId(), nurse.getId(), NoteType.PATIENT,
                "우측 대퇴부 골절 수술(ORIF) 후 3일차. 수술 부위 드레싱 교체 시 삼출액 소량 관찰, 감염 징후 없음. 항생제 투여 유지.");
        saveNote(pB.getId(), nurse.getId(), NoteType.PATIENT,
                "혈당 모니터링: 공복 혈당 118 mg/dL, 식후 2시간 혈당 172 mg/dL. 목표 혈당(공복 80~130, 식후 <180) 범위 내 유지 중. 인슐린 용량 조정 없음.");
        saveNote(pB.getId(), nurse.getId(), NoteType.PATIENT,
                "재활의학과 협진 완료. 오늘부터 침상 옆 기립 훈련 시작. 통증 VAS 6/10으로 트라마돌 투여 후 4/10으로 감소. 물리치료사 방문 예정(오후 2시).");
        saveNote(pB.getId(), nurse.getId(), NoteType.PATIENT,
                "조조 체온 37.2°C로 미열 있음. 수술 후 반응성 발열 가능성 높음. 냉찜질 적용 및 수분 섭취 권장. 38°C 이상 시 담당의 연락 예정.");
        saveNote(pB.getId(), nurse.getId(), NoteType.CAUTION,
                "당뇨 환자 — 저혈당 주의. 인슐린 투여 후 식사 여부 반드시 확인. 우측 하지 DVT 예방을 위해 에녹사파린 투여 및 탄력 스타킹 착용 유지.");

        // ────────────────────────────────────────────────────────────
        // 간호 기록 — 정유진
        // ────────────────────────────────────────────────────────────
        saveNote(pC.getId(), nurse.getId(), NoteType.PATIENT,
                "입원 5일째. 발열(38.5°C 이상) 지속되어 해열제 투여 및 미온수 마사지 적용. 객담 양상 황색 점액성으로 배양검사 의뢰함.");
        saveNote(pC.getId(), nurse.getId(), NoteType.PATIENT,
                "산소포화도 89~91% 유지되어 비강 캐뉼라로 산소 2L/min 공급 중. 청진 시 우측 폐 하엽에서 수포음(crackle) 청진됨.");
        saveNote(pC.getId(), nurse.getId(), NoteType.PATIENT,
                "흉부 X-ray 재촬영 결과 우하엽 침윤 소견 호전 추세. 항생제 반응 양호하여 현재 처방 유지하기로 함.");
        saveNote(pC.getId(), nurse.getId(), NoteType.GUARDIAN,
                "보호자(딸 정민아) 내원하여 현재 상태 및 항생제 치료 계획 설명. 발열 양상 호전되면 익일 퇴원 가능성 안내함.");
        saveNote(pC.getId(), nurse.getId(), NoteType.CAUTION,
                "고령 환자 — 탈수 위험 있어 수분 섭취량 모니터링 필요. 기립성 저혈압 가능성 있어 보행 시 보호자 동반 권장. 낙상 고위험군으로 침대 난간 항시 올릴 것.");

        // ────────────────────────────────────────────────────────────
        // 간호 기록 — 한도현
        // ────────────────────────────────────────────────────────────
        saveNote(pD.getId(), nurse.getId(), NoteType.PATIENT,
                "교통사고로 인한 우측 늑골 3~5번 골절 및 흉부 타박상으로 입원. 통증 조절을 위한 진통제 투여 중이며 VAS 7/10 → 4/10으로 호전됨.");
        saveNote(pD.getId(), nurse.getId(), NoteType.PATIENT,
                "흉부 CT 상 기흉·혈흉 소견 없음 확인. 무기폐 예방을 위해 인센티브 스파이로미터 사용법 교육 및 시행 격려 중.");
        saveNote(pD.getId(), nurse.getId(), NoteType.PATIENT,
                "수면 중 통증으로 각성 빈번하여 야간 진통제 용량 조정함. 이후 4시간 이상 연속 수면 가능해짐.");
        saveNote(pD.getId(), nurse.getId(), NoteType.GUARDIAN,
                "보호자(배우자 한지은) 방문. 사고 경위 및 향후 치료 계획(약 1주 입원 후 통원 치료 전환 예정) 설명함.");
        saveNote(pD.getId(), nurse.getId(), NoteType.CAUTION,
                "흉부 손상 환자 — 심호흡·기침 시 통증으로 호흡 억제 가능성 있어 무기폐·폐렴 예방 교육 강화 필요. 진통제 투여 시간 엄수할 것.");

        log.info("[DataInitializer] 삽입 완료 — 병동: {}, 환자: {}명",
                ward.getWardName(), patientRepository.count());
    }

    // ── 헬퍼 메서드 ──────────────────────────────────────────────────

    private void saveVital(Long patientId, Long recordedBy, LocalDateTime at,
                           double temp, int bpS, int bpD, int hr, int o2, int rr, String note) {
        vitalSignRepository.save(VitalSign.builder()
                .patientId(patientId)
                .temperature(temp)
                .bpSystolic(bpS).bpDiastolic(bpD)
                .heartRate(hr).oxygenSaturation(o2).respiratoryRate(rr)
                .recordedBy(recordedBy)
                .recordedAt(at)
                .note(note)
                .build());
    }

    private Medication saveMed(Long patientId, Long doctorId,
                               String name, double dosage, String unit, int intervalHours) {
        return medicationRepository.save(Medication.builder()
                .patientId(patientId)
                .drugName(name).dosage(dosage).unit(unit)
                .intervalHours(intervalHours)
                .startAt(LocalDateTime.now().minusDays(3))
                .prescribedBy(doctorId)
                .status(MedicationStatus.ACTIVE)
                .build());
    }

    private void saveMedRecord(Medication med, Long patientId, Long nurseId,
                               LocalDateTime administeredAt, int intervalHours) {
        medicationRecordRepository.save(MedicationRecord.builder()
                .medicationId(med.getId())
                .patientId(patientId)
                .drugName(med.getDrugName())
                .dosage(med.getDosage())
                .administeredAt(administeredAt)
                .nextDueAt(administeredAt.plusHours(intervalHours))
                .administeredBy(nurseId)
                .build());
    }

    private void saveNote(Long patientId, Long nurseId, NoteType type, String content) {
        noteRepository.save(Note.builder()
                .patientId(patientId)
                .noteType(type)
                .content(content)
                .createdBy(nurseId)
                .build());
    }
}
