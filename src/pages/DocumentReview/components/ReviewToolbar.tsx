import React from 'react';
import { Document } from '../../../stores/documentStore';

interface ReviewToolbarProps {
  document: Document;
  canReview: boolean;
  hasUserSigned: boolean;
  onReject: () => void;
  onApprove: () => void;
  onBack: () => void;
}

const ReviewToolbar: React.FC<ReviewToolbarProps> = ({
  document,
  canReview,
  hasUserSigned,
  onReject,
  onApprove,
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
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
                문서 검토
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
            {canReview ? (
              <>
                {hasUserSigned ? (
                  <div className="flex items-center text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    ✓ 서명 완료
                  </div>
                ) : (
                  <div className="flex items-center text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                    ⏳ 서명 대기중
                  </div>
                )}
                
                <button
                  onClick={onReject}
                  className="px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  반려
                </button>
                
                <button
                  onClick={onApprove}
                  disabled={!hasUserSigned}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  승인
                </button>
              </>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                검토 권한이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewToolbar;