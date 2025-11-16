import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { SignatureModal } from '../components/SignatureModal';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { API_BASE_URL } from '../config/api';
import { usePdfPages } from '../hooks/usePdfPages';
import axios from 'axios';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import { refreshDocumentsAndUser } from '../utils/documentRefreshHelpers';

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

const DocumentSign: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  // 모달 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfScale, setPdfScale] = useState(1);


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

  // 디버깅용 로그
  useEffect(() => {
    console.log('🔍 DocumentSign 인증 상태:', {
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
      console.log('🔍 DocumentSign: 문서 로드 시작, ID:', id);
      getDocument(parseInt(id)).then((doc) => {
        const coordinateFields = doc?.data?.coordinateFields || [];
        const signerSignatureFields = coordinateFields.filter((field: any) =>
          field.type === 'signer_signature' || field.type === 'reviewer_signature'
        );

        // 서명자 목록 확인
        const signerTasks = doc?.tasks?.filter((task: any) => task.role === 'SIGNER') || [];
        const signerEmails = signerTasks.map((task: any) => task.assignedUserEmail);

        // 각 서명자에 대한 서명 필드 확인
        const signerFieldMapping = signerEmails.map((email: string) => {
          const hasField = signerSignatureFields.some((field: any) =>
            field.signerEmail === email || field.reviewerEmail === email
          );
          return { email, hasField };
        });

        console.log('🔍 DocumentSign: 문서 로드 완료:', {
          documentId: doc?.id,
          status: doc?.status,
          coordinateFieldsCount: coordinateFields.length,
          signerSignatureFieldsCount: signerSignatureFields.length,
          signerTasksCount: signerTasks.length,
          signerEmails,
          signerFieldMapping,
          signerSignatureFields: signerSignatureFields.map((field: any) => ({
            id: field.id,
            type: field.type,
            signerEmail: field.signerEmail,
            reviewerEmail: field.reviewerEmail,
            signerName: field.signerName,
            reviewerName: field.reviewerName,
            hasValue: !!field.value,
            valueLength: field.value ? field.value.length : 0
          }))
        });

        // 서명 필드가 없는 서명자가 있는지 확인
        const missingFields = signerFieldMapping.filter(m => !m.hasField);
        if (missingFields.length > 0) {
          console.warn('⚠️ 서명 필드가 없는 서명자:', missingFields);
        }
      });
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

  // 서명 가능한 상태인지 확인 (서명하지 않은 서명자만 가능)
  const canSign = () => {
    if (!currentDocument || !user) return false;
    return isSigner() && 
           currentDocument.status === 'SIGNING' && 
           !hasCurrentUserSigned(); // 이미 서명한 경우 서명 불가
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
        signatureData
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
      const responseCoordinateFields = response.data?.data?.coordinateFields || [];
      const responseHasSignature = responseCoordinateFields.some((field: any) =>
        (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
        (field.signerEmail === user.email || field.reviewerEmail === user.email) &&
        field.value
      );

      console.log('🔍 응답에서 서명 데이터 확인:', {
        documentId: response.data.id,
        documentStatus: response.data.status,
        signerSignatureFields: responseCoordinateFields.filter((field: any) =>
          field.type === 'signer_signature' || field.type === 'reviewer_signature'
        ),
        hasSignatureData: responseHasSignature
      });

      // 서명 모달 닫기
      setShowSignatureModal(false);

      // 서명 저장 후 문서를 다시 로드하여 서명이 표시되도록 함
      const updatedDocument = await getDocument(Number(id));

      const updatedCoordinateFields = updatedDocument?.data?.coordinateFields || [];
      const reloadedHasSignature = updatedCoordinateFields.some((field: any) =>
        (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
        (field.signerEmail === user.email || field.reviewerEmail === user.email) &&
        field.value
      );

      console.log('🔄 문서 재로드 후 서명 데이터 확인 (직접):', {
        documentId: updatedDocument?.id,
        documentStatus: updatedDocument?.status,
        signerSignatureFields: updatedCoordinateFields.filter((field: any) =>
          field.type === 'signer_signature' || field.type === 'reviewer_signature'
        ),
        hasSignatureData: reloadedHasSignature,
        allSigners: currentDocument.tasks?.filter(task => task.role === 'SIGNER').map(t => t.assignedUserEmail),
        signedSigners: updatedCoordinateFields
          .filter((field: any) => 
            (field.type === 'signer_signature' || field.type === 'reviewer_signature') && 
            field.value
          )
          .map((field: any) => field.signerEmail || field.reviewerEmail)
      });

      // 문서 상태 확인
      const finalStatus = updatedDocument?.status;
      console.log('📊 최종 문서 상태:', finalStatus);

      // 문서 상태에 따라 처리
      if (finalStatus === 'COMPLETED') {
        // 모든 서명이 완료된 경우
        setIsRedirecting(true);
        await refreshDocumentsAndUser();
        navigate('/documents');
      } else if (finalStatus === 'SIGNING') {
        // 아직 다른 서명자가 서명해야 하는 경우
        setIsRedirecting(false);
        setShowSignatureModal(false);
        // 문서를 다시 로드하여 최신 상태 반영
        await getDocument(Number(id));
        alert('✅ 서명이 완료되었습니다. 다른 서명자의 서명을 기다리고 있습니다.');
      } else {
        // 기타 상태인 경우
        setIsRedirecting(true);
        await refreshDocumentsAndUser();
        navigate('/documents');
      }

    } catch (error) {
      console.error('❌ 서명 실패:', error);
      if (axios.isAxiosError(error)) {
        console.error('❌ 에러 응답:', error.response?.data);
        console.error('❌ 에러 상태:', error.response?.status);
        alert(`서명 처리에 실패했습니다: ${error.response?.data?.error || error.message}`);
      } else {
        alert('서명 처리 중 오류가 발생했습니다.');
      }
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

    try {
      const { token } = useAuthStore.getState();

      await axios.post(
        `${API_BASE_URL}/documents/${currentDocument.id}/reject`,
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
      console.warn('⚠️ DocumentSign - currentDocument가 없습니다');
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

  // 반응형 폰트 크기 계산 함수
  const getResponsiveFontSize = (baseFontSize: number | undefined, options: { height: number }) => {
    if (baseFontSize === undefined) return 18; // 기본값
    const { height } = options;
    if (height < 100) return baseFontSize * 0.8; // 높이가 작을 때 폰트 크기 조절
    if (height > 200) return baseFontSize * 1.2; // 높이가 클 때 폰트 크기 조절
    return baseFontSize;
  };

  if (loading || isRedirecting) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
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

  // 상태 확인 (SIGNING 상태가 아니면 접근 불가)
  if (currentDocument.status !== 'SIGNING') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">잘못된 문서 상태</h3>
              <p className="text-yellow-700 mb-4">
                   현재 문서는 서명 단계가 아닙니다. (현재 상태: {currentDocument.status})
              </p>
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

  // 서명자 권한 확인
  if (!isSigner()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-600 text-2xl mr-3">🚫</div>
            <div>
              <h3 className="font-bold text-red-800 mb-2">접근 권한 없음</h3>
              <p className="text-red-700 mb-4">이 문서의 서명 권한이 없습니다.</p>
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

  // 서명 필드 확인
  const coordinateFields = currentDocument.data?.coordinateFields || [];
  const signerSignatureFields = coordinateFields.filter((field: any) =>
    field.type === 'signer_signature' || field.type === 'reviewer_signature'
  );
  const signerTasks = currentDocument.tasks?.filter((task: any) => task.role === 'SIGNER') || [];
  const currentUserSignerField = signerSignatureFields.find((field: any) =>
    (field.signerEmail === user?.email || field.reviewerEmail === user?.email)
  );

  // 현재 사용자에게 서명 필드가 없는 경우 경고
  if (!currentUserSignerField && signerTasks.some((task: any) => task.assignedUserEmail === user?.email)) {
    console.warn('⚠️ 현재 사용자에게 서명 필드가 없습니다:', {
      userEmail: user?.email,
      signerTasks: signerTasks.map((t: any) => t.assignedUserEmail),
      signerSignatureFields: signerSignatureFields.map((f: any) => ({
        signerEmail: f.signerEmail,
        reviewerEmail: f.reviewerEmail
      }))
    });
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
                {currentDocument.title || currentDocument.templateName} - 서명
              </h1>
              <StatusBadge status={currentDocument.status || DOCUMENT_STATUS.SIGNING} size="md" isRejected={currentDocument.isRejected} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* 중앙: 서명 액션 버튼들 */}
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:w-auto">
            {canSign() && (
              <div className="flex flex-col gap-2 w-full sm:flex-row sm:justify-center">
                <button
                  onClick={handleSign}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  서명하기
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
            {/* 이미 서명한 서명자에게 안내 메시지 표시 */}
            {isSigner() && currentDocument.status === 'SIGNING' && hasCurrentUserSigned() && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg w-full sm:w-auto">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-green-800">
                  서명 완료 - 다른 서명자 대기 중
                </span>
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
                        const responsiveFontSize = getResponsiveFontSize(field.fontSize, {
                          height: field.height,
                        });
                        const displayFontSize = responsiveFontSize || field.fontSize || 14;
                        console.log('🎯 서명 화면 - 필드 렌더링:', {
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
                        let isSignerSignature = false;
                        let tableInfo = null;

                        // 편집자 서명 필드 확인
                        if (field.type === 'editor_signature') {
                          isEditorSignature = true;
                        }

                        // 서명자 서명 필드 확인 (signer_signature 또는 reviewer_signature)
                        // 모든 서명 필드를 표시 (현재 사용자에게 할당된 것만이 아님)
                        if (field.type === 'signer_signature' || field.type === 'reviewer_signature') {
                          isSignerSignature = true;
                          const fieldSignerEmail = (field as any).signerEmail;
                          const fieldReviewerEmail = (field as any).reviewerEmail;
                          const isAssignedToCurrentUser = user && (
                            fieldSignerEmail === user.email || 
                            fieldReviewerEmail === user.email
                          );
                          
                          console.log('✅ 서명 필드 발견:', {
                            fieldId: field.id,
                            fieldType: field.type,
                            signerEmail: fieldSignerEmail,
                            reviewerEmail: fieldReviewerEmail,
                            currentUserEmail: user?.email,
                            isAssignedToCurrentUser,
                            hasValue: !!field.value,
                            valuePreview: field.value ? (field.value.substring(0, 50) + '...') : 'null'
                          });
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
                        } catch {
                          // JSON 파싱 실패 시 일반 필드로 처리
                        }
                      }

                      return (
                        <div
                          key={field.id}
                          className={`absolute border-2 bg-opacity-30 flex flex-col justify-center ${
                            isEditorSignature ? 'bg-green-100 border-green-500' :
                            isSignerSignature ? 'bg-red-100 border-red-500' :
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
                          ) : isSignerSignature ? (
                            // 서명자 서명 필드 렌더링
                            <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-transparent">
                              {field.value && field.value.startsWith('data:image') ? (
                                <img
                                  src={field.value}
                                  alt={`${(field as any).signerName || (field as any).reviewerName || '서명자'} 서명`}
                                  className="max-w-full h-full object-contain bg-transparent"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    background: 'transparent'
                                  }}
                                />
                              ) : (
                                <div className="text-xs text-red-700 font-medium text-center">
                                  {(field as any).signerName || (field as any).reviewerName || (field as any).signerEmail || (field as any).reviewerEmail || '서명자'} 서명
                                  {(((field as any).signerEmail === user?.email || (field as any).reviewerEmail === user?.email)) && (
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
                                      let tableValue: { cells?: string[][] } = {};
                                      if (field.value) {
                                        if (typeof field.value === 'string') {
                                          tableValue = JSON.parse(field.value) as { cells?: string[][] };
                                        } else if (typeof field.value === 'object') {
                                          tableValue = field.value as { cells?: string[][] };
                                        }
                                      }

                                      cellText = tableValue.cells?.[rowIndex]?.[colIndex] || '';

                                    } catch (err) {
                                      console.error(`테이블 값 파싱 실패 [${rowIndex}][${colIndex}]:`, {
                                        fieldId: field.id,
                                        rawValue: field.value,
                                        error: err
                                      });
                                      cellText = '';
                                    }

                                    return (
                                      <div
                                        key={`${rowIndex}-${colIndex}`}
                                        className="border border-purple-200 flex items-center justify-center p-1"
                                        style={{
                                          minHeight: '20px',
                                          fontSize: `${displayFontSize}px !important`,
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
                                            fontSize: `${displayFontSize}px !important`,
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
                            <div
                              className="text-gray-900 p-1 truncate text-center"
                              style={{
                                fontSize: `${displayFontSize}px !important`,
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 패널 - 서명자 리스트 및 정보 (반응형) */}
        <div className="w-full lg:w-80 flex-shrink-0 bg-white border border-gray-200 rounded-lg lg:rounded-none lg:border-l lg:h-[calc(100vh-220px)] lg:overflow-y-auto">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">서명 정보</h2>
            <p className="text-sm text-gray-500 mt-1">
              문서 상태 및 서명자 정보
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* 서명자 목록 */}
            <div className="border rounded-lg p-3">
              <h3 className="text-sm font-medium text-gray-900 mb-3">서명자</h3>
              <div className="space-y-2">
                {currentDocument.tasks && currentDocument.tasks.length > 0 ? (
                  currentDocument.tasks
                    .filter(task => task.role === 'SIGNER')
                    .map((signer, index) => {
                      // 서명 완료 여부 확인
                      const coordinateFields = (currentDocument.data?.coordinateFields || []) as any[];
                      const hasSigned = coordinateFields.some((field) =>
                        (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
                        (field.signerEmail === signer.assignedUserEmail || field.reviewerEmail === signer.assignedUserEmail) &&
                        field.value &&
                        field.value !== null &&
                        field.value !== ''
                      );

                      return (
                        <div 
                          key={index} 
                          className={`flex items-center space-x-3 p-2 rounded-lg border ${
                            hasSigned 
                              ? 'bg-green-50 border-green-300' 
                              : 'bg-yellow-50 border-yellow-300'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                            hasSigned ? 'bg-green-500' : 'bg-yellow-500'
                          }`}>
                            {hasSigned ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              signer.assignedUserName ? signer.assignedUserName.charAt(0).toUpperCase() : 'S'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {signer.assignedUserName || '이름 없음'}
                              {hasSigned && (
                                <span className="ml-2 text-xs text-green-600 font-semibold">✓ 서명완료</span>
                              )}
                              {!hasSigned && (
                                <span className="ml-2 text-xs text-yellow-600 font-semibold">⏳ 서명대기</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {signer.assignedUserEmail}
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
                    <p className="text-sm">지정된 서명자가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 편집자 정보 (참고용) */}
            {currentDocument.tasks && currentDocument.tasks.some(task => task.role === 'EDITOR') && (
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-medium text-gray-900 mb-3">작성자</h3>
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

export default DocumentSign;

