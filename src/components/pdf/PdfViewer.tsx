import React, { useRef, useState } from 'react';
import { CoordinateField, TemplateField } from '../../types/field';
import PdfCanvas from './PdfCanvas';
import PdfFieldOverlay from './PdfFieldOverlay';
import PdfSignatureOverlay from './PdfSignatureOverlay';

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

interface PdfViewerProps {
  pdfImageUrl: string;
  coordinateFields: CoordinateField[];
  onCoordinateFieldsChange: (fields: CoordinateField[]) => void;
  onFieldSelect?: (field: CoordinateField | null) => void;
  selectedFieldId?: string | null;
  editable?: boolean;
  showFieldUI?: boolean;
  scale?: number;
  onAddField?: (x: number, y: number) => void;
  isAddingSignatureField?: boolean;
  onSignaturePositionSelect?: (field: CoordinateField) => void;
  signatureFields?: SignatureField[];
  editingSignatureFieldId?: string | null;
  onSignatureFieldUpdate?: (fieldId: string, updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>) => void;
  onSignatureFieldSelect?: (signatureField: SignatureField | null) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfImageUrl,
  coordinateFields,
  onCoordinateFieldsChange,
  onFieldSelect,
  selectedFieldId,
  editable = false,
  showFieldUI = false,
  scale = 1,
  onAddField,
  isAddingSignatureField = false,
  onSignaturePositionSelect,
  signatureFields = [],
  editingSignatureFieldId = null,
  onSignatureFieldUpdate,
  onSignatureFieldSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const getImageCoordinates = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    
    return { x: Math.max(0, Math.min(imageDimensions.width, x)), y: Math.max(0, Math.min(imageDimensions.height, y)) };
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    setImageLoaded(true);
    setImageError(null);
  };

  const handleImageError = () => {
    setImageError('이미지를 불러올 수 없습니다.');
    setImageLoaded(false);
  };

  if (imageError) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-lg">{imageError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-200 overflow-auto rounded-lg">
      <div 
        ref={containerRef}
        className="relative inline-block"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <img
          src={pdfImageUrl}
          alt="PDF Document"
          className="block max-w-none"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ 
            width: imageDimensions.width || 'auto',
            height: imageDimensions.height || 'auto'
          }}
        />
        
        {imageLoaded && (
          <>
            <PdfCanvas
              imageDimensions={imageDimensions}
              onAddField={onAddField}
              isAddingSignatureField={isAddingSignatureField}
              onSignaturePositionSelect={onSignaturePositionSelect}
              getImageCoordinates={getImageCoordinates}
            />
            
            <PdfFieldOverlay
              coordinateFields={coordinateFields}
              selectedFieldId={selectedFieldId}
              editable={editable}
              showFieldUI={showFieldUI}
              onFieldSelect={onFieldSelect}
              onCoordinateFieldsChange={onCoordinateFieldsChange}
              getImageCoordinates={getImageCoordinates}
            />
            
            <PdfSignatureOverlay
              signatureFields={signatureFields}
              editingSignatureFieldId={editingSignatureFieldId}
              onSignatureFieldUpdate={onSignatureFieldUpdate}
              onSignatureFieldSelect={onSignatureFieldSelect}
              getImageCoordinates={getImageCoordinates}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;