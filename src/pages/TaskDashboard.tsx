import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { SignatureModal } from '../components/SignatureModal';
import axios from 'axios';

interface ReviewSignature {
  documentId: number;
  signatureData: string;
}

const TaskDashboard: React.FC = () => {
  const { documents, fetchDocuments, loading } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'creator' | 'editor' | 'reviewer'>('all');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentReviewDocument, setCurrentReviewDocument] = useState<Document | null>(null);
  
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

  // 디버깅을 위한 로그
  useEffect(() => {
    console.log('TaskDashboard: Documents updated', { 
      documentsCount: documents.length, 
      currentUserEmail,
      documents: documents.map(d => ({
        id: d.id,
        templateName: d.templateName,
        status: d.status,
        tasksCount: d.tasks?.length || 0,
        tasks: d.tasks?.map(t => ({ role: t.role, assignedUserEmail: t.assignedUserEmail, status: t.status }))
      }))
    });
  }, [documents, currentUserEmail]);

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
  
  const getTaskStatus = (doc: Document) => {
    const task = getUserTask(doc);
    return task?.status || 'PENDING';
  };

  // 사용자별 작업 분류
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
      return userTasks.some(task => task.status === 'PENDING');
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

  // 필터링된 문서들
  const getFilteredDocuments = () => {
    let filtered = tasks.allTasks;

    if (filter === 'pending') {
      filtered = tasks.pendingTasks;
    } else if (filter === 'completed') {
      filtered = tasks.completedTasks;
    }

    if (roleFilter === 'creator') {
      filtered = filtered.filter(doc => tasks.createdByMe.includes(doc));
    } else if (roleFilter === 'editor') {
      filtered = filtered.filter(doc => tasks.assignedToEdit.includes(doc));
    } else if (roleFilter === 'reviewer') {
      filtered = filtered.filter(doc => tasks.assignedToReview.includes(doc));
    }

    return filtered;
  };

  const filteredDocuments = getFilteredDocuments();

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

  const getRoleBadge = (doc: Document) => {
    const userTasks = doc.tasks?.filter(task => task.assignedUserEmail === currentUserEmail) || [];
    const roles = userTasks.map(task => task.role);
    
    const roleLabels = {
      CREATOR: '생성자',
      EDITOR: '편집자',
      REVIEWER: '검토자'
    };

    return roles.map(role => (
      <span key={role} className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded mr-1">
        {roleLabels[role as keyof typeof roleLabels]}
      </span>
    ));
  };

  // 문서의 모든 담당자 정보를 반환하는 함수
  const getTaskAssignees = (doc: Document) => {
    const assignees = {
      creator: doc.tasks?.find(task => task.role === 'CREATOR'),
      editor: doc.tasks?.find(task => task.role === 'EDITOR'),
      reviewer: doc.tasks?.find(task => task.role === 'REVIEWER')
    };

    return assignees;
  };

  // 담당자 정보를 표시하는 컴포넌트
  const renderAssigneeInfo = (task: any, roleLabel: string, colorClass: string) => {
    if (!task) {
      return (
        <div className="flex items-center text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full ${colorClass} mr-2 opacity-30`}></span>
          <span>{roleLabel}: 미할당</span>
        </div>
      );
    }

    const statusIcon = task.status === 'COMPLETED' ? '✓' : 
                      task.status === 'PENDING' ? '⏳' : '●';
    
    return (
      <div className="flex items-center text-xs">
        <span className={`w-2 h-2 rounded-full ${colorClass} mr-2`}></span>
        <span className="text-gray-700">
          {roleLabel}: <span className="font-medium">{task.assignedUserName}</span>
          <span className="ml-1 text-gray-500">({task.assignedUserEmail})</span>
          <span className="ml-1">{statusIcon}</span>
        </span>
      </div>
    );
  };

  const getUrgencyLevel = (doc: Document) => {
    const daysSinceCreated = Math.floor(
      (new Date().getTime() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (doc.status === 'REVIEWING' && daysSinceCreated > 3) {
      return { level: 'high', label: '긴급', color: 'text-red-600' };
    } else if (daysSinceCreated > 7) {
      return { level: 'medium', label: '주의', color: 'text-yellow-600' };
    }
    return { level: 'normal', label: '일반', color: 'text-green-600' };
  };

  // 검토 승인 핸들러
  const handleApproveReview = (document: Document) => {
    setCurrentReviewDocument(document);
    setShowSignatureModal(true);
  };

  // 서명 저장 핸들러
  const handleSignatureSave = async (signatureData: string) => {
    if (!currentReviewDocument || !user) return;
    
    try {
      // authStore에서 토큰 가져오기
      const { token } = useAuthStore.getState();
      
      // 서명 데이터와 함께 승인 요청
      await axios.post(
        `http://localhost:8080/api/documents/${currentReviewDocument.id}/approve`,
        {
          signatureData,
          reviewerEmail: user.email
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      alert('✅ 문서가 승인되었습니다!');
      
      // 목록 새로고침
      fetchDocuments();
      
      setCurrentReviewDocument(null);
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인 처리에 실패했습니다.');
    }
  };

  // 검토 거부 핸들러
  const handleRejectReview = async (document: Document) => {
    const reason = prompt('거부 사유를 입력해주세요:');
    if (!reason || !user) return;
    
    try {
      // authStore에서 토큰 가져오기
      const { token } = useAuthStore.getState();
      
      await axios.post(
        `http://localhost:8080/api/documents/${document.id}/reject`,
        {
          reason,
          reviewerEmail: user.email
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      alert('❌ 문서가 거부되었습니다.');
      
      // 목록 새로고침
      fetchDocuments();
    } catch (error) {
      console.error('거부 실패:', error);
      alert('거부 처리에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">작업 현황</h1>
        <p className="mt-2 text-gray-600">내가 관련된 모든 작업들을 확인하고 관리하세요.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">📝</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">전체 작업</h3>
              <p className="text-2xl font-bold text-blue-600">{tasks.allTasks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">⏳</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">대기중</h3>
              <p className="text-2xl font-bold text-yellow-600">{tasks.pendingTasks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">✅</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">완료</h3>
              <p className="text-2xl font-bold text-green-600">{tasks.completedTasks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">👤</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">내가 생성</h3>
              <p className="text-2xl font-bold text-purple-600">{tasks.createdByMe.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 작업 목록 */}
      <div className="bg-white rounded-lg shadow">
        {/* 필터 바 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-4">
            <div className="flex space-x-2">
              <span className="text-sm font-medium text-gray-700">상태:</span>
              {[
                { key: 'all', label: '전체' },
                { key: 'pending', label: '대기중' },
                { key: 'completed', label: '완료' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-3 py-1 text-sm rounded-full ${
                    filter === key
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex space-x-2">
              <span className="text-sm font-medium text-gray-700">역할:</span>
              {[
                { key: 'all', label: '전체' },
                { key: 'creator', label: '생성자' },
                { key: 'editor', label: '편집자' },
                { key: 'reviewer', label: '검토자' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRoleFilter(key as any)}
                  className={`px-3 py-1 text-sm rounded-full ${
                    roleFilter === key
                      ? 'bg-purple-100 text-purple-800 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 작업 목록 */}
        <div className="divide-y divide-gray-200">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => {
              const urgency = getUrgencyLevel(doc);
              return (
                <div key={doc.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          <Link 
                            to={`/documents/${doc.id}/edit`}
                            className="hover:text-blue-600"
                          >
                            {doc.templateName}
                          </Link>
                        </h3>
                        {getStatusBadge(doc.status)}
                        <span className={`text-sm font-medium ${urgency.color}`}>
                          {urgency.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>문서 ID: {doc.id}</span>
                        <span>생성일: {new Date(doc.createdAt).toLocaleDateString('ko-KR')}</span>
                        <span>수정일: {new Date(doc.updatedAt).toLocaleDateString('ko-KR')}</span>
                      </div>

                      {/* 현재 사용자 역할 표시 */}
                      <div className="mt-2">
                        {getRoleBadge(doc)}
                      </div>

                      {/* 모든 담당자 정보 표시 */}
                      <div className="mt-3 space-y-1">
                        <div className="text-xs font-medium text-gray-700 mb-2">담당자 현황:</div>
                        <div className="flex flex-wrap gap-4">
                          {(() => {
                            const assignees = getTaskAssignees(doc);
                            return (
                              <>
                                {renderAssigneeInfo(assignees.creator, '생성자', 'bg-green-500')}
                                {renderAssigneeInfo(assignees.editor, '편집자', 'bg-blue-500')}
                                {renderAssigneeInfo(assignees.reviewer, '검토자', 'bg-yellow-500')}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        보기
                      </Link>
                      {/* 편집 버튼: 작업이 완료되지 않고, 문서가 편집 가능한 상태이며, 사용자가 편집 권한이 있는 경우에만 표시 */}
                      {getTaskStatus(doc) !== 'COMPLETED' && 
                       doc.status !== 'COMPLETED' && 
                       doc.status !== 'REJECTED' &&
                       (getUserRole(doc) === 'CREATOR' || getUserRole(doc) === 'EDITOR') && (
                        <Link
                          to={`/documents/${doc.id}/edit`}
                          className="text-green-600 hover:text-green-700 text-sm"
                        >
                          편집
                        </Link>
                      )}
                      
                      {/* 검토자를 위한 검토 페이지 링크 */}
                      {getUserRole(doc) === 'REVIEWER' && doc.status === 'REVIEWING' && getTaskStatus(doc) === 'PENDING' && (
                        <Link
                          to={`/documents/${doc.id}/review`}
                          className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                        >
                          검토
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">표시할 작업이 없습니다</h3>
              <p className="text-gray-600">
                {filter === 'all' && roleFilter === 'all' 
                  ? '아직 할당된 작업이 없습니다.'
                  : '선택한 필터 조건에 맞는 작업이 없습니다.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 빠른 액션 */}
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
      </div>

      {/* 서명 모달 */}
      {showSignatureModal && currentReviewDocument && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={handleSignatureSave}
          reviewerName={user?.name || '검토자'}
        />
      )}
    </div>
  );
};

export default TaskDashboard; 