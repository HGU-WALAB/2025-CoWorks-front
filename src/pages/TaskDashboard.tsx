import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';

const TaskDashboard: React.FC = () => {
  const { documents, fetchDocuments, loading } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  // 실제 인증된 사용자 이메일 사용
  const currentUserEmail = user?.email || '';

  useEffect(() => {
    if (isAuthenticated && currentUserEmail) {
      console.log('TaskDashboard: Fetching documents for user:', currentUserEmail);
      fetchDocuments();
    } else {
      console.log('TaskDashboard: Not authenticated or no user email', { isAuthenticated, currentUserEmail });
    }
  }, [fetchDocuments, isAuthenticated, currentUserEmail]);

  // 라우터 location이 변경될 때마다 데이터 새로고침 (페이지 이동 감지)
  useEffect(() => {
    console.log('📍 TaskDashboard: Location changed to', location.pathname);
    if (location.pathname === '/tasks' && isAuthenticated && currentUserEmail) {
      console.log('📍 TaskDashboard: Refreshing due to location change...');
      fetchDocuments();
    }
  }, [location, isAuthenticated, currentUserEmail, fetchDocuments]);

  // 컴포넌트가 마운트될 때마다 강제로 데이터 새로고침
  useEffect(() => {
    console.log('🎯 TaskDashboard: Component MOUNTED - This should only show once per mount');
    if (isAuthenticated && currentUserEmail) {
      console.log('🎯 TaskDashboard: Fetching on mount...');
      fetchDocuments();
    }

    return () => {
      console.log('🎯 TaskDashboard: Component UNMOUNTING');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 dependency로 mount시에만 실행

  // 페이지 가시성 변경 시 데이터 새로고침
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated && currentUserEmail) {
        console.log('TaskDashboard: Page became visible, refreshing...');
        fetchDocuments();
      }
    };

    const handleFocus = () => {
      if (isAuthenticated && currentUserEmail) {
        console.log('TaskDashboard: Window focused, refreshing...');
        fetchDocuments();
      }
    };

    // 문서 생성 이벤트 리스너
    const handleDocumentCreated = (event: CustomEvent) => {
      console.log('📄 TaskDashboard: Document created event received:', event.detail);
      if (isAuthenticated && currentUserEmail) {
        console.log('📄 TaskDashboard: Refreshing after document creation...');
        fetchDocuments();
      }
    };

    // 강제 새로고침 이벤트 리스너
    const handleForceRefresh = () => {
      console.log('🔄 TaskDashboard: Force refresh event received');
      if (isAuthenticated && currentUserEmail) {
        console.log('🔄 TaskDashboard: Force refreshing...');
        fetchDocuments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('documentCreated', handleDocumentCreated as EventListener);
    window.addEventListener('forceRefreshTasks', handleForceRefresh);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('documentCreated', handleDocumentCreated as EventListener);
      window.removeEventListener('forceRefreshTasks', handleForceRefresh);
    };
  }, [isAuthenticated, currentUserEmail, fetchDocuments]);

  // 디버깅을 위한 로그
  useEffect(() => {
    console.log('🔍 TaskDashboard: Documents state changed', {
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

  // 인증되지 않은 경우 처리
  if (!isAuthenticated) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-600">작업 현황을 확인하려면 먼저 로그인해주세요.</p>
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
            <p className="text-gray-600">작업 현황을 불러오는 중...</p>
          </div>
        </div>
    );
  }

  // 안전한 tasks 접근을 위한 헬퍼 함수들
  const getUserTask = (doc: Document) => {
    return doc.tasks?.find(task => task.assignedUserEmail === currentUserEmail);
  };

  const getUserRole = (doc: Document) => {
    const task = getUserTask(doc);
    return task?.role || '';
  };


  // 사용자별 작업 분류 (전체 작업, , 내가 생성)
  const getUserTasks = () => {
    const createdByMe = documents.filter(doc =>
        doc.tasks?.some(task =>
            task.role === 'CREATOR' && task.assignedUserEmail === currentUserEmail
        ) || false
    );

    const assignedToEdit = documents.filter(doc =>
        doc.tasks?.some(task =>
            task.role === 'EDITOR' && task.assignedUserEmail === currentUserEmail
        ) || false
    );

    const assignedToReview = documents.filter(doc =>
        doc.tasks?.some(task =>
            task.role === 'REVIEWER' && task.assignedUserEmail === currentUserEmail
        ) || false
    );

    const pendingTasks = documents.filter(doc => {
      const userTasks = doc.tasks?.filter(task => task.assignedUserEmail === currentUserEmail) || [];

      // 나의 할 일 로직과 동일하게 처리
      return userTasks.some(task => {
        // 편집자 역할: DRAFT, EDITING, REJECTED 상태의 문서에서 편집 작업이 PENDING인 경우
        if (task.role === 'EDITOR' && task.status === 'PENDING') {
          return ['DRAFT', 'EDITING', 'REJECTED'].includes(doc.status);
        }

        // 검토자 역할: REVIEWING 상태의 문서에서 검토 작업이 PENDING인 경우
        if (task.role === 'REVIEWER' && task.status === 'PENDING') {
          return doc.status === 'REVIEWING';
        }

        return false;
      });
    });

    const completedTasks = documents.filter(doc => {
      const userTasks = doc.tasks?.filter(task => task.assignedUserEmail === currentUserEmail) || [];
      return userTasks.length > 0 && userTasks.every(task => task.status === 'COMPLETED');
    });

    return {
      createdByMe,
      assignedToEdit,
      assignedToReview,
      pendingTasks,
      completedTasks,
      allTasks: [...new Set([...createdByMe, ...assignedToEdit, ...assignedToReview])]
    };
  };

  const tasks = getUserTasks();

  // 우선순위 문서 가져오기 (나의 할 일)
  const getMyTodoDocuments = () => {
    const myTasks = documents.filter(doc => {
      const userTasks = doc.tasks?.filter(task => task.assignedUserEmail === currentUserEmail) || [];

      // 각 사용자 작업을 확인하여 처리해야 할 작업이 있는지 판단
      return userTasks.some(task => {
        // 편집자 역할: DRAFT, EDITING, REJECTED 상태의 문서에서 편집 작업이 PENDING인 경우
        if (task.role === 'EDITOR' && task.status === 'PENDING') {
          return ['DRAFT', 'EDITING', 'REJECTED'].includes(doc.status);
        }

        // 검토자 역할: REVIEWING 상태의 문서에서 검토 작업이 PENDING인 경우
        if (task.role === 'REVIEWER' && task.status === 'PENDING') {
          return doc.status === 'REVIEWING';
        }

        // 생성자 역할: 일반적으로 할 일이 없지만, 반려된 문서의 경우 재작업 필요할 수 있음
        // (하지만 현재 생성자는 편집할 수 없으므로 제외)

        return false;
      });
    });

    console.log('🎯 getMyTodoDocuments: 필터링된 나의 할 일 문서들', {
      totalDocuments: documents.length,
      myTasksCount: myTasks.length,
      currentUser: currentUserEmail,
      myTasks: myTasks.map(doc => ({
        id: doc.id,
        templateName: doc.templateName,
        status: doc.status,
        myTasks: doc.tasks?.filter(task => task.assignedUserEmail === currentUserEmail)
      }))
    });

    // 우선순위 정렬: 1) 긴급도, 2) 생성일 순 - 점수로 계산하여 정렬함
    return myTasks
        .map(doc => ({
          ...doc,
          urgencyScore: getUrgencyScore(doc),
          daysSinceCreated: Math.floor(
              (new Date().getTime() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          )
        }))
        .sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceCreated - a.daysSinceCreated)
        .slice(0, 5); // TOP 5만
  };

  // 정렬 점수 계산 (긴급도 계산)
  const getUrgencyScore = (doc: Document) => {
    const daysSinceCreated = Math.floor(
        (new Date().getTime() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    let score = 0;

    // 문서 상태별 가중치
    if (doc.status === 'REVIEWING') score += 20; // 검토중
    else if (doc.status === 'READY_FOR_REVIEW') score += 30; // 검토대기
    else if (doc.status === 'EDITING') score += 20; // 편집중

    // 문서 경과일수 가중치
    if (daysSinceCreated > 7) score += 20;
    else if (daysSinceCreated > 3) score += 10;

    return score;
  };

  // 긴급도 레벨 계산
  const getUrgencyLevel = (doc: Document) => {
    const score = getUrgencyScore(doc);

    if (score >= 40) {
      return { level: 'high', label: '긴급', color: 'text-red-600', bgColor: 'bg-red-50' };
    } else if (score >= 20) {
      return { level: 'medium', label: '주의', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    }
    return { level: 'normal', label: '일반', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const myTodoDocuments = getMyTodoDocuments();

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: { label: '초안', color: 'bg-gray-100 text-gray-800' },
      EDITING: { label: '편집중', color: 'bg-blue-100 text-blue-800' },
      READY_FOR_REVIEW: { label: '검토대기', color: 'bg-orange-100 text-orange-800' },
      REVIEWING: { label: '검토중', color: 'bg-yellow-100 text-yellow-800' },
      COMPLETED: { label: '완료', color: 'bg-green-100 text-green-800' },
      REJECTED: { label: '반려', color: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };


  // 문서 현황 카드 UI
  return (
      <div className="space-y-8">
        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">작업 현황</h1>
          <p className="mt-2 text-gray-500">내가 관련된 모든 작업들을 확인하고 관리하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. 내가 관여한 전체 Task */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">📋</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">내가 관여한 전체 문서</h3>
                <p className="text-3xl font-bold text-blue-600">{tasks.allTasks.length}</p>
                <p className="text-sm text-gray-500">모든 관련 작업</p>
              </div>
            </div>
          </div>

          {/* 2. 내가 해야 할 Task (대기중) - 빨간색/강조 */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg shadow p-6 border-l-4 border-red-500 ring-2 ring-red-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-white text-lg">🚨</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-red-800">내가 처리해야 할 문서</h3>
                <p className="text-3xl font-bold text-red-600">{tasks.pendingTasks.length}</p>
                <p className="text-sm text-red-600 font-medium">처리 필요!</p>
              </div>
            </div>
          </div>

          {/* 3. 내가 완료한 Task - 초록색 톤 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">🎉</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-green-800">내가 완료한 문서</h3>
                <p className="text-3xl font-bold text-green-600">{tasks.completedTasks.length}</p>
                <p className="text-sm text-green-600">작업 완료한 문서</p>
              </div>
            </div>
          </div>

          {/* 4. 내가 생성한 Task - 중립적 색상 */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-400">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">✏️</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">내가 생성한 문서</h3>
                <p className="text-3xl font-bold text-gray-600">{tasks.createdByMe.length}</p>
                <p className="text-sm text-gray-500">내가 생성한 문서</p>
              </div>
            </div>
          </div>
        </div>

        {/* 나의 할 일 UI */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">나의 할 일</h2>
            <p className="text-sm text-gray-500 mt-1">처리가 필요한 문서들을 우선순위별로 확인하세요</p>
          </div>

          <div className="divide-y divide-gray-200">
            {myTodoDocuments.length > 0 ? (
                myTodoDocuments.map((doc, index) => {
                  const urgency = getUrgencyLevel(doc);
                  const userRole = getUserRole(doc);

                  return (
                      <div key={doc.id} className={`px-6 py-4 hover:bg-gray-50 ${urgency.bgColor}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {/* 우선순위 번호 */}
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-1">
                                <h3 className="text-lg font-medium text-gray-900">
                                  {doc.templateName}
                                </h3>
                                {getStatusBadge(doc.status)}
                                <span className={`text-sm font-medium px-2 py-1 rounded-full ${urgency.color} ${urgency.bgColor}`}>
                            {urgency.label}
                          </span>
                              </div>

                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span>ID: {doc.id}</span>
                                <span>{doc.daysSinceCreated}일 전 생성</span>
                                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            {userRole === 'CREATOR' && '생성자'}
                                  {userRole === 'EDITOR' && '편집자'}
                                  {userRole === 'REVIEWER' && '검토자'}
                          </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            {/* 역할에 따른 액션 버튼 */}
                            {/* 검토자로서 검토해야 할 문서 */}
                            {doc.tasks?.some(task =>
                                task.assignedUserEmail === currentUserEmail &&
                                task.role === 'REVIEWER' &&
                                task.status === 'PENDING' &&
                                doc.status === 'REVIEWING'
                            ) && (
                                <Link
                                    to={`/documents/${doc.id}/review`}
                                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 text-sm font-medium transition-colors"
                                >
                                  검토하기
                                </Link>
                            )}

                            {/* 편집자로서 편집해야 할 문서 */}
                            {doc.tasks?.some(task =>
                                task.assignedUserEmail === currentUserEmail &&
                                task.role === 'EDITOR' &&
                                task.status === 'PENDING' &&
                                ['DRAFT', 'EDITING', 'REJECTED'].includes(doc.status)
                            ) && (
                                <Link
                                    to={`/documents/${doc.id}/edit`}
                                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm font-medium transition-colors"
                                >
                                  편집하기
                                </Link>
                            )}

                            <Link
                                to={`/documents/${doc.id}`}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                            >
                              보기
                            </Link>
                          </div>
                        </div>
                      </div>
                  );
                })
            ) : (
                <div className="px-6 py-12 text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">처리할 작업이 없습니다</h3>
                  <p className="text-gray-600">할당된 모든 작업이 완료되었습니다!</p>
                </div>
            )}
          </div>

          {/* 더 보기 링크 */}
          {myTodoDocuments.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Link
                    to="/documents"
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  모든 문서 보기 →
                </Link>
              </div>
          )}
        </div>

        {/* 빠른 액션
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">빠른 액션</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/documents/new"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-bold">+</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">새 문서 생성</h3>
              <p className="text-sm text-gray-600">템플릿을 선택하여 새 문서를 생성합니다</p>
            </div>
          </Link>

          <Link
            to="/templates"
            className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-bold">📋</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">템플릿 관리</h3>
              <p className="text-sm text-gray-600">새 템플릿을 생성하거나 기존 템플릿을 수정합니다</p>
            </div>
          </Link>

          <Link
            to="/documents"
            className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-bold">📁</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">전체 문서</h3>
              <p className="text-sm text-gray-600">모든 문서를 확인하고 관리합니다</p>
            </div>
          </Link>
        </div>
      </div> */}

      </div>
  );
};

export default TaskDashboard;