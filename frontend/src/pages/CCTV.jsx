import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useFallAlert } from '../context/FallAlertContext';
import {
  classifyPosture,
  createFallSuspicionTracker,
  POSTURE_META,
  POSTURE_UNKNOWN,
} from '../utils/postureClassifier';

// COCO 17관절 연결선 정의
const SKELETON_EDGES = [
  [0, 1], [0, 2],
  [1, 3], [2, 4],
  [5, 6],
  [5, 7], [7, 9],
  [6, 8], [8, 10],
  [5, 11], [6, 12],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
];

const ROOMS = [
  {
    id: 1,
    name: '301호',
    patient: '환자 A',
    videoUrl: 'http://localhost:8080/videos/room1.mp4',
    skeletonUrl: 'http://localhost:8080/skeleton/room1.json',
  },
  {
    id: 2,
    name: '302호',
    patient: '환자 B',
    videoUrl: 'http://localhost:8080/videos/room2.mp4',
    skeletonUrl: 'http://localhost:8080/skeleton/room2.json',
  },
  {
    id: 3,
    name: '303호',
    patient: '환자 C',
    videoUrl: 'http://localhost:8080/videos/data_3_pose_h264.mp4',
    skeletonUrl: 'http://localhost:8080/videos/data_3_pose_detection_3.json',
  },
  {
    id: 4,
    name: '304호',
    patient: '환자 D',
    videoUrl: 'http://localhost:8080/videos/data_4_pose_h264.mp4',
    skeletonUrl: 'http://localhost:8080/videos/data_4_pose_detection_3.json',
  },
];


