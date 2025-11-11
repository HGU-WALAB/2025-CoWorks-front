import React, { useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { getRoleAssignmentMessageShort, formatKoreanFullDateTime } from '../utils/roleAssignmentUtils';

const TaskDashboard: React.FC = () => {
  const { documents, todoDocuments, fetchDocuments, fetchTodoDocuments, loading } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  const currentUserEmail = user?.email || '';

  useEffect(() => {
    if (isAuthenticated && currentUserEmail) {
      console.log('TaskDashboard: Fetching documents for user:', currentUserEmail);
      fetchDocuments();
      fetchTodoDocuments();
    } else {
      console.log('TaskDashboard: Not authenticated or no user email', { isAuthenticated, currentUserEmail });
    }
  }, [fetchDocuments, fetchTodoDocuments, isAuthenticated, currentUserEmail]);

  // 라우터 location이 변경될 때마다 데이터 새로고침 (페이지 이동 감지)
  useEffect(() => {
    console.log('📍 TaskDashboard: Location changed to', location.pathname);
    if (location.pathname === '/tasks' && isAuthenticated && currentUserEmail) {
      console.log('📍 TaskDashboard: Refreshing due to location change...');
      fetchDocuments();
      fetchTodoDocuments();
    }
  }, [location, isAuthenticated, currentUserEmail, fetchDocuments, fetchTodoDocuments]);

  // 컴포넌트가 마운트될 때마다 강제로 데이터 새로고침
  useEffect(() => {
    console.log('🎯 TaskDashboard: Component MOUNTED - This should only show once per mount');
    if (isAuthenticated && currentUserEmail) {
      console.log('🎯 TaskDashboard: Fetching on mount...');
      fetchDocuments();
      fetchTodoDocuments();
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
        fetchTodoDocuments();
      }
    };

    const handleFocus = () => {
      if (isAuthenticated && currentUserEmail) {
        console.log('TaskDashboard: Window focused, refreshing...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    // 문서 생성 이벤트 리스너
    const handleDocumentCreated = (event: CustomEvent) => {
      console.log('📄 TaskDashboard: Document created event received:', event.detail);
      if (isAuthenticated && currentUserEmail) {
        console.log('📄 TaskDashboard: Refreshing after document creation...');
        fetchDocuments();
        fetchTodoDocuments();
      }
    };

    // 강제 새로고침 이벤트 리스너
    const handleForceRefresh = () => {
      console.log('🔄 TaskDashboard: Force refresh event received');
      if (isAuthenticated && currentUserEmail) {
        console.log('🔄 TaskDashboard: Force refreshing...');
        fetchDocuments();
        fetchTodoDocuments();
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
  }, [isAuthenticated, currentUserEmail, fetchDocuments, fetchTodoDocuments]);

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

  const filteredTodoDocuments = useMemo(() => {
    return todoDocuments.filter(doc => {
      if (doc.status === 'SIGNING') {
        return doc.tasks?.some(task =>
          task.role === 'SIGNER' && task.assignedUserEmail === currentUserEmail
        ) || false;
      }
      return true;
    });
  }, [todoDocuments, currentUserEmail]);

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



  // 사용자별 작업 분류 (작성중, 검토중, 서명중, 반려됨, 완료됨)
  const getUserTasks = () => {
    const myDocuments = documents.filter(doc =>
        doc.tasks?.some(task => task.assignedUserEmail === currentUserEmail) || false
    );

    const editingTasks = myDocuments.filter(doc => 
      ['DRAFT', 'EDITING'].includes(doc.status)
    );

    const reviewingTasks = myDocuments.filter(doc => 
      doc.status === 'REVIEWING'
    );

    const signingTasks = myDocuments.filter(doc => 
      doc.status === 'SIGNING'
    );

    const rejectedTasks = myDocuments.filter(doc => {
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

    const completedTasks = myDocuments.filter(doc => 
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">모든 할 일을 완료했습니다!</h3>
            <p className="text-gray-500">처리해야 할 문서가 없습니다.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h2 className="text-3xl font-bold text-gray-900">To Do List</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md">
                {filteredTodoDocuments.length}
              </span>
            </div>
          </div>
        </div>
        
        {/* 카드 그리드 레이아웃 */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTodoDocuments.map((doc) => {
            const myTask = doc.tasks?.find(task => task.assignedUserEmail === currentUserEmail);
            const isNewTask = myTask?.isNew;
            
            // 작성자인지 확인
            const isEditor = doc.tasks?.some(task =>
              task.role === 'EDITOR' && task.assignedUserEmail === currentUserEmail
            ) || false;

            // 상태에 따른 색상과 아이콘 설정
            const getStatusInfo = (status: string, isRejected?: boolean, isEditor?: boolean) => {
              // isRejected가 true이고 EDITING 상태이고 작성자가 현재 사용자인 경우 REJECTED처럼 표시
              if (isRejected && status === 'EDITING' && isEditor) {
                return {
                  color: 'red',
                  bgColor: 'bg-red-50',
                  textColor: 'text-red-700',
                  borderColor: 'border-red-200',
                  label: '반려됨'
                };
              }

              let baseInfo;
              switch (status) {
                case 'EDITING':
                  baseInfo = {
                    color: 'blue',
                    bgColor: 'bg-blue-50',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200',
                    label: '작성중'
                  };
                  break;
                case 'REVIEWING':
                  baseInfo = {
                    color: 'yellow',
                    bgColor: 'bg-yellow-50',
                    textColor: 'text-yellow-700',
                    borderColor: 'border-yellow-200',
                    label: '검토중'
                  };
                  break;
                case 'SIGNING':
                  baseInfo = {
                    color: 'orange',
                    bgColor: 'bg-orange-50',
                    textColor: 'text-orange-700',
                    borderColor: 'border-orange-200',
                    label: '서명중'
                  };
                  break;
                case 'REJECTED':
                  baseInfo = {
                    color: 'red',
                    bgColor: 'bg-red-50',
                    textColor: 'text-red-700',
                    borderColor: 'border-red-200',
                    label: '반려됨'
                  };
                  break;
                default:
                  baseInfo = {
                    color: 'gray',
                    bgColor: 'bg-gray-50',
                    textColor: 'text-gray-700',
                    borderColor: 'border-gray-200',
                    label: '처리 필요'
                  };
              }

              return baseInfo;
            };

            const statusInfo = getStatusInfo(doc.status, doc.isRejected, isEditor);
            const deadlineDate = doc.deadline ? new Date(doc.deadline) : null;
            const isOverdue = deadlineDate && deadlineDate < new Date();
            
            // 역할 지정 시간 정보 가져오기
            const roleAssignmentInfo = getRoleAssignmentMessageShort(doc, currentUserEmail);
            
            // To Do List 카드
            return (
              <div 
                key={doc.id} 
                className={`bg-white rounded-lg border-2 ${statusInfo.borderColor} shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden`}
              >
                {/* 카드 헤더 */}
                <div className={`${statusInfo.bgColor} px-4 py-3 border-b ${statusInfo.borderColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor} border ${statusInfo.borderColor}`}>
                      {statusInfo.label}
                    </span>
                    {isNewTask && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500 text-white animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                  <Link 
                    to={`/documents/${doc.id}`}
                    className={`text-lg font-bold ${statusInfo.textColor} hover:opacity-80 transition-opacity line-clamp-2`}
                  >
                    {doc.title || doc.templateName}
                  </Link>
                </div>

                {/* 카드 본문 */}
                <div className="p-4 space-y-3 flex flex-col min-h-[200px]">
                  {/* 템플릿 정보 */}
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate">{doc.templateName}</span>
                  </div>

                  {/* 마감일 */}
                  {deadlineDate && (
                    <div className={`flex items-center text-sm font-medium ${
                      isOverdue 
                        ? 'text-red-700 bg-red-50' 
                        : 'text-orange-700 bg-orange-50'
                    } px-3 py-2 rounded-md`}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        마감일: {formatKoreanFullDateTime(deadlineDate)}
                      </span>
                      {isOverdue && <span className="ml-1">(지연)</span>}
                    </div>
                  )}

                  {/* 역할 지정 시간 */}
                  {roleAssignmentInfo && (
                    <div className={`flex items-center text-sm px-3 py-2 rounded-md ${
                      doc.status === 'REVIEWING' 
                        ? 'text-orange-700 bg-orange-50' 
                        : 'text-blue-700 bg-blue-50'
                    }`}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">
                        {roleAssignmentInfo.label}: {roleAssignmentInfo.time}
                      </span>
                    </div>
                  )}

                  {/* 날짜 정보 */}
                  <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                    <div className="text-gray-900 font-medium">
                      생성일: {formatKoreanFullDateTime(doc.createdAt)}
                    </div>
                    {doc.updatedAt && (
                      <div className="text-gray-900 font-medium">
                        수정일: {formatKoreanFullDateTime(doc.updatedAt)}
                      </div>
                    )}
                  </div>
                </div>

                {/* 카드 푸터 - 액션 버튼 (하단 고정) */}
                <div className="px-4 pb-4 mt-auto">
                  {doc.status === 'REVIEWING' ? (
                    <Link
                      to={`/documents/${doc.id}/review`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      검토하기
                    </Link>
                  ) : doc.status === 'SIGNING' ? (
                    <Link
                      to={`/documents/${doc.id}/sign`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      서명하기
                    </Link>
                  ) : doc.status === 'REJECTED' || (doc.isRejected && doc.status === 'EDITING' && isEditor) ? (
                    <Link
                      to={`/documents/${doc.id}`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      수정하기
                    </Link>
                  ) : (
                    <Link
                      to={`/documents/${doc.id}`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      편집하기
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 문서 현황 카드 UI
  return (
    <div className="container mx-auto px-4 py-4">
      <div className="space-y-4">
        {/* 대시보드 및 통계 카드 섹션 */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* 페이지 헤더 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
            <p className="text-gray-500 text-sm mt-1">나의 문서 현황을 한눈에 확인하세요</p>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
           {/* 1. 작성 중인 문서 - 파란색 글씨 */}
           <Link to="/documents?status=EDITING" className="block group">
             <div className="bg-gray-50 rounded-xl shadow-lg p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden border border-gray-200">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gray-100 opacity-50 rounded-full -mr-12 -mt-12"></div>
               <div className="absolute bottom-0 left-0 w-20 h-20 bg-gray-100 opacity-50 rounded-full -ml-10 -mb-10"></div>
               
             <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xl font-medium text-blue-600">
                    작성중
                  </p>
                  <span className="text-blue-600 text-2xl opacity-70 group-hover:opacity-100">&gt;</span>
                </div>
                <p className="text-3xl font-bold text-blue-600 mb-2">{tasks.editingTasks.length}</p>
                <div className="h-px bg-gray-300 my-2"></div>
              </div>
             </div>
           </Link>

           {/* 2. 검토 중인 문서 - 노란색 글씨 */}
           <Link to="/documents?status=REVIEWING" className="block group">
             <div className="bg-gray-50 rounded-xl shadow-lg p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden border border-gray-200">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gray-100 opacity-50 rounded-full -mr-12 -mt-12"></div>
               <div className="absolute bottom-0 left-0 w-20 h-20 bg-gray-100 opacity-50 rounded-full -ml-10 -mb-10"></div>
               
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xl font-medium text-yellow-600">
                    검토중
                  </p>
                  <span className="text-yellow-600 text-2xl opacity-70 group-hover:opacity-100">&gt;</span>
                </div>
                <p className="text-3xl font-bold text-yellow-600 mb-2">{tasks.reviewingTasks.length}</p>
                <div className="h-px bg-gray-300 my-2"></div>
              </div>
             </div>
           </Link>

           {/* 3. 서명 중인 문서 - 주황색 글씨 */}
           <Link to="/documents?status=SIGNING" className="block group">
             <div className="bg-gray-50 rounded-xl shadow-lg p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden border border-gray-200">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gray-100 opacity-50 rounded-full -mr-12 -mt-12"></div>
               <div className="absolute bottom-0 left-0 w-20 h-20 bg-gray-100 opacity-50 rounded-full -ml-10 -mb-10"></div>
               
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xl font-medium text-orange-600">
                    서명중
                  </p>
                  <span className="text-orange-600 text-2xl opacity-70 group-hover:opacity-100">&gt;</span>
                </div>
                <p className="text-3xl font-bold text-orange-600 mb-2">{tasks.signingTasks.length}</p>
                <div className="h-px bg-gray-300 my-2"></div>
              </div>
             </div>
           </Link>

           {/* 4. 반려된 문서 - 빨간색 글씨 */}
           <Link to="/documents?status=REJECTED" className="block group">
             <div className="bg-gray-50 rounded-xl shadow-lg p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden border border-gray-200">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gray-100 opacity-50 rounded-full -mr-12 -mt-12"></div>
               <div className="absolute bottom-0 left-0 w-20 h-20 bg-gray-100 opacity-50 rounded-full -ml-10 -mb-10"></div>
               
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xl font-medium text-red-600">
                    반려됨
                  </p>
                  <span className="text-red-600 text-2xl opacity-70 group-hover:opacity-100">&gt;</span>
                </div>
                <p className="text-3xl font-bold text-red-600 mb-2">{tasks.rejectedTasks.length}</p>
                <div className="h-px bg-gray-300 my-2"></div>
              </div>
             </div>
           </Link>

           {/* 5. 완료된 문서 - 연두색 글씨 */}
           <Link to="/documents?status=COMPLETED" className="block group">
             <div className="bg-gray-50 rounded-xl shadow-lg p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer relative overflow-hidden border border-gray-200">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gray-100 opacity-50 rounded-full -mr-12 -mt-12"></div>
               <div className="absolute bottom-0 left-0 w-20 h-20 bg-gray-100 opacity-50 rounded-full -ml-10 -mb-10"></div>

              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xl font-medium text-lime-600">
                    완료됨
                  </p>
                  <span className="text-lime-600 text-2xl opacity-70 group-hover:opacity-100">&gt;</span>
                </div>
                <p className="text-3xl font-bold text-lime-600 mb-2">{tasks.completedTasks.length}</p>
                <div className="h-px bg-gray-300 my-2"></div>
              </div>
             </div>
           </Link>
          </div>
        </div>

        {/* TodoList 섹션 */}
        <TodoList />

        
        {/* 문서 생성 방법 섹션 */}
        {/*<div className="bg-white rounded-lg shadow p-6">*/}
        {/*  <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">문서 생성 방법</h2>*/}
        {/*  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">*/}
        {/*    /!* Step 1 *!/*/}
        {/*    <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">*/}
        {/*      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">*/}
        {/*        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">*/}
        {/*          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />*/}
        {/*        </svg>*/}
        {/*      </div>*/}
        {/*      <h3 className="text-lg font-semibold text-gray-900 mb-2">1. 문서 생성 하기</h3>*/}
        {/*      <p className="text-sm text-gray-600">템플릿을 선택하여 문서를 생성한 후 문서 정보를 입력하세요.</p>*/}
        {/*    </div>*/}

        {/*    /!* Step 2 *!/*/}
        {/*    <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">*/}
        {/*      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">*/}
        {/*        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">*/}
        {/*          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />*/}
        {/*          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />*/}
        {/*        </svg>*/}
        {/*      </div>*/}
        {/*      <h3 className="text-lg font-semibold text-gray-900 mb-2">2. 문서 편집 하기</h3>*/}
        {/*      <p className="text-sm text-gray-600">편집할 위치를 클릭하여 편집할 내용을 입력하세요.</p>*/}
        {/*    </div>*/}

        {/*    /!* Step 3 *!/*/}
        {/*    <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">*/}
        {/*      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">*/}
        {/*        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">*/}
        {/*          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />*/}
        {/*        </svg>*/}
        {/*      </div>*/}
        {/*      <h3 className="text-lg font-semibold text-gray-900 mb-2">3. 서명자 지정 하기</h3>*/}
        {/*      <p className="text-sm text-gray-600">문서 편집을 완료한 후 서명자를 지정하세요.</p>*/}
        {/*    </div>*/}

        {/*    /!* Step 4 *!/*/}
        {/*    <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">*/}
        {/*      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">*/}
        {/*        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">*/}
        {/*          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />*/}
        {/*        </svg>*/}
        {/*      </div>*/}
        {/*      <h3 className="text-lg font-semibold text-gray-900 mb-2">4. 문서 작업 완료</h3>*/}
        {/*      <p className="text-sm text-gray-600">서명자의 서명 완료 되면 문서 작업이 완료됩니다!.</p>*/}
        {/*    </div>*/}
        {/*  </div>*/}
        {/*</div>*/}

      </div>
    </div>
  );
};

export default TaskDashboard;