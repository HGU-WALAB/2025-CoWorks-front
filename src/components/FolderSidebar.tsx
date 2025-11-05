import React, { useState, useEffect } from 'react';
import { Folder } from '../types/folder';
import FolderTree from './FolderTree';
import folderService from '../services/folderService';

export interface FolderSidebarProps {
  currentFolderId?: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onClose?: () => void; // 모바일에서 사이드바 닫기용
}

const FolderSidebar: React.FC<FolderSidebarProps> = ({
  currentFolderId,
  onFolderSelect,
  onClose
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

  return (
    <div className="w-64 lg:w-72 xl:w-80 bg-white border-r border-gray-200 shadow-sm flex flex-col h-full flex-shrink-0">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            폴더
          </h2>
          
          <div className="flex items-center space-x-1">
            {/* 모바일 닫기 버튼 */}
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="닫기"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
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
    </div>
  );
};

export default FolderSidebar;