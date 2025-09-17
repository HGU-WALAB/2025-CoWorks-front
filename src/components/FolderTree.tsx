import React, { useState, useEffect } from 'react';
import { Folder } from '../types/folder';

export interface FolderTreeProps {
  folders: Folder[];
  currentFolderId?: string | null;
  onFolderSelect: (folderId: string | null) => void;
  className?: string;
}

export interface FolderTreeNodeProps {
  folder: Folder;
  level: number;
  isSelected: boolean;
  onSelect: (folderId: string) => void;
  onToggleExpanded: (folderId: string) => void;
  isExpanded: boolean;
  currentFolderId?: string | null;
  expandedFolders?: Set<string>;
}

const FolderTreeNode: React.FC<FolderTreeNodeProps> = ({
  folder,
  level,
  isSelected,
  onSelect,
  onToggleExpanded,
  isExpanded,
  currentFolderId,
  expandedFolders
}) => {
  const hasChildren = folder.children && folder.children.length > 0;
  const paddingLeft = level * 16; // 각 레벨마다 16px씩 들여쓰기

  return (
    <div>
      {/* 폴더 아이템 */}
      <div
        className={`
          flex items-center py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors
          ${isSelected 
            ? 'bg-blue-100 text-blue-700 border border-blue-300' 
            : 'hover:bg-gray-100 text-gray-700'
          }
        `}
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {/* 확장/축소 버튼 */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(folder.id);
            }}
            className="mr-1 p-0.5 hover:bg-gray-200 rounded"
          >
            <svg 
              className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
        )}
        
        {/* 폴더 아이콘 */}
        <svg 
          className="w-4 h-4 mr-2 text-yellow-500 flex-shrink-0" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        
        {/* 폴더 이름 */}
        <span className="truncate flex-1">
          {folder.name}
        </span>
        
        {/* 자식 폴더 개수 표시 */}
        {folder.childrenCount > 0 && (
          <span className="text-xs text-gray-400 ml-1">
            ({folder.childrenCount})
          </span>
        )}
      </div>
      
      {/* 하위 폴더들 */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((childFolder) => (
            <FolderTreeNode
              key={childFolder.id}
              folder={childFolder}
              level={level + 1}
              isSelected={childFolder.id === currentFolderId}
              onSelect={onSelect}
              onToggleExpanded={onToggleExpanded}
              isExpanded={expandedFolders ? expandedFolders.has(childFolder.id) : false}
              currentFolderId={currentFolderId}
              expandedFolders={expandedFolders}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  currentFolderId,
  onFolderSelect,
  className = ''
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // 선택된 폴더까지의 경로에 있는 모든 폴더 ID들을 찾는 함수
  const findPathToFolder = (folders: Folder[], targetId: string | null): string[] => {
    if (!targetId) return [];
    
    const findPath = (items: Folder[], path: string[] = []): string[] | null => {
      for (const item of items) {
        const currentPath = [...path, item.id];
        
        if (item.id === targetId) {
          return currentPath;
        }
        
        if (item.children && item.children.length > 0) {
          const foundPath = findPath(item.children, currentPath);
          if (foundPath) {
            return foundPath;
          }
        }
      }
      return null;
    };
    
    return findPath(folders) || [];
  };

  // currentFolderId가 변경될 때마다 해당 폴더까지의 경로를 자동으로 확장
  useEffect(() => {
    if (currentFolderId && folders.length > 0) {
      const pathToFolder = findPathToFolder(folders, currentFolderId);
      if (pathToFolder.length > 1) {
        // 선택된 폴더를 제외한 상위 폴더들만 확장 (마지막 요소 제외)
        const foldersToExpand = pathToFolder.slice(0, -1);
        setExpandedFolders(new Set(foldersToExpand));
      }
    }
  }, [currentFolderId, folders]);

  // 폴더가 현재 선택된 폴더인지 또는 그 하위 폴더 중 선택된 것이 있는지 확인
  const isFolderSelected = (folder: Folder, targetId: string | null): boolean => {
    if (targetId === null) return false;
    if (folder.id === targetId) return true;
    
    if (folder.children) {
      return folder.children.some(child => isFolderSelected(child, targetId));
    }
    return false;
  };

  const handleToggleExpanded = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFolderSelect = (folderId: string) => {
    onFolderSelect(folderId);
  };

  const handleHomeSelect = () => {
    onFolderSelect(null);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {/* 홈(루트) 폴더 */}
      <div
        className={`
          flex items-center py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors
          ${currentFolderId === null 
            ? 'bg-blue-100 text-blue-700 border border-blue-300' 
            : 'hover:bg-gray-100 text-gray-700'
          }
        `}
        onClick={handleHomeSelect}
      >
        <svg className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        <span className="text-gray-600">홈 폴더</span>
      </div>

      {/* 폴더 트리 */}
      {folders.length > 0 ? (
        folders.map((folder) => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            level={0}
            isSelected={folder.id === currentFolderId}
            onSelect={handleFolderSelect}
            onToggleExpanded={handleToggleExpanded}
            isExpanded={expandedFolders.has(folder.id)}
            currentFolderId={currentFolderId}
            expandedFolders={expandedFolders}
          />
        ))
      ) : (
        <div className="text-center py-4 text-sm text-gray-500">
          폴더가 없습니다
        </div>
      )}
    </div>
  );
};

export default FolderTree;