import React, { useState, useMemo } from 'react';
import { CoordinateField, TemplateField } from '../../types/field';
import PdfViewer from './PdfViewer';

interface PdfPage {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

interface SignatureField {
  id: string;
  reviewerEmail: string;
  reviewerName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string;
  page: number;
}

interface MultiPagePdfViewerProps {
  pages: PdfPage[];
  coordinateFields: CoordinateField[];
  onCoordinateFieldsChange: (fields: CoordinateField[]) => void;
  onFieldSelect?: (field: CoordinateField | null) => void;
  selectedFieldId?: string | null;
  editable?: boolean;
  showFieldUI?: boolean;
  scale?: number;
  onAddField?: (x: number, y: number, pageNumber: number) => void;
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

const MultiPagePdfViewer: React.FC<MultiPagePdfViewerProps> = ({
  pages,
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
  // 페이지별 보기만 지원하도록 고정
  const viewMode = 'single';
  const [currentPageNumber, setCurrentPageNumber] = useState(1);

  // 페이지별 보기를 위한 필터링만 유지

  // 현재 페이지의 필드들만 필터링 (단일 페이지 모드용)
  const currentPageFields = useMemo(() =>
    coordinateFields.filter(field => field.page === currentPageNumber),
    [coordinateFields, currentPageNumber]
  );

  // 현재 페이지의 서명 필드들만 필터링 (단일 페이지 모드용)
  const currentPageSignatureFields = useMemo(() =>
    signatureFields.filter(field => field.page === currentPageNumber),
    [signatureFields, currentPageNumber]
  );

  // 현재 페이지 정보
  const currentPage = pages.find(page => page.pageNumber === currentPageNumber);

  // 페이지 변경 함수
  const handlePageChange = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= pages.length) {
      setCurrentPageNumber(pageNumber);
      // 페이지 변경 시 선택된 필드 해제
      if (onFieldSelect) {
        onFieldSelect(null);
      }
    }
  };

  // 필드 변경 처리 (단일 페이지 모드용)
  const handleFieldsChange = (updatedFields: CoordinateField[]) => {
    // 업데이트된 필드들에 현재 페이지 정보 추가
    const fieldsWithPage = updatedFields.map(field => ({
      ...field,
      page: currentPageNumber
    }));

    // 전체 필드 배열에서 현재 페이지 필드들을 새로운 필드들로 교체
    const otherPageFields = coordinateFields.filter(field => field.page !== currentPageNumber);
    const newAllFields = [...otherPageFields, ...fieldsWithPage];

    onCoordinateFieldsChange(newAllFields);
  };

  // 더 이상 필요 없는 전체 페이지 모드용 함수 제거됨

  // 필드 추가 처리
  const handleAddField = (x: number, y: number, pageNumber?: number) => {
    if (onAddField) {
      onAddField(x, y, pageNumber || currentPageNumber);
    }
  };

  // 서명 위치 선택 처리
  const handleSignaturePositionSelect = (field: CoordinateField, pageNumber?: number) => {
    if (onSignaturePositionSelect) {
      // 서명 필드에도 페이지 정보 추가
      const fieldWithPage = { ...field, page: pageNumber || currentPageNumber };
      onSignaturePositionSelect(fieldWithPage);
    }
  };

  if (!pages || pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">📄</div>
          <p className="text-lg">PDF 페이지가 없습니다</p>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-lg">페이지를 찾을 수 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 - 페이지 네비게이션 */}
      {pages.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">페이지</span>
            <select
              value={currentPageNumber}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1 text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pages.map(page => (
                <option key={page.pageNumber} value={page.pageNumber}>
                  {page.pageNumber}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">/ {pages.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPageNumber - 1)}
              disabled={currentPageNumber === 1}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              <span>←</span>
              <span>이전</span>
            </button>

            <button
              onClick={() => handlePageChange(currentPageNumber + 1)}
              disabled={currentPageNumber === pages.length}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              <span>다음</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* 현재 페이지 정보 표시 */}
      <div className="px-4 py-2 bg-blue-50 border-b text-sm text-blue-700 flex-shrink-0">
        <span className="font-medium">페이지 {currentPageNumber}</span>
        <span className="mx-2">•</span>
        <span>필드 {currentPageFields.length}개</span>
        {currentPageSignatureFields.length > 0 && (
          <>
            <span className="mx-2">•</span>
            <span>서명 필드 {currentPageSignatureFields.length}개</span>
          </>
        )}
      </div>

      {/* PDF 뷰어 - 페이지별 보기만 지원 */}
      <div className="flex-1 overflow-auto">
        <PdfViewer
          pdfImageUrl={currentPage?.imageUrl || ''}
          coordinateFields={currentPageFields}
          onCoordinateFieldsChange={handleFieldsChange}
          onFieldSelect={onFieldSelect}
          selectedFieldId={selectedFieldId}
          editable={editable}
          showFieldUI={showFieldUI}
          scale={scale}
          onAddField={handleAddField}
          isAddingSignatureField={isAddingSignatureField}
          onSignaturePositionSelect={handleSignaturePositionSelect}
          signatureFields={currentPageSignatureFields}
          editingSignatureFieldId={editingSignatureFieldId}
          onSignatureFieldUpdate={onSignatureFieldUpdate}
          onSignatureFieldSelect={onSignatureFieldSelect}
        />
      </div>
    </div>
  );
};

export default MultiPagePdfViewer;