const CCTV = () => {
  const location = useLocation();
  const { resetFallAlertForVideoLoop } = useFallAlert();
  const [isMenuOpen,    setIsMenuOpen]    = useState(false);
  const [selectedRoom,  setSelectedRoom]  = useState(
    () => ROOMS.find(room => room.name === location.state?.roomName) ?? ROOMS[0]
  );
  const [skeletonFrames,setSkeletonFrames]= useState([]);
  const [frameLoading,  setFrameLoading]  = useState(true);
  const [fps,           setFps]           = useState(30);
  const [isMasking,     setIsMasking]     = useState(false); // 프라이버시 마스킹 ON/OFF
  const [aiAnalysisOn,  setAiAnalysisOn]  = useState(true);  // AI 자세·낙상 분석 오버레이 ON/OFF
  const [fallBanner,    setFallBanner]    = useState(null);  // AI가 낙상 의심을 감지했을 때 표시할 배너 텍스트

  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);
  const skeletonRef  = useRef([]);
  const isMaskingRef = useRef(false);   // rAF 클로저 안에서 최신값 읽기 위해 ref 동기화
  const aiAnalysisOnRef = useRef(true); // 위와 동일한 이유로 ref 동기화
  const selectedRoomRef = useRef(selectedRoom); // rAF 클로저에서 최신 방 정보(name/patient)를 읽기 위해 ref 동기화
  const lastKeypointsRef = useRef(null); // 직전에 검출된 keypoints 보관 (검출 누락 프레임에 재사용)
  const lastVideoTimeRef = useRef(-1); // 영상 loop로 재생 시간이 처음으로 돌아갔는지 감지

  /* ── AI 자세 분류 / 낙상 의심 감지 ─────────────────────────────
     - personState: personIdx → { posture, aspectRatio, fallUntil }
     - fallTrackers: personIdx → 자세 이력을 추적하는 createFallSuspicionTracker() 인스턴스
     - lastFrameIdx: 동일 스켈레톤 프레임에서 분류를 중복 실행하지 않기 위한 캐시 */
  const personStateRef  = useRef([]);
  const fallTrackersRef = useRef([]);
  const lastFrameIdxRef = useRef(-1);
  const fallBannerTimeoutRef = useRef(null);

  // isMasking / aiAnalysisOn state → ref 동기화
  useEffect(() => {
    isMaskingRef.current = isMasking;
  }, [isMasking]);

  useEffect(() => {
    aiAnalysisOnRef.current = aiAnalysisOn;
  }, [aiAnalysisOn]);

  // selectedRoom → ref 동기화 (rAF draw 루프 클로저 안에서 최신 방 정보를 안전하게 읽기 위함;
  // draw 루프 useEffect의 deps에 selectedRoom을 추가하면 방 전환 때마다 루프가 불필요하게
  // 재시작되므로, ref로 최신값을 전달하는 기존 isMaskingRef/aiAnalysisOnRef 패턴을 따른다)
  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  // ─── 방이 바뀌면 스켈레톤 JSON 로드 ──────────────────────────
  // (selectedRoom이 바뀔 때 이전 방의 프레임/AI 분석 상태를 초기화한 뒤 새 데이터를 fetch하는
  //  표준적인 "프롭 변경 시 상태 리셋" 패턴이다. 실험적인 set-state-in-effect 규칙이
  //  이 초기화 호출들을 cascading render로 오인해 경고하지만, 매 렌더가 아닌 방 전환 시에만
  //  실행되므로 안전하다.)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrameLoading(true);
    setSkeletonFrames([]);
    skeletonRef.current = [];
    lastKeypointsRef.current = null;   // 방 전환 시 이전 방의 keypoints 잔상 방지
    lastVideoTimeRef.current = -1;
    setFps(30);

    // AI 분석 상태도 방 전환 시 초기화 (다른 방의 자세 이력이 섞이지 않도록)
    personStateRef.current  = [];
    fallTrackersRef.current = [];
    lastFrameIdxRef.current = -1;
    setFallBanner(null);
    if (fallBannerTimeoutRef.current) {
      clearTimeout(fallBannerTimeoutRef.current);
      fallBannerTimeoutRef.current = null;
    }

    fetch(selectedRoom.skeletonUrl)
      .then(res => res.json())
      .then(data => {
        setSkeletonFrames(data);
        skeletonRef.current = data;
        const video = videoRef.current;
        if (video && video.duration) {
          setFps(data.length / video.duration);
        }
        setFrameLoading(false);
      })
      .catch(err => {
        console.error('스켈레톤 좌표 로드 실패:', err);
        setFrameLoading(false);
      });
  }, [selectedRoom]);

  const handleVideoMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (skeletonRef.current.length > 0) {
      setFps(skeletonRef.current.length / video.duration);
    }
  };

  // ─── 프라이버시 실루엣 그리기 ─────────────────────────────────
  /**
   * keypoints 기반으로 보라색 속채움 실루엣을 그린다.
   *
   * [레이어 순서]
   *   ① 몸통 폴리곤 (어깨 + 골반 사각형) — 꽉 찬 보라색
   *   ② 각 신체 부위를 굵기가 다른 캡슐 선으로 덮음
   *   ③ 관절 원으로 선 사이 빈틈 제거
   *   ④ 목 (어깨 중심 → 코) 연결
   *   ⑤ 머리 원 (코·눈·귀 중심에 큰 원)
   *   ⑥ 스켈레톤 선을 밝은 라벤더색으로 위에 올림 → 이미지와 동일한 느낌
   */
  const drawPrivacySilhouette = (ctx, keypoints) => {
    if (!keypoints || keypoints.length < 17) return;

    const valid = (kp) => kp && kp[0] > 0 && kp[1] > 0;

    // 어깨 너비(sw)로 모든 굵기를 비례 계산
    const ls = keypoints[5];   // 왼쪽 어깨
    const rs = keypoints[6];   // 오른쪽 어깨
    let sw = 100;
    if (valid(ls) && valid(rs)) {
      sw = Math.max(60, Math.hypot(ls[0] - rs[0], ls[1] - rs[1]));
    }

    const PURPLE = '#9B30D0';                         // 메인 보라색
    const LINE   = 'rgba(230, 180, 255, 0.85)';       // 위에 올릴 밝은 라벤더 선

    ctx.shadowColor = 'rgba(140, 40, 200, 0.45)';
    ctx.shadowBlur  = 22;

    // ── ① 몸통 폴리곤 (어깨 ↔ 골반 사각형) ──────────────────
    const lh = keypoints[11];
    const rh = keypoints[12];
    if (valid(ls) && valid(rs) && valid(lh) && valid(rh)) {
      ctx.fillStyle = PURPLE;
      ctx.beginPath();
      ctx.moveTo(ls[0], ls[1]);
      ctx.lineTo(rs[0], rs[1]);
      ctx.lineTo(rh[0], rh[1]);
      ctx.lineTo(lh[0], lh[1]);
      ctx.closePath();
      ctx.fill();
    }

    // ── ② 신체 부위별 캡슐 선 (굵기 차등) ───────────────────
    //  [관절i, 관절j, lineWidth (sw 비례)]
    const limbs = [
      [5,  6,  sw * 0.30],   // 어깨 연결
      [5,  7,  sw * 0.38],   // 왼쪽 상완
      [7,  9,  sw * 0.33],   // 왼쪽 전완
      [6,  8,  sw * 0.38],   // 오른쪽 상완
      [8,  10, sw * 0.33],   // 오른쪽 전완
      [5,  11, sw * 0.25],   // 왼쪽 옆구리
      [6,  12, sw * 0.25],   // 오른쪽 옆구리
      [11, 12, sw * 0.30],   // 골반 연결
      [11, 13, sw * 0.44],   // 왼쪽 허벅지
      [13, 15, sw * 0.36],   // 왼쪽 종아리
      [12, 14, sw * 0.44],   // 오른쪽 허벅지
      [14, 16, sw * 0.36],   // 오른쪽 종아리
    ];

    ctx.strokeStyle = PURPLE;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    limbs.forEach(([i, j, w]) => {
      if (!valid(keypoints[i]) || !valid(keypoints[j])) return;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(keypoints[i][0], keypoints[i][1]);
      ctx.lineTo(keypoints[j][0], keypoints[j][1]);
      ctx.stroke();
    });

    // 손목·발목에서 선이 끝나며 손과 발이 노출되지 않도록,
    // 마지막 관절 방향으로 짧게 연장한다. 신체 전체 굵기는 키우지 않는다.
    [
      [7,  9,  sw * 0.33, sw * 0.24], // 왼손
      [8,  10, sw * 0.33, sw * 0.24], // 오른손
      [13, 15, sw * 0.36, sw * 0.30], // 왼발
      [14, 16, sw * 0.36, sw * 0.30], // 오른발
    ].forEach(([fromIdx, endIdx, width, maxExtension]) => {
      const from = keypoints[fromIdx];
      const end = keypoints[endIdx];
      if (!valid(from) || !valid(end)) return;

      const dx = end[0] - from[0];
      const dy = end[1] - from[1];
      const length = Math.hypot(dx, dy);
      if (length === 0) return;

      const extension = Math.min(maxExtension, length * 0.3);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(
        end[0] + (dx / length) * extension,
        end[1] + (dy / length) * extension
      );
      ctx.stroke();
    });

    // ── ③ 관절 원 (선 사이 빈틈 제거) ───────────────────────
    ctx.fillStyle = PURPLE;
    [
      [5,  sw * 0.17], [6,  sw * 0.17],   // 어깨
      [7,  sw * 0.20], [8,  sw * 0.20],   // 팔꿈치
      [9,  sw * 0.18], [10, sw * 0.18],   // 손목
      [11, sw * 0.17], [12, sw * 0.17],   // 골반
      [13, sw * 0.23], [14, sw * 0.23],   // 무릎
      [15, sw * 0.20], [16, sw * 0.20],   // 발목
    ].forEach(([idx, r]) => {
      if (!valid(keypoints[idx])) return;
      ctx.beginPath();
      ctx.arc(keypoints[idx][0], keypoints[idx][1], r, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── ④ 목 (어깨 중심 → 코) ───────────────────────────────
    if (valid(ls) && valid(rs) && valid(keypoints[0])) {
      const nx = (ls[0] + rs[0]) / 2;
      const ny = (ls[1] + rs[1]) / 2;
      ctx.strokeStyle = PURPLE;
      ctx.lineWidth   = sw * 0.20;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(keypoints[0][0], keypoints[0][1]);
      ctx.stroke();
    }

    // ── ⑤ 머리 (코·눈·귀 평균 위치에 원) ──────────────────
    const faceKps = [0, 1, 2, 3, 4].map(i => keypoints[i]).filter(valid);
    if (faceKps.length > 0) {
      const cx = faceKps.reduce((s, p) => s + p[0], 0) / faceKps.length;
      const cy = faceKps.reduce((s, p) => s + p[1], 0) / faceKps.length;
      ctx.fillStyle = PURPLE;
      ctx.beginPath();
      ctx.arc(cx, cy, sw * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // ── ⑥ 스켈레톤 선 — 밝은 라벤더색으로 실루엣 위에 올림 ─
    ctx.strokeStyle = LINE;
    ctx.lineWidth   = Math.max(1.5, sw * 0.015);
    ctx.lineCap     = 'round';

    SKELETON_EDGES.forEach(([i, j]) => {
      if (!valid(keypoints[i]) || !valid(keypoints[j])) return;
      ctx.beginPath();
      ctx.moveTo(keypoints[i][0], keypoints[i][1]);
      ctx.lineTo(keypoints[j][0], keypoints[j][1]);
      ctx.stroke();
    });
  };

  // ─── 스켈레톤 그리기 ───────────────────────────────────────────
  // (useEffect의 draw 루프보다 먼저 선언 — 참조 시점에 이미 선언되어 있어야 함)
  function drawSkeleton(ctx, keypoints, personIdx) {
    if (!keypoints || keypoints.length < 17) return;

    const colors = ['#00ff88', '#ff6b6b', '#66b3ff'];
    const color  = colors[personIdx % colors.length];

    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;

    SKELETON_EDGES.forEach(([i, j]) => {
      const kpI = keypoints[i];
      const kpJ = keypoints[j];
      if (!kpI || !kpJ) return;
      const [x1, y1] = kpI;
      const [x2, y2] = kpJ;
      if (x1 > 0 && y1 > 0 && x2 > 0 && y2 > 0) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    });

    ctx.fillStyle  = color;
    ctx.shadowBlur = 0;
    keypoints.forEach(kp => {
      if (!kp) return;
      const [x, y] = kp;
      if (x > 0 && y > 0) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // ─── AI 자세 분석 라벨 그리기 ───────────────────────────────────
  /**
   * personStateRef에 캐시된 분류 결과(posture/aspectRatio/fallUntil)를 바탕으로
   * 사람의 머리 위에 "🧍 서 있음" 같은 라벨 배지를 그리고, 낙상 의심 상태이면
   * 빨간 경고 테두리 + "⚠ 낙상 의심" 배지를 함께 강조해서 그린다.
   *
   * (useEffect의 draw 루프보다 먼저 선언 — 참조 시점에 이미 선언되어 있어야 함)
   */
  function drawPostureLabel(ctx, keypoints, state) {
    if (!keypoints || keypoints.length < 17 || !state) return;

    const valid = (kp) => Array.isArray(kp) && kp[0] > 0 && kp[1] > 0;
    const pts = keypoints.filter(valid);
    if (pts.length === 0) return;

    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);

    const isFallSuspected = state.fallUntil && Date.now() < state.fallUntil;
    const meta = POSTURE_META[state.posture] ?? POSTURE_META[POSTURE_UNKNOWN];

    const labelText = isFallSuspected ? '⚠ 낙상 의심' : `${meta.emoji} ${meta.label}`;
    const bgColor   = isFallSuspected ? '#dc2626' : meta.color;

    ctx.font = 'bold 22px "Pretendard", "Apple SD Gothic Neo", sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    const paddingX  = 16;
    const badgeW    = textWidth + paddingX * 2;
    const badgeH    = 40;
    const badgeX    = Math.max(0, (minX + maxX) / 2 - badgeW / 2);
    const badgeY    = Math.max(0, minY - badgeH - 14);

    // 배지 배경 (낙상 의심 시 깜빡임 효과)
    const blink = isFallSuspected ? (Math.sin(Date.now() / 150) + 1) / 2 : 1; // 0~1
    ctx.globalAlpha = isFallSuspected ? 0.55 + blink * 0.45 : 0.88;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 배지 텍스트
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

    // 낙상 의심: 사람 전체를 감싸는 경고 테두리 추가
    if (isFallSuspected) {
      const minYAll = Math.min(...ys);
      const maxYAll = Math.max(...ys);
      const pad = 24;
      ctx.globalAlpha = 0.5 + blink * 0.5;
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(minX - pad, minYAll - pad, (maxX - minX) + pad * 2, (maxYAll - minYAll) + pad * 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 텍스트 정렬 기본값 복원 (다른 그리기 함수에 영향 주지 않도록)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ─── rAF 그리기 루프 ────────────────────────────────────────────
  useEffect(() => {
    if (frameLoading || skeletonFrames.length === 0) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');

    const draw = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (vw && vh) {
        canvas.width  = vw;
        canvas.height = vh;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const frames        = skeletonRef.current;
      const currentFps    = fps > 0 ? fps : 30;
      const previousVideoTime = lastVideoTimeRef.current;
      const videoLooped = previousVideoTime >= 0
        && video.currentTime < previousVideoTime - 0.5;
      lastVideoTimeRef.current = video.currentTime;

      if (videoLooped) {
        personStateRef.current = [];
        fallTrackersRef.current = [];
        lastFrameIdxRef.current = -1;
        lastKeypointsRef.current = null;
        setFallBanner(null);
        if (fallBannerTimeoutRef.current) {
          clearTimeout(fallBannerTimeoutRef.current);
          fallBannerTimeoutRef.current = null;
        }
        resetFallAlertForVideoLoop(selectedRoomRef.current.name);
      }

      const currentFrameIdx = Math.min(
        Math.round(video.currentTime * currentFps),
        frames.length - 1
      );
      const frameData = frames[currentFrameIdx];

      // 검출 누락 프레임(사람 keypoints가 없는 프레임) 보정:
      //   마스킹 ON 상태에서 한 프레임이라도 keypoints가 비면
      //   그 순간 보라색 실루엣이 사라져 원본 영상(얼굴)이 그대로 노출된다.
      //   → 직전에 검출된 keypoints를 잠깐 이어서 사용해 빈틈을 메운다.
      let keypointsToDraw = frameData?.keypoints;
      if (isMaskingRef.current) {
        if (keypointsToDraw && keypointsToDraw.length > 0) {
          lastKeypointsRef.current = keypointsToDraw;
        } else if (lastKeypointsRef.current) {
          keypointsToDraw = lastKeypointsRef.current;
        }
      }

      // ── AI 자세 분류 / 낙상 의심 감지 ──
      // 같은 스켈레톤 프레임에서 매 rAF마다 중복 분석하지 않도록, 프레임 인덱스가
      // 바뀐 시점에만 keypoints를 분석해 personStateRef에 캐시해둔다. (그려질 때는
      // 매 프레임 캐시된 결과를 사용 → 60fps로 그려도 분석은 스켈레톤 fps만큼만 수행)
      if (aiAnalysisOnRef.current && keypointsToDraw && currentFrameIdx !== lastFrameIdxRef.current) {
        lastFrameIdxRef.current = currentFrameIdx;

        keypointsToDraw.forEach((personKeypoints, personIdx) => {
          const { posture, aspectRatio } = classifyPosture(personKeypoints);

          if (!fallTrackersRef.current[personIdx]) {
            fallTrackersRef.current[personIdx] = createFallSuspicionTracker();
          }
          const fallDetectedNow = fallTrackersRef.current[personIdx](posture);

          const prevState = personStateRef.current[personIdx];
          const fallUntil = fallDetectedNow
            ? Date.now() + 6000 // 6초간 "낙상 의심" 시각 강조 유지
            : (prevState?.fallUntil ?? 0);

          personStateRef.current[personIdx] = { posture, aspectRatio, fallUntil };

          if (fallDetectedNow) {
            const room = selectedRoomRef.current;
            const roomLabel = `${room.name} · ${room.patient}`;
            setFallBanner(`⚠️ AI 낙상 의심 감지 — ${roomLabel} (자세 변화 패턴 분석 결과)`);
            if (fallBannerTimeoutRef.current) clearTimeout(fallBannerTimeoutRef.current);
            fallBannerTimeoutRef.current = setTimeout(() => setFallBanner(null), 6000);
          }
        });
      }

      if (keypointsToDraw) {
        keypointsToDraw.forEach((personKeypoints, personIdx) => {
          if (isMaskingRef.current) {
            // ── 마스킹 ON: keypoints로 흰색 실루엣 그리기 ──
            drawPrivacySilhouette(ctx, personKeypoints);
          } else {
            // ── 마스킹 OFF: 스켈레톤 선+점 그리기 ──
            drawSkeleton(ctx, personKeypoints, personIdx);
          }

          if (aiAnalysisOnRef.current) {
            drawPostureLabel(ctx, personKeypoints, personStateRef.current[personIdx]);
          }
        });
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [skeletonFrames, fps, frameLoading, resetFallAlertForVideoLoop]);

  return (
    <div className="relative min-h-screen w-screen bg-[#f8f9fa] overflow-x-hidden">
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} active="cctv" />

      <main className="w-full h-screen flex flex-col">
        <Header title="실시간 모니터링" onMenuClick={() => setIsMenuOpen(true)} />

        {/* 방 선택 탭 + 마스킹 버튼 */}
        <div className="flex flex-wrap items-center gap-3 px-8 pt-4">
          {ROOMS.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                selectedRoom.id === room.id
                  ? 'bg-[#00478d] text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {room.name} — {room.patient}
            </button>
          ))}

          {/* AI 자세·낙상 분석 오버레이 토글 버튼 */}
          <button
            onClick={() => setAiAnalysisOn(prev => !prev)}
            className={`ml-auto flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
              aiAnalysisOn
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">smart_toy</span>
            {aiAnalysisOn ? 'AI 자세·낙상 분석 ON' : 'AI 자세·낙상 분석 OFF'}
          </button>

          {/* 프라이버시 마스킹 토글 버튼 */}
          <button
            onClick={() => setIsMasking(prev => !prev)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
              isMasking
                ? 'bg-[#00478d] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {isMasking ? 'visibility_off' : 'visibility'}
            </span>
            {isMasking ? '마스킹 ON' : '마스킹 OFF'}
          </button>
        </div>

        {/* AI 낙상 의심 감지 배너 */}
        {fallBanner && (
          <div className="px-8 pt-4">
            <div className="flex items-center gap-3 bg-red-600 text-white font-black text-sm px-6 py-3 rounded-2xl shadow-xl animate-pulse">
              <span className="material-symbols-outlined">emergency</span>
              {fallBanner}
              <span className="ml-auto text-[11px] font-bold opacity-80 uppercase tracking-widest">
                AI 자세 변화 패턴 분석
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 p-6 overflow-hidden">
          <div className="relative w-full h-full bg-[#1e293b] rounded-[2.5rem] shadow-2xl overflow-hidden border-[10px] border-white">

            {/* LIVE 표시 */}
            <div className="absolute top-6 left-6 flex items-center gap-3 bg-red-600 px-4 py-2 rounded-full shadow-lg z-20 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span className="text-white font-black text-xs tracking-widest uppercase">Live</span>
            </div>

            {/* 방 이름 + 마스킹 상태 표시 */}
            <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
              {aiAnalysisOn && (
                <div className="bg-emerald-600/80 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                  <span className="text-white font-black text-xs tracking-widest">AI 분석 중</span>
                </div>
              )}
              {isMasking && (
                <div className="bg-[#00478d]/80 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-white text-sm">visibility_off</span>
                  <span className="text-white font-black text-xs tracking-widest">PRIVACY</span>
                </div>
              )}
              <div className="bg-black/40 backdrop-blur px-4 py-2 rounded-full">
                <span className="text-white font-bold text-sm">
                  {selectedRoom.name} · {selectedRoom.patient}
                </span>
              </div>
            </div>

            {/* 로딩 표시 */}
            {frameLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <p className="text-white font-bold text-lg animate-pulse">
                  스켈레톤 데이터 로딩 중...
                </p>
              </div>
            )}

            {/* 영상 + 스켈레톤/마스킹 캔버스 */}
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                key={selectedRoom.videoUrl}
                src={selectedRoom.videoUrl}
                className="w-full h-full object-contain"
                autoPlay
                loop
                muted
                onLoadedMetadata={handleVideoMetadata}
              />
              {/*
                캔버스: 마스킹 OFF → 투명 배경 위에 스켈레톤 선+점
                        마스킹 ON  → keypoints 기반 흰색 실루엣 (누군지 식별 불가)
              */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ pointerEvents: 'none' }}
              />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default CCTV;
