import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDocumentStore } from '../stores/documentStore';
import NotificationDropdown from './NotificationDropdown';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, refreshUser } = useAuthStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // 검토 대기 문서 개수 계산
  const reviewCount = useMemo(() => {
    if (!user?.hasFolderAccess || !isAuthenticated) return 0;
    
    return documents.filter(doc => 
      doc.status === 'REVIEWING' && 
      doc.tasks?.some(task => 
        task.role === 'REVIEWER' && 
        task.assignedUserEmail === user.email
      )
    ).length;
  }, [documents, user, isAuthenticated]);

  // 로그인 상태이고 user가 없거나 필요한 정보가 없을 때 refreshUser 호출
  useEffect(() => {
    if (isAuthenticated && (!user || user.hasFolderAccess === undefined)) {
      console.log('Layout: User or hasFolderAccess missing, refreshing user...');
      refreshUser();
    }
  }, [isAuthenticated, user, refreshUser]);

  // 관리자인 경우 문서 목록 로드 (검토 개수 표시를 위해)
  useEffect(() => {
    if (isAuthenticated && user?.hasFolderAccess) {
      fetchDocuments();
    }
  }, [isAuthenticated, user?.hasFolderAccess, fetchDocuments]);

  const navigation = useMemo(() => {
    const base = [
      { name: '대시보드', href: '/tasks' },
      { name: '템플릿', href: '/templates' },
    ];

    // 관리자가 아닌 경우에만 문서 메뉴 표시
    if (user?.hasFolderAccess !== true) {
      base.push({ name: '문서', href: '/documents' });
    }

    // 관리자인 경우 검토, 폴더 메뉴 추가
    if (user?.hasFolderAccess === true) {
      base.push({ name: '검토', href: '/review' });
      base.push({ name: '폴더', href: '/folders' });
    }

    return base;
  }, [user?.hasFolderAccess]);
  useEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight ?? 0;
      setHeaderHeight(height);
    };

    updateHeaderHeight();

    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const height = headerRef.current?.offsetHeight ?? 0;
      setHeaderHeight(height);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, navigation.length]);


  // position에 따라 로고 결정
  const getLogoPath = () => {
    if (!user?.position) return '/CoWorks_admin.jpeg';

    switch (user.position) {
      case '학생':
        return '/CoWorks_Student.jpeg';
      case '교수':
        return '/CoWorks_Professor.jpeg';
      case '교직원':
        return '/CoWorks_Staff.jpeg';
      default:
        return '/CoWorks_admin.jpeg';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowUserMenu(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - 고정 위치 */}
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b overflow-visible">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center gap-4 py-4 md:flex-nowrap md:justify-between overflow-visible">
            <div className="flex w-full items-center justify-between md:w-auto md:justify-start">
              <Link to={'/tasks'} className="flex items-center">
                <img 
                  src={getLogoPath()} 
                  alt="CoWorks Logo" 
                  className="h-14 w-auto"
                />
              </Link>

              {/* {isAuthenticated && (
                <div className="flex items-center gap-3 md:hidden">
                  <NotificationDropdown />
                </div>
              )} */}
            </div>
            
            {isAuthenticated && (
              <nav className="order-3 flex w-full gap-3 rounded-md bg-gray-50 px-2 py-2 text-sm font-medium text-gray-600 md:order-none md:w-auto md:bg-transparent md:px-0 md:py-0 md:text-base md:text-gray-600">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`whitespace-nowrap px-3 py-2 rounded-md transition-colors relative ${
                      location.pathname.startsWith(item.href)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.name}
                    {item.name === '검토' && reviewCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[20px] z-[100] shadow-sm">
                        {reviewCount}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-4 md:flex-none">
              {/* {isAuthenticated && (
                <div className="hidden md:block">
                  <NotificationDropdown />
                </div>
              )} */}
              
              {isAuthenticated ? (
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 text-sm rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium">
                        {user?.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <span className="font-medium">{user?.name}</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                          <p className="text-sm text-gray-500">{user?.email}</p>
                          <p className="text-xs text-gray-400 mt-1">{user?.position}</p>
                        </div>
                        
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          로그아웃
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    to="/login"
                    className="btn btn-secondary text-sm"
                  >
                    로그인
                  </Link>
                  <Link
                    to="/signup"
                    className="btn btn-primary text-sm"
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 사용자 메뉴 클릭 외부 클릭 시 닫기 */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}

      {/* Main content - 헤더 높이만큼 상단 여백 추가 */}
      <main
        className="w-full py-8 flex-1"
        style={{ paddingTop: headerHeight }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout; 