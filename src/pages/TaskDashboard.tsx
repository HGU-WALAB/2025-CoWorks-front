import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { getRoleAssignmentMessageShort, formatKoreanFullDateTime } from '../utils/roleAssignmentUtils';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { loadPdfPagesFromTemplate } from '../utils/pdfPageLoader';
import { Document } from '../types/document';

const TaskDashboard: React.FC = () => {
  const { documents, todoDocuments, fetchDocuments, fetchTodoDocuments, loading } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  const currentUserEmail = user?.email || '';
  const userPosition = (user?.position || '').toLowerCase();
  const showReviewingCard = userPosition === '기타' || userPosition === '교직원';
  const isStaff = user?.position === '교직원';

  // 교직원용 월별 필터 상태
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // 문서 미리보기 상태
  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);

  // 교직원용 월별 필터링된 문서 (항상 계산)
  const getMonthlyDocuments = useMemo(() => {
    if (!isStaff) return { editing: [], reviewing: [], signing: [], completed: [], rejected: [] };

    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const filteredDocs = documents.filter(doc => {
      const docDate = new Date(doc.createdAt);
      return docDate >= startDate && docDate <= endDate;
    });

    return {
      editing: filteredDocs.filter(doc => ['DRAFT', 'EDITING'].includes(doc.status)),
      reviewing: filteredDocs.filter(doc => doc.status === 'REVIEWING'),
      signing: filteredDocs.filter(doc => doc.status === 'SIGNING'),
      completed: filteredDocs.filter(doc => doc.status === 'COMPLETED'),
      rejected: filteredDocs.filter(doc => doc.status === 'REJECTED' || (doc.isRejected && doc.status === 'EDITING'))
    };
  }, [documents, selectedMonth, isStaff]);

  // 월별 옵션 생성 (최근 12개월) - 항상 계산
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      options.push({ value, label });
    }
    return options;
  }, []);

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

  // PDF 이미지 URL 생성 함수 (DocumentList.tsx와 동일)
  const getPdfImageUrl = (doc: Document) => {
    if (!doc.template?.pdfImagePath) {
      return '';
    }

    const filename = doc.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    const url = `/uploads/pdf-templates/${filename}`;

    return url;
  };

  // PDF 이미지 URL 배열 생성 함수
  const getPdfImageUrls = (doc: Document): string[] => {
    if (!doc.template) return [];
    return loadPdfPagesFromTemplate(doc.template);
  };

  // 문서 미리보기 핸들러
  const handlePreview = async (documentId: number) => {
    try {
      const document = documents.find(d => d.id === documentId);
      if (document) {
        console.log('🔍 TaskDashboard - 미리보기 문서:', document);
        setPreviewDocument(document);

        // 미리보기는 저장된 문서 데이터만 사용 (템플릿 필드와 병합하지 않음)
        const savedFields = document.data?.coordinateFields || [];

        console.log('💾 TaskDashboard - 저장된 필드 (미리보기용):', {
          count: savedFields.length,
          fields: savedFields.map((f: any) => ({
            id: f.id,
            label: f.label,
            page: f.page,
            hasValue: !!f.value
          }))
        });

        setCoordinateFields(savedFields);

        // 서명 필드 처리
        const docSignatureFields = document.data?.signatureFields || [];
        const docSignatures = document.data?.signatures || {};

        const processedSignatureFields = docSignatureFields.map((field: any) => ({
          ...field,
          signatureData: docSignatures[field.reviewerEmail]
        }));

        console.log('🖋️ TaskDashboard - 서명 필드 처리:', {
          originalSignatureFields: docSignatureFields,
          signatures: docSignatures,
          processedSignatureFields,
          signatureFieldsWithData: processedSignatureFields.filter(sf => sf.signatureData).length,
          reviewerEmails: Object.keys(docSignatures),
          hasSignatures: Object.keys(docSignatures).length > 0,
          documentStatus: document.status
        });

        setSignatureFields(processedSignatureFields);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('문서 미리보기 실패:', error);
    }
  };

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
                  if (isEditor) {
                    baseInfo = {
                      color: 'blue',
                      bgColor: 'bg-blue-50',
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
                    color: 'purple',
                    bgColor: 'bg-purple-50',
                    textColor: 'text-purple-700',
                    borderColor: 'border-purple-200',
                    label: '서명자 지정하기'
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
            if (!statusInfo) {
              return null;
            }
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
                      doc.status === 'SIGNING' 
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
                  {doc.status === 'EDITING' && isEditor ? (
                    <Link
                    to={`/documents/${doc.id}`}
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      편집하기
                    </Link>
                  ) :
                  doc.status === 'READY_FOR_REVIEW' ? (
                    <Link
                      to={`/documents/${doc.id}/signer-assignment`}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      서명자 지정하기
                    </Link>
                  ) :
                  doc.status === 'REVIEWING' ? (
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
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 교직원용 대시보드 UI
  if (isStaff) {
    return (
      <div className="container mx-auto px-4 py-4">
        <div className="space-y-6">
          {/* 페이지 헤더 및 상태별 통계 카드 */}
          <div className="bg-white rounded-lg shadow p-6">
            {/* 헤더 */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">문서 관리 대시보드</h1>
                <p className="text-gray-500 text-sm mt-1">월별 문서 현황을 확인하고 관리하세요</p>
              </div>
              
              {/* 월별 필터 */}
              <div className="flex items-center gap-3">
                <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">
                  기간 선택:
                </label>
                <select
                  id="month-filter"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {monthOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 상태별 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 작성중 */}
              <Link to="/documents?status=EDITING" className="block">
                <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-blue-500 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">작성중</h3>
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{getMonthlyDocuments.editing.length}</p>
                </div>
              </Link>

              {/* 검토중 */}
              <Link to="/documents?status=REVIEWING" className="block">
                <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-yellow-500 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">검토중</h3>
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">{getMonthlyDocuments.reviewing.length}</p>
                </div>
              </Link>

              {/* 서명중 */}
              <Link to="/documents?status=SIGNING" className="block">
                <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-orange-500 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">서명중</h3>
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{getMonthlyDocuments.signing.length}</p>
                </div>
              </Link>

              {/* 완료 */}
              <Link to="/documents?status=COMPLETED" className="block">
                <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-green-500 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">완료</h3>
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{getMonthlyDocuments.completed.length}</p>
                </div>
              </Link>

              {/* 반려 */}
              <Link to="/documents?status=REJECTED" className="block">
                <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-red-500 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">반려</h3>
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{getMonthlyDocuments.rejected.length}</p>
                </div>
              </Link>
            </div>
          </div>

          {/* 문서 목록 테이블 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {monthOptions.find(opt => opt.value === selectedMonth)?.label} 문서 목록
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      문서명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작성자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      마감일
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...getMonthlyDocuments.editing, ...getMonthlyDocuments.reviewing, ...getMonthlyDocuments.signing, ...getMonthlyDocuments.completed, ...getMonthlyDocuments.rejected]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((doc) => {
                      const editor = doc.tasks?.find(task => task.role === 'EDITOR');
                      const getStatusBadge = () => {
                        if (doc.status === 'REJECTED' || (doc.isRejected && doc.status === 'EDITING')) {
                          return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">반려</span>;
                        }
                        switch (doc.status) {
                          case 'EDITING':
                          case 'DRAFT':
                            return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">작성중</span>;
                          case 'REVIEWING':
                            return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">검토중</span>;
                          case 'SIGNING':
                            return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">서명중</span>;
                          case 'COMPLETED':
                            return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">완료</span>;
                          default:
                            return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">{doc.status}</span>;
                        }
                      };

                      return (
                        <tr key={doc.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{doc.title || doc.templateName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {editor?.assignedUserName || editor?.assignedUserEmail || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {formatKoreanFullDateTime(doc.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${doc.deadline && new Date(doc.deadline) < new Date() && doc.status !== 'COMPLETED' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {doc.deadline ? formatKoreanFullDateTime(doc.deadline) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handlePreview(doc.id)}
                              className="text-blue-600 hover:text-blue-900 hover:underline"
                            >
                              상세보기
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {[...getMonthlyDocuments.editing, ...getMonthlyDocuments.reviewing, ...getMonthlyDocuments.signing, ...getMonthlyDocuments.completed, ...getMonthlyDocuments.rejected].length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        선택한 기간에 문서가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 문서 미리보기 모달 */}
        {showPreview && previewDocument && previewDocument.template?.pdfImagePath && (
          <DocumentPreviewModal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            pdfImageUrl={getPdfImageUrl(previewDocument)}
            pdfImageUrls={getPdfImageUrls(previewDocument)}
            coordinateFields={coordinateFields}
            signatureFields={signatureFields}
            documentTitle={previewDocument.title || previewDocument.template?.name || '문서'}
          />
        )}
      </div>
    );
  }

  // 일반 사용자용 대시보드 UI
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
          <div className={`grid grid-cols-1 md:grid-cols-2 ${showReviewingCard ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
           {/* 1. 작성 중인 문서 - 파란색 글씨 */}
           <Link to="/documents?status=EDITING" className="block">
             <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-blue-500">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-medium text-gray-600">작성중</h3>
                 <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                 </svg>
               </div>
               <p className="text-3xl font-bold text-blue-600">{tasks.editingTasks.length}</p>
             </div>
           </Link>

           {/* 2. 검토 중인 문서 - 노란색 글씨 (관리자/교직원만 표시) */}
           {showReviewingCard && (
             <Link to="/documents?status=REVIEWING" className="block">
               <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-yellow-500">
                 <div className="flex items-center justify-between mb-2">
                   <h3 className="text-sm font-medium text-gray-600">검토중</h3>
                   <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                   </svg>
                 </div>
                 <p className="text-3xl font-bold text-yellow-600">{tasks.reviewingTasks.length}</p>
               </div>
             </Link>
           )}

           {/* 3. 서명 중인 문서 - 주황색 글씨 */}
           <Link to="/documents?status=SIGNING" className="block">
             <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-orange-500">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-medium text-gray-600">서명중</h3>
                 <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                 </svg>
               </div>
               <p className="text-3xl font-bold text-orange-600">{tasks.signingTasks.length}</p>
             </div>
           </Link>

           {/* 4. 반려된 문서 - 빨간색 글씨 */}
           <Link to="/documents?status=REJECTED" className="block">
             <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-red-500">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-medium text-gray-600">반려</h3>
                 <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </div>
               <p className="text-3xl font-bold text-red-600">{tasks.rejectedTasks.length}</p>
             </div>
           </Link>

           {/* 5. 완료된 문서 - 연두색 글씨 */}
           <Link to="/documents?status=COMPLETED" className="block">
             <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-green-500">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-medium text-gray-600">완료</h3>
                 <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               </div>
               <p className="text-3xl font-bold text-green-600">{tasks.completedTasks.length}</p>
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