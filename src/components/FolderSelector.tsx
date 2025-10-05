import React, { useState, useEffect, useRef } from 'react';
import { Folder } from '../types/folder';
import { folderService } from '../services/folderService';
import FolderCreateModal from './FolderCreateModal';
import FolderLocationSelector from './FolderLocationSelector';

export interface FolderSelectorProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowRoot?: boolean;
  hideCreateButton?: boolean; // 새 폴더 만들기 버튼 숨김 옵션
  onFolderCreated?: (folderId: string) => void; // 폴더 생성 후 호출되는 콜백
  refreshTrigger?: number; // 폴더 목록 새로고침을 위한 트리거
}

const FolderSelector: React.FC<FolderSelectorProps> = ({
  selectedFolderId,
  onFolderSelect,
  placeholder = "폴더를 선택하세요",
  className = '',
  disabled = false,
  allowRoot = true,
  hideCreateButton = false,
  onFolderCreated,
  refreshTrigger,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedParentFolderId, setSelectedParentFolderId] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 드롭다운이 열릴 때 자동 스크롤
  useEffect(() => {
    if (isOpen && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100); // 짧은 딩레이로 드롭다운 렌더링 완료 후 스크롤
    }
  }, [isOpen]);

  useEffect(() => {
    loadFolders();
  }, []);

  // refreshTrigger가 변경되면 폴더 목록 새로고침
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadFolders();
    }
  }, [refreshTrigger]);

  const loadFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading folder tree for selector...');
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
      setLoading(false);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    try {
      console.log('Creating folder:', { name: folderName, parentId: selectedParentFolderId });
      const newFolder = await folderService.createFolder({
        name: folderName,
        parentId: selectedParentFolderId
      });
      
      // 폴더 생성 후 목록 새로고침
      await loadFolders();
      
      // 새로 생성된 폴더를 자동으로 선택
      onFolderSelect(newFolder.id);
      
      // 부모 컴포넌트에 폴더 생성 알림
      if (onFolderCreated) {
        onFolderCreated(newFolder.id);
      }
      
      // 모달 닫기
      setShowCreateModal(false);
      setSelectedParentFolderId(null);
      setShowLocationModal(false);
    } catch (error: any) {
      console.error('Error creating folder:', error);
      throw error; // 모달에서 에러 처리
    }
  };

  const findFolderById = (folders: Folder[], targetId: string | null): Folder | null => {
    if (targetId === null) return null;
    
    for (const folder of folders) {
      if (folder.id === targetId) {
        return folder;
      }
      if (folder.children && folder.children.length > 0) {
        const found = findFolderById(folder.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedFolder = selectedFolderId ? findFolderById(folders, selectedFolderId) : null;

  const renderFolderTree = (folders: Folder[], depth: number = 0): React.ReactNode => {
    return folders.map(folder => {
      const isSelected = folder.id === selectedFolderId;
      
      return (
        <div key={folder.id}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFolderSelect(folder.id);
              setIsOpen(false);
            }}
            disabled={disabled}
            className={`
              w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center
              ${isSelected
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'hover:bg-gray-50 text-gray-700'
              }
            `}
            style={{ marginLeft: `${depth * 20}px` }}
          >
            <svg className="w-4 h-4 mr-2 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="truncate">{folder.name}</span>
          </button>
          {/* 하위 폴더들 렌더링 */}
          {folder.children && folder.children.length > 0 && renderFolderTree(folder.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className={`relative ${className}`} data-folder-selector ref={containerRef}>
      {/* 폴더 선택기와 새 폴더 만들기 버튼 컨테이너 */}
      <div className="flex items-center gap-2">
        {/* 폴더 선택 버튼 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setIsOpen(!isOpen);
          }}
          disabled={disabled}
          className={`
            ${hideCreateButton ? 'w-full' : 'flex-1'} px-3 py-2 border border-gray-300 rounded-lg text-left bg-white
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-colors flex items-center justify-between
            ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:border-gray-400'}
          `}
        >
          <div className="flex items-center">
            {selectedFolder ? (
              <>
                <svg className="w-4 h-4 mr-2 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className="truncate">{selectedFolder.name}</span>
              </>
            ) : selectedFolderId === null && allowRoot ? (
              <>
                <svg className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="text-gray-600">홈 폴더</span>
              </>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 새 폴더 만들기 버튼 - hideCreateButton이 false일 때만 표시 */}
        {!hideCreateButton && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowLocationModal(true);
            }}
            disabled={disabled}
            className="px-2 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="새 폴더 만들기"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            새 폴더
          </button>
        )}
      </div>      {/* 드롭다운 메뉴 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-2 text-gray-600 text-sm">로딩 중...</span>
            </div>
          ) : error ? (
            <div className="p-3 text-red-600 text-sm">
              {error}
              <button
                type="button"
                onClick={loadFolders}
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="p-2">
              {/* 루트 폴더 옵션 */}
              {allowRoot && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onFolderSelect(null);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2 text-sm transition-colors flex items-center border-b border-gray-100 mb-2
                    ${selectedFolderId === null
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'hover:bg-gray-50 text-gray-700'
                    }
                  `}
                >
                  <svg className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  홈 폴더
                </button>
              )}
              
              {/* 폴더 트리 */}
              {folders.length > 0 ? (
                renderFolderTree(folders)
              ) : (
                <p className="text-gray-500 text-center py-4 text-sm">폴더가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 배경 클릭으로 닫기 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
          }}
        />
      )}

      {/* 위치 선택 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* 배경 오버레이 */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowLocationModal(false);
              }}
            />

            {/* 모달 컨테이너 */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      새 폴더 만들기
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          폴더를 생성할 위치 선택
                        </label>
                        <FolderLocationSelector
                          selectedFolderId={selectedParentFolderId}
                          onFolderSelect={setSelectedParentFolderId}
                          allowRoot={true}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLocationModal(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  계속
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLocationModal(false);
                    setSelectedParentFolderId(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 생성 모달 */}
      <FolderCreateModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedParentFolderId(null);
        }}
        onSubmit={handleCreateFolder}
        parentFolderName={selectedParentFolderId ? findFolderById(folders, selectedParentFolderId)?.name || null : null}
      />
    </div>
  );
};

export default FolderSelector;