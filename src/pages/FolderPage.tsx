import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolderStore } from '../stores/folderStore';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import AccessDenied from '../components/AccessDenied';
import FolderCreateModal from '../components/FolderCreateModal';
import ContextMenu, { ContextMenuOption } from '../components/ContextMenu';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import RenameModal from '../components/RenameModal';
import MoveToFolderModal from '../components/MoveToFolderModal';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import WorkflowModal from '../components/WorkflowModal';
import FolderSidebar from '../components/FolderSidebar';
import { FolderPageProps, Folder } from '../types/folder';
import { Document } from '../types/document';
import { DOCUMENT_STATUS, StatusBadge, getStatusText } from '../utils/documentStatusUtils';
import { useBulkDownload } from '../utils/bulkDownloadUtils';
import { loadPdfPagesFromTemplate } from '../utils/pdfPageLoader';

// 필터링 및 정렬 타입 정의
type SortOption = 'createdAt-desc' | 'createdAt-asc' | 'updatedAt-desc' | 'updatedAt-asc';

const FolderPage: React.FC<FolderPageProps> = () => {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();

  const {
    folders,
    documents,
    currentFolder,
    folderPath,
    loading,
    error,
    loadFolderContents,
    checkFolderAccess,
    createFolder,
    renameFolder,
    moveFolder,
    moveDocument,
    deleteFolder,
    reset,
    clearError
  } = useFolderStore();

  const { deleteDocument } = useDocumentStore();

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // 사이드바 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 문서 필터링 상태
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 문서 정렬 상태
  const [sortOption, setSortOption] = useState<SortOption>('updatedAt-desc');

  // 문서 선택 상태
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());

  // 문서 미리보기 상태
  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);

  // 작업현황 모달 상태
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [selectedWorkflowDocument, setSelectedWorkflowDocument] = useState<Document | null>(null);

  // 대량 다운로드 훅
  const { isDownloading, progress, downloadAsZip } = useBulkDownload();

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    type: 'folder' | 'document' | null;
    item: Folder | Document | null;
  }>({
    isVisible: false,
    x: 0,
    y: 0,
    type: null,
    item: null,
  });

  // 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDownloadAlertModal, setShowDownloadAlertModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);

  // 컴포넌트 마운트 시 권한 확인
  useEffect(() => {
    const verifyAccess = async () => {
      try {
        console.log('Checking folder access. Auth status:', { isAuthenticated, token: !!token });
        const access = await checkFolderAccess();
        setHasAccess(access);
      } catch (error) {
        console.error('Error checking folder access:', error);
        setHasAccess(false);
      } finally {
        setAccessLoading(false);
      }
    };

    verifyAccess();
  }, [checkFolderAccess, isAuthenticated, token]);

  // 권한이 확인된 후 폴더 내용 로드
  useEffect(() => {
    if (hasAccess === true) {
      const targetFolderId = folderId || null;
      loadFolderContents(targetFolderId);
    }
  }, [hasAccess, folderId, loadFolderContents]);

  // 컴포넌트 언마운트 시 상태 리셋
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // 필터 변경 시 선택 상태 정리 (필터된 문서에 없는 선택 제거)
  useEffect(() => {
    const filteredDocs = getFilteredDocuments();
    const filteredDocIds = new Set(filteredDocs.map(doc => doc.id));
    
    setSelectedDocuments(prev => {
      const newSet = new Set<number>();
      prev.forEach(id => {
        if (filteredDocIds.has(id)) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  }, [statusFilter, documents]);

  const handleFolderClick = (clickedFolderId: string) => {
    navigate(`/folders/${clickedFolderId}`);
  };

  const handleDocumentClick = (documentId: string) => {
    navigate(`/documents/${documentId}`);
  };

  const handleBreadcrumbNavigate = (targetFolderId: string | null) => {
    if (targetFolderId === null) {
      navigate('/folders');
    } else {
      navigate(`/folders/${targetFolderId}`);
    }
  };

  // 사이드바 폴더 선택 핸들러
  const handleSidebarFolderSelect = (selectedFolderId: string | null) => {
    if (selectedFolderId === null) {
      navigate('/folders');
    } else {
      navigate(`/folders/${selectedFolderId}`);
    }
  };

  // 사이드바 토글 핸들러
  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleCreateFolder = async (folderName: string) => {
    setCreateLoading(true);
    try {
      await createFolder(folderName, folderId || null);
      // 생성 후 현재 폴더 내용을 다시 로드
      await loadFolderContents(folderId || null);
    } catch (error: any) {
      console.error('Create folder operation failed:', error);
      alert(`폴더 생성 실패: ${error.message}`);
      clearError();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleContextMenu = (
      event: React.MouseEvent,
      item: Folder | Document,
      type: 'folder' | 'document'
  ) => {
    event.preventDefault();
    setContextMenu({
      isVisible: true,
      x: event.clientX,
      y: event.clientY,
      type,
      item,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  };

  const handleRename = () => {
    setShowRenameModal(true);
    closeContextMenu();
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
    closeContextMenu();
  };

  const handleMoveTo = () => {
    setShowMoveModal(true);
    closeContextMenu();
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!contextMenu.item) return;

    setRenameLoading(true);
    try {
      if (contextMenu.type === 'folder') {
        await renameFolder(contextMenu.item.id.toString(), newName);
      } else {
        // TODO: 문서 이름 변경 구현
        console.log('Document rename not implemented yet');
      }
      // 변경 후 폴더 내용 다시 로드
      await loadFolderContents(folderId || null);
    } catch (error: any) {
      console.error('Rename operation failed:', error);
      alert(`이름 변경 실패: ${error.message}`);
      clearError();
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!contextMenu.item) return;

    setDeleteLoading(true);
    try {
      if (contextMenu.type === 'folder') {
        await deleteFolder(contextMenu.item.id.toString());
      } else {
        // 문서 삭제 API 호출
        const documentId = Number(contextMenu.item.id);
        console.log('🗑️ 문서 삭제 시도:', documentId);
        await deleteDocument(documentId);
        console.log('✅ 문서 삭제 완료:', documentId);
      }
      // 삭제 후 폴더 내용 다시 로드
      await loadFolderContents(folderId || null);
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error('Delete operation failed:', error);
      alert(`삭제 실패: ${error.message}`);
      clearError();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleMoveSubmit = async (targetFolderId: string | null) => {
    if (!contextMenu.item) return;

    setMoveLoading(true);
    try {
      // 인증 헤더 재설정 시도
      const { setAuthHeader } = useAuthStore.getState();
      setAuthHeader();

      if (contextMenu.type === 'folder') {
        await moveFolder(contextMenu.item.id.toString(), targetFolderId);
      } else {
        // 문서 이동 구현
        await moveDocument(contextMenu.item.id.toString(), targetFolderId);
      }
      // 이동 후 폴더 내용 다시 로드
      await loadFolderContents(folderId || null);
      setShowMoveModal(false);
    } catch (error: any) {
      console.error('Move operation failed:', error);
      alert(`이동 실패: ${error.message}`);
      clearError();
    } finally {
      setMoveLoading(false);
    }
  };

  // 문서 미리보기 핸들러
  const handleDocumentPreview = async (document: Document) => {
    try {
      console.log('🔍 FolderPage - 미리보기 문서:', document);
      setPreviewDocument(document);

      // 미리보기는 저장된 문서 데이터만 사용 (템플릿 필드와 병합하지 않음)
      const savedFields = document.data?.coordinateFields || [];

      console.log('💾 FolderPage - 저장된 필드 (미리보기용):', {
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

      console.log('🖋️ FolderPage - 서명 필드 처리:', {
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
    } catch (error) {
      console.error('미리보기 오류:', error);
      alert('미리보기를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 작업현황 모달 핸들러
  const handleWorkflow = (document: Document) => {
    setSelectedWorkflowDocument(document);
    setShowWorkflowModal(true);
  };

  // 전체 문서 다운로드 핸들러 (ZIP)
  const handleBulkDownload = async () => {
    try {
      // 선택된 문서가 없으면 알림 모달 표시
      if (selectedDocuments.size === 0) {
        setShowDownloadAlertModal(true);
        return;
      }

      // 선택된 문서만 다운로드
      const documentsToDownload = documents.filter(doc => selectedDocuments.has(doc.id));

      if (documentsToDownload.length === 0) {
        setShowDownloadAlertModal(true);
        return;
      }

      // 사용자 확인
      const confirmed = window.confirm(
        `총 ${documentsToDownload.length}개의 선택된 문서를 ZIP 파일로 다운로드하시겠습니까?\n\n` +
        '다운로드가 진행되는 동안 브라우저를 닫지 마세요.'
      );

      if (!confirmed) {
        return;
      }

      console.log('📦 ZIP 다운로드 시작:', documentsToDownload.length, '개 문서');
      
      await downloadAsZip(documentsToDownload, getPdfImageUrl);
      
    } catch (error) {
      console.error('❌ ZIP 다운로드 실패:', error);
      alert(`문서 다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 문서 선택 핸들러
  const handleDocumentSelect = (documentId: number, checked: boolean) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(documentId);
      } else {
        newSet.delete(documentId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const filteredDocs = getFilteredDocuments();
      setSelectedDocuments(new Set(filteredDocs.map(doc => doc.id)));
    } else {
      setSelectedDocuments(new Set());
    }
  };

  // 현재 필터된 문서들 중 선택된 문서 수 계산
  const getSelectedCount = () => {
    const filteredDocs = getFilteredDocuments();
    return filteredDocs.filter(doc => selectedDocuments.has(doc.id)).length;
  };

  // 전체 선택 상태 확인
  const isAllSelected = () => {
    const filteredDocs = getFilteredDocuments();
    return filteredDocs.length > 0 && filteredDocs.every(doc => selectedDocuments.has(doc.id));
  };

  // 일부 선택 상태 확인 (indeterminate)
  const isSomeSelected = () => {
    const filteredDocs = getFilteredDocuments();
    const selectedCount = filteredDocs.filter(doc => selectedDocuments.has(doc.id)).length;
    return selectedCount > 0 && selectedCount < filteredDocs.length;
  };

  // PDF 이미지 URL 생성 함수
  const getPdfImageUrl = (document: Document) => {
    if (!document.template?.pdfImagePath) {
      return '';
    }
    const filename = document.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    return `/uploads/pdf-templates/${filename}`;
  };

  // 여러 페이지 URL 배열 생성 - pdfPageLoader 유틸리티 사용
  const getPdfImageUrls = (doc: Document): string[] => {
    if (!doc.template) return [];
    return loadPdfPagesFromTemplate(doc.template);
  };

  // 문서 상태 통계 계산 함수
  const getDocumentStats = () => {
    const stats = {
      total: documents.length,
      draft: 0,
      editing: 0,
      readyForReview: 0,
      reviewing: 0,
      completed: 0,
      rejected: 0
    };

    documents.forEach(doc => {
      switch (doc.status) {
        case DOCUMENT_STATUS.DRAFT:
          stats.draft++;
          break;
        case DOCUMENT_STATUS.EDITING:
          stats.editing++;
          break;
        case DOCUMENT_STATUS.READY_FOR_REVIEW:
          stats.readyForReview++;
          break;
        case DOCUMENT_STATUS.REVIEWING:
          stats.reviewing++;
          break;
        case DOCUMENT_STATUS.COMPLETED:
          stats.completed++;
          break;
        case DOCUMENT_STATUS.REJECTED:
          stats.rejected++;
          break;
      }
    });

    return stats;
  };

  // 필터링된 문서 목록 계산 함수
  const getFilteredDocuments = () => {
    let filtered;
    if (statusFilter === 'all') {
      filtered = documents;
    } else {
      filtered = documents.filter(doc => doc.status === statusFilter);
    }
    
    // 정렬 옵션에 따라 정렬
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'createdAt-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'createdAt-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'updatedAt-desc':
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        case 'updatedAt-asc':
          return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  };

  // 필터 버튼 클릭 핸들러
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
  };

  const getContextMenuOptions = (): ContextMenuOption[] => {
    if (!contextMenu.item) return [];

    const isFolder = contextMenu.type === 'folder';

    return [
      {
        id: 'open',
        label: isFolder ? '폴더 열기' : '문서 열기',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        ),
        onClick: () => {
          if (isFolder) {
            handleFolderClick(contextMenu.item!.id.toString());
          } else {
            handleDocumentClick(contextMenu.item!.id.toString());
          }
          closeContextMenu();
        },
      },
      {
        id: 'rename',
        label: '이름 변경',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        ),
        onClick: handleRename,
      },
      {
        id: 'moveTo',
        label: '이동',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
        ),
        onClick: handleMoveTo,
      },
      {
        id: 'delete',
        label: '삭제',
        dangerous: true,
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        ),
        onClick: handleDelete,
      },
    ];
  };

  const handleGoBack = () => {
    if (currentFolder?.parentId) {
      navigate(`/folders/${currentFolder.parentId}`);
    } else {
      navigate('/folders');
    }
  };

  // 로딩 상태 - 권한 확인 중
  if (accessLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">권한을 확인하는 중...</p>
          </div>
        </div>
    );
  }

  // 권한 없음
  if (hasAccess === false) {
    return <AccessDenied />;
  }

  // 폴더 내용 로딩 중
  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">폴더 내용을 불러오는 중...</p>
          </div>
        </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
                onClick={() => loadFolderContents(folderId || null)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50 flex">
        {/* 사이드바 */}
        <FolderSidebar
            currentFolderId={folderId}
            onFolderSelect={handleSidebarFolderSelect}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
        />

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full">
            {/* 헤더 */}
            <div className="px-4 py-6 sm:px-0">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <svg
                      className="w-8 h-8 mr-3 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  폴더 관리
                </h1>
              </div>
            </div>

            {/* 브레드크럼 네비게이션 */}
            <nav className="px-4 pb-4 sm:px-0" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2 text-sm text-gray-500">
                <li>
                  <button
                      onClick={() => handleBreadcrumbNavigate(null)}
                      className={`flex items-center ${
                          folderPath.length === 0
                              ? 'text-gray-900 font-medium cursor-default'
                              : 'text-indigo-600 hover:text-indigo-700'
                      }`}
                      disabled={folderPath.length === 0}
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    홈
                  </button>
                </li>
                {folderPath.map((folder, index) => (
                    <li key={folder.id} className="flex items-center">
                      <svg className="w-5 h-5 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      {index === folderPath.length - 1 ? (
                          <span className="text-gray-900 font-medium">{folder.name}</span>
                      ) : (
                          <button
                              onClick={() => handleBreadcrumbNavigate(folder.id)}
                              className="text-indigo-600 hover:text-indigo-700"
                          >
                            {folder.name}
                          </button>
                      )}
                    </li>
                ))}
              </ol>
            </nav>

            {/* 액션 버튼 영역 */}
            <div className="px-4 pb-6 sm:px-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {currentFolder && (
                      <button
                          onClick={handleGoBack}
                          className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                        </svg>
                        상위 폴더
                      </button>
                  )}
                  <button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    새 폴더
                  </button>



                  {/* 문서 다운로드 버튼 */}
                  {documents.length > 0 && (
                      <button
                          onClick={handleBulkDownload}
                          disabled={isDownloading}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                            isDownloading
                              ? 'bg-gray-400 cursor-not-allowed text-white'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                      >
                        {isDownloading ? (
                          <>
                            <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                                <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                                <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                              </circle>
                            </svg>
                            다운로드 중... ({progress.current}/{progress.total})
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {selectedDocuments.size > 0 ? `문서 다운로드 (선택된 ${selectedDocuments.size}개)` : '문서 다운로드'}
                          </>
                        )}
                      </button>
                  )}
                </div>

                {/* 문서 상태 필터 */}
                {documents.length > 0 && (
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg">
                        {(() => {
                          const stats = getDocumentStats();
                          return (
                              <>
                                <span className="font-medium text-gray-700">문서 상태:</span>
                                <div className="flex items-center space-x-2">
                                  {/* 전체 보기 버튼 */}
                                  <button
                                      onClick={() => handleStatusFilter('all')}
                                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                          statusFilter === 'all'
                                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                  >
                                    전체 {stats.total}
                                  </button>

                                  {/* 각 상태별 필터 버튼 */}
                                  {stats.draft > 0 && (
                                      <button
                                          onClick={() => handleStatusFilter(DOCUMENT_STATUS.DRAFT)}
                                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              statusFilter === DOCUMENT_STATUS.DRAFT
                                                  ? 'bg-gray-100 text-gray-700 border border-gray-300'
                                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                          }`}
                                      >
                                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                        <span>{getStatusText(DOCUMENT_STATUS.DRAFT)} {stats.draft}</span>
                                      </button>
                                  )}
                                  {stats.editing > 0 && (
                                      <button
                                          onClick={() => handleStatusFilter(DOCUMENT_STATUS.EDITING)}
                                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              statusFilter === DOCUMENT_STATUS.EDITING
                                                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                          }`}
                                      >
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span>{getStatusText(DOCUMENT_STATUS.EDITING)} {stats.editing}</span>
                                      </button>
                                  )}
                                  {stats.readyForReview > 0 && (
                                      <button
                                          onClick={() => handleStatusFilter(DOCUMENT_STATUS.READY_FOR_REVIEW)}
                                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              statusFilter === DOCUMENT_STATUS.READY_FOR_REVIEW
                                                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                                          }`}
                                      >
                                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                        <span>{getStatusText(DOCUMENT_STATUS.READY_FOR_REVIEW)} {stats.readyForReview}</span>
                                      </button>
                                  )}
                                  {stats.reviewing > 0 && (
                                      <button
                                          onClick={() => handleStatusFilter(DOCUMENT_STATUS.REVIEWING)}
                                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              statusFilter === DOCUMENT_STATUS.REVIEWING
                                                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                          }`}
                                      >
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                        <span>{getStatusText(DOCUMENT_STATUS.REVIEWING)} {stats.reviewing}</span>
                                      </button>
                                  )}
                                  {stats.rejected > 0 && (
                                      <button
                                          onClick={() => handleStatusFilter(DOCUMENT_STATUS.REJECTED)}
                                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              statusFilter === DOCUMENT_STATUS.REJECTED
                                                  ? 'bg-red-100 text-red-700 border border-red-300'
                                                  : 'bg-red-50 text-red-700 hover:bg-red-100'
                                          }`}
                                      >
                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                        <span>{getStatusText(DOCUMENT_STATUS.REJECTED)} {stats.rejected}</span>
                                      </button>
                                  )}
                                  {stats.completed > 0 && (
                                      <button
                                          onClick={() => handleStatusFilter(DOCUMENT_STATUS.COMPLETED)}
                                          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              statusFilter === DOCUMENT_STATUS.COMPLETED
                                                  ? 'bg-green-100 text-green-700 border border-green-300'
                                                  : 'bg-green-50 text-green-700 hover:bg-green-100'
                                          }`}
                                      >
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span>{getStatusText(DOCUMENT_STATUS.COMPLETED)} {stats.completed}</span>
                                      </button>
                                  )}
                                </div>
                              </>
                          );
                        })()}
                      </div>

                      {/* 정렬 기준 드롭다운 */}
                      <div className="flex items-center space-x-2 ml-4">
                        <span className="font-medium text-gray-700 text-sm">정렬:</span>
                        <select
                          value={sortOption}
                          onChange={(e) => setSortOption(e.target.value as SortOption)}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="updatedAt-desc">수정일 (최신순)</option>
                          <option value="updatedAt-asc">수정일 (오래된순)</option>
                          <option value="createdAt-desc">생성일 (최신순)</option>
                          <option value="createdAt-asc">생성일 (오래된순)</option>
                        </select>
                      </div>
                    </div>
                )}
              </div>
            </div>

            {/* 컨텐츠 영역 */}
            <div className="px-4 sm:px-0">
              <div
                  className="bg-white rounded-lg shadow p-6 min-h-96"
                  onClick={closeContextMenu}
              >
                {/* 폴더가 있는 경우 */}
                {folders.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                        폴더 ({folders.length}개)
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {folders.map((folder) => (
                            <div
                                key={folder.id}
                                onClick={() => handleFolderClick(folder.id)}
                                onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                                className="w-30 h-30 bg-white rounded-lg shadow-md border-2 border-transparent p-4 cursor-pointer transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-lg flex flex-col items-center justify-center text-center"
                            >
                              <svg className="w-12 h-12 text-yellow-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              </svg>
                              <span className="text-sm font-medium line-clamp-2 break-words">{folder.name}</span>
                            </div>
                        ))}
                      </div>
                    </div>
                )}

                {/* 문서가 있는 경우 */}
                {documents.length > 0 && (
                    <div className="mb-8">
                      {(() => {
                        const filteredDocuments = getFilteredDocuments();
                        return (
                            <>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                  <div className="flex items-center mr-3">
                                    <input
                                      type="checkbox"
                                      checked={isAllSelected()}
                                      ref={(input) => {
                                        if (input) input.indeterminate = isSomeSelected();
                                      }}
                                      onChange={(e) => handleSelectAll(e.target.checked)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label className="ml-2 text-sm text-gray-700">
                                      {getSelectedCount() > 0 ? `${getSelectedCount()}개 선택됨` : '전체 선택'}
                                    </label>
                                  </div>
                                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                    문서 ({filteredDocuments.length}개)
                                  </h3>
                                </div>
                                {statusFilter !== 'all' && (
                                    <button
                                        onClick={() => handleStatusFilter('all')}
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                      필터 해제
                                    </button>
                                )}
                              </div>
                              <div className="bg-white rounded-lg shadow">
                                <div className="divide-y divide-gray-200">
                                  {filteredDocuments.map((document) => (
                                      <div key={document.id}
                                           className="px-6 py-4 hover:bg-gray-50"
                                           onContextMenu={(e) => handleContextMenu(e, document, 'document')}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-3">
                                            <input
                                              type="checkbox"
                                              checked={selectedDocuments.has(document.id)}
                                              onChange={(e) => handleDocumentSelect(document.id, e.target.checked)}
                                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <div className="flex-1">
                                              <div className="flex items-center space-x-3 mb-2">
                                                <h6 className="text-s font-medium text-gray-900">
                                                  {document.title || document.templateName || '제목 없음'}
                                                </h6>
                                                <StatusBadge status={document.status} size="sm" />
                                              </div>
                                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                                <span>마지막 수정일: {new Date(document.updatedAt).toLocaleString('ko-KR', {
                                                  year: 'numeric',
                                                  month: 'numeric',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  hour12: false
                                                })}</span>
                                                {document.deadline && (
                                                  <span className={`flex items-center space-x-1 ${
                                                    new Date(document.deadline) < new Date() && document.status !== DOCUMENT_STATUS.COMPLETED ? 'text-red-600' : 'text-orange-600'
                                                  }`}>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>
                                                      만료일: {new Date(document.deadline).toLocaleString('ko-KR', {
                                                        year: 'numeric',
                                                        month: 'numeric',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                      })}
                                                      {new Date(document.deadline) < new Date() && document.status !== DOCUMENT_STATUS.COMPLETED && (
                                                        <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                                                          만료됨
                                                        </span>
                                                      )}
                                                    </span>
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleWorkflow(document)}
                                                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
                                            >
                                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                              </svg>
                                              작업현황
                                            </button>

                                            <button
                                                onClick={() => handleDocumentPreview(document)}
                                                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
                                            >
                                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                              </svg>
                                              미리보기
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                  ))}
                                </div>
                              </div>
                            </>
                        );
                      })()}
                    </div>
                )}

                {/* 빈 상태 */}
                {folders.length === 0 && documents.length === 0 && (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {currentFolder ? '이 폴더는 비어있습니다' : '폴더가 없습니다'}
                      </h3>
                      <p className="text-gray-500 mb-4">
                        새 폴더를 생성하거나 기존 문서를 이 폴더로 이동해보세요
                      </p>
                      <button
                          onClick={() => setShowCreateModal(true)}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        새 폴더 생성
                      </button>
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* 새 폴더 생성 모달 */}
          <FolderCreateModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSubmit={handleCreateFolder}
              parentFolderName={currentFolder?.name || null}
              loading={createLoading}
          />

          {/* 컨텍스트 메뉴 */}
          <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              isVisible={contextMenu.isVisible}
              options={getContextMenuOptions()}
              onClose={closeContextMenu}
          />

          {/* 삭제 확인 모달 */}
          <DeleteConfirmModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={handleDeleteConfirm}
              loading={deleteLoading}
              title={`${contextMenu.type === 'folder' ? '폴더' : '문서'} 삭제`}
              message={`정말로 이 ${contextMenu.type === 'folder' ? '폴더' : '문서'}를 삭제하시겠습니까?`}
              itemName={
                contextMenu.type === 'folder'
                    ? (contextMenu.item as Folder)?.name || ''
                    : (contextMenu.item as Document)?.title || ''
              }
          />

          {/* 이름 변경 모달 */}
          <RenameModal
              isOpen={showRenameModal}
              onClose={() => setShowRenameModal(false)}
              onSubmit={handleRenameSubmit}
              loading={renameLoading}
              currentName={
                contextMenu.type === 'folder'
                    ? (contextMenu.item as Folder)?.name || ''
                    : (contextMenu.item as Document)?.title || ''
              }
              title={`${contextMenu.type === 'folder' ? '폴더' : '문서'} 이름 변경`}
              itemType={contextMenu.type || 'folder'}
          />

          {/* 이동 모달 */}
          <MoveToFolderModal
              isOpen={showMoveModal}
              onClose={() => setShowMoveModal(false)}
              onSubmit={handleMoveSubmit}
              loading={moveLoading}
              currentFolderId={contextMenu.type === 'folder' ? contextMenu.item?.id.toString() : folderId}
              itemName={
                contextMenu.type === 'folder'
                    ? (contextMenu.item as Folder)?.name || ''
                    : (contextMenu.item as Document)?.title || ''
              }
              itemType={contextMenu.type || 'folder'}
          />

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

          {/* 작업현황 모달 */}
          <WorkflowModal
            isOpen={showWorkflowModal}
            onClose={() => setShowWorkflowModal(false)}
            document={selectedWorkflowDocument}
          />

          {/* 다운로드 안내 모달 */}
          {showDownloadAlertModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">문서를 선택해주세요</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    다운로드할 문서를 먼저 선택하신 후 다운로드 버튼을 클릭해주세요.
                  </p>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowDownloadAlertModal(false)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      확인
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};

export default FolderPage;