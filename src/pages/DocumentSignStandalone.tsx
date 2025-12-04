import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { SignatureModal } from '../components/SignatureModal';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { API_BASE_URL } from '../config/api';
import { usePdfPages } from '../hooks/usePdfPages';
import axios from 'axios';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';

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

const PDF_WIDTH = 1240;
const PDF_HEIGHT = 1754;

const DocumentSignStandalone: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token'); // URL에서 토큰 추출
  
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, isAuthenticated } = useAuthStore();

  // 익명 사용자 정보 (토큰 기반)
  const [anonymousUserEmail, setAnonymousUserEmail] = useState<string | null>(null);
  const [isAnonymousUser, setIsAnonymousUser] = useState(false);

  // 모달 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<'success' | 'rejected' | null>(null);

  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfScale, setPdfScale] = useState(1);
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartScale, setTouchStartScale] = useState<number>(1);
  const [isManuallyScaled, setIsManuallyScaled] = useState(false); // 수동 줌 여부 추적

  // PDF 페이지 관리 훅 사용
  const {
    currentPage,
    totalPages: getTotalPages,
    pdfPages,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage
  } = usePdfPages(currentDocument?.template, []);

  // 두 터치 포인트 간 거리 계산
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 터치 이벤트 핸들러 등록 (passive: false로 설정)
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = getTouchDistance(e.touches[0], e.touches[1]);
        setTouchStartDistance(distance);
        setTouchStartScale(pdfScale);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistance !== null) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / touchStartDistance;
        const newScale = Math.max(0.5, Math.min(3, touchStartScale * scale));
        setPdfScale(newScale);
        setIsManuallyScaled(true); // 수동 줌 활성화
      }
    };

    const handleTouchEnd = () => {
      setTouchStartDistance(null);
      // 터치가 끝나도 스케일은 유지 (isManuallyScaled가 true로 유지됨)
    };

    // passive: false로 설정하여 preventDefault()가 작동하도록 함
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pdfScale, touchStartDistance, touchStartScale]);

  // 자동 스케일 조정
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 터치 제스처가 없고 수동으로 조정하지 않았을 때만 자동 스케일 조정
    if (touchStartDistance === null && !isManuallyScaled) {
      const updateScale = () => {
        const containerWidth = pdfContainerRef.current?.clientWidth ?? window.innerWidth;
        const computedScale = Math.min(1, containerWidth / PDF_WIDTH);
        setPdfScale(Number.isFinite(computedScale) && computedScale > 0 ? computedScale : 1);
      };

      updateScale();

      let resizeObserver: ResizeObserver | null = null;

      if (typeof ResizeObserver !== 'undefined' && pdfContainerRef.current) {
        resizeObserver = new ResizeObserver(() => updateScale());
        resizeObserver.observe(pdfContainerRef.current);
      }

      window.addEventListener('resize', updateScale);

      return () => {
        window.removeEventListener('resize', updateScale);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }, [currentDocument?.id, touchStartDistance, isManuallyScaled]);

  useEffect(() => {
    if (id) {
      // 토큰이 있으면 익명 사용자로 문서 조회
      if (token) {
        fetchDocumentWithToken(parseInt(id), token);
      } else if (isAuthenticated) {
        // 로그인한 사용자는 기존 방식으로 조회
        getDocument(parseInt(id));
      }
    }
  }, [id, token, isAuthenticated, getDocument]);

  // 토큰 기반 문서 조회 함수
  const fetchDocumentWithToken = async (docId: number, signingToken: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/public/sign/${docId}?token=${signingToken}`
      );
      
      if (response.data) {
        // 익명 사용자 정보 설정
        setIsAnonymousUser(true);
        setAnonymousUserEmail(response.data.signerEmail);
        
        // 문서 스토어에 직접 설정 (임시 방법)
        useDocumentStore.setState({ 
          currentDocument: response.data.document,
          loading: false,
          error: null
        });

        // 문서가 이미 완료된 경우 완료 모달 표시
        if (response.data.document?.status === 'COMPLETED') {
          setSubmissionResult('success');
        }
      }
    } catch (error) {
      console.error('❌ 토큰 기반 문서 조회 실패:', error);
      
      // 401 에러인 경우 (토큰 만료/무효) - 이미 서명이 완료된 상태일 수 있음
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // 현재 문서가 이미 로드되어 있고 서명이 완료된 경우, 에러를 무시하고 계속 진행
        if (currentDocument && (hasCurrentUserSigned() || currentDocument.status === 'COMPLETED')) {
          console.log('✅ 서명 완료된 문서 - 토큰 만료는 정상');
          setSubmissionResult('success');
          return;
        }
      }
      
      useDocumentStore.setState({
        loading: false,
        error: '문서를 불러올 수 없습니다. 링크가 만료되었거나 유효하지 않습니다.'
      });
    }
  };

  // 인증 상태 확인 - 익명 사용자도 허용
  if (!isAuthenticated && !isAnonymousUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">접근 권한이 없습니다</h3>
              <p className="text-yellow-700 mb-4">
                유효한 서명 링크가 아닙니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 서명자 권한 확인
  const isSigner = () => {
    if (!currentDocument) return false;
    
    // 익명 사용자인 경우
    if (isAnonymousUser && anonymousUserEmail) {
      return currentDocument.tasks?.some(task =>
        task.role === 'SIGNER' &&
        task.assignedUserEmail === anonymousUserEmail
      );
    }
    
    // 로그인 사용자인 경우
    if (user) {
      return currentDocument.tasks?.some(task =>
        task.role === 'SIGNER' &&
        task.assignedUserEmail === user.email
      );
    }
    
    return false;
  };

  // 현재 사용자가 이미 서명했는지 확인
  const hasCurrentUserSigned = () => {
    if (!currentDocument) return false;

    const coordinateFields = (currentDocument.data?.coordinateFields || []) as any[];
    const currentUserEmail = isAnonymousUser ? anonymousUserEmail : user?.email;
    
    if (!currentUserEmail) return false;
    
    return coordinateFields.some((field) =>
      (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
      (field.signerEmail === currentUserEmail || field.reviewerEmail === currentUserEmail) &&
      field.value &&
      field.value !== null &&
      field.value !== ''
    );
  };

  // 서명 가능한 상태인지 확인
  const canSign = () => {
    if (!currentDocument) return false;
    return isSigner() && 
           currentDocument.status === 'SIGNING' && 
           !hasCurrentUserSigned() &&
           !submissionResult; // 이미 처리 완료된 경우 불가
  };

  // 서명 핸들러
  const handleSign = () => {
    if (!canSign()) {
      alert('서명 권한이 없거나 서명 가능한 상태가 아닙니다.');
      return;
    }
    setShowSignatureModal(true);
  };

  // 서명 저장 핸들러
  const handleSignatureSave = async (signatureData: string) => {
    if (!currentDocument) return;

    setIsSubmitting(true);
    try {
      let responseData;
      
      // 익명 사용자는 토큰 기반 API 사용
      if (isAnonymousUser && token) {
        const response = await axios.post(
          `${API_BASE_URL}/public/sign/${currentDocument.id}?token=${token}`,
          { signature: signatureData },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        responseData = response.data;
      } else {
        // 로그인 사용자는 기존 API 사용
        const authToken = useAuthStore.getState().token;
        const response = await axios.post(
          `${API_BASE_URL}/documents/${currentDocument.id}/sign`,
          { signature: signatureData },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        responseData = response.data;
      }
      
      setShowSignatureModal(false);
      
      // 서명 완료 상태 설정
      setSubmissionResult('success');
      
      // 서명 성공 응답에서 업데이트된 문서 정보가 있으면 사용
      if (responseData && responseData.document) {
        useDocumentStore.setState({ 
          currentDocument: responseData.document,
          loading: false,
          error: null
        });
      } else {
        // 응답에 문서 정보가 없으면 토큰 기반으로 문서 다시 불러오기 시도
        if (token) {
          try {
            await fetchDocumentWithToken(parseInt(id!), token);
          } catch (refreshError) {
            // 토큰이 만료되어 새로고침 실패해도 괜찮음 - 이미 서명은 완료됨
            console.log('문서 새로고침 실패 (정상) - 서명은 완료됨');
            
            // 로컬 상태에 서명 데이터 직접 추가
            const updatedDocument = { ...currentDocument };
            if (updatedDocument.data?.coordinateFields) {
              const currentUserEmail = isAnonymousUser ? anonymousUserEmail : user?.email;
              updatedDocument.data.coordinateFields = updatedDocument.data.coordinateFields.map((field: any) => {
                if (
                  (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
                  (field.signerEmail === currentUserEmail || field.reviewerEmail === currentUserEmail) &&
                  !field.value
                ) {
                  return { ...field, value: signatureData };
                }
                return field;
              });
              
              useDocumentStore.setState({ 
                currentDocument: updatedDocument,
                loading: false,
                error: null
              });
            }
          }
        } else if (isAuthenticated) {
          await getDocument(parseInt(id!));
        }
      }
      
    } catch (error) {
      console.error('❌ 서명 실패:', error);
      if (axios.isAxiosError(error)) {
        alert(`서명 처리에 실패했습니다: ${error.response?.data?.error || error.message}`);
      } else {
        alert('서명 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 반려 핸들러
  const handleReject = () => {
    if (!canSign()) {
      alert('서명 권한이 없거나 서명 가능한 상태가 아닙니다.');
      return;
    }
    setShowRejectModal(true);
  };

  // 반려 실행
  const executeReject = async (reason: string) => {
    if (!currentDocument) return;

    setIsSubmitting(true);
    try {
      // 익명 사용자는 토큰 기반 API 사용
      if (isAnonymousUser && token) {
        await axios.post(
          `${API_BASE_URL}/public/sign/${currentDocument.id}/reject?token=${token}`,
          { reason },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      } else {
        // 로그인 사용자는 기존 API 사용
        const authToken = useAuthStore.getState().token;
        await axios.post(
          `${API_BASE_URL}/documents/${currentDocument.id}/reject`,
          { reason },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      setShowRejectModal(false);
      
      // 반려 완료 상태 설정
      setSubmissionResult('rejected');
      
      // 토큰이 있으면 토큰 기반으로 문서 다시 불러오기 시도 (실패해도 괜찮음)
      if (token) {
        try {
          await fetchDocumentWithToken(parseInt(id!), token);
        } catch (refreshError) {
          // 토큰이 만료되어 새로고침 실패해도 괜찮음 - 이미 반려는 완료됨
          console.log('문서 새로고침 실패 (정상) - 반려는 완료됨');
        }
      } else if (isAuthenticated) {
        await getDocument(parseInt(id!));
      }
      
    } catch (error) {
      console.error('반려 실패:', error);
      alert('반려 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 미리보기 핸들러
  const handlePreview = () => {
    if (!currentDocument) {
      console.warn('⚠️ DocumentSignStandalone - currentDocument가 없습니다');
      return;
    }
    setShowPreviewModal(true);
  };

  // PDF 이미지 URL 생성
  const getPdfImageUrl = () => {
    if (pdfPages.length === 0) return '';
    const pageIndex = currentPage - 1;
    if (pageIndex >= 0 && pageIndex < pdfPages.length) {
      return `${API_BASE_URL.replace('/api', '')}${pdfPages[pageIndex]}`;
    }
    return '';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-500">문서를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex flex-col">
        {/* 헤더 */}
        <div className="bg-white border-b shadow-sm px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-gray-900">문서 조회 오류</h1>
            </div>
          </div>
        </div>

        {/* 오류 메시지 */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = import.meta.env.VITE_PUBLIC_URL || 'https://coworks.kr'}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                CoWorks로 이동
              </button>
              <button
                onClick={() => window.close()}
                className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">문서를 찾을 수 없습니다.</div>
      </div>
    );
  }

  // 서명 권한이 없지만 문서가 완료 상태인 경우는 허용 (미리보기만 가능)
  const isDocumentCompleted = currentDocument?.status === 'COMPLETED';

  if (!isSigner() && !isDocumentCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-4">이 문서의 서명 권한이 없습니다.</div>
            <p className="text-gray-600 text-sm mb-4">
              이 문서에 대한 서명 권한이 없거나 이미 처리된 문서입니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 상태 확인 (SIGNING도 아니고 COMPLETED도 아니면 접근 불가)
  if (currentDocument.status !== 'SIGNING' && currentDocument.status !== 'COMPLETED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="text-center">
            <div className="text-yellow-600 text-2xl mb-4">⚠️</div>
            <h3 className="font-bold text-yellow-800 mb-2">잘못된 문서 상태</h3>
            <p className="text-yellow-700 mb-4">
              현재 문서는 서명 단계가 아닙니다. (현재 상태: {currentDocument.status})
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col">
      {/* 헤더 - 독립적인 헤더 (Layout 없음) */}
      <div className="bg-white border-b shadow-sm px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* 문서 정보와 버튼을 같은 줄에 배치 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 문서 정보 */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                {currentDocument.title || currentDocument.templateName}
              </h1>
              <StatusBadge status={currentDocument.status || DOCUMENT_STATUS.SIGNING} size="md" isRejected={currentDocument.isRejected} />
              {/* <p className="text-sm text-gray-500">
                생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
              </p> */}
            </div>

            {/* 액션 버튼들 - 서명/반려 완료 전에만 표시 */}
            {!submissionResult && canSign() && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSign}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  서명하기
                </button>
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  반려
                </button>
                <button
                  onClick={handlePreview}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  미리보기
                </button>
              </div>
            )}

            {/* 이미 서명한 경우에도 미리보기 버튼 표시 */}
            {!submissionResult && isSigner() && hasCurrentUserSigned() && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreview}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  미리보기
                </button>
              </div>
            )}
          </div>

          {/* 서명 완료 메시지 - 상단 버튼으로 표시 */}
          {(isSigner() && hasCurrentUserSigned() || submissionResult === 'success') && (
            <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-3 bg-green-50 border border-green-300 rounded-lg">
              <div className="flex items-center gap-2 flex-1">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-sm font-bold text-green-800 block">
                    서명이 완료되었습니다
                  </span>
                  <span className="text-xs text-green-700">
                    {currentDocument.status === 'COMPLETED' 
                      ? '모든 서명이 완료되었습니다.' 
                      : '다른 서명자의 서명을 기다리고 있습니다.'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.href = import.meta.env.VITE_PUBLIC_URL || 'https://coworks.kr'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  CoWorks로 이동
                </button>
                <button
                  onClick={() => window.close()}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          
          {/* 반려 완료 메시지 */}
          {submissionResult === 'rejected' && (
            <div className="flex flex-col sm:flex-row items-center gap-3 px-4 py-3 bg-red-50 border border-red-300 rounded-lg">
              <div className="flex items-center gap-2 flex-1">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="text-sm font-bold text-red-800 block">
                    문서가 반려되었습니다
                  </span>
                  <span className="text-xs text-red-700">
                    문서가 반려 처리되었습니다.
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.href = import.meta.env.VITE_PUBLIC_URL || 'https://coworks.kr'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  CoWorks로 이동
                </button>
                <button
                  onClick={() => window.close()}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* 문서 완료 메시지 - 서명자가 아닌 경우에만 표시 */}
          {!isSigner() && currentDocument.status === 'COMPLETED' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <span className="text-sm font-medium text-green-800 block">
                  완료된 문서입니다
                </span>
                <span className="text-xs text-green-700">
                  모든 서명이 완료되었습니다.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-100 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col items-center gap-4">
              {/* 페이지 네비게이션 */}
              {getTotalPages > 1 && (
                <div className="flex w-full max-w-md items-center justify-center gap-3 bg-white px-4 py-3 rounded-lg shadow">
                  <button
                    onClick={previousPage}
                    disabled={!hasPreviousPage}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 transition-colors"
                  >
                    ← 이전
                  </button>
                  <span className="text-sm font-medium">
                    페이지 {currentPage} / {getTotalPages}
                  </span>
                  <button
                    onClick={nextPage}
                    disabled={!hasNextPage}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 transition-colors"
                  >
                    다음 →
                  </button>
                </div>
              )}

              {/* PDF 컨테이너 */}
              <div
                ref={pdfContainerRef}
                className="w-full overflow-auto"
                style={{
                  maxHeight: '80vh',
                  touchAction: 'pan-x pan-y pinch-zoom'
                }}
              >
                <div
                  className="mx-auto origin-top-left"
                  style={{
                    width: PDF_WIDTH * pdfScale,
                    height: PDF_HEIGHT * pdfScale,
                  }}
                >
                  <div
                    className="relative bg-white shadow-sm border origin-top-left"
                    style={{
                      width: PDF_WIDTH,
                      height: PDF_HEIGHT,
                      minWidth: PDF_WIDTH,
                      minHeight: PDF_HEIGHT,
                      flexShrink: 0,
                      transform: `scale(${pdfScale})`,
                      transformOrigin: 'top left'
                    }}
                  >
                    {/* PDF 배경 이미지 */}
                    <img
                      src={getPdfImageUrl()}
                      alt="PDF Preview"
                      className="absolute inset-0"
                      style={{
                        width: PDF_WIDTH,
                        height: PDF_HEIGHT,
                        objectFit: 'fill'
                      }}
                      onError={() => {
                        console.error('PDF 이미지 로드 실패:', getPdfImageUrl());
                      }}
                    />

                    {/* 필드 오버레이 */}
                    <div className="absolute inset-0">
                      {(currentDocument.data?.coordinateFields || [])
                        .filter((field) => !field.page || field.page === currentPage)
                        .map((field) => {
                          const leftPercent = field.x;
                          const topPercent = field.y;
                          const widthPercent = field.width;
                          const heightPercent = field.height;

                          // 필드 타입 확인
                          let isTableField = false;
                          let isEditorSignature = false;
                          let isSignerSignature = false;
                          let tableInfo = null;

                          if (field.type === 'editor_signature') {
                            isEditorSignature = true;
                          }

                          if (field.type === 'signer_signature' || field.type === 'reviewer_signature') {
                            isSignerSignature = true;
                          }

                          // 1. value를 파싱해서 테이블 데이터 확인 (우선순위 높음)
                          if (field.value && typeof field.value === 'string' && !isEditorSignature && !isSignerSignature) {
                            try {
                              const parsedValue = JSON.parse(field.value);
                              if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                                isTableField = true;
                                tableInfo = {
                                  rows: parsedValue.rows,
                                  cols: parsedValue.cols,
                                  columnWidths: parsedValue.columnWidths,
                                  columnHeaders: parsedValue.columnHeaders
                                };
                              }
                            } catch (e) {
                              // JSON 파싱 실패 시 다음 단계로
                            }
                          }
                          
                          // 2. tableData 속성으로 확인 (value가 없거나 파싱 실패한 경우)
                          if (!isTableField && field.tableData) {
                            isTableField = true;
                            tableInfo = field.tableData;
                          }

                          // 본인 서명 필드인지 확인
                          const currentUserEmail = isAnonymousUser ? anonymousUserEmail : user?.email;
                          const isCurrentUserSignature = isSignerSignature && currentUserEmail && (
                            (field as any).signerEmail === currentUserEmail || 
                            (field as any).reviewerEmail === currentUserEmail
                          );
                          
                          // 서명이 아직 없는 본인 필드에만 테두리 표시
                          const showBorder = isCurrentUserSignature && !field.value;

                          return (
                            <div
                              key={field.id}
                              className={`absolute ${
                                showBorder
                                  ? 'border-2 bg-red-100 border-red-500 bg-opacity-30' 
                                  : ''
                              }`}
                              style={{
                                left: `${leftPercent}px`,
                                top: `${topPercent}px`,
                                width: `${widthPercent}px`,
                                height: `${heightPercent}px`,
                                fontSize: `${field.fontSize || 18}px`,
                                fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                fontWeight: '500',
                                overflow: 'visible',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isEditorSignature && field.value && field.value.startsWith('data:image') ? (
                                <img
                                  src={field.value}
                                  alt="작성자 서명"
                                  className="w-full h-full object-contain"
                                  style={{ background: 'transparent' }}
                                />
                              ) : isSignerSignature && field.value && field.value.startsWith('data:image') ? (
                                <img
                                  src={field.value}
                                  alt="서명자 서명"
                                  className="w-full h-full object-contain"
                                  style={{ background: 'transparent' }}
                                />
                              ) : isCurrentUserSignature && !field.value ? (
                                <div className="text-xs text-red-700 font-medium text-center p-2 flex items-center justify-center gap-1 flex-wrap">
                                  <span>
                                    {(field as any).signerName || (field as any).reviewerName || (field as any).signerEmail || (field as any).reviewerEmail || '서명자'} 서명
                                  </span>
                                  <span className="text-red-500">(본인)</span>
                                </div>
                              ) : isTableField && tableInfo ? (
                                (() => {
                                  let tableData: { cells?: string[][] } = {};
                                  try {
                                    if (field.value) {
                                      if (typeof field.value === 'string') {
                                        tableData = JSON.parse(field.value) as { cells?: string[][] };
                                      } else if (typeof field.value === 'object') {
                                        tableData = field.value as { cells?: string[][] };
                                      }
                                    }
                                  } catch (err) {
                                    console.error('테이블 데이터 파싱 실패:', err);
                                  }

                                  const hasColumnHeaders = tableInfo.columnHeaders && tableInfo.columnHeaders.some((h: string) => h);
                                  const rowHeight = hasColumnHeaders 
                                    ? `${heightPercent / (tableInfo.rows + 1)}px` 
                                    : `${heightPercent / tableInfo.rows}px`;

                                  return (
                                    <table className="w-full h-full border-collapse" style={{ border: '2px solid black', tableLayout: 'fixed' }}>
                                      {/* 열 헤더가 있는 경우 표시 */}
                                      {hasColumnHeaders && (
                                        <thead>
                                          <tr className="bg-purple-100">
                                            {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                                              const headerText = tableInfo!.columnHeaders?.[colIndex] || '';
                                              const cellWidth = tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`;
                                              return (
                                                <th
                                                  key={`header-${colIndex}`}
                                                  className="border border-purple-400 text-center"
                                                  style={{
                                                    width: cellWidth,
                                                    height: rowHeight,
                                                    fontSize: `${Math.max((field.fontSize || 16) * 1.0, 10)}px`,
                                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                                    padding: '4px',
                                                    fontWeight: '600',
                                                    lineHeight: '1.2',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#e9d5ff',
                                                    color: '#6b21a8'
                                                  }}
                                                >
                                                  {headerText || (colIndex + 1)}
                                                </th>
                                              );
                                            })}
                                          </tr>
                                        </thead>
                                      )}
                                      <tbody>
                                        {Array(tableInfo.rows).fill(null).map((_, rowIndex) => (
                                          <tr key={rowIndex}>
                                            {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                                              const cellValue = tableData.cells?.[rowIndex]?.[colIndex] || '';
                                              const cellWidth = tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`;
                                              return (
                                                <td
                                                  key={colIndex}
                                                  className="border border-black text-center"
                                                  style={{
                                                    width: cellWidth,
                                                    height: rowHeight,
                                                    fontSize: `${Math.max((field.fontSize || 18) * 1.2, 10)}px`,
                                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                                    padding: '4px',
                                                    fontWeight: '500',
                                                    lineHeight: '1.2',
                                                    overflow: 'hidden',
                                                  }}
                                                >
                                                  {cellValue}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  );
                                })()
                              ) : field.value ? (
                                <div
                                  className="text-gray-900 flex items-center justify-center w-full h-full"
                                  style={{
                                    fontSize: `${field.fontSize || 18}px`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                    fontWeight: '500',
                                    color: '#111827',
                                    lineHeight: '1.4',
                                    textAlign: 'center',
                                    wordBreak: 'keep-all',
                                    overflow: 'visible',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    whiteSpace: 'nowrap',
                                    padding: '2px 4px'
                                  }}
                                >
                                  {field.value}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 서명 모달 */}
      {showSignatureModal && (
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSave={handleSignatureSave}
          reviewerName={
            isAnonymousUser 
              ? (anonymousUserEmail || '서명자')
              : (user?.name || '서명자')
          }
        />
      )}

      {/* 반려 모달 */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onReject={executeReject}
      />

      {/* 미리보기 모달 */}
      {showPreviewModal && currentDocument && (
        <DocumentPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          pdfImageUrl={getPdfImageUrl()}
          pdfImageUrls={pdfPages}
          coordinateFields={currentDocument.data?.coordinateFields || []}
          signatureFields={(() => {
            const docSignatureFields = currentDocument.data?.signatureFields || [];
            const docSignatures = (currentDocument.data?.signatures || {}) as Record<string, string>;
            return docSignatureFields.map((field) => ({
              ...field,
              reviewerName: (field as any).reviewerName || '',
              signatureData: docSignatures[(field as { reviewerEmail?: string }).reviewerEmail || '']
            }));
          })()}
          documentTitle={currentDocument.title || currentDocument.templateName}
        />
      )}
    </div>
  );
};

export default DocumentSignStandalone;
