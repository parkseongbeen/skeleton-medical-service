import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import api from '../api/axiosInstance';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { analyzeNote, URGENCY_STYLES, parseTags } from '../utils/noteAiAnalyzer';

/* ─────────────────────────────────────────────────────────────
   상수
───────────────────────────────────────────────────────────── */
const NOTE_TYPE_LABELS = { PATIENT: '환자 관련', GUARDIAN: '보호자 관련', CAUTION: '주의사항' };
const NOTE_TYPE_COLORS = { PATIENT: 'text-[#00478d]', GUARDIAN: 'text-[#0ea5e9]', CAUTION: 'text-[#ef4444]' };
const UNIT_OPTIONS = ['mg', 'g', 'ml', 'unit', 'mcg', 'IU'];

/* ─────────────────────────────────────────────────────────────
   유틸 함수
───────────────────────────────────────────────────────────── */
/** 서버 LocalDateTime 비교와 맞추기 위해 클라이언트 로컬 타임 사용 */
const get24hRange = () => {
  const now  = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const toLocal = d => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  return { from: toLocal(from), to: toLocal(now) };
};

const fmtRemaining = ms => {
  if (ms <= 0) return '지금!';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}분`;
  return '< 1분';
};

/* ─────────────────────────────────────────────────────────────
   시계 게이지 컴포넌트
───────────────────────────────────────────────────────────── */
const ClockGauge = ({ intervalHours, record, now }) => {
  if (!record) {
    return (
      <span className="text-xs font-black bg-gray-100 text-gray-400 px-3 py-1.5 rounded-full">
        미투여
      </span>
    );
  }

  const totalMs      = intervalHours * 3600 * 1000;
  const nextDue      = new Date(record.nextDueAt);
  const remainingMs  = nextDue - now;
  const isOverdue    = remainingMs <= 0;
  const pct          = Math.max(0, Math.min(1, remainingMs / totalMs)); // 1 = 방금 투여, 0 = 기한 만료

  const r             = 22;
  const circumference = 2 * Math.PI * r;
  const dashOffset    = circumference * (1 - pct);

  const color = isOverdue
    ? '#ef4444'
    : pct > 0.5 ? '#22c55e'
    : pct > 0.25 ? '#f97316'
    : '#ef4444';

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56">
        {/* 배경 트랙 */}
        <circle cx="28" cy="28" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        {/* 진행 게이지 */}
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[9px] font-black leading-none text-center ${
          isOverdue ? 'text-red-500' : 'text-gray-500'
        } ${isOverdue ? 'animate-pulse' : ''}`}>
          {fmtRemaining(remainingMs)}
        </span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   바이탈 추이 미니 차트
