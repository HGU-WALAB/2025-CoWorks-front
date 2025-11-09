import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const DocumentReview: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  // 모달 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 문서별 서명 필드를 로컬 스토리지에서 로드 (제거됨 - 서명자 지정은 별도 페이지에서 처리)

  // 문서 로드 시 기존 서명 필드는 그대로 두고, 새로운 필드만 추가 가능하도록 설정 (제거됨)

  // 서명 필드 변경 시 로컬 스토리지에 저장 (제거됨)

  // 서명 필드 관련 함수들 (제거됨 - 서명자 지정은 별도 페이지에서 처리)

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

  // 검토 가능한 상태인지 확인
  const canReview = () => {
    if (!currentDocument || !user) return false;
    return isReviewer() && currentDocument.status === 'REVIEWING';
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
        `${API_BASE_URL}/documents/${currentDocument.id}/approve`,
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

      alert('✅ 문서가 승인되었습니다! 서명이 문서에 추가되었습니다. 페이지에서 서명을 확인하세요.');

      // 승인 후 페이지에 남아서 서명 확인 가능하도록 함
      // navigate('/documents'); // 제거: 바로 이동하지 않음

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

  // 반려 실행
  const executeReject = async (reason: string) => {
    if (!currentDocument || !user) return;

    try {
      const { token } = useAuthStore.getState();

      await axios.post(
        `${API_BASE_URL}/documents/${currentDocument.id}/reject`,
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
      
      // 반려 후 문서 목록 페이지로 이동
      navigate('/documents');
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

  if (!isReviewer()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-4">이 문서의 검토 권한이 없습니다.</div>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              뒤로가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* 액션 바 - Layout 헤더 아래 고정 위치 */}
      <div className="fixed top-[88px] left-0 right-0 z-40 bg-white border-b px-6 py-4 w-full shadow-sm">
        <div className="flex items-center justify-between w-full">
          {/* 왼쪽: 문서 제목 및 정보 */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                {currentDocument.title || currentDocument.templateName} - 검토
              </h1>
              <StatusBadge status={currentDocument.status || DOCUMENT_STATUS.REVIEWING} size="md" isRejected={currentDocument.isRejected} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">
                생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* 중앙: 검토 액션 버튼들 */}
          <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
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
          </div>

          {/* 오른쪽: 미리보기 및 돌아가기 버튼 */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              onClick={handlePreview}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              미리보기
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 - Layout 헤더 + 액션 바 아래 고정 레이아웃 */}
      <div className="fixed left-0 right-0 bottom-0 flex w-full top-[160px]">
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex flex-col items-center p-4">
          {/* 페이지 네비게이션 (다중 페이지인 경우에만 표시) */}
          {getTotalPages > 1 && (
            <div className="mb-4 flex items-center gap-4 bg-white px-6 py-3 rounded-lg shadow">
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
            </div>
          )}

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
              src={getPdfImageUrl()}
              alt="PDF Preview"
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

            {/* 기존 필드 오버레이 */}
            <div className="absolute inset-0">
              {(currentDocument.data?.coordinateFields || [])
                .filter((field: any) => !field.page || field.page === currentPage)
                .map((field: any) => {
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
                    className={`absolute border-2 bg-opacity-30 flex flex-col justify-center ${
                      isEditorSignature ? 'bg-green-100 border-green-500' :
                      isReviewerSignature ? 'bg-red-100 border-red-500' :
                      isTableField ? 'bg-purple-100 border-purple-500' : 'bg-blue-100 border-blue-500'
                    }`}
                    style={{
                      left: `${leftPercent}px`,
                      top: `${topPercent}px`,
                      width: `${widthPercent}px`,
                      height: `${heightPercent}px`,
                    }}
                  >
                    {isEditorSignature ? (
                      // 편집자 서명 필드 렌더링
                      <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-transparent">
                        {field.value && field.value.startsWith('data:image') ? (
                          <img
                            src={field.value}
                            alt="편집자 서명"
                            className="max-w-full h-full object-contain bg-transparent"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              background: 'transparent'
                            }}
                          />
                        ) : field.value ? (
                          <div className="text-xs text-gray-600 text-center">
                            서명됨
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 text-center">
                            미서명
                          </div>
                        )}
                      </div>
                    ) : isReviewerSignature ? (
                      // 검토자 서명 필드 렌더링
                      <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-transparent">
                        {field.value && field.value.startsWith('data:image') ? (
                          <img
                            src={field.value}
                            alt={`${field.reviewerName || '검토자'} 서명`}
                            className="max-w-full h-full object-contain bg-transparent"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              background: 'transparent'
                            }}
                          />
                        ) : (
                          <div className="text-xs text-red-700 font-medium text-center">
                            {field.reviewerName || field.reviewerEmail || '검토자'} 서명
                            {field.reviewerEmail === user?.email && (
                              <div className="text-red-500 mt-1">(본인)</div>
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

              {/* 기존 서명 필드 렌더링 - 현재 페이지만 표시 */}
              {(() => {
                const existingSignatureFields = currentDocument.data?.signatureFields || [];
                const signatures = currentDocument.data?.signatures || {};

                return existingSignatureFields
                  .filter((field: any) => !field.page || field.page === currentPage)
                  .map((field: any) => {
                  const signatureData = signatures[field.reviewerEmail];
                  const isMySignature = field.reviewerEmail === user?.email;

                  return (
                    <div
                      key={`existing-signature-${field.id}`}
                      className={`absolute border-2 flex flex-col justify-center items-center p-1 ${
                        isMySignature ? 'border-red-500 bg-red-100 bg-opacity-30' : 'border-green-500'
                      }`}
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
                        <div className="text-sm font-bold text-center text-black">
                          {field.reviewerName} 서명
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
            {/* 검토자 목록 */}
            <div className="border rounded-lg p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-3">검토자</h3>
              <div className="space-y-2">
                {currentDocument.tasks && currentDocument.tasks.length > 0 ? (
                  currentDocument.tasks
                    .filter(task => task.role === 'REVIEWER')
                    .map((reviewer, index) => (
                      <div key={index} className="flex items-center space-x-3 p-2 rounded-lg bg-green-50 border border-green-200">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {reviewer.assignedUserName ? reviewer.assignedUserName.charAt(0).toUpperCase() : 'R'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {reviewer.assignedUserName || '이름 없음'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {reviewer.assignedUserEmail}
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
            const docSignatures = currentDocument.data?.signatures || {};
            return docSignatureFields.map((field: any) => ({
              ...field,
              signatureData: docSignatures[field.reviewerEmail]
            }));
          })()}
          documentTitle={currentDocument.title || currentDocument.templateName}
        />
      )}
    </div>
  );
};

export default DocumentReview; 