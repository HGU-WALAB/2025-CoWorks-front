import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { API_BASE_URL } from '../config/api';
import { usePdfPages } from '../hooks/usePdfPages';
import axios from 'axios';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import { CoordinateField, TaskInfo } from '../types/document';

type SignatureCoordinateField = CoordinateField & {
  signerEmail?: string;
  signerName?: string;
  reviewerEmail?: string;
  reviewerName?: string;
};

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

const DocumentReview: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  // 모달 상태
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfScale, setPdfScale] = useState(1);

  // 문서별 서명 필드를 로컬 스토리지에서 로드 (제거됨 - 서명자 지정은 별도 페이지에서 처리)

  // 문서 로드 시 기존 서명 필드는 그대로 두고, 새로운 필드만 추가 가능하도록 설정 (제거됨)

  // 서명 필드 변경 시 로컬 스토리지에 저장 (제거됨)

  // 서명 필드 관련 함수들 (제거됨 - 서명자 지정은 별도 페이지에서 처리)

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

  const signerTasks = React.useMemo(() => {
    return (currentDocument?.tasks?.filter((task) => task.role === 'SIGNER') ?? []) as TaskInfo[];
  }, [currentDocument?.tasks]);

  const signerInfos = React.useMemo(() => {
    const coordinateFields = (currentDocument?.data?.coordinateFields ?? []) as SignatureCoordinateField[];

    return signerTasks.map((signer) => {
      const relatedField = coordinateFields.find((field) =>
        (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
        (field.signerEmail === signer.assignedUserEmail || field.reviewerEmail === signer.assignedUserEmail)
      );

      const hasSigned = typeof relatedField?.value === 'string'
        ? relatedField.value.trim().length > 0
        : Boolean(relatedField?.value);

      return {
        task: signer,
        hasSigned,
        relatedField,
      };
    });
  }, [signerTasks, currentDocument?.data?.coordinateFields]);

  // 디버깅용 로그
  useEffect(() => {
    console.log('🔍 DocumentReview 인증 상태:', {
      user: user?.email,
      token: token ? `${token.substring(0, 20)}...` : 'null',
      isAuthenticated,
      axiosDefaultHeaders: axios.defaults.headers.common
    });
  }, [user, token, isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

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
  }, [currentDocument?.id]);

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

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

  // 검토자 권한 확인
  const isReviewer = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task =>
      task.role === 'REVIEWER' &&
      task.assignedUserEmail === user.email
    );
  };

  // 검토 가능한 상태인지 확인
  const canReview = () => {
    if (!currentDocument || !user) return false;
    return isReviewer() && currentDocument.status === 'REVIEWING';
  };

  // 승인 핸들러
  const handleApprove = async () => {
    if (!canReview()) {
      alert('검토 권한이 없거나 검토 가능한 상태가 아닙니다.');
      return;
    }

    if (!currentDocument || !user) return;

    if (!confirm('이 문서를 승인하시겠습니까?\n승인 후, 지정된 서명자에게 서명 요청이 전송됩니다.')) {
      return;
    }

    try {
      const { token } = useAuthStore.getState();

      console.log('📝 검토 승인 시도:', {
        documentId: currentDocument.id,
        documentStatus: currentDocument.status,
        userEmail: user.email
      });

      const response = await axios.post(
        `${API_BASE_URL}/documents/${currentDocument.id}/review/approve`,
        {
          comment: '검토 승인'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ 검토 승인 성공:', response.data);

      // 문서 재로드
      await getDocument(Number(id));

      alert('✅ 검토가 승인되었습니다. 지정된 서명자에게 서명 요청이 전송되었습니다.');
      
      // 대시보드로 이동
      setTimeout(() => {
        navigate('/tasks');
      }, 500);

  } catch (error) {
    console.error('❌ 검토 승인 실패:', error);
    if (axios.isAxiosError(error)) {
      console.error('❌ 에러 응답:', error.response?.data);
      console.error('❌ 에러 상태:', error.response?.status);
      alert(`검토 승인 처리에 실패했습니다: ${error.response?.data?.error || error.message}`);
    } else {
      alert('검토 승인 처리 중 오류가 발생했습니다.');
    }
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

  // 반려 실행
  const executeReject = async (reason: string) => {
    if (!currentDocument || !user) return;

    try {
      const { token } = useAuthStore.getState();

      await axios.post(
        `${API_BASE_URL}/documents/${currentDocument.id}/review/reject`,
        {
          reason
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      alert('❌ 문서가 반려되었습니다. 작성자가 문서를 수정해야 합니다.');
      setShowRejectModal(false);
      
      // 반려 후 대시보드로 이동
      navigate('/tasks');
    } catch (error) {
      console.error('반려 실패:', error);
      alert('반려 처리에 실패했습니다.');
    }
  };

  // 미리보기 핸들러
  const handlePreview = () => {
    if (!currentDocument) {
      console.warn('⚠️ DocumentReview - currentDocument가 없습니다');
      return;
    }
    setShowPreviewModal(true);
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

  // 문서 상태 확인 (REVIEWING 상태가 아니면 접근 불가)
  if (currentDocument.status !== 'REVIEWING') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">잘못된 문서 상태</h3>
              <p className="text-yellow-700 mb-4">
                현재 문서는 검토 단계가 아닙니다. (현재 상태: {currentDocument.status})
              </p>
              <button
                onClick={() => navigate('/tasks')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                대시보드로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isReviewer()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-4">이 문서의 검토 권한이 없습니다.</div>
            <button
              onClick={() => navigate('/tasks')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col">
      {/* 액션 바 - Layout 헤더 아래 고정 위치 */}
      <div className="sticky top-[64px] md:top-[88px] z-40 bg-white border-b px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* 왼쪽: 문서 제목 및 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                {currentDocument.title || currentDocument.templateName} - 검토
              </h1>
              <StatusBadge status={currentDocument.status || DOCUMENT_STATUS.REVIEWING} size="md" isRejected={currentDocument.isRejected} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* 중앙: 검토 액션 버튼들 */}
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:w-auto">
            {canReview() && (
              <div className="flex flex-col gap-2 w-full sm:flex-row sm:justify-center">
                <button
                  onClick={handleApprove}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  승인
                </button>
                <button
                  onClick={handleReject}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  반려
                </button>
              </div>
            )}
          </div>

          {/* 오른쪽: 미리보기 및 돌아가기 버튼 */}
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:justify-end lg:w-auto">
            <button
              onClick={handlePreview}
              className="w-full sm:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              미리보기
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 - Layout 헤더 + 액션 바 아래 고정 레이아웃 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 px-4 sm:px-6 py-4">
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="bg-gray-100 rounded-lg lg:rounded-none lg:flex-1 lg:overflow-auto">
          <div className="flex w-full flex-col items-center gap-4 p-4 sm:p-6">
            {/* 페이지 네비게이션 (다중 페이지인 경우에만 표시) */}
            {getTotalPages > 1 && (
              <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-3 bg-white px-4 py-3 rounded-lg shadow">
                <button
                  onClick={previousPage}
                  disabled={!hasPreviousPage}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 transition-colors"
                >
                  ← 이전
                </button>
                <span className="text-sm font-medium">
                  페이지 {currentPage} / {getTotalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={!hasNextPage}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 transition-colors"
                >
                  다음 →
                </button>
              </div>
            )}

            {/* PDF 컨테이너 - 반응형 스케일링 */}
            <div ref={pdfContainerRef} className="w-full">
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

                  {/* 기존 필드 오버레이 */}
                  <div className="absolute inset-0">
                    {(currentDocument.data?.coordinateFields || [])
                      .filter((field) => !field.page || field.page === currentPage)
                      .map((field) => {
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
                        let isEditorSignature = false;
                        let isReviewerSignature = false;
                        let tableInfo = null;

                        // 편집자 서명 필드 확인
                        if (field.type === 'editor_signature') {
                          isEditorSignature = true;
                        }

                        // 검토자 서명 필드 확인
                        if (field.type === 'reviewer_signature') {
                          isReviewerSignature = true;
                        }

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
                          className={`absolute ${
                            isEditorSignature || isReviewerSignature 
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
                          {isEditorSignature ? (
                            field.value && field.value.startsWith('data:image') ? (
                              <img
                                src={field.value}
                                alt="작성자 서명"
                                className="w-full h-full object-contain"
                                style={{ background: 'transparent' }}
                              />
                            ) : (
                              <div className="text-xs text-red-700 font-medium text-center p-2 flex items-center justify-center gap-1 flex-wrap">
                                <span>작성자 서명</span>
                                {(field as any).editorName && (
                                  <span>({(field as any).editorName})</span>
                                )}
                                {(field as any).editorEmail === user?.email && (
                                  <span className="text-red-500">(본인)</span>
                                )}
                              </div>
                            )
                          ) : isReviewerSignature ? (
                            field.value && field.value.startsWith('data:image') ? (
                              <img
                                src={field.value}
                                alt="서명자 서명"
                                className="w-full h-full object-contain"
                                style={{ background: 'transparent' }}
                              />
                            ) : (
                              <div className="text-xs text-red-700 font-medium text-center p-2 flex items-center justify-center gap-1 flex-wrap">
                                <span>
                                  {(field as any).reviewerName || (field as any).reviewerEmail || '검토자'} 서명
                                </span>
                                {(field as any).reviewerEmail === user?.email && (
                                  <span className="text-red-500">(본인)</span>
                                )}
                              </div>
                            )
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

                              return (
                                <table className="w-full h-full border-collapse" style={{ border: '2px solid black', tableLayout: 'fixed' }}>
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

        {/* 오른쪽 패널 - 검토자 리스트 및 정보 (반응형) */}
        <div className="w-full lg:w-80 flex-shrink-0 bg-white border border-gray-200 rounded-lg lg:rounded-none lg:border-l lg:h-[calc(100vh-220px)] lg:overflow-y-auto">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">검토 정보</h2>
            <p className="text-sm text-gray-500 mt-1">
              문서 상태 및 검토자 정보
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* 검토자 목록 */}
            <div className="border rounded-lg p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-3">검토자</h3>
              <div className="space-y-2">
                {currentDocument.tasks && currentDocument.tasks.length > 0 ? (
                  currentDocument.tasks
                    .filter(task => task.role === 'REVIEWER')
                    .map((reviewer, index) => {
                      // 검토자의 경우 단순히 목록만 표시 (검토 완료 여부는 문서 상태로 판단)
                      const isCurrentUser = reviewer.assignedUserEmail === user?.email;

                      return (
                        <div 
                          key={index} 
                          className={`flex items-center space-x-3 p-2 rounded-lg border ${
                            isCurrentUser
                              ? 'bg-blue-50 border-blue-300' 
                              : 'bg-gray-50 border-gray-300'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                            isCurrentUser ? 'bg-blue-500' : 'bg-gray-500'
                          }`}>
                            {reviewer.assignedUserName ? reviewer.assignedUserName.charAt(0).toUpperCase() : 'R'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {reviewer.assignedUserName || '이름 없음'}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-blue-600 font-semibold">(본인)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {reviewer.assignedUserEmail}
                            </div>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <p className="text-sm">지정된 검토자가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 서명자 목록 */}
            <div className="border rounded-lg p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-3">서명자</h3>
              <div className="space-y-2">
                {signerInfos.length > 0 ? (
                  signerInfos.map(({ task, hasSigned, relatedField }) => {
                    const displayName =
                      relatedField?.signerName ||
                      relatedField?.reviewerName ||
                      task.assignedUserName ||
                      task.assignedUserEmail;
                    const isCurrentUser = task.assignedUserEmail === user?.email;

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          hasSigned ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                              hasSigned ? 'bg-green-500' : 'bg-orange-500'
                            }`}
                          >
                            {displayName ? displayName.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {displayName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-blue-600 font-semibold">(본인)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {task.assignedUserEmail}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            hasSigned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {hasSigned ? '서명 완료' : '서명 대기'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm">지정된 서명자가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 편집자 정보 (참고용) */}
            {currentDocument.tasks && currentDocument.tasks.some(task => task.role === 'EDITOR') && (
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-medium text-gray-900 mb-3">편집자</h3>
                <div className="space-y-2">
                  {currentDocument.tasks
                    .filter(task => task.role === 'EDITOR')
                    .map((editor, index) => (
                      <div key={index} className="flex items-center space-x-3 p-2 rounded-lg bg-blue-50 border border-blue-200">
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
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

export default DocumentReview; 