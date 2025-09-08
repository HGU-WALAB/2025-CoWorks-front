import React from 'react';
import { Document } from '../../../stores/documentStore';

interface DocumentToolbarProps {
  document: Document;
  isSaving: boolean;
  onShowPreview: () => void;
  onBack: () => void;
}

const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  document,
  isSaving,
  onShowPreview,
  onBack
}) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'DRAFT': { color: 'bg-gray-100 text-gray-800', text: '임시저장' },
      'EDITING': { color: 'bg-blue-100 text-blue-800', text: '편집중' },
      'READY_FOR_REVIEW': { color: 'bg-yellow-100 text-yellow-800', text: '검토대기' },
      'REVIEWING': { color: 'bg-orange-100 text-orange-800', text: '검토중' },
      'COMPLETED': { color: 'bg-green-100 text-green-800', text: '완료' },
      'REJECTED': { color: 'bg-red-100 text-red-800', text: '반려' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;
    
    return (
      <span className={`px-2 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              ← 문서 목록
            </button>
            
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-semibold text-gray-800">
                문서 편집
              </h1>
              <div className="flex items-center space-x-3 mt-1">
                <p className="text-sm text-gray-500">
                  ID: {document.id} • 템플릿: {document.template?.name}
                </p>
                {getStatusBadge(document.status)}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isSaving && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                저장 중...
              </div>
            )}
            
            <button
              onClick={onShowPreview}
              className="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              미리보기
            </button>
            
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentToolbar;