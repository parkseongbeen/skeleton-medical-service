import React from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, onClose, active }) => {
  const navigate = useNavigate();

  const goTo = (path) => {
    navigate(path);
    onClose();
  };

  const menuItem = (path, activeKey, icon, label) => (
    <button
      onClick={() => goTo(path)}
      className={`flex items-center gap-4 w-full p-4 rounded-2xl font-bold text-left transition-all
        ${active === activeKey ? 'bg-[#f1f5f9] text-[#00478d]' : 'text-gray-500 hover:bg-gray-50'}`}
    >
      <span className="material-symbols-outlined">{icon}</span>
      {label}
    </button>
  );

  return (
    <>
      {/* 딤 처리 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* 사이드바 본체 */}
      <aside
        className={`fixed left-0 top-0 h-full w-80 bg-white z-50 shadow-2xl
                    transition-transform duration-300 ease-in-out transform
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* 로고 + 닫기 */}
        <div className="p-8 border-b flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-[#00478d]">ANON-CARE</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Medical System</p>
          </div>
          <button
            onClick={onClose}
            className="material-symbols-outlined text-gray-400 hover:text-black transition-colors p-2"
          >
            close
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="p-4 mt-4 space-y-2">
          {menuItem('/dashboard',   'dash',     'dashboard',   '대시보드')}
          {menuItem('/details',     'detailed', 'analytics',   '상세 데이터')}
          {menuItem('/cctv',        'cctv',     'videocam',    'CCTV 모니터링')}
          {menuItem('/bulk-vitals', 'bulk',     'table_chart', '바이탈 일괄 입력')}
          {menuItem('/profile',     'profile',  'person',      '내 정보 수정')}
        </nav>

        {/* 하단 로그아웃 */}
        <div className="absolute bottom-8 left-0 w-full px-8">
          <button
            onClick={() => goTo('/')}
            className="flex items-center gap-3 text-gray-400 font-bold text-sm hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            시스템 종료 (로그아웃)
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
