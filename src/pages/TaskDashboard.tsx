import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
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



  // 사용자별 작업 분류 (편집중, 검토중, 반려됨, 완료됨)
  const getUserTasks = () => {
    const myDocuments = documents.filter(doc =>
        doc.tasks?.some(task => task.assignedUserEmail === currentUserEmail) || false
    );

    // 편집 중인 문서 (DRAFT, EDITING 상태)
    const editingTasks = myDocuments.filter(doc => 
      ['DRAFT', 'EDITING'].includes(doc.status)
    );

    // 검토 중인 문서 (REVIEWING 상태이면서 현재 사용자가 검토자인 경우)
    const reviewingTasks = myDocuments.filter(doc => {
      if (doc.status !== 'REVIEWING') return false;
      // 현재 사용자가 검토자(REVIEWER 역할)인지 확인
      return doc.tasks?.some(task => 
        task.role === 'REVIEWER' && task.assignedUserEmail === currentUserEmail
      ) || false;
    });

    // 반려된 문서 (REJECTED 상태)
    const rejectedTasks = myDocuments.filter(doc => 
      doc.status === 'REJECTED'
    );

    // 완료된 문서 (FINISHED 상태)
    const completedTasks = myDocuments.filter(doc => 
      doc.status === 'FINISHED'
    );

    return {
      editingTasks,
      reviewingTasks,
      rejectedTasks,
      completedTasks
    };
  };

  const tasks = getUserTasks();




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
                   <h3 className="text-lg font-medium text-gray-900">편집 중인 문서</h3>
                   <p className="text-3xl font-bold text-blue-600">{tasks.editingTasks.length}</p>
                   <p className="text-sm text-gray-500">편집 작업 진행중</p>
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
           <Link to="/documents?status=REVIEWING&reviewer=me" className="block">
             <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500 hover:bg-gray-50 transition-colors cursor-pointer">
               <div className="flex items-center">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                     <span className="text-white text-lg">👀</span>
                   </div>
                 </div>
                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">검토 중인 문서</h3>
                   <p className="text-3xl font-bold text-yellow-600">{tasks.reviewingTasks.length}</p>
                   <p className="text-sm text-gray-500">검토 작업 진행중</p>
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
                   <h3 className="text-lg font-medium text-gray-900">반려된 문서</h3>
                   <p className="text-3xl font-bold text-red-600">{tasks.rejectedTasks.length}</p>
                   <p className="text-sm text-gray-500">수정이 필요한 문서</p>
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
           <Link to="/documents?status=FINISHED" className="block">
             <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
               <div className="flex items-center">
                 <div className="flex-shrink-0">
                   <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
                     <span className="text-white text-lg">✅</span>
                   </div>
                 </div>
                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">완료된 문서</h3>
                   <p className="text-3xl font-bold text-gray-600">{tasks.completedTasks.length}</p>
                   <p className="text-sm text-gray-500">작업 완료된 문서</p>
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


        {/* 작업 생성 방법 섹션 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">작업 생성 방법</h2>
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
  );
};

export default TaskDashboard;