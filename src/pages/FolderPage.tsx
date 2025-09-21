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
import FolderSidebar from '../components/FolderSidebar';
import { FolderPageProps, Folder } from '../types/folder';
import { Document } from '../types/document';
import { DOCUMENT_STATUS, StatusBadge, getStatusText } from '../utils/documentStatusUtils';

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

  // 문서 미리보기 상태
  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);

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

      // 템플릿 필드와 저장된 필드를 합쳐서 설정
      let allFields: any[] = [];

      // 템플릿 필드 추가
      if (document.template?.coordinateFields) {
        try {
          const templateFields = JSON.parse(document.template.coordinateFields);
          allFields = [...templateFields];
        } catch (error) {
          console.error('템플릿 필드 파싱 오류:', error);
        }
      }

      // 저장된 추가 필드 추가
      const savedFields = document.data?.coordinateFields || [];
      savedFields.forEach((savedField: any) => {
        const existingIndex = allFields.findIndex(field => field.id === savedField.id);
        if (existingIndex >= 0) {
          // 기존 필드 업데이트
          allFields[existingIndex] = { ...allFields[existingIndex], ...savedField };
        } else {
          // 새 필드 추가
          allFields.push(savedField);
        }
      });

      console.log('🔍 FolderPage - 설정된 필드들:', allFields);
      setCoordinateFields(allFields);

      // 서명 필드 설정
      const sigFields = document.data?.signatureFields || [];
      setSignatureFields(sigFields);

      setShowPreview(true);
    } catch (error) {
      console.error('미리보기 오류:', error);
      alert('미리보기를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // PDF 이미지 URL 생성 함수
  const getPdfImageUrl = (document: Document) => {
    if (!document.template?.pdfImagePath) {
      return '';
    }
    const filename = document.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    return `/uploads/pdf-templates/${filename}`;
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
    if (statusFilter === 'all') {
      return documents;
    }
    return documents.filter(doc => doc.status === statusFilter);
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



                  {/* 문서 다운로드 버튼 (빈 껍데기) */}
                  {documents.length > 0 && (
                      <button
                          onClick={() => {
                            // TODO: 문서 다운로드 기능 구현 예정
                            alert('문서 다운로드 기능은 개발 중입니다.');
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        문서 다운로드
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
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                  </svg>
                                  문서 ({filteredDocuments.length}개)
                                </h3>
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
                                          <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                              <h6 className="text-s font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                                  onClick={() => handleDocumentClick(document.id.toString())}>
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
                                                minute: '2-digit'
                                              })}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleDocumentPreview(document)}
                                                className="px-3 py-1.5 text-sm text-black bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors flex items-center"
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
                  coordinateFields={coordinateFields}
                  signatureFields={signatureFields}
                  documentTitle={previewDocument.title || previewDocument.template?.name || '문서'}
              />
          )}
        </div>
      </div>
  );
};

export default FolderPage;