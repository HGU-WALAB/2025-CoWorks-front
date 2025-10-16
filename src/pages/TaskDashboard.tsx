import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';

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
        <div className="divide-y divide-gray-200">
          {todoDocuments.map((doc) => {
            const myTask = doc.tasks?.find(task => task.assignedUserEmail === currentUserEmail);
            const isNewTask = myTask?.isNew;
            const taskRole = myTask?.role;
            
            // 상태에 따른 색상과 아이콘 설정
            const getStatusInfo = (status: string) => {
              switch (status) {
                case 'EDITING':
                  return {
                    color: 'blue',
                    bgColor: 'bg-blue-50',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200',
                    icon: '✏️',
                    label: '편집중'
                  };
                case 'REVIEWING':
                  return {
                    color: 'yellow',
                    bgColor: 'bg-yellow-50',
                    textColor: 'text-yellow-700',
                    borderColor: 'border-yellow-200',
                    icon: '👀',
                    label: '검토중'
                  };
                case 'READY_FOR_REVIEW':
                  return {
                      color: 'orange',
                      bgColor: 'bg-orange-50',
                      textColor: 'text-orange-700',
                      borderColor: 'border-orange-200',
                      icon: '📝',
                      label: '서명자 지정 필요'
                      };
                case 'REJECTED':
                  return {
                    color: 'red',
                    bgColor: 'bg-red-50',
                    textColor: 'text-red-700',
                    borderColor: 'border-red-200',
                    icon: '❌',
                    label: '반려됨'
                  };
                default:
                  return {
                    color: 'gray',
                    bgColor: 'bg-gray-50',
                    textColor: 'text-gray-700',
                    borderColor: 'border-gray-200',
                    icon: '📄',
                    label: '처리 필요'
                  };
              }
            };

            const statusInfo = getStatusInfo(doc.status);
            const deadlineDate = doc.deadline ? new Date(doc.deadline) : null;
            const isOverdue = deadlineDate && deadlineDate < new Date();

            return (
              <div key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <Link 
                        to={`/documents/${doc.id}`}
                        className="text-2xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {doc.title || doc.templateName}
                      </Link>
                      {isNewTask && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse">
                          NEW
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                      <span>템플릿: {doc.templateName}</span>
                      {taskRole && (
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs">
                          {taskRole === 'CREATOR' ? '생성자' : taskRole === 'EDITOR' ? '편집자' :
                              taskRole === 'REVIEWER' ? '검토자' : '기타 역할'}
                        </span>
                      )}
                      {deadlineDate && (
                        <span className={`px-2 py-1 rounded-md text-xs ${
                          isOverdue 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          마감일: {deadlineDate.toLocaleDateString()}
                          {isOverdue}
                        </span>
                      )}
                      {/* 액션 버튼을 taskRole 오른쪽으로 이동 */}
                      <span className="ml-auto flex items-center space-x-2">
                        {doc.status === 'READY_FOR_REVIEW' ? (
                          <Link
                            to={`/documents/${doc.id}/signer-assignment`}
                            className="inline-flex items-center px-4 py-2.5 border border-transparent text-base leading-5 font-medium rounded-md text-orange-500 bg-orange-100 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-200 transition-colors"
                          >
                            서명자 지정하기
                          </Link>
                        ) : doc.status === 'REVIEWING' ? (
                          <Link
                            to={`/documents/${doc.id}/review`}
                            className="inline-flex items-center px-4 py-2.5 border border-transparent text-base leading-5 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            서명하기
                          </Link>
                        ) : (
                          <Link
                            to={`/documents/${doc.id}`}
                            className="inline-flex items-center px-4 py-2.5 border border-transparent text-base leading-5 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            {doc.status === 'EDITING' ? '편집하기' :
                              doc.status === 'REJECTED' ? '수정하기' : '이 버튼 뜨면 안됨 - 문서 완료상태가 TodoList에 뜬다는 것'}
                          </Link>
                        )}
                      </span>
                    </div>
                    {/* 생성일/수정일을 템플릿 라인 아래로 이동 */}
                    <div className="text-xs text-gray-500 space-x-4 mt-2">
                      <span>생성일: {new Date(doc.createdAt).toLocaleDateString()}</span>
                      {doc.updatedAt && (
                        <span>수정일: {new Date(doc.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

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
           <Link to="/documents?status=EDITING" className="block">
             <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500 hover:bg-gray-50 transition-colors cursor-pointer">
               <div className="flex items-center">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                     <span className="text-white text-lg">✏️</span>
                   </div>
                 </div>
                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">편집중</h3>
                   <p className="text-3xl font-bold text-blue-600">{tasks.editingTasks.length}</p>
                 </div>
                 <div className="ml-auto">
                   <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
               </div>
             </div>
           </Link>

           {/* 2. 검토 중인 문서 - 노란색 */}
           <Link to="/documents?status=REVIEWING" className="block">
             <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500 hover:bg-gray-50 transition-colors cursor-pointer">
               <div className="flex items-center">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                     <span className="text-white text-lg">👀</span>
                   </div>
                 </div>
                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">검토중</h3>
                   <p className="text-3xl font-bold text-yellow-600">{tasks.reviewingTasks.length}</p>
                 </div>
                 <div className="ml-auto">
                   <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
               </div>
             </div>
           </Link>

           {/* 3. 반려된 문서 - 빨간색 */}
           <Link to="/documents?status=REJECTED" className="block">
             <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500 hover:bg-gray-50 transition-colors cursor-pointer">
               <div className="flex items-center">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                     <span className="text-white text-lg">❌</span>
                   </div>
                 </div>
                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">반려됨</h3>
                   <p className="text-3xl font-bold text-red-600">{tasks.rejectedTasks.length}</p>
                 </div>
                 <div className="ml-auto">
                   <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
               </div>
             </div>
           </Link>

           {/* 4. 완료된 문서 - 회색 */}
           <Link to="/documents?status=COMPLETED" className="block">
             <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
               <div className="flex items-center">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">

                   </div>
                 </div>
                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">완료</h3>
                   <p className="text-3xl font-bold text-gray-600">{tasks.completedTasks.length}</p>
                 </div>
                 <div className="ml-auto">
                   <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                 </div>
               </div>
             </div>
           </Link>
         </div>


        {/* TodoList 섹션 */}
        <TodoList />

        
        {/* 문서 생성 방법 섹션 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">문서 생성 방법</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">1. 문서 생성 하기</h3>
              <p className="text-sm text-gray-600">템플릿을 선택하여 문서를 생성한 후 문서 정보를 입력하세요.</p>
            </div>

            {/* Step 2 */}
            <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">2. 문서 편집 하기</h3>
              <p className="text-sm text-gray-600">편집할 위치를 클릭하여 편집할 내용을 입력하세요.</p>
            </div>

            {/* Step 3 */}
            <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">3. 서명자 지정 하기</h3>
              <p className="text-sm text-gray-600">문서 편집을 완료한 후 서명자를 지정하세요.</p>
            </div>

            {/* Step 4 */}
            <div className="bg-blue-50 rounded-xl p-6 text-center transition-transform hover:-translate-y-1 hover:shadow-lg">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">4. 문서 작업 완료</h3>
              <p className="text-sm text-gray-600">서명자의 서명 완료 되면 문서 작업이 완료됩니다!.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TaskDashboard;