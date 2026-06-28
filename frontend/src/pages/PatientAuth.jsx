import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register, emergencyAccess } from '../api/auth';

const ROLE_OPTIONS = [
  { value: 'NURSE',  label: '간호사' },
  { value: 'DOCTOR', label: '의사' },
];

const PatientAuth = () => {
  const navigate = useNavigate();

  // 'login' | 'register'
  const [mode, setMode] = useState('login');

  /* ---------- 로그인 폼 상태 ---------- */
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /* ---------- 회원가입 폼 상태 ---------- */
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regRole, setRegRole] = useState('NURSE');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ---------- 긴급 접근 모달 상태 ---------- */
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  /* ---------- 로그인 제출 ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError('사번(또는 이메일)과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch {
      setError('사번/이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 회원가입 제출 ---------- */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!regName.trim() || !regUsername.trim() || !regPassword || !regPasswordConfirm) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }
    if (regPassword.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: regUsername.trim(),
        password: regPassword,
        name: regName.trim(),
        role: regRole,
      });
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || '회원가입에 실패했습니다. 입력 정보를 확인해 주세요.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 긴급 접근 ---------- */
  const handleEmergencyConfirm = async () => {
    setEmergencyLoading(true);
    setEmergencyError('');
    try {
      await emergencyAccess();
      navigate('/dashboard');
    } catch {
      setEmergencyError('긴급 접근에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setEmergencyLoading(false);
    }
  };

  return (
    <main className="relative flex items-center justify-center min-h-screen w-full bg-[#f8f9fa] p-6 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-[#e2e8f0]/40 blur-[100px] -z-10" />

      {/* 카드 */}
      <div className="w-full max-w-[440px] bg-white rounded-[2.5rem] p-10 sm:p-12 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.12)]">

        {/* 브랜딩 */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#00478d] flex items-center justify-center shadow-lg shadow-[#00478d]/20 mb-5">
            <span className="material-symbols-outlined text-white text-3xl">monitor_heart</span>
          </div>
          <span className="text-[#00478d] font-black text-2xl tracking-tighter uppercase">ANON-CARE</span>
          <p className="text-[#697077] text-sm font-medium mt-2">
            {mode === 'login' ? '병동 모니터링 시스템에 로그인하세요' : '의료진 계정을 새로 만들어 보세요'}
          </p>
        </div>

        {mode === 'login' ? (
          <>
            {/* 로그인 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">
                  사번 또는 이메일
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                    badge
                  </span>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="예) 20260612 또는 name@hospital.com"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f1f3f6] border border-transparent text-[#1a1c1e] font-medium placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:border-[#00478d] focus:outline-none focus:ring-4 focus:ring-[#00478d]/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">
                  비밀번호
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                    lock
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full h-14 pl-12 pr-12 rounded-2xl bg-[#f1f3f6] border border-transparent text-[#1a1c1e] font-medium placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:border-[#00478d] focus:outline-none focus:ring-4 focus:ring-[#00478d]/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00478d] transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <p className="text-[#940010] text-sm font-bold text-center bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl py-3 px-4">
                  {error}
                </p>
              )}

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-lg font-black shadow-lg transition-all
                  ${loading
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#00478d] text-white hover:bg-[#00355f] active:scale-[0.98] shadow-[#00478d]/25'}`}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    확인 중입니다...
                  </>
                ) : (
                  <>
                    로그인
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* 보조 옵션 */}
            <div className="flex items-center justify-between mt-5 px-1">
              <label className="flex items-center gap-2 text-xs font-medium text-[#697077] cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded accent-[#00478d]" />
                로그인 상태 유지
              </label>
              <button type="button" className="text-xs font-bold text-[#00478d] hover:underline">
                비밀번호를 잊으셨나요?
              </button>
            </div>

            {/* 회원가입 안내 */}
            <p className="text-center text-sm font-medium text-[#697077] mt-6">
              아직 계정이 없으신가요?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-black text-[#00478d] hover:underline"
              >
                회원가입
              </button>
            </p>

            {/* 구분선 */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">또는</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* 빠른 접근 옵션 */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setEmergencyError(''); setShowEmergencyModal(true); }}
                className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 bg-[#ffdad6]/70 border border-[#ffdad6] text-[#940010] font-black hover:bg-[#ffdad6] transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-xl">warning</span>
                긴급 접근
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-400 font-medium mt-8">
              © 2026 ANON-CARE · 의료진 전용 모니터링 시스템
            </p>
          </>
        ) : (
          <>
            {/* 회원가입 폼 */}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label htmlFor="regName" className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">
                  이름
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                    person
                  </span>
                  <input
                    id="regName"
                    type="text"
                    autoComplete="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="실명을 입력하세요"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f1f3f6] border border-transparent text-[#1a1c1e] font-medium placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:border-[#00478d] focus:outline-none focus:ring-4 focus:ring-[#00478d]/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="regUsername" className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">
                  사번 또는 이메일
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                    badge
                  </span>
                  <input
                    id="regUsername"
                    type="text"
                    autoComplete="username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="예) 20260612 또는 name@hospital.com"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f1f3f6] border border-transparent text-[#1a1c1e] font-medium placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:border-[#00478d] focus:outline-none focus:ring-4 focus:ring-[#00478d]/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">역할</label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRegRole(opt.value)}
                      className={`h-14 rounded-2xl flex items-center justify-center gap-2 font-bold border transition-all active:scale-[0.98]
                        ${regRole === opt.value
                          ? 'bg-[#00478d] border-[#00478d] text-white shadow-lg shadow-[#00478d]/20'
                          : 'bg-[#f1f3f6] border-transparent text-[#697077] hover:bg-gray-100'}`}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {opt.value === 'NURSE' ? 'health_and_safety' : 'medical_services'}
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="regPassword" className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">
                  비밀번호
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                    lock
                  </span>
                  <input
                    id="regPassword"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="4자 이상 입력하세요"
                    className="w-full h-14 pl-12 pr-12 rounded-2xl bg-[#f1f3f6] border border-transparent text-[#1a1c1e] font-medium placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:border-[#00478d] focus:outline-none focus:ring-4 focus:ring-[#00478d]/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00478d] transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showRegPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="regPasswordConfirm" className="block text-xs font-bold text-[#424752] mb-2 ml-1 tracking-wide">
                  비밀번호 확인
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                    lock_reset
                  </span>
                  <input
                    id="regPasswordConfirm"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    placeholder="비밀번호를 한 번 더 입력하세요"
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-[#f1f3f6] border border-transparent text-[#1a1c1e] font-medium placeholder:text-gray-400 placeholder:font-normal focus:bg-white focus:border-[#00478d] focus:outline-none focus:ring-4 focus:ring-[#00478d]/10 transition-all"
                  />
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <p className="text-[#940010] text-sm font-bold text-center bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl py-3 px-4">
                  {error}
                </p>
              )}

              {/* 회원가입 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-lg font-black shadow-lg transition-all
                  ${loading
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#00478d] text-white hover:bg-[#00355f] active:scale-[0.98] shadow-[#00478d]/25'}`}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    계정을 만드는 중입니다...
                  </>
                ) : (
                  <>
                    회원가입
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* 로그인으로 전환 */}
            <p className="text-center text-sm font-medium text-[#697077] mt-6">
              이미 계정이 있으신가요?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-black text-[#00478d] hover:underline"
              >
                로그인
              </button>
            </p>

            <p className="text-center text-[11px] text-gray-400 font-medium mt-8">
              © 2026 ANON-CARE · 의료진 전용 모니터링 시스템
            </p>
          </>
        )}
      </div>

      {/* 긴급 접근 확인 모달 */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-[400px] bg-white rounded-[2rem] p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#ffdad6] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#940010] text-3xl">warning</span>
              </div>
              <h3 className="text-lg font-black text-[#191c1d]">긴급 접근을 사용하시겠습니까?</h3>
              <p className="text-sm font-medium text-[#697077] mt-2 leading-relaxed">
                긴급 접근은 본인 계정 없이 응급 전용 계정으로 즉시 접속합니다.
                반드시 의료 응급 상황에서만 사용해 주세요. 접속 기록은 시스템에 남습니다.
              </p>
            </div>

            {emergencyError && (
              <p className="text-[#940010] text-sm font-bold text-center bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl py-3 px-4 mb-4">
                {emergencyError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                disabled={emergencyLoading}
                className="flex-1 h-14 rounded-2xl flex items-center justify-center font-bold border border-gray-200 text-[#1a1c1e] hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleEmergencyConfirm}
                disabled={emergencyLoading}
                className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg transition-all active:scale-[0.98]
                  ${emergencyLoading
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#940010] text-white hover:bg-[#7a000d] shadow-[#940010]/25'}`}
              >
                {emergencyLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    접속 중...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">login</span>
                    긴급 접속
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default PatientAuth;
