import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFolderStore } from '../stores/folderStore';
import { useAuthStore } from '../stores/authStore';
import AccessDenied from '../components/AccessDenied';
import FolderCreateModal from '../components/FolderCreateModal';
import ContextMenu, { ContextMenuOption } from '../components/ContextMenu';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import RenameModal from '../components/RenameModal';
import MoveToFolderModal from '../components/MoveToFolderModal';
import { FolderPageProps, Folder } from '../types/folder';
import { Document } from '../types/document';

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

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
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
        // TODO: 문서 삭제 구현
        console.log('Document delete not implemented yet');
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
      
      // 인증 오류인 경우 로그인 페이지로 리다이렉트
      if (error.message?.includes('인증이 필요합니다')) {
        alert('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
        navigate('/login');
      } else {
        alert(`이동 실패: ${error.message}`);
        // alert으로 에러를 표시한 후 folderStore의 에러 상태를 초기화
        clearError();
      }
    } finally {
      setMoveLoading(false);
    }
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              새 폴더
            </button>
            
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
          </div>
        </div>

        {/* 컨텐츠 영역 */}
        <div className="px-4 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6 min-h-96">
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
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  문서 ({documents.length}개)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      onClick={() => handleDocumentClick(document.id.toString())}
                      onContextMenu={(e) => handleContextMenu(e, document, 'document')}
                      className="w-30 h-30 bg-white rounded-lg shadow-md border-2 border-transparent p-4 cursor-pointer transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-lg flex flex-col items-center justify-center text-center"
                    >
                      <svg className="w-12 h-12 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium line-clamp-2 break-words">
                        {document.data?.title || '제목 없음'}
                      </span>
                    </div>
                  ))}
                </div>
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
            : (contextMenu.item as Document)?.data?.title || ''
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
            : (contextMenu.item as Document)?.data?.title || ''
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
            : (contextMenu.item as Document)?.data?.title || ''
        }
        itemType={contextMenu.type || 'folder'}
      />
    </div>
  );
};

export default FolderPage;