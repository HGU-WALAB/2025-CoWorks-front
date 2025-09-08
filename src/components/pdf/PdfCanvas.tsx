import React from 'react';
import { CoordinateField } from '../../types/field';

interface PdfCanvasProps {
  imageDimensions: { width: number; height: number };
  onAddField?: (x: number, y: number) => void;
  isAddingSignatureField?: boolean;
  onSignaturePositionSelect?: (field: CoordinateField) => void;
  getImageCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
}

const PdfCanvas: React.FC<PdfCanvasProps> = ({
  imageDimensions,
  onAddField,
  isAddingSignatureField,
  onSignaturePositionSelect,
  getImageCoordinates
}) => {
  const handleCanvasClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { x, y } = getImageCoordinates(e.clientX, e.clientY);
    
    if (isAddingSignatureField && onSignaturePositionSelect) {
      const signatureField: CoordinateField = {
        id: `signature_${Date.now()}`,
        label: 'Signature',
        x,
        y,
        width: 200,
        height: 60,
        page: 1,
        required: true,
        type: 'field'
      };
      onSignaturePositionSelect(signatureField);
    } else if (onAddField) {
      onAddField(x, y);
    }
  };

  return (
    <div
      className={`absolute inset-0 ${
        isAddingSignatureField ? 'cursor-crosshair' : 'cursor-pointer'
      }`}
      style={{
        width: imageDimensions.width,
        height: imageDimensions.height
      }}
      onClick={handleCanvasClick}
    />
  );
};

export default PdfCanvas;