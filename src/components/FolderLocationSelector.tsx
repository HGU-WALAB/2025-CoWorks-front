import React, { useState, useEffect } from 'react';
import { Folder } from '../types/folder';
import { folderService } from '../services/folderService';

interface FolderLocationSelectorProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  className?: string;
  allowRoot?: boolean;
}

const FolderLocationSelector: React.FC<FolderLocationSelectorProps> = ({
  selectedFolderId,
  onFolderSelect,
  className = '',
  allowRoot = true,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const foldersData = await folderService.getFolderTree();
      setFolders(foldersData);
    } catch (error: any) {
      console.error('Error loading folders:', error);
      setError('폴더 목록을 불러오는데 실패했습니다.');
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
            onClick={() => onFolderSelect(folder.id)}
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

  if (loading) {
    return (
      <div className={`border border-gray-300 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-2 text-gray-600 text-sm">로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border border-red-300 rounded-lg p-4 ${className}`}>
        <div className="text-red-600 text-sm">
          {error}
          <button
            type="button"
            onClick={loadFolders}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-300 rounded-lg max-h-60 overflow-y-auto ${className}`}>
      <div className="p-2">
        {/* 현재 선택 표시 */}
        <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
          <span className="font-medium text-gray-700">선택된 위치: </span>
          {selectedFolder ? (
            <span className="text-blue-600">{selectedFolder.name}</span>
          ) : selectedFolderId === null && allowRoot ? (
            <span className="text-blue-600">홈 폴더</span>
          ) : (
            <span className="text-gray-500">선택되지 않음</span>
          )}
        </div>

        {/* 루트 폴더 옵션 */}
        {allowRoot && (
          <button
            type="button"
            onClick={() => onFolderSelect(null)}
            className={`
              w-full text-left px-3 py-2 text-sm transition-colors flex items-center border-b border-gray-100 mb-2 rounded
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
          <div className="text-gray-500 text-sm text-center py-4">
            폴더가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderLocationSelector;