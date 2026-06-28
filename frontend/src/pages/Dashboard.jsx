import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import QuickRecordModal from '../components/QuickRecordModal';
import AlertActionModal from '../components/AlertActionModal';

const Dashboard = () => {
  const navigate = useNavigate();

  const [isMenuOpen,    setIsMenuOpen]    = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  /** { patient, initialType } | null  — 빠른 기록 모달 제어 */
  const [modalState,    setModalState]    = useState(null);
  const [alertPatient,  setAlertPatient]  = useState(null);

  /* ─── 대시보드 fetch (5초 자동 갱신) ─── */
  const fetchDashboard = useCallback(async () => {
    const wardId = localStorage.getItem('wardId');
    if (!wardId) return;
    try {
      const res = await api.get(`/api/wards/${wardId}/dashboard`);
      if (res.data.success) {
        setDashboardData(res.data.data);
        setError(null);
      }
    } catch (err) {
      console.error('대시보드 로드 실패:', err);
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const wardId = localStorage.getItem('wardId');
    if (!wardId) {
      setError('병동 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      setLoading(false);
      return;
    }
    fetchDashboard();
    const timer = setInterval(fetchDashboard, 5000);
    return () => clearInterval(timer);
  }, [fetchDashboard]);

  /* ─── 미완료 업무 목록 계산 ─── */
  const incompleteTasks = useMemo(() => {
    if (!dashboardData) return [];
    const tasks = [];
    dashboardData.patients.forEach(p => {
      // 투약 지연
      if (p.nextMedication && p.nextMedication.minutesLeft <= 0) {
        tasks.push({
          patient:   p,
          modalType: 'MED_REACTION',
          label:     `${p.name} — ${p.nextMedication.drugName} 투약 지연`,
          urgent:    true,
        });
      }
      // 확인이 필요한 알림
      if (p.unresolvedAlerts > 0) {
        tasks.push({
          patient:   p,
          action:    'ALERTS',
          label:     `${p.name} — 확인 필요 알림 ${p.unresolvedAlerts}건`,
          urgent:    false,
        });
      }
    });
    return tasks;
  }, [dashboardData]);

  /* ─── 스켈레톤 상태 뱃지 ─── */
  const getSkeletonBadge = (status) => {
    switch (status) {
      case 'FALL':     return { label: '낙상 감지', color: 'bg-red-100 text-red-700' };
      case 'LYING':    return { label: '누워 있음', color: 'bg-yellow-100 text-yellow-700' };
      case 'SITTING':  return { label: '앉아 있음', color: 'bg-blue-100 text-blue-700' };
      case 'STANDING': return { label: '서 있음',   color: 'bg-green-100 text-green-700' };
      default:         return { label: '정상',       color: 'bg-green-100 text-green-700' };
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f8f9fa] overflow-y-auto font-sans">
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} active="dash" />

      <main className="w-full flex flex-col pb-16">
        <Header title="환자 모니터링" onMenuClick={() => setIsMenuOpen(true)} />

        <div className="p-8 max-w-[1600px] mx-auto w-full">

          {/* ── 병동 요약 헤더 ── */}
          {dashboardData && (
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-4xl font-black text-[#191c1d]">{dashboardData.wardName}</h2>
                <p className="text-gray-400 font-semibold mt-1">
                  총 <span className="text-[#00478d] font-black">{dashboardData.totalPatients}</span>명 입원 중
                </p>
              </div>
              <div className="bg-white rounded-2xl px-6 py-3 shadow-sm border border-gray-100 text-sm font-bold text-gray-500">
                5초마다 자동 갱신
              </div>
            </div>
          )}

          {/* ── 미완료 업무 패널 ── */}
          {incompleteTasks.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-[2rem] p-6">
              <h3 className="font-black text-amber-800 text-base mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-xl">warning</span>
                미완료 업무
                <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
                  {incompleteTasks.length}
                </span>
              </h3>
              <div className="space-y-2">
                {incompleteTasks.map((task, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (task.action === 'ALERTS') {
                        setAlertPatient(task.patient);
                      } else {
                        setModalState({ patient: task.patient, initialType: task.modalType });
                      }
                    }}
                    className="w-full text-left bg-white rounded-xl px-4 py-3 flex items-center justify-between
                               hover:bg-amber-50 transition-colors border border-amber-100 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0
                        ${task.urgent ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                      <span className="font-semibold text-gray-700 text-sm">{task.label}</span>
                    </div>
                    <span className="material-symbols-outlined text-amber-400 text-base
                                     group-hover:text-amber-600 transition-colors">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 로딩 ── */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400 font-bold text-lg animate-pulse">데이터 불러오는 중...</p>
            </div>
          )}

          {/* ── 에러 ── */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <p className="text-red-600 font-bold text-lg">{error}</p>
            </div>
          )}

          {/* ── 환자 카드 그리드 ── */}
          {dashboardData && !loading && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {dashboardData.patients.map((patient) => {
                const badge  = getSkeletonBadge(patient.skeletonStatus);
                const vitals = patient.latestVitals;
                const nextMed = patient.nextMedication;

                return (
                  /* div으로 변경 — 내부에 <button> 중첩 가능하도록 */
                  <div
                    key={patient.patientId}
                    onClick={() => navigate('/details', {
                      state: { patientId: patient.patientId, patientName: patient.name },
                    })}
                    className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05)]
                               border border-white cursor-pointer
                               hover:shadow-[0_20px_60px_-10px_rgba(0,71,141,0.15)] hover:-translate-y-1
                               transition-all duration-200"
                  >
                    {/* 환자 이름·병상·상태뱃지 */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#f1f5f9] rounded-2xl flex items-center justify-center">
                          <span className="material-symbols-outlined text-4xl text-gray-300 font-light">person</span>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-[#191c1d]">{patient.name}</h3>
                          <p className="text-sm font-semibold text-gray-400">병상 {patient.bedNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {patient.unresolvedAlerts > 0 && (
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              setAlertPatient(patient);
                            }}
                            className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full
                                       hover:bg-red-600 transition-colors"
                          >
                            ⚠ {patient.unresolvedAlerts}
                          </button>
                        )}
                        <span className={`text-xs font-black px-3 py-1.5 rounded-full ${badge.color}`}>
                          ● {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* 바이탈 4개 */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <div className="bg-[#fff5f5] p-4 rounded-2xl text-center">
                        <p className="text-[#ef4444] font-black text-xs mb-1">심박수</p>
                        <p className="text-2xl font-black text-[#ef4444]">{vitals?.heartRate ?? '—'}</p>
                        <p className="text-[10px] font-bold text-[#ef4444]/60">BPM</p>
                      </div>
                      <div className="bg-[#f0f9ff] p-4 rounded-2xl text-center">
                        <p className="text-[#0ea5e9] font-black text-xs mb-1">혈압</p>
                        <p className="text-xl font-black text-[#0ea5e9]">{vitals?.bp ?? '—'}</p>
                        <p className="text-[10px] font-bold text-[#0ea5e9]/60">mmHg</p>
                      </div>
                      <div className="bg-[#eff6ff] p-4 rounded-2xl text-center">
                        <p className="text-[#3b82f6] font-black text-xs mb-1">산소포화도</p>
                        <p className="text-2xl font-black text-[#3b82f6]">{vitals?.oxygenSaturation ?? '—'}</p>
                        <p className="text-[10px] font-bold text-[#3b82f6]/60">%</p>
                      </div>
                      <div className="bg-[#fff7ed] p-4 rounded-2xl text-center">
                        <p className="text-[#f97316] font-black text-xs mb-1">체온</p>
                        <p className="text-2xl font-black text-[#f97316]">{vitals?.temperature ?? '—'}</p>
                        <p className="text-[10px] font-bold text-[#f97316]/60">°C</p>
                      </div>
                    </div>

                    {/* 다음 투약 + 기록 시각 */}
                    <div className="flex items-center justify-between text-sm mb-5">
                      <div className="flex items-center gap-2 text-gray-500">
                        <span className="material-symbols-outlined text-base">medication</span>
                        {nextMed ? (
                          <span className="font-semibold">
                            다음 투약:{' '}
                            <span className="font-black text-[#00478d]">{nextMed.drugName}</span>
                            {nextMed.minutesLeft > 0
                              ? ` (${nextMed.minutesLeft}분 후)`
                              : <span className="text-red-500"> (지금 투여)</span>
                            }
                          </span>
                        ) : (
                          <span className="font-semibold text-gray-400">처방 약물 없음</span>
                        )}
                      </div>
                      {vitals?.recordedAt && (
                        <span className="text-xs text-gray-300 font-semibold">
                          {new Date(vitals.recordedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기록
                        </span>
                      )}
                    </div>

                    {/* 하단: 상세보기 링크 + 빠른 기록 버튼 */}
                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#00478d]">
                        <span className="text-xs font-bold uppercase tracking-widest">상세 데이터 보기</span>
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </div>

                      {/* ⚡ 빠른 기록 — e.stopPropagation()으로 카드 클릭(상세이동)과 분리 */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setModalState({ patient, initialType: 'VITAL' });
                        }}
                        className="flex items-center gap-1.5 bg-[#00478d] text-white text-xs font-black
                                   px-4 py-2.5 rounded-xl hover:bg-[#003a73] transition-colors shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        빠른 기록
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 환자 없을 때 ── */}
          {dashboardData && dashboardData.patients.length === 0 && (
            <div className="bg-white rounded-[2.5rem] p-16 text-center shadow-sm">
              <span className="material-symbols-outlined text-6xl text-gray-200">person_off</span>
              <p className="text-gray-400 font-bold text-xl mt-4">현재 입원 환자가 없습니다</p>
            </div>
          )}
        </div>
      </main>

      {/* ── 빠른 기록 모달 ── */}
      <QuickRecordModal
        isOpen={!!modalState}
        onClose={() => setModalState(null)}
        patient={modalState?.patient}
        initialType={modalState?.initialType || 'VITAL'}
        onSaved={fetchDashboard}
      />

      {alertPatient && (
        <AlertActionModal
          patient={alertPatient}
          onClose={() => setAlertPatient(null)}
          onResolved={fetchDashboard}
          onOpenDetails={() => navigate('/details', {
            state: {
              patientId: alertPatient.patientId,
              patientName: alertPatient.name,
            },
          })}
          onOpenCctv={() => navigate('/cctv', {
            state: {
              roomName: `${alertPatient.bedNumber?.split('-')[0]}호`,
            },
          })}
        />
      )}
    </div>
  );
};

export default Dashboard;
