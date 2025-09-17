import React, { useState, useEffect } from 'react';
import { Folder } from '../types/folder';
import folderService from '../services/folderService';

export interface FolderSelectorProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  allowRoot?: boolean;
}

const FolderSelector: React.FC<FolderSelectorProps> = ({
  selectedFolderId,
  onFolderSelect,
  className = '',
  placeholder = '폴더를 선택하세요',
  disabled = false,
  allowRoot = true,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

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
            onClick={() => {
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
    <div className={`relative ${className}`}>
      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border border-gray-300 rounded-lg text-left bg-white
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

      {/* 드롭다운 메뉴 */}
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
                  onClick={() => {
                    onFolderSelect(null);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2 text-sm transition-colors flex items-center border-b border-gray-100 mb-1
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
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default FolderSelector;