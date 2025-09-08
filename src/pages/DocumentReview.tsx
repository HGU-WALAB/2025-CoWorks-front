import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { SignatureModal } from '../components/SignatureModal';
import UserSearchInput from '../components/UserSearchInput';
import axios from 'axios';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ isOpen, onClose, onReject }) => {
  const [reason, setReason] = useState('');

  const handleReject = () => {
    if (!reason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }
    onReject(reason);
    setReason('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">❌ 문서 반려</h2>
          <p className="text-sm text-gray-600 mt-1">
            반려 사유를 입력해주세요
          </p>
        </div>

        <div className="p-6">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유를 상세히 입력해주세요..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleReject}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              반려
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocumentReview: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  // 모달 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteSignatureSetupModal, setShowCompleteSignatureSetupModal] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [isAssigningReviewer, setIsAssigningReviewer] = useState(false);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);

  // 서명 필드 관련 상태
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // 문서별 서명 필드를 로컬 스토리지에서 로드
  useEffect(() => {
    if (id) {
      const savedFields = localStorage.getItem(`signatureFields_${id}`);
      if (savedFields) {
        try {
          setSignatureFields(JSON.parse(savedFields));
        } catch (error) {
          console.error('서명 필드 로드 실패:', error);
        }
      }
    }
  }, [id]);

  // 문서 로드 시 기존 서명 필드는 그대로 두고, 새로운 필드만 추가 가능하도록 설정
  useEffect(() => {
    // 로컬 스토리지에서 임시 작업 중인 서명 필드만 로드
    // DB의 기존 서명 필드는 읽기 전용으로 표시됨
  }, [currentDocument]);

  // 서명 필드 변경 시 로컬 스토리지에 저장 (자동 임시 저장 제거)
  useEffect(() => {
    if (id && signatureFields.length > 0) {
      localStorage.setItem(`signatureFields_${id}`, JSON.stringify(signatureFields));
    }
  }, [id, signatureFields]);

  // 서명 필드 추가 함수
  const addSignatureField = (reviewerEmail: string, reviewerName: string) => {
    const newField = {
      id: `signature-${Date.now()}`,
      x: 100, // 기본 위치
      y: 100,
      width: 200, // 기본 크기
      height: 80,
      reviewerEmail,
      reviewerName,
    };
    
    setSignatureFields(prev => [...prev, newField]);
  };

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent, fieldId: string, action: 'drag' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    
    const field = signatureFields.find(f => f.id === fieldId);
    if (!field) return;

    setActiveFieldId(fieldId);
    
    if (action === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        fieldX: field.x,
        fieldY: field.y
      });
    } else {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: field.width,
        height: field.height
      });
    }
  };

  // 마우스 이동
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeFieldId) return;

    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      setSignatureFields(prev => 
        prev.map(field => 
          field.id === activeFieldId 
            ? {
                ...field,
                x: Math.max(0, dragStart.fieldX + deltaX),
                y: Math.max(0, dragStart.fieldY + deltaY)
              }
            : field
        )
      );
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      setSignatureFields(prev => 
        prev.map(field => 
          field.id === activeFieldId 
            ? {
                ...field,
                width: Math.max(50, resizeStart.width + deltaX),
                height: Math.max(30, resizeStart.height + deltaY)
              }
            : field
        )
      );
    }
  };

  // 마우스 업
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setActiveFieldId(null);
  };

  // 서명 필드 삭제
  const removeSignatureField = (fieldId: string) => {
    setSignatureFields(prev => {
      const updated = prev.filter(f => f.id !== fieldId);
      // 로컬 스토리지 업데이트
      if (id) {
        if (updated.length === 0) {
          localStorage.removeItem(`signatureFields_${id}`);
        } else {
          localStorage.setItem(`signatureFields_${id}`, JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  // 서명 배치 완료 처리
  const handleCompleteSignatureSetup = async () => {
    if (!currentDocument) return;
    
    setIsCompletingSetup(true);
    try {
      // 서명 필드를 로컬 상태에서 관리하면서 DB에도 저장
      console.log('서명 필드 배치 완료:', signatureFields);
      
      // 서명 필드를 문서의 signatureFields에 추가
      const updatedSignatureFields = [
        ...(currentDocument.data?.signatureFields || []),
        ...signatureFields.map(field => ({
          ...field,
          id: field.id,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          reviewerEmail: field.reviewerEmail,
          reviewerName: field.reviewerName
        }))
      ];

      // 문서 데이터 업데이트 (기존 데이터 + 새로운 서명 필드)
      const updatedDocumentData = {
        ...currentDocument.data,
        signatureFields: updatedSignatureFields
      };

      // API 호출로 문서 데이터 업데이트
      await axios.put(`http://localhost:8080/api/documents/${id}`, {
        data: updatedDocumentData
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('DB에 서명 필드 저장 완료:', updatedSignatureFields);
      
      setShowCompleteSignatureSetupModal(false);
      setSignatureFields([]); // 로컬 상태 초기화
      
      // 로컬 스토리지에서도 제거
      if (id) {
        localStorage.removeItem(`signatureFields_${id}`);
      }
      
      // 문서 정보 새로고침
      await getDocument(Number(id));
      
      // 성공 메시지 표시
      alert('서명 필드 배치가 완료되었습니다. 이제 리뷰어들이 검토를 시작할 수 있습니다.');
      
    } catch (error) {
      console.error('서명 필드 저장 실패:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          alert('인증이 만료되었습니다. 다시 로그인해주세요.');
        } else if (error.response?.status === 403) {
          alert('권한이 없습니다.');
        } else if (error.response?.status === 404) {
          alert('문서를 찾을 수 없습니다.');
        } else {
          alert('서명 필드 저장에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        alert('네트워크 오류가 발생했습니다.');
      }
    } finally {
      setIsCompletingSetup(false);
    }
  };

  // 디버깅용 로그
  useEffect(() => {
    console.log('🔍 DocumentReview 인증 상태:', {
      user: user?.email,
      token: token ? `${token.substring(0, 20)}...` : 'null',
      isAuthenticated,
      axiosDefaultHeaders: axios.defaults.headers.common
    });
  }, [user, token, isAuthenticated]);

  // 인증 상태 확인
  if (!isAuthenticated || !token || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">로그인이 필요합니다</h3>
              <p className="text-yellow-700 mb-4">
                이 페이지에 접근하려면 로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                로그인하러 가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 검토자 권한 확인
  const isReviewer = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task => 
      task.role === 'REVIEWER' && 
      task.assignedUserEmail === user.email
    );
  };

  // 검토자 지정 권한 확인
  const canAssignReviewer = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task => 
      task.assignedUserEmail === user.email && 
      (task.role === 'CREATOR' || (task.role === 'EDITOR' && task.canAssignReviewer))
    );
  };

  // 검토 가능한 상태인지 확인
  const canReview = () => {
    if (!currentDocument || !user) return false;
    return isReviewer() && (currentDocument.status === 'REVIEWING' || currentDocument.status === 'READY_FOR_REVIEW');
  };

  // 승인 핸들러
  const handleApprove = () => {
    if (!canReview()) {
      alert('검토 권한이 없거나 검토 가능한 상태가 아닙니다.');
      return;
    }
    setShowSignatureModal(true);
  };

  // 서명 저장 핸들러
  const handleSignatureSave = async (signatureData: string) => {
    if (!currentDocument || !user) return;
    
    try {
      const { token } = useAuthStore.getState();
      
      console.log('📝 서명 저장 시도:', {
        documentId: currentDocument.id,
        documentStatus: currentDocument.status,
        userEmail: user.email,
        signatureDataLength: signatureData?.length,
        token: token ? '있음' : '없음'
      });
      
      const requestBody = {
        signatureData,
        reviewerEmail: user.email
      };
      
      console.log('📤 요청 본문:', requestBody);
      
      const response = await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/approve`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ 응답 성공:', response.data);
      
      // 응답에서 직접 서명 데이터 확인
      console.log('🔍 응답에서 서명 데이터 확인:', {
        documentId: response.data.id,
        documentStatus: response.data.status,
        signatureFields: response.data.data?.signatureFields,
        signatures: response.data.data?.signatures,
        hasSignatureData: !!response.data.data?.signatures?.[user.email],
        allSignatures: response.data.data?.signatures
      });
      
      // 서명 모달 닫기
      setShowSignatureModal(false);
      
      // 서명 저장 후 문서를 다시 로드하여 서명이 표시되도록 함
      const updatedDocument = await getDocument(Number(id));
      
      console.log('🔄 문서 재로드 후 서명 데이터 확인 (직접):', {
        documentId: updatedDocument?.id,
        documentStatus: updatedDocument?.status,
        signatureFields: updatedDocument?.data?.signatureFields,
        signatures: updatedDocument?.data?.signatures,
        hasSignatureData: !!updatedDocument?.data?.signatures?.[user.email],
        allSignatures: updatedDocument?.data?.signatures
      });
      
      alert('✅ 문서가 승인되었습니다! 서명이 문서에 추가되었습니다.');
      
      // 사용자가 직접 페이지를 이동할 수 있도록 자동 이동 제거
      // setTimeout(() => {
      //   navigate('/tasks');
      // }, 2000);
      
    } catch (error: any) {
      console.error('❌ 승인 실패:', error);
      console.error('❌ 에러 응답:', error.response?.data);
      console.error('❌ 에러 상태:', error.response?.status);
      console.error('❌ 에러 메시지:', error.message);
      alert(`승인 처리에 실패했습니다: ${error.response?.data?.error || error.message}`);
    }
  };

  // 반려 핸들러
  const handleReject = () => {
    if (!canReview()) {
      alert('검토 권한이 없거나 검토 가능한 상태가 아닙니다.');
      return;
    }
    setShowRejectModal(true);
  };

  // 검토자 지정 핸들러
  const handleAssignReviewer = async () => {
    if (!selectedReviewer.trim()) {
      alert('검토자 이메일을 입력해주세요.');
      return;
    }

    if (!currentDocument) {
      alert('문서 정보를 찾을 수 없습니다.');
      return;
    }

    setIsAssigningReviewer(true);

    try {
      const { token, user: currentUser } = useAuthStore.getState();
      
      // 디버깅 로그 추가
      console.log('🔍 검토자 지정 시도:', {
        documentId: currentDocument.id,
        selectedReviewer,
        currentUser: currentUser?.email,
        token: token ? `${token.substring(0, 20)}...` : 'null',
        canAssignReviewer: canAssignReviewer(),
        documentStatus: currentDocument.status,
        documentTasks: currentDocument.tasks
      });

      const response = await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/assign-reviewer`,
        { reviewerEmail: selectedReviewer },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        alert('검토자가 성공적으로 지정되었습니다.');
        setSelectedReviewer('');
        // 문서 정보 다시 로드
        getDocument(parseInt(id!));
      }
    } catch (error: any) {
      console.error('검토자 지정 실패:', error);
      alert(`검토자 지정에 실패했습니다: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsAssigningReviewer(false);
    }
  };

  // 반려 실행
  const executeReject = async (reason: string) => {
    if (!currentDocument || !user) return;
    
    try {
      const { token } = useAuthStore.getState();
      
      await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/reject`,
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
      
      alert('❌ 문서가 반려되었습니다.');
      setShowRejectModal(false);
      navigate('/tasks');
    } catch (error) {
      console.error('반려 실패:', error);
      alert('반려 처리에 실패했습니다.');
    }
  };

  // PDF 이미지 URL 생성
  const getPdfImageUrl = (document: Document) => {
    console.log('🔍 DocumentReview - PDF 이미지 URL 생성:', {
      template: document.template,
      pdfImagePath: document.template?.pdfImagePath
    });
    
    if (!document.template?.pdfImagePath) {
      console.warn('⚠️ DocumentReview - PDF 이미지 경로가 없습니다');
      return '';
    }
    
    const filename = document.template.pdfImagePath.split('/').pop();
    const url = `http://localhost:8080/api/files/pdf-template-images/${filename}`;
    
    console.log('📄 DocumentReview - 생성된 PDF 이미지 URL:', {
      originalPath: document.template.pdfImagePath,
      filename: filename,
      url: url
    });
    
    return url;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">문서를 찾을 수 없습니다.</div>
      </div>
    );
  }

  // 디버깅 정보 표시 (개발용)
  const showDebugInfo = import.meta.env.DEV;

  if (!isReviewer() && !canAssignReviewer()) {
    return (
      <div className="container mx-auto px-4 py-8">
        {showDebugInfo && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-yellow-800 mb-2">🔍 디버깅 정보</h3>
            <div className="text-sm space-y-1">
              <div>현재 사용자: {user?.email || 'null'}</div>
              <div>토큰 상태: {token ? '있음' : '없음'}</div>
              <div>인증 상태: {isAuthenticated ? '인증됨' : '인증 안됨'}</div>
              <div>검토자 권한: {isReviewer() ? '있음' : '없음'}</div>
              <div>검토자 지정 권한: {canAssignReviewer() ? '있음' : '없음'}</div>
              <div>문서 상태: {currentDocument.status}</div>
              <div>문서 작업:</div>
              <ul className="ml-4">
                {currentDocument.tasks?.map((task, idx) => (
                  <li key={idx}>
                    {task.role}: {task.assignedUserEmail} 
                    {task.role === 'EDITOR' && ` (검토자 지정 권한: ${task.canAssignReviewer ? '있음' : '없음'})`}
                  </li>
                )) || <li>작업 없음</li>}
              </ul>
            </div>
          </div>
        )}
        <div className="flex justify-center items-center h-64">
          <div className="text-red-500">이 문서의 검토 권한이나 검토자 지정 권한이 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* 헤더 - 고정 위치 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-6 py-4 flex justify-between items-center w-full">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            📋 {currentDocument.templateName} - 검토
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">
              상태: <span className="font-medium text-blue-600">{currentDocument.status}</span>
            </p>
            <span className="text-sm text-gray-500">•</span>
            <p className="text-sm text-gray-500">
              생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 서명 배치 완료 버튼 - 서명 필드가 있을 때만 표시 */}
          {signatureFields.length > 0 && (
            <button
              onClick={() => setShowCompleteSignatureSetupModal(true)}
              disabled={isCompletingSetup}
              className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 transition-colors ${
                isCompletingSetup 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isCompletingSetup ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                  처리 중
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  서명 배치 완료
                </>
              )}
            </button>
          )}
          
          {/* 검토 액션 버튼들 */}
          {canReview() && (
            <>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                승인
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                반려
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            돌아가기
          </button>
        </div>
      </div>

      {/* 검토자 지정 섹션 (헤더 아래 고정) */}
      {canAssignReviewer() && currentDocument.status === 'READY_FOR_REVIEW' && !currentDocument.tasks?.some(task => task.role === 'REVIEWER') && (
        <div className="fixed top-20 left-0 right-0 z-40 bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-yellow-800">👤 검토자 지정</h3>
              <p className="text-sm text-yellow-700">검토를 진행하기 위해 검토자를 지정해주세요.</p>
            </div>
            <div className="flex items-end space-x-3">
              <div className="w-64">
                <UserSearchInput
                  value={selectedReviewer}
                  onChange={setSelectedReviewer}
                  placeholder="검토자 이메일을 입력하세요"
                />
              </div>
              <button
                onClick={handleAssignReviewer}
                disabled={isAssigningReviewer || !selectedReviewer.trim()}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAssigningReviewer || !selectedReviewer.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isAssigningReviewer ? '지정 중...' : '검토자 지정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 - 헤더 아래 고정 레이아웃 */}
      <div className={`fixed left-0 right-0 bottom-0 flex w-full ${
        canAssignReviewer() && currentDocument.status === 'READY_FOR_REVIEW' && !currentDocument.tasks?.some(task => task.role === 'REVIEWER') 
          ? 'top-40' 
          : 'top-24'
      }`}>
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex justify-center items-start p-4">
          {/* PDF 컨테이너 - 고정 크기 */}
          <div 
            className="relative bg-white shadow-sm border"
            style={{
              width: '1240px',
              height: '1754px',
              minWidth: '1240px',
              minHeight: '1754px',
              flexShrink: 0
            }}
          >
            {/* PDF 배경 이미지 */}
            <img 
              src={getPdfImageUrl(currentDocument)}
              alt="PDF Preview"
              className="absolute inset-0"
              style={{
                width: '1240px',
                height: '1754px',
                objectFit: 'fill'
              }}
              onError={() => {
                console.error('PDF 이미지 로드 실패:', getPdfImageUrl(currentDocument));
              }}
            />
            
            {/* 필드 컨테이너 */}
            <div 
              className="absolute inset-0"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* 기존 필드 오버레이 */}
              {(currentDocument.data?.coordinateFields || []).map((field: any) => {
                console.log('🎯 검토 화면 - 필드 렌더링:', {
                  id: field.id,
                  label: field.label,
                  x: field.x,
                  y: field.y,
                  width: field.width,
                  height: field.height,
                  value: field.value,
                  hasTableData: !!field.tableData,
                  tableData: field.tableData,
                  fieldType: field.type,
                  fontSize: field.fontSize,
                  fontFamily: field.fontFamily
                });
                
                // 픽셀값 직접 사용
                const leftPercent = field.x;
                const topPercent = field.y;
                const widthPercent = field.width;
                const heightPercent = field.height;

                // 테이블 필드인지 확인
                let isTableField = false;
                let tableInfo = null;
                
                // 1. tableData 속성으로 확인
                if (field.tableData) {
                  isTableField = true;
                  tableInfo = field.tableData;
                } else {
                  // 2. value를 파싱해서 테이블 데이터 확인
                  try {
                    if (field.value && typeof field.value === 'string') {
                      const parsedValue = JSON.parse(field.value);
                      if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                        isTableField = true;
                        tableInfo = {
                          rows: parsedValue.rows,
                          cols: parsedValue.cols,
                          columnWidths: parsedValue.columnWidths
                        };
                      }
                    }
                  } catch (e) {
                    // JSON 파싱 실패 시 일반 필드로 처리
                  }
                }

                return (
                  <div
                    key={field.id}
                    className={`absolute border-2 bg-opacity-30 flex flex-col justify-center ${
                      isTableField ? 'bg-purple-100 border-purple-500' : 'bg-blue-100 border-blue-500'
                    }`}
                    style={{
                      left: `${leftPercent}px`,
                      top: `${topPercent}px`,
                      width: `${widthPercent}px`,
                      height: `${heightPercent}px`,
                    }}
                  >
                    {isTableField && tableInfo ? (
                      // 테이블 렌더링
                      <div className="w-full h-full p-1">
                        <div className="text-xs font-medium mb-1 text-purple-700 truncate">
                          {field.label} ({tableInfo.rows}×{tableInfo.cols})
                          {field.required && <span className="text-red-500">*</span>}
                        </div>
                        <div 
                          className="grid gap-px bg-purple-300" 
                          style={{
                            gridTemplateColumns: tableInfo.columnWidths 
                              ? tableInfo.columnWidths.map((width: number) => `${width * 100}%`).join(' ')
                              : `repeat(${tableInfo.cols}, 1fr)`,
                            height: 'calc(100% - 20px)'
                          }}
                        >
                          {Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
                            Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                              let cellText = '';
                              try {
                                let tableValue: any = {};
                                if (field.value) {
                                  if (typeof field.value === 'string') {
                                    tableValue = JSON.parse(field.value);
                                  } else {
                                    tableValue = field.value;
                                  }
                                }
                                
                                cellText = tableValue.cells?.[rowIndex]?.[colIndex] || '';
                                
                              } catch (error) {
                                console.error(`테이블 값 파싱 실패 [${rowIndex}][${colIndex}]:`, {
                                  fieldId: field.id,
                                  rawValue: field.value,
                                  error
                                });
                                cellText = '';
                              }
                              
                              return (
                                <div 
                                  key={`${rowIndex}-${colIndex}`}
                                  className="border border-purple-200 flex items-center justify-center p-1"
                                  style={{ 
                                    minHeight: '20px',
                                    fontSize: `${field.fontSize || 14}px !important`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                    color: '#6b21a8',
                                    fontWeight: '500'
                                  }}
                                  title={cellText || ''}
                                >
                                  <span 
                                    className="text-center truncate leading-tight"
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      fontSize: `${field.fontSize || 14}px !important`,
                                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                      fontWeight: '500 !important',
                                      color: '#6b21a8 !important'
                                    }}
                                  >
                                    {cellText}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : field.value ? (
                      // 일반 필드 - 값이 있는 경우
                      <div className="text-gray-900 p-1 truncate text-center"
                        style={{
                          fontSize: `${field.fontSize || 14}px !important`,
                          fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                          fontWeight: '500 !important'
                        }}
                      >
                        {field.value}
                      </div>
                    ) : (
                      // 일반 필드 - 값이 없는 경우
                      <div className="text-xs text-blue-700 font-medium p-1 truncate text-center">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 기존 서명 필드 렌더링 */}
              {(() => {
                const existingSignatureFields = currentDocument.data?.signatureFields || [];
                const signatures = currentDocument.data?.signatures || {};
                
                return existingSignatureFields.map((field: any) => {
                  const signatureData = signatures[field.reviewerEmail];
                  
                  return (
                    <div
                      key={`existing-signature-${field.id}`}
                      className="absolute border-2 border-green-500 flex flex-col justify-center items-center p-1"
                      style={{
                        left: `${field.x}px`,
                        top: `${field.y}px`,
                        width: `${field.width}px`,
                        height: `${field.height}px`,
                      }}
                    >
                      {signatureData ? (
                        <img 
                          src={signatureData} 
                          alt={`${field.reviewerName} 서명`}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-xs text-green-700 font-medium text-center">
                          {field.reviewerName} 서명
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* 새로 추가된 서명 필드 렌더링 */}
              {signatureFields.map((field) => (
                <div
                  key={field.id}
                  className={`absolute border-2 border-orange-500 flex flex-col justify-center items-center p-1 cursor-move ${
                    activeFieldId === field.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{
                    left: `${field.x}px`,
                    top: `${field.y}px`,
                    width: `${field.width}px`,
                    height: `${field.height}px`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field.id, 'drag')}
                >
                  {/* 서명 필드 내용 */}
                  <div className="text-xs text-orange-700 font-medium text-center pointer-events-none">
                    {field.reviewerName} 서명
                    <div className="text-orange-600">드래그 가능</div>
                  </div>
                  
                  {/* 리사이즈 핸들 */}
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-orange-500 cursor-se-resize"
                    onMouseDown={(e) => handleMouseDown(e, field.id, 'resize')}
                  />
                  
                  {/* 삭제 버튼 */}
                  <button
                    className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs flex items-center justify-center rounded-full transform translate-x-1 -translate-y-1 hover:bg-red-600"
                    onClick={() => removeSignatureField(field.id)}
                    title="서명 필드 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 패널 - 검토자 리스트 및 정보 (고정 너비, 고정 위치) */}
        <div className="w-80 bg-white border-l overflow-y-auto flex-shrink-0 h-full">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">검토 정보</h2>
            <p className="text-sm text-gray-500 mt-1">
              문서 상태 및 검토자 정보
            </p>
          </div>
          
          <div className="p-4 space-y-4">
            {/* 리뷰어 목록 */}
            <div className="border rounded-lg p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-3">👥 리뷰어 목록</h3>
              <div className="space-y-3">
                {currentDocument.tasks && currentDocument.tasks.length > 0 ? (
                  currentDocument.tasks
                    .filter(task => task.role === 'REVIEWER')
                    .map((reviewer, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-green-50 border border-green-200">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {reviewer.assignedUserName ? reviewer.assignedUserName.charAt(0).toUpperCase() : 'R'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                              검토자
                            </span>
                            <button
                              onClick={() => addSignatureField(reviewer.assignedUserEmail, reviewer.assignedUserName || '검토자')}
                              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors"
                              title="서명 필드 추가"
                            >
                              + 서명 필드
                            </button>
                          </div>
                          <div className="text-sm font-medium text-gray-900 mt-1">
                            {reviewer.assignedUserName || '이름 없음'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {reviewer.assignedUserEmail}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            지정일: {new Date(reviewer.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <p className="text-sm">지정된 리뷰어가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 편집자 정보 (참고용) */}
            {currentDocument.tasks && currentDocument.tasks.some(task => task.role === 'EDITOR') && (
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-medium text-gray-900 mb-3">✏️ 편집자</h3>
                <div className="space-y-2">
                  {currentDocument.tasks
                    .filter(task => task.role === 'EDITOR')
                    .map((editor, index) => (
                      <div key={index} className="flex items-center space-x-3 p-2 rounded-lg bg-blue-50">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {editor.assignedUserName ? editor.assignedUserName.charAt(0).toUpperCase() : 'E'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {editor.assignedUserName || '이름 없음'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {editor.assignedUserEmail}
                          </div>
                        </div>
                        {editor.canAssignReviewer && (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            리뷰어 지정 권한
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
                                        fontWeight: '500'
      
      {/* 서명 배치 완료 확인 모달 */}
      {showCompleteSignatureSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">서명 배치 완료 확인</h3>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                서명 필드 배치를 완료하시겠습니까?
              </p>
              <p className="text-sm text-blue-600">
                ✓ 총 {signatureFields.length}개의 서명 필드가 배치되었습니다.
              </p>
              <p className="text-sm text-amber-600">
                ⚠️ 완료 후에는 서명 필드를 수정할 수 없으며, 리뷰어들이 검토를 시작할 수 있습니다.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCompleteSignatureSetupModal(false)}
                  disabled={isCompletingSetup}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleCompleteSignatureSetup}
                  disabled={isCompletingSetup}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                    isCompletingSetup 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isCompletingSetup ? '처리 중...' : '완료'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 서명 모달 */}
      {showSignatureModal && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={handleSignatureSave}
          reviewerName={user?.name || '검토자'}
        />
      )}

      {/* 반려 모달 */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onReject={executeReject}
      />
    </div>
  );
};

export default DocumentReview; 