───────────────────────────────────────────────────────────── */
const VitalChart = ({ data, lines }) => (
  <ResponsiveContainer width="100%" height={180}>
    <LineChart data={data} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} domain={['auto', 'auto']} />
      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #f1f5f9' }} />
      {lines.map(line => (
        <Line
          key={line.dataKey}
          type="monotone"
          dataKey={line.dataKey}
          name={line.name}
          stroke={line.color}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
);

/* ─────────────────────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────────────────────── */
const DetailedData = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const patientId   = location.state?.patientId;
  const patientName = location.state?.patientName;

  /* ── 조회 데이터 ─────────────────────────────────────────── */
  const [patient,       setPatient]       = useState(null);
  const [vitals,        setVitals]        = useState(null);
  const [history,       setHistory]       = useState([]);
  const [medications,   setMedications]   = useState([]);
  const [latestRecords, setLatestRecords] = useState({}); // { medicationId: MedicationRecord }
  const [notes,         setNotes]         = useState([]);
  const [loading,       setLoading]       = useState(true);

  /* ── 현재 시각 (게이지 갱신용, 60초마다) ─────────────────── */
  const [now, setNow] = useState(new Date());

  /* ── 알람 관리 ───────────────────────────────────────────── */
  const [alarmDismissed, setAlarmDismissed] = useState(false);
  const prevOverdueRef = useRef(new Set());

  /* ── 바이탈 입력 폼 ──────────────────────────────────────── */
  const [showVitalForm,  setShowVitalForm]  = useState(false);
  const [vitalForm, setVitalForm] = useState({
    heartRate: '', temperature: '', bpSystolic: '', bpDiastolic: '',
    oxygenSaturation: '', respiratoryRate: '', note: '',
  });
  const [vitalSubmitting, setVitalSubmitting] = useState(false);
  const [vitalError,      setVitalError]      = useState('');

  /* ── 처방 약물 추가 폼 ───────────────────────────────────── */
  const [showMedForm,  setShowMedForm]  = useState(false);
  const [medForm, setMedForm] = useState({ drugName: '', dosage: '', unit: 'mg', intervalHours: '' });
  const [medSubmitting, setMedSubmitting] = useState(false);
  const [medError,      setMedError]      = useState('');

  /* ── 처방 약물 편집 ──────────────────────────────────────── */
  const [editingMedId,     setEditingMedId]     = useState(null);
  const [editMedForm,      setEditMedForm]      = useState({ drugName: '', dosage: '', unit: '', intervalHours: '' });
  const [editMedSubmitting, setEditMedSubmitting] = useState(false);
  const [editMedError,      setEditMedError]      = useState('');

  /* ── 투여 중 상태 ────────────────────────────────────────── */
  const [administeringId, setAdministeringId] = useState(null);

  /* ── 간호 기록 입력 폼 ───────────────────────────────────── */
  const [showNoteForm,  setShowNoteForm]  = useState(false);
  const [noteForm, setNoteForm] = useState({ noteType: 'PATIENT', content: '' });
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError,      setNoteError]      = useState('');

  /** 입력 중인 메모 내용을 실시간으로 분석한 AI 미리보기 (키워드 기반, 외부 API 불필요) */
  const notePreview = useMemo(() => analyzeNote(noteForm.content), [noteForm.content]);

  /** 바이탈 이력을 차트용 데이터로 변환 (시간 라벨 + 각 수치) */
  const chartData = useMemo(() => history.map(v => ({
    time: new Date(v.recordedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    heartRate: v.heartRate,
    bpSystolic: v.bpSystolic,
    bpDiastolic: v.bpDiastolic,
    oxygenSaturation: v.oxygenSaturation,
    temperature: v.temperature,
    respiratoryRate: v.respiratoryRate,
  })), [history]);

  /* ── Effects ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!patientId) navigate('/dashboard');
  }, [patientId, navigate]);

  // 60초마다 현재 시각 갱신 (시계 게이지 업데이트)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  /* ── refresh 함수들 ──────────────────────────────────────── */
  const refreshVitals = useCallback(async () => {
    if (!patientId) return;
    const { from, to } = get24hRange();
    const [latestRes, historyRes] = await Promise.allSettled([
      api.get(`/api/patients/${patientId}/vitals/latest`),
      api.get(`/api/patients/${patientId}/vitals/history`, { params: { from, to } }),
    ]);
    if (latestRes.status === 'fulfilled' && latestRes.value.data.success)
      setVitals(latestRes.value.data.data);

    if (historyRes.status === 'fulfilled' && historyRes.value.data.success) {
      const serverHistory = historyRes.value.data.data ?? [];
      // 서버 데이터와 낙관적 추가 항목 병합 (덮어쓰기 방지)
      setHistory(prev => {
        const serverIds = new Set(serverHistory.map(v => v.id));
        const localOnly = prev.filter(v => v.id && !serverIds.has(v.id));
        return [...serverHistory, ...localOnly].sort(
          (a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)
        );
      });
    }
  }, [patientId]);

  const refreshLatestRecords = useCallback(async () => {
    if (!patientId) return;
    const res = await api.get(`/api/patients/${patientId}/medications/latest-records`);
    if (res.data.success) {
      const map = {};
      (res.data.data ?? []).forEach(r => { map[r.medicationId] = r; });
      setLatestRecords(map);
    }
  }, [patientId]);

  const refreshMedications = useCallback(async () => {
    if (!patientId) return;
    const res = await api.get(`/api/patients/${patientId}/medications`);
    if (res.data.success) setMedications(res.data.data ?? []);
    await refreshLatestRecords();
  }, [patientId, refreshLatestRecords]);

  const refreshNotes = useCallback(async () => {
    if (!patientId) return;
    const res = await api.get(`/api/patients/${patientId}/notes`);
    if (res.data.success) setNotes(res.data.data ?? []);
  }, [patientId]);

  /* ── 초기 로드 ───────────────────────────────────────────── */
  useEffect(() => {
    if (!patientId) return;
    const { from, to } = get24hRange();

    (async () => {
      setLoading(true);
      try {
        const [patRes, latRes, hisRes, medRes, recRes, noteRes] = await Promise.allSettled([
          api.get(`/api/patients/${patientId}`),
          api.get(`/api/patients/${patientId}/vitals/latest`),
          api.get(`/api/patients/${patientId}/vitals/history`, { params: { from, to } }),
          api.get(`/api/patients/${patientId}/medications`),
          api.get(`/api/patients/${patientId}/medications/latest-records`),
          api.get(`/api/patients/${patientId}/notes`),
        ]);

        if (patRes.status  === 'fulfilled' && patRes.value.data.success)  setPatient(patRes.value.data.data);
        if (latRes.status  === 'fulfilled' && latRes.value.data.success)  setVitals(latRes.value.data.data);
        if (hisRes.status  === 'fulfilled' && hisRes.value.data.success)  setHistory(hisRes.value.data.data ?? []);
        if (medRes.status  === 'fulfilled' && medRes.value.data.success)  setMedications(medRes.value.data.data ?? []);
        if (recRes.status  === 'fulfilled' && recRes.value.data.success) {
          const map = {};
          (recRes.value.data.data ?? []).forEach(r => { map[r.medicationId] = r; });
          setLatestRecords(map);
        }
        if (noteRes.status === 'fulfilled' && noteRes.value.data.success) setNotes(noteRes.value.data.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  /* ── 알람 감지: 미투여 초과 약물 변화 감지 ──────────────── */
  useEffect(() => {
    const overdueIds = new Set(
      medications
        .filter(med => {
          const rec = latestRecords[med.id];
          return rec && new Date(rec.nextDueAt) < now;
        })
        .map(m => m.id)
    );

    // 새로 초과된 약물이 있으면 알람 재활성화
    const newlyOverdue = [...overdueIds].some(id => !prevOverdueRef.current.has(id));
    if (newlyOverdue) setAlarmDismissed(false);
    prevOverdueRef.current = overdueIds;
  }, [now, medications, latestRecords]);

  /* ── 바이탈 기록 제출 ────────────────────────────────────── */
  const submitVital = async () => {
    const userId = Number(localStorage.getItem('userId'));
    if (!userId) { setVitalError('로그인 정보가 없습니다.'); return; }

    const payload = { recordedBy: userId };
    if (vitalForm.heartRate)        payload.heartRate        = Number(vitalForm.heartRate);
    if (vitalForm.temperature)      payload.temperature      = Number(vitalForm.temperature);
    if (vitalForm.bpSystolic)       payload.bpSystolic       = Number(vitalForm.bpSystolic);
    if (vitalForm.bpDiastolic)      payload.bpDiastolic      = Number(vitalForm.bpDiastolic);
    if (vitalForm.oxygenSaturation) payload.oxygenSaturation = Number(vitalForm.oxygenSaturation);
    if (vitalForm.respiratoryRate)  payload.respiratoryRate  = Number(vitalForm.respiratoryRate);
    if (vitalForm.note)             payload.note             = vitalForm.note;

    if (Object.keys(payload).length === 1) {
      setVitalError('최소 한 가지 이상 수치를 입력해주세요.');
      return;
    }

    try {
      setVitalSubmitting(true);
      setVitalError('');
      const res = await api.post(`/api/patients/${patientId}/vitals`, payload);

      // POST 응답으로 즉시 반영 (히스토리 낙관적 추가)
      if (res.data?.success && res.data?.data) {
        const newVital = res.data.data;
        setVitals(newVital);
        setHistory(prev => {
          const exists = prev.some(v => v.id === newVital.id);
          return exists ? prev : [...prev, newVital];
        });
      }

      // 서버에서 재조회 (병합 방식으로 덮어쓰기 방지)
      await refreshVitals();

      setVitalForm({ heartRate: '', temperature: '', bpSystolic: '', bpDiastolic: '',
                     oxygenSaturation: '', respiratoryRate: '', note: '' });
      setShowVitalForm(false);
    } catch (e) {
      setVitalError(e.response?.data?.message || '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setVitalSubmitting(false);
    }
  };

  /* ── 처방 약물 추가 ──────────────────────────────────────── */
  const submitMedication = async () => {
    const userId = Number(localStorage.getItem('userId'));
    if (!userId)                  { setMedError('로그인 정보가 없습니다.'); return; }
    if (!medForm.drugName.trim()) { setMedError('약물명을 입력해주세요.'); return; }
    if (!medForm.dosage)          { setMedError('용량을 입력해주세요.'); return; }
    if (!medForm.intervalHours)   { setMedError('투여 간격을 입력해주세요.'); return; }

    try {
      setMedSubmitting(true);
      setMedError('');
      await api.post(`/api/patients/${patientId}/medications`, {
        drugName:      medForm.drugName.trim(),
        dosage:        Number(medForm.dosage),
        unit:          medForm.unit || 'mg',
        intervalHours: Number(medForm.intervalHours),
        startAt:       new Date().toISOString().slice(0, 19),
        prescribedBy:  userId,
      });
      await refreshMedications();
      setMedForm({ drugName: '', dosage: '', unit: 'mg', intervalHours: '' });
      setShowMedForm(false);
    } catch (e) {
      setMedError(e.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setMedSubmitting(false);
    }
  };

  /* ── 처방 약물 편집 ──────────────────────────────────────── */
  const startEditMed = med => {
    setEditingMedId(med.id);
    setEditMedForm({ drugName: med.drugName, dosage: String(med.dosage),
                     unit: med.unit ?? 'mg', intervalHours: String(med.intervalHours) });
    setEditMedError('');
  };

  const submitEditMedication = async medicationId => {
    try {
      setEditMedSubmitting(true);
      setEditMedError('');
      await api.put(`/api/patients/${patientId}/medications/${medicationId}`, {
        drugName:      editMedForm.drugName      || null,
        dosage:        editMedForm.dosage        ? Number(editMedForm.dosage)        : null,
        unit:          editMedForm.unit          || null,
        intervalHours: editMedForm.intervalHours ? Number(editMedForm.intervalHours) : null,
      });
      await refreshMedications();
      setEditingMedId(null);
    } catch (e) {
      setEditMedError(e.response?.data?.message || '수정에 실패했습니다.');
    } finally {
      setEditMedSubmitting(false);
    }
  };

  /* ── 처방 약물 중단 ──────────────────────────────────────── */
  const discontinueMedication = async (medicationId, drugName) => {
    if (!window.confirm(`'${drugName}' 처방을 중단하시겠습니까?`)) return;
    try {
      await api.delete(`/api/patients/${patientId}/medications/${medicationId}`);
      await refreshMedications();
    } catch (e) {
      alert(e.response?.data?.message || '처방 중단에 실패했습니다.');
    }
  };

  /* ── 약물 투여 완료 ──────────────────────────────────────── */
  const administerMedication = async (medicationId) => {
    const userId = Number(localStorage.getItem('userId'));
    if (!userId) { alert('로그인 정보가 없습니다.'); return; }
    try {
      setAdministeringId(medicationId);
      await api.post(
        `/api/patients/${patientId}/medications/${medicationId}/administer`,
        { administeredBy: userId }
      );
      await refreshLatestRecords();
      setNow(new Date()); // 게이지 즉시 갱신
    } catch (e) {
      alert(e.response?.data?.message || '투여 기록에 실패했습니다.');
    } finally {
      setAdministeringId(null);
    }
  };

  /* ── 간호 기록 제출 ──────────────────────────────────────── */
  const submitNote = async () => {
    if (!noteForm.content.trim()) { setNoteError('내용을 입력해주세요.'); return; }
    const userId = Number(localStorage.getItem('userId'));
    if (!userId) { setNoteError('로그인 정보가 없습니다.'); return; }

    try {
      setNoteSubmitting(true);
      setNoteError('');
      await api.post(`/api/patients/${patientId}/notes`, {
        noteType: noteForm.noteType, content: noteForm.content.trim(), createdBy: userId,
      });
      await refreshNotes();
      setNoteForm({ noteType: 'PATIENT', content: '' });
      setShowNoteForm(false);
    } catch (e) {
      setNoteError(e.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setNoteSubmitting(false);
    }
  };

  if (!patientId) return null;

  /* ── 초과 약물 목록 ──────────────────────────────────────── */
  const overdueMeds = medications.filter(med => {
    const rec = latestRecords[med.id];
    return rec && new Date(rec.nextDueAt) < now;
  });

  /* ── 공통 스타일 ─────────────────────────────────────────── */
  const inputCls      = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-[#191c1d] focus:outline-none focus:border-[#00478d] focus:ring-2 focus:ring-[#00478d]/20 transition-all bg-white';
  const smallInputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-[#191c1d] focus:outline-none focus:border-[#00478d] focus:ring-1 focus:ring-[#00478d]/20 transition-all bg-white';

  return (
    <div className="relative w-full min-h-screen bg-[#f8f9fa] font-sans">
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} active="detailed" />

      <main className="w-full flex flex-col">
        <Header title="상세 데이터 분석" onMenuClick={() => setIsMenuOpen(true)} />

        <div className="p-8 max-w-7xl mx-auto w-full space-y-8 pb-20">

          {/* 뒤로가기 */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-[#00478d] font-bold text-sm transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
              대시보드로
            </button>
            <span className="text-gray-300">|</span>
            <h2 className="text-2xl font-black text-[#191c1d]">{patientName || patient?.name}</h2>
            {patient?.bedNumber && (
              <span className="text-sm font-semibold text-gray-400">병상 {patient.bedNumber}</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400 font-bold text-lg animate-pulse">데이터 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* ── 1. 환자 프로필 ── */}
              {patient && (
                <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-white flex items-center gap-8">
                  <div className="w-20 h-20 bg-[#f1f5f9] rounded-[1.5rem] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-5xl text-gray-300 font-light">person</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                    {[
                      ['이름',    patient.name],
                      ['생년월일', patient.birthDate ?? '—'],
                      ['성별',    patient.gender === 'M' ? '남성' : patient.gender === 'F' ? '여성' : '—'],
                      ['입원일',  patient.admissionDate ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-xl font-black text-[#191c1d]">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── 2. 최신 바이탈 사인 ── */}
              <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-white">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-[#191c1d]">최신 바이탈 사인</h3>
                    {vitals?.recordedAt && (
                      <p className="text-xs font-bold text-gray-400 mt-1">
                        {new Date(vitals.recordedAt).toLocaleString('ko-KR')} 기록
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowVitalForm(v => !v); setVitalError(''); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                      showVitalForm ? 'bg-gray-100 text-gray-600' : 'bg-[#00478d] text-white hover:bg-[#003d7a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{showVitalForm ? 'close' : 'add'}</span>
                    {showVitalForm ? '닫기' : '바이탈 기록'}
                  </button>
                </div>

                {vitals ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {[
                      { label: '심박수',    value: vitals.heartRate,        unit: 'BPM',  bg: '#fff5f5', color: '#ef4444', icon: 'favorite' },
                      { label: '혈압',      value: vitals.bpSystolic && vitals.bpDiastolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` : '—', unit: 'mmHg', bg: '#f0f9ff', color: '#0ea5e9', icon: 'blood_pressure' },
                      { label: '산소포화도', value: vitals.oxygenSaturation, unit: '%',    bg: '#eff6ff', color: '#3b82f6', icon: 'air' },
                      { label: '체온',      value: vitals.temperature,      unit: '°C',   bg: '#fff7ed', color: '#f97316', icon: 'thermostat' },
                      { label: '호흡수',    value: vitals.respiratoryRate,  unit: '회/분', bg: '#f0fdf4', color: '#22c55e', icon: 'pulmonology' },
                    ].map(({ label, value, unit, bg, color, icon }) => (
                      <div key={label} className="p-5 rounded-2xl text-center border" style={{ backgroundColor: bg, borderColor: bg }}>
                        <span className="material-symbols-outlined text-2xl" style={{ color }}>{icon}</span>
                        <p className="font-black text-xs uppercase mt-1" style={{ color }}>{label}</p>
                        <p className="text-3xl font-black mt-1" style={{ color }}>{value ?? '—'}</p>
                        <p className="text-xs font-bold" style={{ color: color + '99' }}>{unit}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 font-semibold text-center py-6 mb-4">기록된 바이탈 정보가 없습니다.</p>
                )}

                {showVitalForm && (
                  <div className="bg-[#f8f9fa] rounded-2xl p-6 border border-gray-100 space-y-4">
                    <p className="text-sm font-black text-[#191c1d]">새 바이탈 기록</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { key: 'heartRate',        label: '심박수',     placeholder: 'BPM' },
                        { key: 'temperature',      label: '체온',       placeholder: '°C', step: '0.1' },
                        { key: 'bpSystolic',       label: '수축기 혈압', placeholder: 'mmHg' },
                        { key: 'bpDiastolic',      label: '이완기 혈압', placeholder: 'mmHg' },
                        { key: 'oxygenSaturation', label: '산소포화도', placeholder: '%' },
                        { key: 'respiratoryRate',  label: '호흡수',     placeholder: '회/분' },
                      ].map(({ key, label, placeholder, step }) => (
                        <div key={key}>
                          <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
                          <input type="number" step={step} placeholder={placeholder}
                            value={vitalForm[key]}
                            onChange={e => setVitalForm(f => ({ ...f, [key]: e.target.value }))}
                            className={inputCls} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">메모 (선택)</label>
                      <input type="text" placeholder="특이사항을 입력하세요"
                        value={vitalForm.note}
                        onChange={e => setVitalForm(f => ({ ...f, note: e.target.value }))}
                        className={inputCls} />
                    </div>
                    {vitalError && <p className="text-red-500 text-sm font-bold">{vitalError}</p>}
                    <div className="flex gap-3 pt-1">
                      <button onClick={submitVital} disabled={vitalSubmitting}
                        className="px-6 py-2.5 bg-[#00478d] text-white rounded-xl font-bold text-sm hover:bg-[#003d7a] disabled:opacity-50 transition-all">
                        {vitalSubmitting ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => { setShowVitalForm(false); setVitalError(''); }}
                        className="px-6 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* ── 3. 바이탈 이력 (24시간) ── */}
              <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-white">
                <h3 className="text-2xl font-black text-[#191c1d] mb-6">바이탈 이력 (최근 24시간)</h3>
                {history.length > 0 ? (
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#f8f9fa] rounded-2xl p-4">
                      <p className="text-xs font-black text-gray-400 mb-2">심박수 (bpm)</p>
                      <VitalChart data={chartData} lines={[{ dataKey: 'heartRate', name: '심박수', color: '#ef4444' }]} />
                    </div>
                    <div className="bg-[#f8f9fa] rounded-2xl p-4">
                      <p className="text-xs font-black text-gray-400 mb-2">혈압 (mmHg)</p>
                      <VitalChart data={chartData} lines={[
                        { dataKey: 'bpSystolic', name: '수축기', color: '#0ea5e9' },
                        { dataKey: 'bpDiastolic', name: '이완기', color: '#7dd3fc' },
                      ]} />
                    </div>
                    <div className="bg-[#f8f9fa] rounded-2xl p-4">
                      <p className="text-xs font-black text-gray-400 mb-2">체온 (°C)</p>
                      <VitalChart data={chartData} lines={[{ dataKey: 'temperature', name: '체온', color: '#f97316' }]} />
                    </div>
                    <div className="bg-[#f8f9fa] rounded-2xl p-4">
                      <p className="text-xs font-black text-gray-400 mb-2">산소포화도 (%)</p>
                      <VitalChart data={chartData} lines={[{ dataKey: 'oxygenSaturation', name: '산소포화도', color: '#3b82f6' }]} />
                    </div>
                    <div className="bg-[#f8f9fa] rounded-2xl p-4">
                      <p className="text-xs font-black text-gray-400 mb-2">호흡수 (회/분)</p>
                      <VitalChart data={chartData} lines={[{ dataKey: 'respiratoryRate', name: '호흡수', color: '#22c55e' }]} />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 font-bold uppercase tracking-wider text-xs border-b border-gray-100">
                          <th className="text-left py-3 pr-6">기록 시각</th>
                          <th className="text-center px-4">심박수</th>
                          <th className="text-center px-4">혈압</th>
                          <th className="text-center px-4">산소포화도</th>
                          <th className="text-center px-4">체온</th>
                          <th className="text-center px-4">호흡수</th>
                          <th className="text-left px-4">메모</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...history].reverse().map((v, i) => (
                          <tr key={v.id ?? i} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-6 font-semibold text-gray-600 whitespace-nowrap">
                              {new Date(v.recordedAt).toLocaleString('ko-KR')}
                            </td>
                            <td className="text-center px-4 font-bold text-[#ef4444]">{v.heartRate ?? '—'}</td>
                            <td className="text-center px-4 font-bold text-[#0ea5e9]">
                              {v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : '—'}
                            </td>
                            <td className="text-center px-4 font-bold text-[#3b82f6]">{v.oxygenSaturation ?? '—'}</td>
                            <td className="text-center px-4 font-bold text-[#f97316]">{v.temperature ?? '—'}</td>
                            <td className="text-center px-4 font-bold text-[#22c55e]">{v.respiratoryRate ?? '—'}</td>
                            <td className="px-4 text-gray-400 text-xs">{v.note ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                ) : (
                  <div className="h-32 bg-[#f8f9fa] rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <p className="text-gray-400 font-bold">최근 24시간 이내 바이탈 기록이 없습니다.</p>
                  </div>
                )}
              </section>

              {/* ── 4. 처방 약물 ── */}
              <section className="bg-white rounded-[2.5rem] shadow-sm border border-white overflow-hidden">
                {/* 헤더 */}
                <div className="px-8 pt-8 pb-5 border-b border-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black text-[#191c1d]">처방 약물</h3>
                    {overdueMeds.length > 0 && (
                      <span className="animate-bounce text-xs font-black bg-red-500 text-white px-2.5 py-1 rounded-full">
                        {overdueMeds.length}건 초과
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowMedForm(v => !v); setMedError(''); setEditingMedId(null); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                      showMedForm ? 'bg-gray-100 text-gray-600' : 'bg-[#00478d] text-white hover:bg-[#003d7a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{showMedForm ? 'close' : 'add'}</span>
                    {showMedForm ? '닫기' : '약물 추가'}
                  </button>
                </div>

                {/* ── 초과 알람 배너 ── */}
                {overdueMeds.length > 0 && !alarmDismissed && (
                  <div className="mx-8 mt-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <span className="material-symbols-outlined text-red-500 text-xl mt-0.5 shrink-0">
                      notification_important
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-red-700 mb-1">투여 시간 초과 알람</p>
                      <p className="text-xs font-medium text-red-500">
                        {overdueMeds.map(m => m.drugName).join(', ')} — 투여 완료 버튼을 눌러 기록하세요.
                      </p>
                    </div>
                    <button
                      onClick={() => setAlarmDismissed(true)}
                      className="text-red-400 hover:text-red-600 shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>
                )}

                {/* 약물 추가 폼 */}
                {showMedForm && (
                  <div className="px-8 py-6 bg-[#f8f9fa] border-b border-gray-100 space-y-4 mt-5">
                    <p className="text-sm font-black text-[#191c1d]">새 처방 약물</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">약물명 *</label>
                        <input type="text" placeholder="예) 아스피린"
                          value={medForm.drugName}
                          onChange={e => setMedForm(f => ({ ...f, drugName: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">용량 *</label>
                        <input type="number" placeholder="0"
                          value={medForm.dosage}
                          onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">단위</label>
                        <select value={medForm.unit}
                          onChange={e => setMedForm(f => ({ ...f, unit: e.target.value }))}
                          className={inputCls}>
                          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">투여 간격 (시간) *</label>
                        <input type="number" placeholder="예) 8"
                          value={medForm.intervalHours}
                          onChange={e => setMedForm(f => ({ ...f, intervalHours: e.target.value }))}
                          className={inputCls} />
                      </div>
                    </div>
                    {medError && <p className="text-red-500 text-sm font-bold">{medError}</p>}
                    <div className="flex gap-3">
                      <button onClick={submitMedication} disabled={medSubmitting}
                        className="px-6 py-2.5 bg-[#00478d] text-white rounded-xl font-bold text-sm hover:bg-[#003d7a] disabled:opacity-50 transition-all">
                        {medSubmitting ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => { setShowMedForm(false); setMedError(''); }}
                        className="px-6 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* 약물 목록 */}
                <div className="p-8 space-y-3">
                  {medications.length > 0 ? medications.map(med => {
                    const record    = latestRecords[med.id];
                    const isOverdue = record && new Date(record.nextDueAt) < now;
                    const isAdminLoading = administeringId === med.id;

                    return (
                      <div key={med.id}>
                        {editingMedId === med.id ? (
                          /* 편집 모드 */
                          <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
                            <p className="text-xs font-black text-[#00478d]">처방 수정</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1">약물명</label>
                                <input type="text" value={editMedForm.drugName}
                                  onChange={e => setEditMedForm(f => ({ ...f, drugName: e.target.value }))}
                                  className={smallInputCls} />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">용량</label>
                                <input type="number" value={editMedForm.dosage}
                                  onChange={e => setEditMedForm(f => ({ ...f, dosage: e.target.value }))}
                                  className={smallInputCls} />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">단위</label>
                                <select value={editMedForm.unit}
                                  onChange={e => setEditMedForm(f => ({ ...f, unit: e.target.value }))}
                                  className={smallInputCls}>
                                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">간격 (시간)</label>
                                <input type="number" value={editMedForm.intervalHours}
                                  onChange={e => setEditMedForm(f => ({ ...f, intervalHours: e.target.value }))}
                                  className={smallInputCls} />
                              </div>
                            </div>
                            {editMedError && <p className="text-red-500 text-xs font-bold">{editMedError}</p>}
                            <div className="flex gap-2">
                              <button onClick={() => submitEditMedication(med.id)} disabled={editMedSubmitting}
                                className="px-4 py-2 bg-[#00478d] text-white rounded-lg font-bold text-xs hover:bg-[#003d7a] disabled:opacity-50 transition-all">
                                {editMedSubmitting ? '저장 중...' : '저장'}
                              </button>
                              <button onClick={() => { setEditingMedId(null); setEditMedError(''); }}
                                className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg font-bold text-xs hover:bg-gray-50 transition-all">
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 표시 모드 */
                          <div className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${
                            isOverdue
                              ? 'bg-red-50 border-red-200'
                              : 'bg-[#f8f9fa] border-gray-100'
                          }`}>
                            {/* 약물 아이콘 */}
                            <div className={`p-3 rounded-xl border shadow-sm shrink-0 ${
                              isOverdue ? 'bg-red-100 border-red-200' : 'bg-white border-gray-100'
                            }`}>
                              <span className={`material-symbols-outlined text-xl ${
                                isOverdue ? 'text-red-500' : 'text-[#00478d]'
                              }`}>pill</span>
                            </div>

                            {/* 약물 정보 */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-base font-bold ${isOverdue ? 'text-red-700' : 'text-[#191c1d]'}`}>
                                {med.drugName}
                                <span className={`font-semibold ml-1 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                                  {med.dosage}{med.unit}
                                </span>
                              </p>
                              <p className={`text-xs font-medium ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                                {med.intervalHours}시간마다 투여
                                {record?.administeredAt && (
                                  <span className="ml-2">
                                    · 최근 투여: {new Date(record.administeredAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* 시계 게이지 */}
                            <ClockGauge
                              intervalHours={med.intervalHours}
                              record={record}
                              now={now}
                            />

                            {/* 투여 완료 버튼 */}
                            {med.status === 'ACTIVE' && (
                              <button
                                onClick={() => administerMedication(med.id)}
                                disabled={isAdminLoading}
                                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 ${
                                  isOverdue
                                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                                    : 'bg-white text-[#00478d] border border-[#00478d] hover:bg-[#00478d] hover:text-white'
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {isAdminLoading ? 'hourglass_empty' : 'check_circle'}
                                </span>
                                {isAdminLoading ? '처리 중...' : '투여 완료'}
                              </button>
                            )}

                            {/* 상태 배지 + 수정/삭제 */}
                            <span className={`text-xs font-black px-3 py-1.5 rounded-full shrink-0 ${
                              med.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {med.status === 'ACTIVE' ? '투여 중' : '중단'}
                            </span>

                            {med.status === 'ACTIVE' && (
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => startEditMed(med)}
                                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-[#00478d] hover:border-[#00478d] transition-all"
                                  title="수정">
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button onClick={() => discontinueMedication(med.id, med.drugName)}
                                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition-all"
                                  title="중단">
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="text-gray-400 font-semibold text-center py-8">처방된 약물이 없습니다.</p>
                  )}
                </div>
              </section>

              {/* ── 5. 간호 기록 ── */}
              <section className="bg-white rounded-[2.5rem] shadow-sm border border-white overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="text-2xl font-black text-[#191c1d]">간호 기록</h3>
                  <button
                    onClick={() => { setShowNoteForm(v => !v); setNoteError(''); }}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
                      showNoteForm ? 'bg-gray-100 text-gray-600' : 'bg-[#00478d] text-white hover:bg-[#003d7a]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{showNoteForm ? 'close' : 'add'}</span>
                    {showNoteForm ? '닫기' : '기록 추가'}
                  </button>
                </div>

                {showNoteForm && (
                  <div className="px-8 py-6 bg-[#f8f9fa] border-b border-gray-100 space-y-4">
                    <p className="text-sm font-black text-[#191c1d]">새 간호 기록</p>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">유형</label>
                      <select value={noteForm.noteType}
                        onChange={e => setNoteForm(f => ({ ...f, noteType: e.target.value }))}
                        className={inputCls}>
                        <option value="PATIENT">환자 관련</option>
                        <option value="GUARDIAN">보호자 관련</option>
                        <option value="CAUTION">주의사항</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">내용</label>
                      <textarea rows={4} placeholder="간호 기록 내용을 입력하세요..."
                        value={noteForm.content}
                        onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                        className={inputCls + ' resize-none'} />
                    </div>

                    {/* AI 분석 실시간 미리보기 — 작성 중인 내용을 즉시 분석해 긴급도·태그·요약을 보여줌 */}
                    {noteForm.content.trim() && (
                      <div className="rounded-2xl p-4 border border-gray-200 bg-white/70">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-base text-[#697077]">smart_toy</span>
                          <span className="text-xs font-black text-[#697077] uppercase tracking-widest">AI 분석 미리보기</span>
                          <span className={`ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${URGENCY_STYLES[notePreview.urgency].badge}`}>
                            <span className="material-symbols-outlined text-sm">{URGENCY_STYLES[notePreview.urgency].icon}</span>
                            {notePreview.urgency}
                          </span>
                        </div>
                        {notePreview.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {notePreview.tags.map((tag) => (
                              <span key={tag} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">{notePreview.summary}</p>
                      </div>
                    )}

                    {noteError && <p className="text-red-500 text-sm font-bold">{noteError}</p>}
                    <div className="flex gap-3">
                      <button onClick={submitNote} disabled={noteSubmitting}
                        className="px-6 py-2.5 bg-[#00478d] text-white rounded-xl font-bold text-sm hover:bg-[#003d7a] disabled:opacity-50 transition-all">
                        {noteSubmitting ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => { setShowNoteForm(false); setNoteError(''); }}
                        className="px-6 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {notes.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {[...notes].reverse().map((note, i) => {
                      const urgency = note.aiUrgency && URGENCY_STYLES[note.aiUrgency] ? note.aiUrgency : null;
                      const tags = parseTags(note.aiTags);
                      return (
                      <div key={i} className="p-8 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className={`text-sm font-black ${NOTE_TYPE_COLORS[note.noteType] ?? 'text-gray-600'}`}>
                            {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
                          </span>
                          <span className="text-gray-200">|</span>
                          <span className="text-gray-400 font-semibold text-sm">
                            {note.createdAt ? new Date(note.createdAt).toLocaleString('ko-KR') : '—'}
                          </span>
                          {urgency && (
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${URGENCY_STYLES[urgency].badge}`}>
                              <span className="material-symbols-outlined text-sm">{URGENCY_STYLES[urgency].icon}</span>
                              AI 긴급도 · {urgency}
                            </span>
                          )}
                        </div>
                        <p className="text-base text-gray-700 font-medium leading-relaxed">{note.content}</p>

                        {(tags.length > 0 || note.aiSummary) && (
                          <div className="mt-3 rounded-2xl bg-[#f8f9fa] border border-gray-100 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="material-symbols-outlined text-base text-[#00478d]">smart_toy</span>
                              <span className="text-[11px] font-black text-[#00478d] uppercase tracking-widest">AI 자동 분석</span>
                            </div>
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {tags.map((tag) => (
                                  <span key={tag} className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 text-[11px] font-bold">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {note.aiSummary && (
                              <p className="text-xs text-gray-500 font-medium leading-relaxed">{note.aiSummary}</p>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <p className="text-gray-400 font-bold">작성된 간호 기록이 없습니다.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DetailedData;
