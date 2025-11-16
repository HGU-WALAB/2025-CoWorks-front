import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import UserSearchInput from '../components/UserSearchInput';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import { API_BASE_URL } from '../config/api';
import { usePdfPages } from '../hooks/usePdfPages';
import axios from 'axios';
import { refreshDocumentsAndUser } from '../utils/documentRefreshHelpers';

const DocumentSignerAssignment: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  // 상태 관리
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [isAssigningReviewer, setIsAssigningReviewer] = useState(false);
  const [isCompletingAssignment, setIsCompletingAssignment] = useState(false);

  // 서명자 필드 매핑 관련 상태 (템플릿의 reviewer_signature 필드와 서명자 매핑)
  const [reviewerFieldMappings, setReviewerFieldMappings] = useState<{
    [fieldId: string]: { email: string; name: string } | null;
  }>({});
  
  // 서명 필드 관련 상태 (기존 방식 유지 - 호환성)
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 줌 레벨 상태 추가
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartZoom, setTouchStartZoom] = useState<number>(1);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  // PDF 페이지 관리 훅 사용
  const {
    currentPage,
    setCurrentPage,
    totalPages: getTotalPages,
    pdfPages,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage
  } = usePdfPages(currentDocument?.template, []);

  // 템플릿에서 서명자 서명 필드 가져오기
  const getSignerSignatureFieldsFromTemplate = () => {
    if (!currentDocument?.template?.coordinateFields) return [];
    
    try {
      const fields = typeof currentDocument.template.coordinateFields === 'string'
        ? JSON.parse(currentDocument.template.coordinateFields)
        : currentDocument.template.coordinateFields;
      
      return fields.filter((field: any) => field.type === 'signer_signature' || field.type === 'reviewer_signature'); // 하위 호환성
    } catch (error) {
      console.error('템플릿 필드 파싱 실패:', error);
      return [];
    }
  };

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
      
      // 서명자 필드 매핑도 로드
      const savedMappings = localStorage.getItem(`reviewerFieldMappings_${id}`);
      if (savedMappings) {
        try {
          setReviewerFieldMappings(JSON.parse(savedMappings));
        } catch (error) {
          console.error('서명자 매핑 로드 실패:', error);
        }
      }
    }
  }, [id]);

  // 서명 필드 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    if (id && signatureFields.length > 0) {
      localStorage.setItem(`signatureFields_${id}`, JSON.stringify(signatureFields));
    }
  }, [id, signatureFields]);

  // 서명자 필드 매핑 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    if (id && Object.keys(reviewerFieldMappings).length > 0) {
      localStorage.setItem(`reviewerFieldMappings_${id}`, JSON.stringify(reviewerFieldMappings));
    }
  }, [id, reviewerFieldMappings]);

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

  // 서명자 지정 권한 확인
  const canAssignSigner = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task =>
      (task.role === 'CREATOR' || (task.role === 'EDITOR')) &&
      task.assignedUserEmail === user.email
    );
  };

  // 서명자 지정 핸들러
  const handleAssignSigner = async () => {
    if (!selectedReviewer.trim()) {
      alert('서명자 이메일을 입력해주세요.');
      return;
    }

    if (!currentDocument) {
      alert('문서 정보를 찾을 수 없습니다.');
      return;
    }

    setIsAssigningReviewer(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/documents/${currentDocument.id}/assign-signer`,
        { signerEmail: selectedReviewer },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        console.log('✅ 서명자 지정 성공:', response.data);
        
        // 입력 필드 초기화
        setSelectedReviewer('');
        
        // 문서 정보 다시 로드
        await getDocument(parseInt(id!));
        
        // 자동 매핑 로직: 서명자가 1명이고 서명 필드가 1개인 경우 자동 매핑
        const signerFields = getSignerSignatureFieldsFromTemplate();
        const updatedTasks = [...(currentDocument.tasks || []), response.data];
        const signers = updatedTasks.filter(task => task.role === 'SIGNER');
        
        if (signers.length === 1 && signerFields.length === 1) {
          const signer = signers[0];
          const field = signerFields[0];
          setReviewerFieldMappings({
            [field.id]: {
              email: signer.assignedUserEmail,
              name: signer.assignedUserName || signer.assignedUserEmail
            }
          });
          console.log('🔄 자동 매핑 완료:', {
            fieldId: field.id,
            signerEmail: signer.assignedUserEmail
          });
        }
        
        alert('서명자가 성공적으로 지정되었습니다.\n\n아래에서 각 서명 필드에 서명자를 매핑해주세요.');
      }
    } catch (error: any) {
      console.error('❌ 서명자 지정 실패:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.message || 
                            error.message;
        alert(`서명자 지정에 실패했습니다: ${errorMessage}`);
      } else {
        alert('서명자 지정 중 오류가 발생했습니다.');
      }
    } finally {
      setIsAssigningReviewer(false);
    }
  };

  // 서명자 제거 핸들러
  const handleRemoveSigner = async (signerEmail: string) => {
    if (!currentDocument) {
      alert('문서 정보를 찾을 수 없습니다.');
      return;
    }

    if (!confirm(`서명자 ${signerEmail}을(를) 제거하시겠습니까?`)) {
      return;
    }

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/documents/${currentDocument.id}/remove-signer`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: { signerEmail }
        }
      );

      if (response.status === 200) {
        console.log('✅ 서명자 제거 성공:', response.data);
        
        // 문서 정보 다시 로드
        await getDocument(parseInt(id!));
        
        alert('서명자가 성공적으로 제거되었습니다.');
      }
    } catch (error: any) {
      console.error('❌ 서명자 제거 실패:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.message || 
                            error.message;
        alert(`서명자 제거에 실패했습니다: ${errorMessage}`);
      } else {
        alert('서명자 제거 중 오류가 발생했습니다.');
      }
    }
  };

  // 서명 필드 추가 함수 (기존 방식 - 더 이상 사용하지 않음, 하위 호환성을 위해 유지)
  // const addSignatureField = (reviewerEmail: string, reviewerName: string) => {
  //   const newField = {
  //     id: `signature-${Date.now()}`,
  //     x: 100, // 기본 위치
  //     y: 100,
  //     width: 200, // 기본 크기
  //     height: 80,
  //     reviewerEmail,
  //     reviewerName,
  //     page: currentPage, // 현재 선택된 페이지
  //   };
  //
  //   setSignatureFields(prev => [...prev, newField]);
  // };

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

  // 두 터치 포인트 사이의 거리 계산
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 터치 이벤트 핸들러 (핀치 줌)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setTouchStartDistance(distance);
      setTouchStartZoom(zoomLevel);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance !== null) {
      e.preventDefault(); // 기본 스크롤 방지
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / touchStartDistance;
      const newZoom = Math.max(0.25, Math.min(2, touchStartZoom * scale));
      setZoomLevel(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDistance(null);
  };

  // 마우스 이동 (전역 이벤트)
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setActiveFieldId(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, activeFieldId, dragStart, resizeStart]);

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

  // 서명자 지정 완료 처리
  const handleCompleteSignerAssignment = async () => {
    if (!currentDocument) return;

    // 서명자가 지정되었는지 확인
    const hasSigner = currentDocument.tasks?.some(task => task.role === 'SIGNER');
    if (!hasSigner) {
      alert('먼저 서명자를 지정해주세요.');
      return;
    }

    // 템플릿의 서명자 서명 필드에 모두 서명자가 지정되었는지 확인
    const signerFields = getSignerSignatureFieldsFromTemplate();
    if (signerFields.length > 0) {
      const unassignedFields = signerFields.filter((field: any) => !reviewerFieldMappings[field.id]);
      
      if (unassignedFields.length > 0) {
        const unassignedLabels = unassignedFields
          .map((field: any) => field.label || `서명자 서명 ${field.reviewerIndex || ''}`)
          .join(', ');
        alert(`모든 서명자 서명 필드에 서명자를 지정해주세요.\n미지정 필드: ${unassignedLabels}`);
        return;
      }
    }

    setIsCompletingAssignment(true);
    try {
      // 기존 coordinateFields 가져오기
      const existingFields = currentDocument.data?.coordinateFields || [];
      
      // signer_signature 타입 필드들을 매핑 정보와 함께 coordinateFields에 추가
      const signerSignatureFields = Object.entries(reviewerFieldMappings).map(([fieldId, signer]) => {
        // 원본 템플릿 필드 정보 찾기
        const templateField = signerFields.find((f: any) => f.id === fieldId);
        
        return {
          ...templateField, // 원본 필드의 모든 속성 유지 (x, y, width, height, page 등)
          type: 'signer_signature',
          signerEmail: signer?.email,
          signerName: signer?.name,
          value: null // 아직 서명 전이므로 value는 null
        };
      });

      // 기존 방식의 서명 필드도 coordinateFields 형식으로 변환 (하위 호환성)
      const legacySignatureFields = signatureFields.map(field => ({
        id: field.id,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page || 1,
        type: 'signer_signature',
        label: `서명 (${field.reviewerName || field.reviewerEmail})`,
        signerEmail: field.reviewerEmail,
        signerName: field.reviewerName,
        value: null,
        required: true,
        fontSize: 18,
        fontFamily: 'Arial'
      }));

      // 모든 필드 합치기
      const updatedCoordinateFields = [
        ...existingFields,
        ...signerSignatureFields,
        ...legacySignatureFields
      ];

      // 문서 데이터 업데이트
      const updatedDocumentData = {
        ...currentDocument.data,
        coordinateFields: updatedCoordinateFields,
      };

      console.log('📝 서명자 필드 업데이트 전송:', {
        documentId: id,
        existingFieldsCount: existingFields.length,
        signerSignatureFieldsCount: signerSignatureFields.length,
        legacySignatureFieldsCount: legacySignatureFields.length,
        totalFieldsCount: updatedCoordinateFields.length,
        signerSignatureFields: signerSignatureFields,
        updatedCoordinateFields: updatedCoordinateFields
      });

      const updateResponse = await axios.put(`${API_BASE_URL}/documents/${id}`, {
        data: updatedDocumentData
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ 문서 데이터 업데이트 응답:', {
        status: updateResponse.status,
        data: updateResponse.data,
        coordinateFieldsCount: updateResponse.data?.data?.coordinateFields?.length || 0
      });

      // 서명자 지정 완료 API 호출
      // 백엔드에서 자동으로 처리되는 내용:
      // 1. 템플릿 생성자를 검토자(REVIEWER)로 자동 지정
      // 2. 템플릿 생성자에게 이메일 알림 발송
      // 3. 템플릿 생성자에게 인앱 알림 생성
      // 4. 문서 상태: READY_FOR_REVIEW → REVIEWING
      await axios.post(`${API_BASE_URL}/documents/${id}/complete-signer-assignment`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ 서명자 지정 완료 - 템플릿 생성자가 자동으로 검토자로 지정되었습니다.');

      // 로컬 스토리지에서 서명 필드 및 매핑 정보 제거
      if (id) {
        localStorage.removeItem(`signatureFields_${id}`);
        localStorage.removeItem(`reviewerFieldMappings_${id}`);
      }

      alert('서명자 지정이 완료되었습니다.\n담당 교직원에게 검토 알림이 발송되었습니다.');

      // 문서 목록으로 이동
      await refreshDocumentsAndUser();
      navigate('/documents');

    } catch (error) {
      console.error('서명자 지정 완료 실패:', error);
      if (axios.isAxiosError(error)) {
        alert(`서명자 지정 완료에 실패했습니다: ${error.response?.data?.error || error.message}`);
      } else {
        alert('네트워크 오류가 발생했습니다.');
      }
    } finally {
      setIsCompletingAssignment(false);
    }
  };

  // PDF 이미지 URL 생성 (현재 페이지에 맞게)
  const getPdfImageUrl = () => {
    if (pdfPages.length === 0) return '';
    const pageIndex = currentPage - 1;
    if (pageIndex >= 0 && pageIndex < pdfPages.length) {
      return `${API_BASE_URL.replace('/api', '')}${pdfPages[pageIndex]}`;
    }
    return '';
  };

  // 로딩 중이거나 문서가 아직 로드되지 않은 경우
  if (loading || !currentDocument) {
    console.log('⏳ 로딩 중 또는 문서 없음:', { loading, hasDocument: !!currentDocument });
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <div className="text-gray-500">문서를 불러오는 중...</div>
        <div className="text-xs text-gray-400 mt-2">
          Loading: {loading ? 'true' : 'false'}, Document: {currentDocument ? 'loaded' : 'null'}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-600 text-2xl mr-3">❌</div>
            <div>
              <h3 className="font-bold text-red-800 mb-2">오류가 발생했습니다</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={async () => {
                  await refreshDocumentsAndUser();
                  navigate('/documents');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                문서 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 상태 확인 (READY_FOR_REVIEW 상태에서 서명자 지정 가능)
  if (currentDocument.status !== 'READY_FOR_REVIEW' && currentDocument.status !== 'REVIEWING') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">잘못된 문서 상태</h3>
              <p className="text-yellow-700 mb-4">
                현재 문서는 서명자 지정 단계가 아닙니다. (현재 상태: {currentDocument.status})
              </p>
              <button
                onClick={async () => {
                  await refreshDocumentsAndUser();
                  navigate('/documents');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                문서 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 작성자 권한 확인
  if (!canAssignSigner()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-600 text-2xl mr-3">🚫</div>
            <div>
              <h3 className="font-bold text-red-800 mb-2">접근 권한 없음</h3>
              <p className="text-red-700 mb-4">이 문서의 서명자를 지정할 권한이 없습니다.</p>
              <button
                onClick={() => navigate('/documents')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                문서 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 액션 바 - Layout 헤더 아래 고정 위치 */}
      <div className="fixed top-[88px] left-0 right-0 z-40 bg-white border-b px-6 py-4 flex justify-between items-center w-full shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentDocument.title || currentDocument.templateName} - 서명자 지정
            </h1>
            <StatusBadge status={currentDocument.status || DOCUMENT_STATUS.REVIEWING} size="md" isRejected={currentDocument.isRejected} />
            {/* 현재 사용자에게 새로 할당된 작업이 있는지 확인하여 NEW 태그 표시 */}
            {currentDocument.tasks?.some(task => 
              task.assignedUserEmail === user?.email && task.isNew
            ) && (
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                NEW
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">
              생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCompleteSignerAssignment}
            disabled={isCompletingAssignment}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompletingAssignment ? '처리 중...' : '서명자 지정 완료'}
          </button>
          <button
            onClick={async () => {
              await refreshDocumentsAndUser();
              navigate('/documents');
            }}
            className="px-4 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 - Layout 헤더 + 액션 바 아래 고정 레이아웃 */}
      <div className="fixed top-[160px] left-0 right-0 bottom-0 flex w-full">
        {/* 문서 미리보기 영역 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex flex-col items-center p-4">
          {/* 페이지 네비게이션 및 줌 컨트롤 */}
          <div className="mb-4 flex items-center gap-4 bg-white px-6 py-3 rounded-lg shadow">
            {/* 페이지 네비게이션 (다중 페이지인 경우에만 표시) */}
            {getTotalPages > 1 && (
              <>
                <button
                  onClick={previousPage}
                  disabled={!hasPreviousPage}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                >
                  ← 이전
                </button>
                <span className="text-sm font-medium">
                  페이지 {currentPage} / {getTotalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={!hasNextPage}
                  className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                >
                  다음 →
                </button>
                <div className="w-px h-6 bg-gray-300"></div>
              </>
            )}
            {/* 줌 컨트롤 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.25, prev - 0.25))}
                disabled={zoomLevel <= 0.25}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="축소"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <span className="text-sm font-medium min-w-[50px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.25))}
                disabled={zoomLevel >= 2}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="확대"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-3 py-1 text-xs hover:bg-gray-100 rounded transition-colors"
                title="100%로 리셋"
              >
                리셋
              </button>
            </div>
          </div>

          {/* PDF 컨테이너 - 줌 적용 */}
          <div
            className="mx-auto origin-top-left touch-none"
            style={{
              width: 1240 * zoomLevel,
              height: 1754 * zoomLevel,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="relative bg-white shadow-sm border origin-top-left"
              style={{
                width: '1240px',
                height: '1754px',
                minWidth: '1240px',
                minHeight: '1754px',
                flexShrink: 0,
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top left'
              }}
            >
            {/* PDF 배경 이미지 */}
            <img
              src={getPdfImageUrl()}
              alt="Document Preview"
              className="absolute inset-0"
              style={{
                width: '1240px',
                height: '1754px',
                objectFit: 'fill'
              }}
              onError={() => {
                console.error('PDF 이미지 로드 실패:', getPdfImageUrl());
              }}
            />

            {/* 필드 컨테이너 */}
            <div className="absolute inset-0">
              {/* 기존 문서 필드들 (coordinateFields) - 현재 페이지만 표시 */}
              {(currentDocument.data?.coordinateFields || [])
                .filter((field: any) => !field.page || field.page === currentPage)
                .map((field: any) => {
                const fieldValue = field.value || field.defaultValue || '';
                
                // 테이블 필드인지 확인
                let isTableField = false;
                let isEditorSignature = false;
                let tableInfo = null;

                // 작성자 서명 필드 확인
                if (field.type === 'editor_signature') {
                  isEditorSignature = true;
                }

                // 테이블 필드 확인
                // 1. tableData 속성으로 확인
                if (field.tableData) {
                  isTableField = true;
                  tableInfo = field.tableData;
                  console.log('🔍 테이블 필드 감지 (tableData):', field.label, tableInfo);
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
                          cells: parsedValue.cells,
                          columnWidths: parsedValue.columnWidths
                        };
                        console.log('🔍 테이블 필드 감지 (JSON 파싱):', field.label, tableInfo);
                      }
                    }
                  } catch (e) {
                    // JSON 파싱 실패 시 일반 필드로 처리
                    console.log('⚠️ JSON 파싱 실패:', field.label, field.value);
                  }
                }
                
                return (
                  <div
                    key={`coord-${field.id}`}
                    className={`absolute bg-opacity-50 border flex flex-col justify-center pointer-events-none ${
                      isEditorSignature ? 'bg-green-100 border-green-500' :
                      isTableField ? 'bg-purple-100 border-purple-300' : 
                      'bg-green-100 border-green-300'
                    }`}
                    style={{
                      left: `${field.x}px`,
                      top: `${field.y}px`,
                      width: `${field.width}px`,
                      height: `${field.height}px`,
                    }}
                    title={`${field.label}: ${fieldValue}`}
                  >
                    {isEditorSignature ? (
                      // 작성자 서명 필드 렌더링
                      <div className="w-full h-full p-2 flex flex-col items-center justify-center">
                        <div className="text-xs font-medium mb-1 text-green-700 truncate">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </div>
                        {field.value && (
                          <div className="text-xs text-gray-600 mt-1 text-center">
                            {field.value.startsWith('data:image') ? (
                              <div className="flex items-center justify-center">
                                <img
                                  src={field.value}
                                  alt="작성자 서명"
                                  className="max-w-full h-8 border border-transparent rounded bg-transparent"
                                />
                              </div>
                            ) : (
                              <div>서명됨: {new Date().toLocaleDateString()}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : isTableField && tableInfo ? (
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
                                // 1. 서버에서 불러온 데이터 우선 확인 (field.value)
                                if (field.value) {
                                  let savedTableData: any = {};
                                  
                                  if (typeof field.value === 'string') {
                                    savedTableData = JSON.parse(field.value);
                                  } else {
                                    savedTableData = field.value;
                                  }
                                  
                                  // 저장된 셀 데이터가 있으면 사용
                                  if (savedTableData.cells && 
                                      Array.isArray(savedTableData.cells) && 
                                      savedTableData.cells[rowIndex] && 
                                      Array.isArray(savedTableData.cells[rowIndex])) {
                                    cellText = savedTableData.cells[rowIndex][colIndex] || '';
                                  }
                                }
                                
                                // 2. 서버 데이터가 없으면 템플릿 기본값 확인
                                if (!cellText && field.tableData && field.tableData.cells) {
                                  cellText = field.tableData.cells[rowIndex]?.[colIndex] || '';
                                }
                                
                                // 3. tableInfo.cells에서도 확인 (파싱된 데이터)
                                if (!cellText && tableInfo.cells && 
                                    Array.isArray(tableInfo.cells) && 
                                    tableInfo.cells[rowIndex] && 
                                    Array.isArray(tableInfo.cells[rowIndex])) {
                                  cellText = tableInfo.cells[rowIndex][colIndex] || '';
                                }
                                
                              } catch (error) {
                                console.error('테이블 셀 데이터 파싱 오류:', error);
                                cellText = '';
                              }

                              return (
                                <div 
                                  key={`${rowIndex}-${colIndex}`}
                                  className="bg-white bg-opacity-70 border border-purple-200 flex items-center justify-center p-1"
                                  style={{ 
                                    minHeight: '20px',
                                    fontSize: `${field.fontSize || 18}px`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                    color: '#6b21a8',
                                    fontWeight: '500'
                                  }}
                                  title={cellText || '빈 셀'}
                                >
                                  <span 
                                    className="text-center truncate leading-tight"
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      fontSize: `${field.fontSize || 18}px`,
                                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                      fontWeight: '500',
                                      color: '#6b21a8'
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
                    ) : fieldValue ? (
                      // 일반 필드 - 값이 있는 경우
                      <div 
                        className="text-gray-900 p-1 truncate text-center"
                        style={{
                          fontSize: `${field.fontSize || 16}px`,
                          fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                          fontWeight: '500'
                        }}
                      >
                        {fieldValue}
                      </div>
                    ) : (
                      // 일반 필드 - 값이 없는 경우 (제목만 표시)
                      <div className="text-xs text-green-700 font-medium p-1 truncate text-center">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 템플릿의 서명자 서명 필드 렌더링 - 현재 페이지만 표시 */}
              {(() => {
                const reviewerFields = getSignerSignatureFieldsFromTemplate();
                return reviewerFields
                  .filter((field: any) => field.page === currentPage)
                  .map((field: any) => {
                    const assignedReviewer = reviewerFieldMappings[field.id];
                    const isFocused = focusedFieldId === field.id;
                    
                    return (
                      <div
                        key={field.id}
                        id={`signature-field-${field.id}`}
                        className={`absolute border-2 select-none cursor-pointer transition-all duration-200 ${
                          isFocused 
                            ? 'border-red-700 bg-red-200 bg-opacity-70 shadow-lg ring-4 ring-red-300 ring-opacity-50 z-50' 
                            : 'border-red-500 bg-red-100 bg-opacity-50 hover:border-red-600 hover:bg-opacity-70'
                        }`}
                        style={{
                          left: `${field.x}px`,
                          top: `${field.y}px`,
                          width: `${field.width}px`,
                          height: `${field.height}px`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedFieldId(field.id);
                        }}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-red-700 font-medium p-1">
                          <div className="font-semibold">
                            {field.label || `서명자 서명 ${field.reviewerIndex || ''}`}
                          </div>
                          {assignedReviewer ? (
                            <div className="text-red-800 mt-1">
                              → {assignedReviewer.name}
                            </div>
                          ) : (
                            <div className="text-gray-500 mt-1 text-xs">
                              (미지정)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
              })()}

              {/* 기존 방식의 서명 필드 (하위 호환성) - 현재 페이지만 표시 */}
              {signatureFields
                .filter(field => field.page === currentPage)
                .map(field => (
                <div
                  key={field.id}
                  className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-50 cursor-move select-none"
                  style={{
                    left: `${field.x}px`,
                    top: `${field.y}px`,
                    width: `${field.width}px`,
                    height: `${field.height}px`
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field.id, 'drag')}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-700 font-medium">
                    서명: {field.reviewerName || field.reviewerEmail}
                  </div>
                  {/* 리사이즈 핸들 */}
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, field.id, 'resize');
                    }}
                  />
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">서명자 지정</h2>
            
            {/* 서명자 지정 폼 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  서명자 이메일
                </label>
                <UserSearchInput
                  value={selectedReviewer}
                  onChange={setSelectedReviewer}
                  placeholder="서명자 이메일을 입력하세요"
                />
              </div>
                <button
                onClick={handleAssignSigner}
                disabled={isAssigningReviewer || !selectedReviewer.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigningReviewer ? '지정 중...' : '서명자 추가'}
              </button>
            </div>

            {/* 지정된 서명자 목록 */}
            {currentDocument.tasks && currentDocument.tasks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  지정된 서명자
                  <span className="ml-2 text-xs text-gray-500">
                    ({currentDocument.tasks.filter(task => task.role === 'SIGNER').length}명)
                  </span>
                </h3>
                <div className="space-y-2">
                  {currentDocument.tasks
                    .filter(task => task.role === 'SIGNER')
                    .map((task, index) => (
                      <div key={task.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                              <div className="font-medium text-sm text-gray-900">
                                {task.assignedUserName || 'Unknown'}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500 ml-6">{task.assignedUserEmail}</div>
                          </div>
                          <button
                            onClick={() => handleRemoveSigner(task.assignedUserEmail)}
                            className="ml-2 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="서명자 제거"
                          >
                            제거
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* 구분선 */}
            <div className="my-6 border-t-2 border-gray-200"></div>

            {/* 템플릿의 서명자 서명 필드와 서명자 매핑 */}
            {(() => {
              const signerFields = getSignerSignatureFieldsFromTemplate();
              const availableSigners = currentDocument.tasks?.filter(
                task => task.role === 'SIGNER'
              ) || [];
              
              const unassignedFieldsCount = signerFields.filter((field: any) => !reviewerFieldMappings[field.id]).length;
              
              return signerFields.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-md font-medium text-gray-900 mb-3">
                    서명자 서명 필드 매핑
                    <span className="ml-2 text-xs text-gray-500">
                      ({signerFields.length}개 필드)
                    </span>
                    {unassignedFieldsCount > 0 && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                        {unassignedFieldsCount}개 미지정
                      </span>
                    )}
                  </h3>
                  
                  {availableSigners.length > 0 && unassignedFieldsCount > 0 && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <span className="text-amber-600 text-lg">⚠️</span>
                        <div className="text-sm text-amber-800">
                          <p className="font-medium">각 서명 필드에 서명자를 지정해주세요</p>
                          <p className="text-xs mt-1 text-amber-700">
                            모든 서명 필드에 서명자를 매핑해야 서명자 지정을 완료할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {signerFields.map((field: any, index: number) => {
                      const assignedSigner = reviewerFieldMappings[field.id];
                      const isFocused = focusedFieldId === field.id;
                      
                      const handleFieldClick = () => {
                        setFocusedFieldId(field.id);
                        
                        // 해당 페이지로 이동
                        if (field.page !== currentPage) {
                          setCurrentPage(field.page);
                        }
                        
                        // PDF의 서명 필드로 스크롤
                        setTimeout(() => {
                          const element = document.getElementById(`signature-field-${field.id}`);
                          if (element) {
                            element.scrollIntoView({ 
                              behavior: 'smooth', 
                              block: 'center',
                              inline: 'center'
                            });
                          }
                        }, 100);
                      };
                      
                      return (
                        <div 
                          key={field.id} 
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            isFocused 
                              ? 'bg-red-100 border-2 border-red-500 shadow-md' 
                              : 'bg-red-50 border border-red-200 hover:bg-red-100'
                          }`}
                          onClick={handleFieldClick}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${
                                isFocused ? 'bg-red-700 ring-2 ring-red-400' : 'bg-red-500'
                              }`}></span>
                              <span className={`text-sm font-medium ${
                                isFocused ? 'text-red-800' : 'text-red-900'
                              }`}>
                                {field.label || `서명자 서명 ${field.reviewerIndex || index + 1}`}
                              </span>
                            </div>
                            <span className="text-xs text-red-600">
                              페이지 {field.page}
                            </span>
                          </div>
                          
                          <select
                            value={assignedSigner?.email || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              const selectedEmail = e.target.value;
                              if (selectedEmail) {
                                const signer = availableSigners.find(
                                  t => t.assignedUserEmail === selectedEmail
                                );
                                if (signer) {
                                  setReviewerFieldMappings(prev => ({
                                    ...prev,
                                    [field.id]: {
                                      email: signer.assignedUserEmail,
                                      name: signer.assignedUserName || signer.assignedUserEmail
                                    }
                                  }));
                                }
                              } else {
                                setReviewerFieldMappings(prev => ({
                                  ...prev,
                                  [field.id]: null
                                }));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm px-2 py-1.5 border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          >
                            <option value="">서명자 선택...</option>
                            {availableSigners.map(task => (
                              <option key={task.id} value={task.assignedUserEmail}>
                                {task.assignedUserName || task.assignedUserEmail}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  
                  {signerFields.length > 0 && availableSigners.length === 0 && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded">
                      ⚠️ 먼저 서명자를 지정해주세요
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 서명 필드 목록 (기존 방식 - 하위 호환성) */}
            {signatureFields.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  추가된 서명 필드
                  <span className="ml-1 text-xs text-gray-500">(기존 방식)</span>
                </h3>
                <div className="space-y-2">
                  {signatureFields.map(field => (
                    <div key={field.id} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-sm text-blue-900">
                            {field.reviewerEmail}
                          </div>
                          <div className="text-xs text-blue-600">
                            페이지: {field.page} | 위치: ({field.x}, {field.y}) | 크기: {field.width}x{field.height}
                          </div>
                        </div>
                        <button
                          onClick={() => removeSignatureField(field.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSignerAssignment;