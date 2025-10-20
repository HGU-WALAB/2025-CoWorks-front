import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { getRoleAssignmentMessageShort } from '../utils/roleAssignmentUtils';

const TaskDashboard: React.FC = () => {
  const { documents, todoDocuments, fetchDocuments, fetchTodoDocuments, loading } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  // 실제 인증된 사용자 이메일 사용
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



  // 사용자별 작업 분류 (편집중, 검토중, 반려됨, 완료됨)
  const getUserTasks = () => {
    const myDocuments = documents.filter(doc =>
        doc.tasks?.some(task => task.assignedUserEmail === currentUserEmail) || false
    );

    // 편집 중인 문서 (DRAFT, EDITING 상태)
    const editingTasks = myDocuments.filter(doc => 
      ['DRAFT', 'EDITING'].includes(doc.status)
    );

    // 검토 중인 문서 (REVIEWING 상태)
    const reviewingTasks = myDocuments.filter(doc => 
      doc.status === 'REVIEWING'
    );

    // 반려된 문서 (REJECTED 상태)
    const rejectedTasks = myDocuments.filter(doc => 
      doc.status === 'REJECTED'
    );

    // 완료된 문서 (COMPLETED 상태)
    const completedTasks = myDocuments.filter(doc => 
      doc.status === 'COMPLETED'
    );

    return {
      editingTasks,
      reviewingTasks,
      rejectedTasks,
      completedTasks
    };
  };

  const tasks = getUserTasks();

  // TodoList 컴포넌트
  const TodoList = () => {
    if (todoDocuments.length === 0) {
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
          <div className="flex items-center">
            <h2 className="text-2xl font-semibold text-gray-900">To Do List</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800 ml-2">
              {todoDocuments.length}개
            </span>
          </div>
        </div>
        
        {/* 카드 그리드 레이아웃 */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {todoDocuments.map((doc) => {
            const myTask = doc.tasks?.find(task => task.assignedUserEmail === currentUserEmail);
            const isNewTask = myTask?.isNew;
            
            // 상태에 따른 색상과 아이콘 설정
            const getStatusInfo = (status: string, isRejected?: boolean) => {
              let baseInfo;
              switch (status) {
                case 'EDITING':
                  baseInfo = {
                    color: 'blue',
                    bgColor: 'bg-blue-50',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200',
                    icon: '✏️',
                    label: '편집중'
                  };
                  break;
                case 'REVIEWING':
                  baseInfo = {
                    color: 'orange',
                    bgColor: 'bg-orange-50',
                    textColor: 'text-orange-700',
                    borderColor: 'border-orange-200',
                    icon: '👀',
                    label: '검토중'
                  };
                  break;
                case 'READY_FOR_REVIEW':
                  baseInfo = {
                      color: 'orange',
                      bgColor: 'bg-yellow-50',
                      textColor: 'text-orange-700',
                      borderColor: 'border-orange-200',
                      icon: '📝',
                      label: '서명자 지정 필요'
                      };
                  break;
                case 'REJECTED':
                  baseInfo = {
                    color: 'red',
                    bgColor: 'bg-red-50',
                    textColor: 'text-red-700',
                    borderColor: 'border-red-200',
                    icon: '❌',
                    label: '반려됨'
                  };
                  break;
                default:
                  baseInfo = {
                    color: 'gray',
                    bgColor: 'bg-gray-50',
                    textColor: 'text-gray-700',
                    borderColor: 'border-gray-200',
                    icon: '📄',
                    label: '처리 필요'
                  };
              }

              // isRejected가 true이고 현재 상태가 REJECTED가 아닌 경우 "<반려>" 접두사 추가
              if (isRejected && status !== 'REJECTED') {
                return {
                  ...baseInfo,
                  label: `<반려> ${baseInfo.label}`
                };
              }

              return baseInfo;
            };

            const statusInfo = getStatusInfo(doc.status, doc.isRejected);
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
                      {statusInfo.icon} {statusInfo.label}
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
                <div className="p-4 space-y-3">
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
                        마감일: {deadlineDate.toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
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
                      생성일: {new Date(doc.createdAt).toLocaleString('ko-KR', {
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </div>
                    {doc.updatedAt && (
                      <div className="text-gray-900 font-medium">
                        수정일: {new Date(doc.updatedAt).toLocaleString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 카드 푸터 - 액션 버튼 */}
                <div className="px-4 pb-4">
                  {doc.status === 'READY_FOR_REVIEW' ? (
                    <Link
                      to={`/documents/${doc.id}/signer-assignment`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      서명자 지정하기
                    </Link>
                  ) : doc.status === 'REVIEWING' ? (
                    <Link
                      to={`/documents/${doc.id}/review`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      서명하기
                    </Link>
                  ) : doc.status === 'REJECTED' ? (
                    <Link
                      to={`/documents/${doc.id}`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      수정하기
                    </Link>
                  ) : (
                    <Link
                      to={`/documents/${doc.id}`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
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
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
        </div>

         {/* 통계 카드 */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {/* 1. 편집 중인 문서 - 파란색 */}
           <Link to="/documents?status=EDITING" className="block group">
             <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 hover:shadow-2xl transform hover:scale-105 transition-all duration-200 cursor-pointer relative overflow-hidden">
               {/* 배경 패턴 */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
               
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                     <span className="text-white text-2xl">✏️</span>
                   </div>
                   <svg className="w-6 h-6 text-white opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
                 <div className="flex items-baseline space-x-2">
                   <h3 className="text-lg font-bold text-white">편집중</h3>
                   <p className="text-4xl font-bold text-white">{tasks.editingTasks.length}</p>
                 </div>
                 <p className="text-blue-100 text-sm mt-2">작업이 필요한 문서</p>
               </div>
             </div>
           </Link>

           {/* 2. 검토 중인 문서 - 노란색 */}
           <Link to="/documents?status=REVIEWING" className="block group">
             <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg p-6 hover:shadow-2xl transform hover:scale-105 transition-all duration-200 cursor-pointer relative overflow-hidden">
               {/* 배경 패턴 */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
               
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                     <span className="text-white text-2xl">👀</span>
                   </div>
                   <svg className="w-6 h-6 text-white opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
                 <div className="flex items-baseline space-x-2">
                   <h3 className="text-lg font-bold text-white">검토중</h3>
                   <p className="text-4xl font-bold text-white">{tasks.reviewingTasks.length}</p>
                 </div>
                 <p className="text-yellow-100 text-sm mt-2">검토가 필요한 문서</p>
               </div>
             </div>
           </Link>

           {/* 3. 반려된 문서 - 빨간색 */}
           <Link to="/documents?status=REJECTED" className="block group">
             <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 hover:shadow-2xl transform hover:scale-105 transition-all duration-200 cursor-pointer relative overflow-hidden">
               {/* 배경 패턴 */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
               
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                     <span className="text-white text-2xl">❌</span>
                   </div>
                   <svg className="w-6 h-6 text-white opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
                 <div className="flex items-baseline space-x-2">
                   <h3 className="text-lg font-bold text-white">반려됨</h3>
                   <p className="text-4xl font-bold text-white">{tasks.rejectedTasks.length}</p>
                 </div>
                 <p className="text-red-100 text-sm mt-2">수정이 필요한 문서</p>
               </div>
             </div>
           </Link>

           {/* 4. 완료된 문서 - 초록색 */}
           <Link to="/documents?status=COMPLETED" className="block group">
             <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 hover:shadow-2xl transform hover:scale-105 transition-all duration-200 cursor-pointer relative overflow-hidden">
               {/* 배경 패턴 */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
               
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                     <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </div>
                   <svg className="w-6 h-6 text-white opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
                 <div className="flex items-baseline space-x-2">
                   <h3 className="text-lg font-bold text-white">완료</h3>
                   <p className="text-4xl font-bold text-white">{tasks.completedTasks.length}</p>
                 </div>
                 <p className="text-green-100 text-sm mt-2">완료된 문서</p>
               </div>
             </div>
           </Link>
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