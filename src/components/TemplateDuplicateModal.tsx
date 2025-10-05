import React, { useState, useEffect } from 'react';
import FolderSelector from './FolderSelector';
import FolderCreateModal from './FolderCreateModal';
import FolderLocationSelector from './FolderLocationSelector';
import { folderService } from '../services/folderService';

interface TemplateDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName: string, description: string, folderId: string | null) => void;
  originalName: string;
  originalDescription: string;
  originalFolderId: string | null;
  loading?: boolean;
}

const TemplateDuplicateModal: React.FC<TemplateDuplicateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  originalName,
  originalDescription,
  originalFolderId,
  loading = false
}) => {
  const [newName, setNewName] = useState(`${originalName} (복사본)`);
  const [description, setDescription] = useState(originalDescription || '');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // 홈 폴더로 기본 설정
  const [folderRefreshTrigger, setFolderRefreshTrigger] = useState(0); // FolderSelector 새로고침용
  
  // 폴더 생성 관련 state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedParentFolderId, setSelectedParentFolderId] = useState<string | null>(null);

  // originalName, originalDescription이 변경될 때 상태 업데이트 (폴더는 항상 홈 폴더로 설정)
  useEffect(() => {
    setNewName(`${originalName} (복사본)`);
    setDescription(originalDescription || '');
    setSelectedFolderId(null); // 항상 홈 폴더로 설정
  }, [originalName, originalDescription, originalFolderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onConfirm(newName.trim(), description.trim(), selectedFolderId);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setNewName(`${originalName} (복사본)`);
      setDescription(originalDescription || '');
      setSelectedFolderId(null); // 홈 폴더로 초기화
      // 폴더 생성 관련 state 초기화
      setShowLocationModal(false);
      setShowCreateModal(false);
      setSelectedParentFolderId(null);
    }
  };

  // 폴더 생성 관련 함수들
  const handleCreateFolder = async (folderName: string) => {
    try {
      const newFolder = await folderService.createFolder({
        name: folderName,
        parentId: selectedParentFolderId
      });
      
      // 새로 생성된 폴더를 자동으로 선택
      setSelectedFolderId(newFolder.id);
      
      // FolderSelector 새로고침 트리거
      setFolderRefreshTrigger(prev => prev + 1);
      
      // 모달 닫기
      setShowCreateModal(false);
      setSelectedParentFolderId(null);
      setShowLocationModal(false);
    } catch (error: any) {
      console.error('Error creating folder:', error);
      throw error; // 모달에서 에러 처리
    }
  };

  const openCreateFolderModal = () => {
    setShowLocationModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto relative">
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          템플릿 복제
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            원본 템플릿 이름
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-gray-600">
            {originalName}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 템플릿 이름 *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="복제될 템플릿의 이름을 입력하세요"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="템플릿에 대한 설명을 입력하세요 (선택사항)"
              disabled={loading}
            />
          </div>
        </form>

        {/* FolderSelector를 form과 버튼 사이에 배치 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              기본 폴더
            </label>
            <button
              type="button"
              onClick={openCreateFolderModal}
              className="px-2 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded transition-colors flex items-center"
              title="새 폴더 만들기"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              새 폴더
            </button>
          </div>
          <FolderSelector
            selectedFolderId={selectedFolderId}
            onFolderSelect={setSelectedFolderId}
            placeholder="이 템플릿으로 생성한 문서가 담길 폴더를 선택해주세요"
            allowRoot={true}
            disabled={loading}
            hideCreateButton={true}
            refreshTrigger={folderRefreshTrigger}
            onFolderCreated={(folderId) => {
              // 폴더 생성 후 자동 선택 및 새로고침
              setSelectedFolderId(folderId);
              setFolderRefreshTrigger(prev => prev + 1);
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            이 템플릿으로 문서를 생성할 때 기본적으로 선택될 폴더입니다
          </p>
        </div>

        {/* 버튼들을 별도 영역으로 분리 */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !newName.trim()}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                복제 중...
              </div>
            ) : (
              '복제하기'
            )}
          </button>
        </div>

        {/* 폴더 위치 선택 모달 */}
        {showLocationModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* 배경 오버레이 */}
              <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                onClick={() => setShowLocationModal(false)}
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
                    onClick={() => {
                      setShowLocationModal(false);
                      setShowCreateModal(true);
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    계속
                  </button>
                  <button
                    type="button"
                    onClick={() => {
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
          parentFolderName={selectedParentFolderId ? '선택된 폴더' : null}
        />
      </div>
    </div>
  );
};

export default TemplateDuplicateModal;