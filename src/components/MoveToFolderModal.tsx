import React, { useState, useEffect } from 'react';
import { Folder } from '../types/folder';
import folderService from '../services/folderService';

export interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (targetFolderId: string | null) => Promise<void>;
  currentFolderId?: string | null;
  loading?: boolean;
  itemName: string;
  itemType: 'folder' | 'document';
}

const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentFolderId,
  loading = false,
  itemName,
  itemType,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
      setSelectedFolderId(null);
      setError(null);
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setFolderLoading(true);
    try {
      console.log('Loading folder tree for move modal...');
      const foldersData = await folderService.getFolderTree();
      console.log('Loaded folder tree:', foldersData);
      setFolders(foldersData);
    } catch (error: any) {
      console.error('Error loading folders:', error);
      
      if (error.message?.includes('인증이 필요합니다')) {
        setError('로그인이 필요합니다. 페이지를 새로고침하고 다시 시도해주세요.');
      } else {
        setError('폴더 목록을 불러오는데 실패했습니다.');
      }
      setFolders([]);
    } finally {
      setFolderLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await onSubmit(selectedFolderId);
      onClose();
    } catch (error: any) {
      console.error('Move operation failed:', error);
      setError(error.message || '이동에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleClose = () => {
    setSelectedFolderId(null);
    setError(null);
    onClose();
  };

  const renderFolderTree = (folders: Folder[], depth: number = 0): React.ReactNode => {
    return folders.map(folder => {
      const isCurrentFolder = folder.id === currentFolderId;
      const isSelected = folder.id === selectedFolderId;
      
      return (
        <div key={folder.id}>
          <button
            onClick={() => setSelectedFolderId(folder.id)}
            disabled={isCurrentFolder || loading}
            className={`
              w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center
              ${isCurrentFolder 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : isSelected
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'hover:bg-gray-50 text-gray-700'
              }
            `}
            style={{ marginLeft: `${depth * 20}px` }}
          >
            <svg className="w-4 h-4 mr-2 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="truncate">
              {folder.name}
              {isCurrentFolder && ' (현재 폴더)'}
            </span>
          </button>
          {/* 하위 폴더들 렌더링 */}
          {folder.children && folder.children.length > 0 && renderFolderTree(folder.children, depth + 1)}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={!loading ? handleClose : undefined}
        />

        {/* 센터링을 위한 트릭 */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* 모달 컨텐츠 */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16l-4-4m0 0l4-4m-4 4h18"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {itemType === 'folder' ? '폴더' : '문서'} 이동
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-4">
                    <span className="font-medium">"{itemName}"</span>을(를) 이동할 폴더를 선택하세요.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        대상 폴더 선택
                      </label>
                      
                      {folderLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="ml-2 text-gray-600">폴더 목록 로딩 중...</span>
                        </div>
                      ) : (
                        <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                          {/* 루트 폴더 옵션 */}
                          <button
                            onClick={() => setSelectedFolderId(null)}
                            disabled={currentFolderId === null || loading}
                            className={`
                              w-full text-left px-3 py-2 text-sm transition-colors flex items-center border-b border-gray-100
                              ${currentFolderId === null
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : selectedFolderId === null
                                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }
                            `}
                          >
                            <svg className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                            </svg>
                            루트 폴더
                            {currentFolderId === null && ' (현재 위치)'}
                          </button>
                          
                          {/* 폴더 트리 */}
                          <div className="p-2">
                            {folders.length > 0 ? (
                              renderFolderTree(folders)
                            ) : (
                              <p className="text-gray-500 text-center py-4">폴더가 없습니다.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || folderLoading || selectedFolderId === currentFolderId}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  이동 중...
                </>
              ) : (
                '이동'
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoveToFolderModal;