import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

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
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 터치 시작 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setTouchStartDistance(distance);
      setTouchStartScale(pdfScale);
    }
  };

  // 터치 이동 핸들러
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance !== null) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / touchStartDistance;
      const newScale = Math.max(0.5, Math.min(3, touchStartScale * scale));
      setPdfScale(newScale);
    }
  };

  // 터치 종료 핸들러
  const handleTouchEnd = () => {
    setTouchStartDistance(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 터치 제스처가 없을 때만 자동 스케일 조정
    if (touchStartDistance === null) {
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
  }, [currentDocument?.id, touchStartDistance]);

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 인증 상태 확인
  if (!isAuthenticated || !token || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">로그인이 필요합니다</h3>
              <p className="text-yellow-700 mb-4">
                이 페이지에 접근하려면 로그인이 필요합니다.
              </p>
              <button
                onClick={() => window.location.href = '/login'}
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

  // 서명자 권한 확인
  const isSigner = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task =>
      task.role === 'SIGNER' &&
      task.assignedUserEmail === user.email
    );
  };

  // 현재 사용자가 이미 서명했는지 확인
  const hasCurrentUserSigned = () => {
    if (!currentDocument || !user) return false;

    const coordinateFields = (currentDocument.data?.coordinateFields || []) as any[];
    return coordinateFields.some((field) =>
      (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
      (field.signerEmail === user.email || field.reviewerEmail === user.email) &&
      field.value &&
      field.value !== null &&
      field.value !== ''
    );
  };

  // 서명 가능한 상태인지 확인
  const canSign = () => {
    if (!currentDocument || !user) return false;
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
    if (!currentDocument || !user) return;

    setIsSubmitting(true);
    try {
      setShowSignatureModal(false);
      setSubmissionResult('success');
      
      // 문서 재로드
      await getDocument(Number(id));
      
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
    if (!currentDocument || !user) return;

    setIsSubmitting(true);
    try {
      const { token } = useAuthStore.getState();

      await axios.post(
        `${API_BASE_URL}/documents/${currentDocument.id}/reject`,
        { reason },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setShowRejectModal(false);
      setSubmissionResult('rejected');
      
      // 문서 재로드
      await getDocument(Number(id));
      
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <p className="text-red-800">{error}</p>
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
              <p className="text-sm text-gray-500">
                생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
              </p>
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

          {/* 서명 완료/반려 메시지 */}
          {submissionResult === 'success' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">
                서명이 완료되었습니다. 감사합니다.
              </span>
            </div>
          )}

          {submissionResult === 'rejected' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-800">
                문서가 반려되었습니다.
              </span>
            </div>
          )}

          {/* 이미 서명한 경우 메시지 */}
          {isSigner() && hasCurrentUserSigned() && !submissionResult && currentDocument.status !== 'COMPLETED' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-blue-800">
                이미 서명하셨습니다. 다른 서명자의 서명을 기다리고 있습니다.
              </span>
            </div>
          )}

          {/* 문서 완료 메시지 */}
          {currentDocument.status === 'COMPLETED' && (
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
                className="w-full touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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

                          // 테이블 필드 확인
                          if (field.tableData) {
                            isTableField = true;
                            tableInfo = field.tableData;
                          } else {
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
                            } catch {
                              // JSON 파싱 실패 시 일반 필드로 처리
                            }
                          }

                          // 본인 서명 필드인지 확인
                          const isCurrentUserSignature = isSignerSignature && user && (
                            (field as any).signerEmail === user.email || 
                            (field as any).reviewerEmail === user.email
                          );

                          return (
                            <div
                              key={field.id}
                              className={`absolute ${
                                isCurrentUserSignature 
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
                              ) : isCurrentUserSignature ? (
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
          reviewerName={user?.name || '서명자'}
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
