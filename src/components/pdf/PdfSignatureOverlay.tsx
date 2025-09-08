import React, { useState } from 'react';

interface SignatureField {
  id: string;
  reviewerEmail: string;
  reviewerName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string;
}

interface PdfSignatureOverlayProps {
  signatureFields: SignatureField[];
  editingSignatureFieldId?: string | null;
  onSignatureFieldUpdate?: (fieldId: string, updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>) => void;
  onSignatureFieldSelect?: (signatureField: SignatureField | null) => void;
  getImageCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
}

const PdfSignatureOverlay: React.FC<PdfSignatureOverlayProps> = ({
  signatureFields,
  editingSignatureFieldId,
  onSignatureFieldUpdate,
  onSignatureFieldSelect,
  getImageCoordinates
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const handleSignatureFieldMouseDown = (e: React.MouseEvent, field: SignatureField) => {
    e.stopPropagation();
    
    const { x, y } = getImageCoordinates(e.clientX, e.clientY);
    
    setIsDragging(true);
    setDraggedFieldId(field.id);
    setDragOffset({
      x: x - field.x,
      y: y - field.y
    });
    
    onSignatureFieldSelect?.(field);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedFieldId || !dragOffset || !onSignatureFieldUpdate) return;
    
    const { x, y } = getImageCoordinates(e.clientX, e.clientY);
    
    onSignatureFieldUpdate(draggedFieldId, {
      x: Math.max(0, x - dragOffset.x),
      y: Math.max(0, y - dragOffset.y)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedFieldId(null);
    setDragOffset(null);
  };

  const renderSignatureField = (field: SignatureField) => {
    const isEditing = editingSignatureFieldId === field.id;
    
    return (
      <div
        key={field.id}
        className={`absolute border-2 cursor-move transition-colors ${
          field.signatureData
            ? 'border-green-400 bg-green-50'
            : isEditing
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : 'border-orange-400 bg-orange-50'
        }`}
        style={{
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height
        }}
        onMouseDown={(e) => handleSignatureFieldMouseDown(e, field)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {field.signatureData ? (
          <div className="w-full h-full flex items-center justify-center p-1">
            <img
              src={field.signatureData}
              alt="Signature"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-center p-1">
            <div>
              <div className="text-sm font-medium text-orange-700">서명 필요</div>
              <div className="text-xs text-orange-600 mt-1 truncate">
                {field.reviewerName}
              </div>
            </div>
          </div>
        )}
        
        {isEditing && (
          <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            ✏️ {field.reviewerName}
          </div>
        )}
        
        {/* Resize handles for editing mode */}
        {isEditing && (
          <>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 border border-white cursor-se-resize" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 border border-white cursor-ne-resize" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-600 border border-white cursor-sw-resize" />
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-600 border border-white cursor-nw-resize" />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="pointer-events-auto">
        {signatureFields.map(renderSignatureField)}
      </div>
    </div>
  );
};

export default PdfSignatureOverlay;