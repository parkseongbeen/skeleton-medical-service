import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';

/**
 * 전역 낙상 감지 컨텍스트
 *
 * ■ 핵심 설계
 *   - setInterval 주기와 무관하게 performance.now() 기반 실제 경과 시간으로
 *     현재 프레임을 계산 → 백그라운드 탭에서도 타이밍 정확
 *   - 어느 페이지에 있든 항상 실행됨 (App 최상단에서 Provider로 감쌈)
 *
 * ■ 낙상 판정 기준
 *   직전 WINDOW 프레임 내 bounding box 비율 < 1.2 (서있었음)
 *   + 현재 비율 > 1.8 (누워있음)
 *   → 서있다가 누운 전환 = 낙상
 *
 * ■ 오탐 방지
 *   - 영상 루프 후 침대 구간(프레임 0~29): idx < WINDOW 조건으로 스킵 → 오탐 없음
 *   - room2(처음부터 누워있음): minPrev > 1.2 → 조건 미충족 → 오탐 없음
 */

const ROOMS = [
  { id: 1, name: '301호', patient: '환자 A', skeletonUrl: 'http://localhost:8080/skeleton/room1.json' },
  { id: 2, name: '302호', patient: '환자 B', skeletonUrl: 'http://localhost:8080/skeleton/room2.json' },
];

const FPS              = 24;
const WINDOW           = 30;    // 직전 30프레임 범위
const UPRIGHT_MAX      = 1.2;   // 서있을 때 최대 비율
const FALLEN_MIN       = 1.8;   // 넘어진 상태 최소 비율
const COOLDOWN_MS      = 7000;  // 알림 지속 + 재감지 방지 시간
const CHECK_INTERVAL   = 300;   // 300ms마다 체크 (백그라운드 탭도 충분)

const FallAlertContext = createContext(null);

export function FallAlertProvider({ children }) {
  const [globalAlert, setGlobalAlert] = useState(null);
  /** 낙상 감지 시 Dashboard가 해당 환자 빠른기록 모달을 열 수 있도록 룸 이름 전달 */
  const [pendingFallRoom, setPendingFallRoom] = useState(null); // e.g. '301호'
  /** 알림 배너에 표시 중인 낙상 발생 룸 — 배너 클릭 시 빠른기록 모달을 여는 데 사용 */
  const [alertRoomName, setAlertRoomName] = useState(null);

  const framesData  = useRef({});  // roomId → skeleton frames []
  const cooldowns   = useRef({});  // roomId → 쿨다운 중 여부
  const roomStartTimes = useRef({}); // roomId → 분석 시작 기준 시각 (ms)
  const previousFrameIndices = useRef({});
  const activeAlertRoomId = useRef(null);
  const alertTimeout = useRef(null);

  const clearFallAlert = useCallback((roomName = null) => {
    const requestedRoom = roomName
      ? ROOMS.find(room => room.name === roomName)
      : null;

    if (requestedRoom && activeAlertRoomId.current !== requestedRoom.id) return;

    if (alertTimeout.current) {
      clearTimeout(alertTimeout.current);
      alertTimeout.current = null;
    }

    if (activeAlertRoomId.current != null) {
      cooldowns.current[activeAlertRoomId.current] = false;
    }

    activeAlertRoomId.current = null;
    setGlobalAlert(null);
    setAlertRoomName(null);
  }, []);

  const resetFallAlertForVideoLoop = useCallback((roomName) => {
    const room = ROOMS.find(candidate => candidate.name === roomName);
    if (!room) return;

    clearFallAlert(roomName);
    cooldowns.current[room.id] = false;
    previousFrameIndices.current[room.id] = 0;
    roomStartTimes.current[room.id] = performance.now();
  }, [clearFallAlert]);

  // ── JSON 로드 ────────────────────────────────────────────────
  useEffect(() => {
    ROOMS.forEach(room => {
      fetch(room.skeletonUrl)
        .then(r => r.json())
        .then(data => {
          framesData.current[room.id] = data;
          cooldowns.current[room.id]  = false;
          roomStartTimes.current[room.id] = performance.now();
        })
        .catch(() => { /* 백엔드 미실행 시 무시 */ });
    });
  }, []);

  // ── 300ms마다 현재 프레임 계산 후 낙상 감지 ─────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      ROOMS.forEach(room => {
        const frames = framesData.current[room.id];
        const startedAt = roomStartTimes.current[room.id];
        if (!frames || frames.length === 0 || startedAt == null) return;

        // performance.now() 기반 경과 시간 → 프레임 인덱스 계산
        // setInterval이 백그라운드에서 1fps로 쓰로틀돼도 타이밍 정확
        const elapsedSec = (performance.now() - startedAt) / 1000;
        const totalFrames = frames.length;
        const idx = Math.floor(elapsedSec * FPS) % totalFrames;
        const previousIdx = previousFrameIndices.current[room.id];
        previousFrameIndices.current[room.id] = idx;

        // 영상 분석 시간이 마지막 프레임에서 첫 프레임으로 돌아오면
        // 이전 재생 회차의 낙상 알림과 쿨다운을 즉시 해제한다.
        if (previousIdx != null && idx < previousIdx) {
          cooldowns.current[room.id] = false;
          if (activeAlertRoomId.current === room.id) {
            clearFallAlert(room.name);
          }
          return;
        }

        if (cooldowns.current[room.id]) return;

        // 루프 시작 직후 침대 구간: WINDOW 미확보 → 스킵 (오탐 방지)
        if (idx < WINDOW) return;

        // 현재 프레임 bounding box 비율
        const currBox = frames[idx]?.boxes?.[0];
        if (!currBox) return;
        const currRatio = (currBox[2] - currBox[0]) / (currBox[3] - currBox[1]);
        if (currRatio <= FALLEN_MIN) return; // 아직 서있음 → 스킵

        // 직전 WINDOW 프레임 중 최소 비율 계산
        let minPrev = Infinity;
        for (let i = idx - WINDOW; i < idx; i++) {
          const box = frames[i]?.boxes?.[0];
          if (!box) continue;
          const r = (box[2] - box[0]) / (box[3] - box[1]);
          if (r < minPrev) minPrev = r;
        }

        // 직전에 서있었고(minPrev < 1.2) + 지금 누워있으면(curr > 1.8) → 낙상
        if (minPrev < UPRIGHT_MAX) {
          cooldowns.current[room.id] = true;
          activeAlertRoomId.current = room.id;
          setGlobalAlert(`${room.name} ${room.patient} 낙상 감지!`);
          setAlertRoomName(room.name); // 배너 클릭 시 빠른기록 모달 오픈에 사용
          if (alertTimeout.current) clearTimeout(alertTimeout.current);
          alertTimeout.current = setTimeout(
            () => clearFallAlert(room.name),
            COOLDOWN_MS
          );
        }
      });
    }, CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      if (alertTimeout.current) clearTimeout(alertTimeout.current);
    };
  }, [clearFallAlert]);

  return (
    <FallAlertContext.Provider value={{
      globalAlert,
      setGlobalAlert,
      clearFallAlert,
      resetFallAlertForVideoLoop,
      pendingFallRoom,
      setPendingFallRoom,
      alertRoomName,
    }}>
      {children}
    </FallAlertContext.Provider>
  );
}

export const useFallAlert = () => useContext(FallAlertContext);
