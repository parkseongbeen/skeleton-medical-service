import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import PatientAuth    from './pages/PatientAuth';
import Dashboard      from './pages/Dashboard';
import DetailedData   from './pages/DetailedData';
import CCTV           from './pages/CCTV';
import BulkVitalEntry from './pages/BulkVitalEntry';
import Profile        from './pages/Profile';
import { FallAlertProvider, useFallAlert } from './context/FallAlertContext';
import { WebSocketAlertProvider, useWebSocketAlert, ALERT_TYPE_LABELS, SEVERITY_STYLES } from './context/WebSocketAlertContext';

/**
 * 낙상 감지 전역 알림 배너
 *
 * - Router 내부에 위치시켜 useNavigate 사용 가능
 * - 클릭 시 해당 병실 CCTV로 바로 이동
 */
function GlobalFallAlert() {
  const { globalAlert, alertRoomName } = useFallAlert();
  const location = useLocation();
  const navigate = useNavigate();

  if (!globalAlert || location.pathname === '/') return null;

  const handleClick = () => {
    navigate('/cctv', { state: { roomName: alertRoomName } });
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] cursor-pointer"
      onClick={handleClick}
    >
      <div className="bg-red-600 text-white px-10 py-5 rounded-2xl shadow-2xl
                      text-xl font-black flex items-center gap-3 animate-bounce">
        ⚠️ {globalAlert}
        <span className="text-sm font-semibold opacity-75 ml-1">→ CCTV 확인</span>
      </div>
    </div>
  );
}

/**
 * 백엔드 WebSocket 알림 배너 (낙상 외: 움직임 없음, 투약 시간 초과 등)
 *
 * - GlobalFallAlert(중앙)와 겹치지 않도록 화면 우측 상단에 표시
 */
function GlobalWsAlert() {
  const { latestAlert, setLatestAlert } = useWebSocketAlert();

  if (!latestAlert) return null;

  const label = ALERT_TYPE_LABELS[latestAlert.type] ?? latestAlert.type;
  const colorClass = SEVERITY_STYLES[latestAlert.severity] ?? 'bg-gray-700';

  return (
    <div className="fixed top-4 right-4 z-[9999] cursor-pointer" onClick={() => setLatestAlert(null)}>
      <div className={`${colorClass} text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-black flex flex-col gap-1 max-w-xs`}>
        <span>⚠️ {label}</span>
        <span className="text-xs font-semibold opacity-90">
          {latestAlert.bedNumber} {latestAlert.patientName} — {latestAlert.message}
        </span>
      </div>
    </div>
  );
}

/** Router 내부에 두어 useNavigate를 쓸 수 있도록 분리 */
function AppContent() {
  return (
    <>
      <GlobalFallAlert />
      <GlobalWsAlert />
      <Routes>
        <Route path="/"             element={<PatientAuth />}    />
        <Route path="/dashboard"    element={<Dashboard />}      />
        <Route path="/details"      element={<DetailedData />}   />
        <Route path="/cctv"         element={<CCTV />}           />
        <Route path="/bulk-vitals"  element={<BulkVitalEntry />} />
        <Route path="/profile"      element={<Profile />}        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <FallAlertProvider>
      <WebSocketAlertProvider>
        <Router>
          <AppContent />
        </Router>
      </WebSocketAlertProvider>
    </FallAlertProvider>
  );
}

export default App;
