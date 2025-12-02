import React, { useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { formatRelativeDateTime } from '../utils/roleAssignmentUtils';

const UserDashboard: React.FC = () => {
  const { documents, todoDocuments, fetchDocuments, fetchTodoDocuments, loading } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  const currentUserEmail = user?.email || '';
  const userPosition = (user?.position || '').toLowerCase();
  const showReviewingCard = userPosition === '기타' || userPosition === '교직원';
  
  // 필터 상태 추가
  const [selectedFilter, setSelectedFilter] = React.useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && currentUserEmail) {
      console.log('UserDashboard: Fetching documents for user:', currentUserEmail);
      fetchDocuments();
      fetchTodoDocuments();
    } else {
      console.log('UserDashboard: Not authenticated or no user email', { isAuthenticated, currentUserEmail });
    }
  }, [fetchDocuments, fetchTodoDocuments, isAuthenticated, currentUserEmail]);

  // 라우터 location이 변경될 때마다 데이터 새로고침 (location.key 사용으로 모든 네비게이션 감지)
  useEffect(() => {
    if (location.pathname === '/tasks' && isAuthenticated && currentUserEmail) {
      console.log('📍 UserDashboard: Refreshing due to location change...');
      fetchDocuments();
      fetchTodoDocuments();
    }
  }, [location.pathname, location.key, isAuthenticated, currentUserEmail]);

  // 컴포넌트가 마운트될 때마다 강제로 데이터 새로고침
  // location.key를 의존성에 추가하여 페이지 이동 시마다 새로고침
  useEffect(() => {
    console.log('🎯 UserDashboard: Component render with location.key:', location.key);
    if (isAuthenticated && currentUserEmail) {
      console.log('🎯 UserDashboard: Fetching data...');
      fetchDocuments();
      fetchTodoDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // 페이지 가시성 변경 시 데이터 새로고침
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated && currentUserEmail) {
        console.log('UserDashboard: Page became visible, refreshing...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    const handleFocus = () => {
      if (isAuthenticated && currentUserEmail) {
        console.log('UserDashboard: Window focused, refreshing...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    const handleDocumentCreated = (event: CustomEvent) => {
      console.log('📄 UserDashboard: Document created event received:', event.detail);
      if (isAuthenticated && currentUserEmail) {
        console.log('📄 UserDashboard: Refreshing after document creation...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    const handleForceRefresh = () => {
      console.log('🔄 UserDashboard: Force refresh event received');
      if (isAuthenticated && currentUserEmail) {
        console.log('🔄 UserDashboard: Force refreshing...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    const handleForceRefreshDocuments = () => {
      console.log('🔄 UserDashboard: Force refresh documents event received');
      if (isAuthenticated && currentUserEmail) {
        console.log('🔄 UserDashboard: Force refreshing documents...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    // 브라우저 뒤로 가기/앞으로 가기 시 데이터 새로고침
    const handlePopState = () => {
      if (isAuthenticated && currentUserEmail) {
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('documentCreated', handleDocumentCreated as EventListener);
    window.addEventListener('forceRefreshTasks', handleForceRefresh);
    window.addEventListener('forceRefreshDocuments', handleForceRefreshDocuments);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('documentCreated', handleDocumentCreated as EventListener);
      window.removeEventListener('forceRefreshTasks', handleForceRefresh);
      window.removeEventListener('forceRefreshDocuments', handleForceRefreshDocuments);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAuthenticated, currentUserEmail, fetchDocuments, fetchTodoDocuments]);

  // 디버깅을 위한 로그
  useEffect(() => {
    console.log('🔍 UserDashboard: Documents state changed', {
      documentsCount: documents.length,
      currentUserEmail,
      isAuthenticated,
      loading,
      documents: documents.map(d => ({
        id: d.id,
        templateName: d.title || d.templateName,
        status: d.status,
        tasksCount: d.tasks?.length || 0,
        tasks: d.tasks?.map(t => ({
          role: t.role,
          assignedUserEmail: t.assignedUserEmail,
          status: t.status
        }))
      }))
    });
  }, [documents, currentUserEmail, isAuthenticated, loading]);

  const filteredTodoDocuments = useMemo(() => {
    let filtered = todoDocuments.filter(doc => {
      if (doc.status === 'SIGNING') {
        return doc.tasks?.some(task =>
          task.role === 'SIGNER' && task.assignedUserEmail === currentUserEmail
        ) || false;
      }
      return true;
    });

    // 필터 적용
    if (selectedFilter && selectedFilter !== 'ALL') {
      filtered = filtered.filter(doc => {
        if (selectedFilter === 'EDITING') {
          return ['DRAFT', 'EDITING', 'READY_FOR_REVIEW'].includes(doc.status) && !doc.isRejected;
        } else if (selectedFilter === 'REJECTED') {
          return doc.status === 'REJECTED' || doc.isRejected;
        } else {
          return doc.status === selectedFilter;
        }
      });
    }

    // 마감일순 정렬: deadline 기준 오름차순 (마감일이 없는 경우 마지막으로)
    const sorted = [...filtered].sort((a, b) => {
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return aDeadline - bDeadline;
    });

    return sorted;
  }, [todoDocuments, currentUserEmail, selectedFilter]);

  // 인증되지 않은 경우 처리
  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600">문서 현황을 확인하려면 먼저 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  // 로딩 상태 처리
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">문서 현황을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 사용자별 작업 분류 (todoDocuments 기반)
  const getUserTasks = () => {
    // todoDocuments와 동일한 로직 적용: 실제로 처리해야 하는 문서만 필터링
    const myTodoDocuments = todoDocuments.filter(doc => {
      // SIGNING 상태인 경우, 현재 사용자가 서명자인 경우만 포함
      if (doc.status === 'SIGNING') {
        return doc.tasks?.some(task =>
          task.role === 'SIGNER' && task.assignedUserEmail === currentUserEmail
        ) || false;
      }
      return true;
    });

    const editingTasks = myTodoDocuments.filter(doc => 
      ['DRAFT', 'EDITING', 'READY_FOR_REVIEW'].includes(doc.status) && 
      !doc.isRejected && 
      doc.status !== 'REJECTED'
    );

    const reviewingTasks = myTodoDocuments.filter(doc => 
      doc.status === 'REVIEWING'
    );

    const signingTasks = myTodoDocuments.filter(doc => 
      doc.status === 'SIGNING'
    );

    const rejectedTasks = myTodoDocuments.filter(doc => {
      if (doc.status === 'REJECTED') {
        return true;
      }
      if (doc.isRejected && doc.status === 'EDITING') {
        return doc.tasks?.some(task =>
          task.role === 'EDITOR' && task.assignedUserEmail === currentUserEmail
        ) || false;
      }
      return false;
    });

    const completedTasks = myTodoDocuments.filter(doc => 
      doc.status === 'COMPLETED'
    );

    return {
      editingTasks,
      reviewingTasks,
      signingTasks,
      rejectedTasks,
      completedTasks
    };
  };

  const tasks = getUserTasks();

  // TodoList 컴포넌트
  const TodoList = () => {
    if (filteredTodoDocuments.length === 0) {
      return (
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">처리할 문서가 없습니다</h3>
            <p className="text-gray-500">현재 대기 중인 작업이 없습니다.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b-2 border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full"></div>
            <h2 className="text-xl font-semibold text-gray-900">처리 대기 문서</h2>
          </div>
        </div>
        
        {/* 카드 그리드 레이아웃 */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTodoDocuments.map((doc) => {
            const myTask = doc.tasks?.find(task => task.assignedUserEmail === currentUserEmail);
            const isNewTask = myTask?.isNew;
            
            const isEditor = doc.tasks?.some(task =>
              task.role === 'EDITOR' && task.assignedUserEmail === currentUserEmail
            ) || false;

            // 작성자 지정 날짜, 반려 시간, 서명자 지정 날짜 계산
            let assignmentInfo = '';
            if (doc.status === 'EDITING' && isEditor && myTask?.createdAt) {
              assignmentInfo = `지정일: ${formatRelativeDateTime(new Date(myTask.createdAt))}`;
            } else if (doc.status === 'READY_FOR_REVIEW' && myTask?.createdAt) {
              assignmentInfo = `지정일: ${formatRelativeDateTime(new Date(myTask.createdAt))}`;
            } else if ((doc.status === 'REJECTED' || doc.isRejected) && doc.statusLogs) {
              const rejectedLog = doc.statusLogs
                .filter(log => log.status === 'REJECTED')
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
              if (rejectedLog) {
                assignmentInfo = `반려일: ${formatRelativeDateTime(new Date(rejectedLog.timestamp))}`;
              }
            } else if (doc.status === 'SIGNING' && myTask?.createdAt) {
              assignmentInfo = `지정일: ${formatRelativeDateTime(new Date(myTask.createdAt))}`;
            }

            const getStatusInfo = (status: string, isRejected?: boolean, isEditor?: boolean) => {
              if (isRejected && status === 'EDITING' && isEditor) {
                return {
                  color: 'red',
                  bgColor: 'bg-red-100',
                  textColor: 'text-red-700',
                  borderColor: 'border-red-200',
                  label: '반려됨'
                };
              }

              let baseInfo;
              switch (status) {
                case 'EDITING':
                  if (isEditor) {
                    baseInfo = {
                      color: 'blue',
                      bgColor: 'bg-blue-100',
                      textColor: 'text-blue-700',
                      borderColor: 'border-blue-200',
                      label: '작성중'
                    };
                  } else {
                    return null;
                  }
                  break;
                case 'READY_FOR_REVIEW':
                  baseInfo = {
                    color: 'blue',
                    bgColor: 'bg-blue-100',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200',
                    label: '서명자 지정하기'
                  };
                  break;
                case 'REVIEWING':
                  baseInfo = {
                    color: 'yellow',
                    bgColor: 'bg-yellow-100',
                    textColor: 'text-yellow-700',
                    borderColor: 'border-yellow-200',
                    label: '검토중'
                  };
                  break;
                case 'SIGNING':
                  baseInfo = {
                    color: 'orange',
                    bgColor: 'bg-orange-100',
                    textColor: 'text-orange-700',
                    borderColor: 'border-orange-200',
                    label: '서명중'
                  };
                  break;
                case 'REJECTED':
                  baseInfo = {
                    color: 'red',
                    bgColor: 'bg-red-100',
                    textColor: 'text-red-700',
                    borderColor: 'border-red-200',
                    label: '반려됨'
                  };
                  break;
                default:
                  baseInfo = {
                    color: 'blue',
                    bgColor: 'bg-blue-100',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200',
                    label: '처리 필요'
                  };
              }

              return baseInfo;
            };

            const statusInfo = getStatusInfo(doc.status, doc.isRejected, isEditor);
            if (!statusInfo) {
              return null;
            }
            const deadlineDate = doc.deadline ? new Date(doc.deadline) : null;
            const isOverdue = deadlineDate && deadlineDate < new Date();
            
            return (
              <div 
                key={doc.id} 
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="p-4">
                  {/* 상태 배지와 NEW 표시 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                      {statusInfo.label}
                    </span>
                    {isNewTask && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-600 text-white">
                        NEW
                      </span>
                    )}
                  </div>

                  {/* 문서 제목 */}
                  <Link 
                    to={`/documents/${doc.id}`}
                    className="block text-base font-semibold text-gray-900 hover:text-gray-700 mb-3 line-clamp-2"
                  >
                    {doc.title || doc.templateName}
                  </Link>

                  {/* 지정/반려 날짜 */}
                  {assignmentInfo && (
                    <div className={`text-sm font-semibold mb-2 ${statusInfo.textColor}`}>
                      {assignmentInfo}
                    </div>
                  )}

                  {/* 만료일 */}
                  {deadlineDate && (
                    <div className={`text-sm font-semibold mb-3 ${isOverdue ? 'text-red-600' : statusInfo.textColor}`}>
                      마감일: {formatRelativeDateTime(deadlineDate)}
                      {isOverdue && ' (지연)'}
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="mt-4">
                    {doc.status === 'EDITING' && isEditor ? (
                      <Link
                        to={`/documents/${doc.id}`}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        작성하기
                      </Link>
                    ) :
                    doc.status === 'READY_FOR_REVIEW' ? (
                      <Link
                        to={`/documents/${doc.id}/signer-assignment`}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        서명자 지정하기
                      </Link>
                    ) :
                    doc.status === 'REVIEWING' ? (
                      <Link
                        to={`/documents/${doc.id}/review`}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        검토하기
                      </Link>
                    ) : doc.status === 'SIGNING' ? (
                      <Link
                        to={`/documents/${doc.id}/sign`}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        서명하기
                      </Link>
                    ) : doc.status === 'REJECTED' || (doc.isRejected && doc.status === 'EDITING' && isEditor) ? (
                      <Link
                        to={`/documents/${doc.id}`}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        수정하기
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">내 작업 현황</h1>
          <p className="text-sm text-gray-600">할당된 작업과 문서 상태를 확인하세요</p>
        </div>

        {/* 통계 및 액션 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* 왼쪽: 통계 카드 영역 (2/3) */}
          <div className="lg:col-span-2">
            <div className={`grid ${showReviewingCard ? 'grid-cols-4' : 'grid-cols-4'} gap-4 h-full`}>
              {/* 전체 */}
              {!showReviewingCard && (
                <button
                  onClick={() => setSelectedFilter('ALL')}
                  className={`p-5 rounded-xl transition-all duration-200 ${
                    !selectedFilter || selectedFilter === 'ALL'
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105'
                      : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className={`text-4xl font-bold mb-2 ${
                    !selectedFilter || selectedFilter === 'ALL' ? 'text-white' : 'text-gray-900'
                  }`}>{tasks.editingTasks.length + tasks.signingTasks.length + tasks.rejectedTasks.length + (showReviewingCard ? tasks.reviewingTasks.length : 0)}</div>
                  <div className={`text-sm font-medium ${
                    !selectedFilter || selectedFilter === 'ALL' ? 'text-primary-100' : 'text-gray-600'
                  }`}>전체</div>
                </button>
              )}

              {/* 작성중 */}
              {showReviewingCard ? (
              <Link to="/documents?status=EDITING" className="block">
                <button className="w-full h-full p-5 rounded-xl transition-all duration-200 bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5">
                  <div className="text-4xl font-bold mb-2 text-gray-900">{tasks.editingTasks.length}</div>
                  <div className="text-sm font-medium text-gray-600">작성중</div>
                  </button>
                </Link>
              ) : (
                <button
                  onClick={() => setSelectedFilter(selectedFilter === 'EDITING' ? 'ALL' : 'EDITING')}
                  className={`p-5 rounded-xl transition-all duration-200 ${
                    selectedFilter === 'EDITING'
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105'
                      : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className={`text-4xl font-bold mb-2 ${
                    selectedFilter === 'EDITING' ? 'text-white' : 'text-gray-900'
                  }`}>{tasks.editingTasks.length}</div>
                  <div className={`text-sm font-medium ${
                    selectedFilter === 'EDITING' ? 'text-primary-100' : 'text-gray-600'
                  }`}>작성중</div>
                </button>
              )}

              {/* 검토중 (관리자/교직원만) */}
              {showReviewingCard && (
              <Link to="/documents?status=REVIEWING" className="block">
                <button className="w-full h-full p-5 rounded-xl transition-all duration-200 bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5">
                  <div className="text-4xl font-bold mb-2 text-gray-900">{tasks.reviewingTasks.length}</div>
                  <div className="text-sm font-medium text-gray-600">검토중</div>
                  </button>
                </Link>
              )}

              {/* 서명중 */}
              {showReviewingCard ? (
              <Link to="/documents?status=SIGNING" className="block">
                <button className="w-full h-full p-5 rounded-xl transition-all duration-200 bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5">
                  <div className="text-4xl font-bold mb-2 text-gray-900">{tasks.signingTasks.length}</div>
                  <div className="text-sm font-medium text-gray-600">서명중</div>
                  </button>
                </Link>
              ) : (
                <button
                  onClick={() => setSelectedFilter(selectedFilter === 'SIGNING' ? 'ALL' : 'SIGNING')}
                  className={`p-5 rounded-xl transition-all duration-200 ${
                    selectedFilter === 'SIGNING'
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105'
                      : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className={`text-4xl font-bold mb-2 ${
                    selectedFilter === 'SIGNING' ? 'text-white' : 'text-gray-900'
                  }`}>{tasks.signingTasks.length}</div>
                  <div className={`text-sm font-medium ${
                    selectedFilter === 'SIGNING' ? 'text-primary-100' : 'text-gray-600'
                  }`}>서명중</div>
                </button>
              )}

              {/* 반려 */}
              {showReviewingCard ? (
              <Link to="/documents?status=REJECTED" className="block">
                <button className="w-full h-full p-5 rounded-xl transition-all duration-200 bg-white border-2 border-gray-200 hover:border-red-300 hover:shadow-md hover:-translate-y-0.5">
                  <div className={`text-4xl font-bold mb-2 ${tasks.rejectedTasks.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{tasks.rejectedTasks.length}</div>
                  <div className="text-sm font-medium text-gray-600">반려</div>
                  </button>
                </Link>
              ) : (
                <button
                  onClick={() => setSelectedFilter(selectedFilter === 'REJECTED' ? 'ALL' : 'REJECTED')}
                  className={`p-5 rounded-xl transition-all duration-200 ${
                    selectedFilter === 'REJECTED'
                      ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 scale-105'
                      : 'bg-white border-2 border-gray-200 hover:border-red-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className={`text-4xl font-bold mb-2 ${
                    selectedFilter === 'REJECTED' ? 'text-white' : tasks.rejectedTasks.length > 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>{tasks.rejectedTasks.length}</div>
                  <div className={`text-sm font-medium ${
                    selectedFilter === 'REJECTED' ? 'text-red-100' : 'text-gray-600'
                  }`}>반려</div>
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 액션 버튼 영역 (1/3) */}
          <div className="flex flex-col gap-4">
            {/* 문서 생성 버튼 */}
            <Link to="/documents/new" className="block">
              <button className="w-full p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-base font-semibold">새 문서 생성</span>
                </div>
              </button>
            </Link>
            
            {/* 전체 문서 보기 버튼 */}
            <Link to="/documents" className="block">
              <button className="w-full p-4 rounded-xl bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-base font-semibold text-gray-700">전체 문서 보기</span>
                </div>
              </button>
            </Link>
          </div>
        </div>

        {/* 선택된 필터 표시 */}
        {!showReviewingCard && selectedFilter && selectedFilter !== 'ALL' && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">필터:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg text-sm font-medium shadow-sm">
              {selectedFilter === 'EDITING' ? '작성중' :
               selectedFilter === 'SIGNING' ? '서명중' :
               selectedFilter === 'REJECTED' ? '반려' : selectedFilter}
              <button onClick={() => setSelectedFilter('ALL')} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        )}

        {/* TodoList 섹션 */}
        <TodoList />
      </div>
    </div>
  );
};

export default UserDashboard;
