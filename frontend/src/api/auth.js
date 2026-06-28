import api from './axiosInstance';

function persistSession(data) {
  localStorage.setItem('accessToken',  data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('wardId',       data.wardId);
  localStorage.setItem('userId',       data.userId);
  if (data.username) localStorage.setItem('username', data.username);
  if (data.name)     localStorage.setItem('userName', data.name);
  if (data.role)     localStorage.setItem('userRole', data.role);
}

export async function login(username, password) {
  const { data } = await api.post('/api/auth/login', { username, password });
  persistSession(data.data);
  return data.data;
}

/**
 * 회원가입 — 사번/이메일·비밀번호·이름·역할(간호사/의사)을 받아 계정을 생성하고
 * 성공 시 곧바로 로그인 처리한다 (백엔드가 회원가입과 동시에 토큰을 발급).
 */
export async function register({ username, password, name, role, wardId }) {
  const { data } = await api.post('/api/auth/register', { username, password, name, role, wardId });
  persistSession(data.data);
  return data.data;
}

/**
 * 긴급 접근 — 별도 입력 없이 사전에 준비된 응급 전용 계정으로 즉시 로그인한다.
 * 로그인 성공 시 세션에 emergencyAccess 플래그를 남겨 화면에 긴급 모드 표시를 띄운다.
 */
export async function emergencyAccess() {
  const data = await login('emergency', 'emergency119');
  sessionStorage.setItem('emergencyAccess', 'true');
  return data;
}

export async function logout() {
  await api.post('/api/auth/logout');
  localStorage.clear();
  sessionStorage.removeItem('emergencyAccess');
  window.location.href = '/';
}

export function isLoggedIn() {
  return !!localStorage.getItem('accessToken');
}

export function isEmergencyAccess() {
  return sessionStorage.getItem('emergencyAccess') === 'true';
}

/** 마이페이지 — 내 정보 조회 */
export async function getMyInfo() {
  const { data } = await api.get('/api/users/me');
  return data.data;
}

/** 마이페이지 — 이름/비밀번호 수정 */
export async function updateMyInfo({ name, currentPassword, newPassword }) {
  const { data } = await api.put('/api/users/me', { name, currentPassword, newPassword });
  // 이름이 바뀌었을 수 있으니 로컬 표시값도 갱신
  if (data?.data?.name) localStorage.setItem('userName', data.data.name);
  return data.data;
}
