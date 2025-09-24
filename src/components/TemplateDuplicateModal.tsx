import React, { useState, useEffect } from 'react';
import FolderSelector from './FolderSelector';

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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(originalFolderId);

  // originalName, originalDescription, originalFolderId가 변경될 때 상태 업데이트
  useEffect(() => {
    setNewName(`${originalName} (복사본)`);
    setDescription(originalDescription || '');
    setSelectedFolderId(originalFolderId);
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
      setSelectedFolderId(originalFolderId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          템플릿 복제
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              원본 템플릿
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-gray-600">
              {originalName}
            </div>
          </div>

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

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기본 폴더
            </label>
            <FolderSelector
              selectedFolderId={selectedFolderId}
              onFolderSelect={setSelectedFolderId}
              placeholder="이 템플릿으로 생성한 문서가 담길 폴더를 선택해주세요"
              allowRoot={true}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              이 템플릿으로 문서를 생성할 때 기본적으로 선택될 폴더입니다
            </p>
          </div>

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
              type="submit"
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
        </form>
      </div>
    </div>
  );
};

export default TemplateDuplicateModal;