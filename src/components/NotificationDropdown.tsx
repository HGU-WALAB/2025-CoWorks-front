import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, type NotificationData } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';

const NotificationDropdown: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    totalCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    deleteNotification,
    deleteAllNotifications,
    connectSSE,
    disconnectSSE,
  } = useNotificationStore();

  const { setAuthHeader } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(unreadCount);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // unreadCount 변화를 즉시 감지하여 표시 업데이트
  useEffect(() => {
    console.log('unreadCount 변화 감지:', unreadCount);
    setDisplayCount(unreadCount);
  }, [unreadCount]);

  // 컴포넌트 마운트 시 인증 헤더 설정 및 초기 데이터 로드
  useEffect(() => {
    setAuthHeader(); // 인증 헤더 설정
    fetchUnreadCount();
    connectSSE();

    return () => {
      disconnectSSE();
    };
  }, [setAuthHeader, fetchUnreadCount, connectSSE, disconnectSSE]);

  // 드롭다운 열 때 알림 목록 조회
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: NotificationData) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // actionUrl이 있으면 해당 URL을 파싱해서 적절한 페이지로 라우팅
    if (notification.actionUrl) {
      try {
        const url = new URL(notification.actionUrl, window.location.origin);
        const pathname = url.pathname;
        
        // actionUrl에서 documentId 추출
        const documentId = pathname.split('/').pop();
        
        // 검토 관련 알림인지 확인 (메시지 내용 또는 URL 경로로 판단)
        const isReviewNotification = 
          notification.message.includes('검토') || 
          notification.message.includes('review') ||
          notification.title.includes('검토') ||
          notification.title.includes('review') ||
          pathname.includes('/review');
        
        if (isReviewNotification && documentId && !isNaN(Number(documentId))) {
          // 검토 페이지로 라우팅
          navigate(`/documents/${documentId}/review`);
        } else {
          // 일반 편집 페이지나 기타 페이지로 라우팅
          navigate(pathname);
        }
        
        setIsOpen(false);
      } catch (error) {
        console.error('URL 파싱 오류:', error);
        // URL 파싱 실패 시 기존 방식 사용
        window.location.href = notification.actionUrl;
      }
    }
  };

  const handleDeleteNotification = async (notificationId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // 알림 클릭 이벤트 방지
    await deleteNotification(notificationId);
  };

  const handleDeleteAllNotifications = async () => {
    if (confirm('모든 알림을 삭제하시겠습니까?')) {
      await deleteAllNotifications();
    }
  };

  const getNotificationIcon = (type: NotificationData['type']) => {
    switch (type) {
      case 'DOCUMENT_ASSIGNED':
        return '📋';
      case 'DOCUMENT_COMPLETED':
        return '✅';
      case 'DOCUMENT_DEADLINE':
        return '⏰';
      case 'DOCUMENT_UPDATED':
        return '📝';
      case 'SYSTEM_NOTICE':
        return '📢';
      default:
        return '🔔';
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return '방금 전';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}분 전`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}일 전`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 알림 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* 읽지 않은 알림 개수 배지 */}
        {displayCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1">
            {displayCount > 99 ? '99+' : displayCount}
          </span>
        )}
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50 max-h-96 overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-gray-900">알림</h3>
              <div className="flex items-center space-x-2">
                {totalCount > 0 && (
                  <button
                    onClick={handleDeleteAllNotifications}
                    className="text-sm text-red-600 hover:text-red-700 transition-colors"
                  >
                    모두 삭제
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 알림 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                <span className="ml-2 text-gray-500">로딩 중...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p>새로운 알림이 없습니다</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h4 className={`text-sm font-medium truncate pr-2 ${
                          !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          <button
                            onClick={(e) => handleDeleteNotification(notification.id, e)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="알림 삭제"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;