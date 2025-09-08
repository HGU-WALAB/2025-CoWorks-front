import React from 'react';
import { Document } from '../../../stores/documentStore';

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

interface DocumentViewerProps {
  document: Document;
  signatureFields: SignatureField[];
  onSignatureFieldClick: (fieldId: string) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  signatureFields,
  onSignatureFieldClick
}) => {
  const renderSignatureField = (field: SignatureField) => {
    return (
      <div
        key={field.id}
        className={`absolute border-2 border-dashed cursor-pointer transition-colors ${
          field.signatureData
            ? 'border-green-400 bg-green-50'
            : 'border-blue-400 bg-blue-50 hover:bg-blue-100'
        }`}
        style={{
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height
        }}
        onClick={() => onSignatureFieldClick(field.id)}
      >
        {field.signatureData ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={field.signatureData}
              alt="Signature"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-center p-1">
            <div>
              <div className="text-sm font-medium text-blue-700">서명 필요</div>
              {field.assignedTo && (
                <div className="text-xs text-blue-600 mt-1">{field.assignedTo}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="bg-gray-100 px-4 py-3 border-b">
        <h3 className="font-medium text-gray-800">문서 뷰어</h3>
        <p className="text-sm text-gray-500">서명 필드를 클릭하여 서명하세요</p>
      </div>
      
      <div className="relative bg-gray-200 overflow-auto" style={{ minHeight: '600px' }}>
        {document.template?.pdfImagePath ? (
          <div className="relative inline-block">
            <img
              src={document.template.pdfImagePath}
              alt="Document"
              className="max-w-none"
              style={{ minWidth: '100%' }}
            />
            <div className="absolute inset-0">
              {signatureFields.map(renderSignatureField)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-lg font-medium">문서 이미지를 불러올 수 없습니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;