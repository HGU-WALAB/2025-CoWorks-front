import React from 'react';

interface SignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo?: string;
  signedBy?: string;
  signatureData?: string;
}

interface SignatureFieldManagerProps {
  signatureFields: SignatureField[];
  currentUserEmail?: string;
  canReview: boolean;
  onAddSignatureField: (field: SignatureField) => void;
  onRemoveSignatureField: (fieldId: string) => void;
}

const SignatureFieldManager: React.FC<SignatureFieldManagerProps> = ({
  signatureFields,
  currentUserEmail,
  canReview,
  onAddSignatureField,
  onRemoveSignatureField
}) => {
  const handleAddSignatureField = () => {
    const newField: SignatureField = {
      id: `signature_${Date.now()}`,
      x: 100,
      y: 100,
      width: 200,
      height: 60,
      assignedTo: currentUserEmail
    };
    onAddSignatureField(newField);
  };

  const getSignatureStatus = (field: SignatureField) => {
    if (field.signatureData) {
      return (
        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
          ✓ 서명완료
        </span>
      );
    }
    
    if (field.assignedTo === currentUserEmail) {
      return (
        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
          ⏳ 대기중
        </span>
      );
    }
    
    return (
      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
        미할당
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">서명 필드</h3>
          {canReview && (
            <button
              onClick={handleAddSignatureField}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + 추가
            </button>
          )}
        </div>
        
        {signatureFields.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <p>서명 필드가 없습니다.</p>
            {canReview && (
              <p className="text-sm mt-1">서명 필드를 추가해주세요.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {signatureFields.map((field) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm">서명 #{field.id.slice(-4)}</span>
                      {getSignatureStatus(field)}
                    </div>
                    <div className="text-xs text-gray-500">
                      위치: ({field.x}, {field.y}) • 크기: {field.width}×{field.height}
                    </div>
                    {field.assignedTo && (
                      <div className="text-xs text-gray-600 mt-1">
                        할당: {field.assignedTo}
                      </div>
                    )}
                    {field.signedBy && (
                      <div className="text-xs text-green-600 mt-1">
                        서명자: {field.signedBy}
                      </div>
                    )}
                  </div>
                  
                  {canReview && (
                    <button
                      onClick={() => onRemoveSignatureField(field.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      title="삭제"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">서명 안내</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 서명 필드를 클릭하여 서명하세요</li>
          <li>• 모든 서명이 완료되면 승인할 수 있습니다</li>
          <li>• 서명은 한 번만 가능합니다</li>
        </ul>
      </div>
    </div>
  );
};

export default SignatureFieldManager;