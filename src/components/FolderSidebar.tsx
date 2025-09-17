import React, { useState, useEffect } from 'react';
import { Folder } from '../types/folder';
import FolderTree from './FolderTree';
import folderService from '../services/folderService';

export interface FolderSidebarProps {
  currentFolderId?: string | null;
  onFolderSelect: (folderId: string | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const FolderSidebar: React.FC<FolderSidebarProps> = ({
  currentFolderId,
  onFolderSelect,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폴더 트리 데이터 로드
  useEffect(() => {
    loadFolderTree();
  }, []);

  const loadFolderTree = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading folder tree for sidebar...');
      const foldersData = await folderService.getFolderTree();
      console.log('Loaded folder tree:', foldersData);
      setFolders(foldersData);
    } catch (error: any) {
      console.error('Error loading folder tree:', error);
      setError(error.message || '폴더 트리를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadFolderTree();
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 shadow-sm flex flex-col">
        {/* 확장 버튼 */}
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
          title="폴더 트리 보기"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* 홈 버튼 */}
        <button
          onClick={() => onFolderSelect(null)}
          className={`p-3 hover:bg-gray-100 transition-colors ${
            currentFolderId === null ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          }`}
          title="홈 폴더"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>
        
        {/* 폴더 아이콘 */}
        <div className="p-3 text-gray-400" title="폴더 트리">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 shadow-sm flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            폴더 구조
          </h2>
          
          <div className="flex items-center space-x-1">
            {/* 새로고침 버튼 */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <svg 
                className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
            
            {/* 축소 버튼 */}
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="사이드바 숨기기"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2 text-gray-500">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm">폴더 트리 로딩 중...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">오류</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="mt-3 text-sm text-red-800 hover:text-red-900 underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && (
          <FolderTree
            folders={folders}
            currentFolderId={currentFolderId}
            onFolderSelect={onFolderSelect}
          />
        )}
      </div>

      {/* 푸터 정보 */}
      {!loading && !error && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            총 {folders.length}개 폴더
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderSidebar;