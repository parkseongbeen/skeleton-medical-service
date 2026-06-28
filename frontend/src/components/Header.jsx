import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, isEmergencyAccess } from '../api/auth';

const Header = ({ title, onMenuClick }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const userName = localStorage.getItem('userName') || '의료진';
  const userRole = localStorage.getItem('userRole');
  const roleLabel = { NURSE: '간호사', DOCTOR: '의사', ADMIN: '관리자' }[userRole] || '';
  const initial = userName.charAt(0);
  const emergency = isEmergencyAccess();

  // 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <header className="flex justify-between items-center px-8 py-6 bg-white border-b">
      <div className="flex items-center gap-4">
        {/* 햄버거 메뉴 버튼! */}
        <button onClick={onMenuClick} className="material-symbols-outlined text-3xl p-2 hover:bg-gray-100 rounded-full">menu</button>
        <div>
          <h2 className="text-xl font-black text-[#191c1d]">{title}</h2>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {emergency ? (
              <span className="text-[#940010]">🚨 긴급 접근 모드</span>
            ) : (
              <>{userName}{roleLabel && ` · ${roleLabel}`}</>
            )}
          </span>
        </div>
      </div>

      {/* 아바타 — 클릭하면 내 정보 메뉴 */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all
            ${emergency ? 'bg-[#ffdad6] text-[#940010] ring-2 ring-[#ffdad6]' : 'bg-[#00478d] text-white hover:opacity-90'}`}
        >
          {initial}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="font-black text-[#191c1d] text-sm">{userName}</p>
              <p className="text-xs text-gray-400 font-bold mt-0.5">{roleLabel || '의료진'}{emergency && ' · 긴급 접근'}</p>
            </div>
            <button
              onClick={() => { setMenuOpen(false); navigate('/profile'); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-[#424752] hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-xl text-[#00478d]">person</span>
              내 정보 수정
            </button>
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors border-t border-gray-50"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
