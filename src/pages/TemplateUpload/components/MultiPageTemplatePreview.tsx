import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TemplateField } from '../../../types/field';
import { Position } from '../../../types/common';

interface PdfPage {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

interface MultiPageTemplatePreviewProps {
  pages: PdfPage[];
  fields: TemplateField[];
  selectedFieldId: string | null;
  onFieldClick: (field: TemplateField) => void;
  onFieldMove: (fieldId: string, updates: Partial<TemplateField>) => void;
  onFieldResize: (fieldId: string, updates: Partial<TemplateField>) => void;
  onTableCellClick: (fieldId: string, row: number, col: number) => void;
  onCanvasClick: (selection: { x: number; y: number; width: number; height: number; pageNumber: number }) => void;
}

const MultiPageTemplatePreview: React.FC<MultiPageTemplatePreviewProps> = ({
  pages,
  fields,
  selectedFieldId,
  onFieldClick,
  onFieldMove,
  onFieldResize,
  onTableCellClick,
  onCanvasClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // 페이지별 보기만 지원하도록 고정
  const viewMode = 'single';
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber?: number;
  } | null>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  // 테이블 컬럼 너비 조절 상태
  const [resizingColumn, setResizingColumn] = useState<{
    fieldId: string;
    columnIndex: number;
    startX: number;
    startWidths: number[];
  } | null>(null);

  // 이미지 로딩 상태 추가
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const [imageLoadSuccess, setImageLoadSuccess] = useState<Set<number>>(new Set());

  // PDF 원본 크기 (A4 기준)
  const PDF_WIDTH = 1240;
  const PDF_HEIGHT = 1754;

  // 페이지별 보기만 지원하므로 그룹핑 제거

  // 현재 페이지 정보
  const currentPage = pages.find(page => page.pageNumber === currentPageNumber);

  // 현재 페이지의 필드들만 필터링 (단일 페이지 모드용)
  const currentPageFields = useMemo(() =>
    fields.filter(field => field.page === currentPageNumber),
    [fields, currentPageNumber]
  );

  // 이미지 로딩 핸들러
  const handleImageLoad = (pageNumber: number) => {
    console.log(`✅ 페이지 ${pageNumber} 이미지 로드 성공`);
    setImageLoadSuccess(prev => new Set([...prev, pageNumber]));
    setImageLoadErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageNumber);
      return newSet;
    });
  };

  const handleImageError = (pageNumber: number, imageUrl: string) => {
    console.error(`❌ 페이지 ${pageNumber} 이미지 로드 실패:`, imageUrl);
    setImageLoadErrors(prev => new Set([...prev, pageNumber]));
    setImageLoadSuccess(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageNumber);
      return newSet;
    });
  };

  // 페이지 변경 함수
  const handlePageChange = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= pages.length) {
      setCurrentPageNumber(pageNumber);
      // 페이지 변경 시 선택 해제
      setIsCreatingField(false);
      setDragStart(null);
      setCurrentSelection(null);
      setDraggingField(null);
      setResizingField(null);
      setResizingColumn(null);
    }
  };

  // 컨테이너 너비에 맞춰 스케일링
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width - 32; // 패딩 제외 (p-4 = 16px * 2)

      // 템플릿 너비를 컨테이너 너비에 맞춤
      const scaleX = containerWidth / PDF_WIDTH;

      // 최소 0.3배, 최대 2배로 제한
      const newScale = Math.max(0.3, Math.min(scaleX, 2.0));

      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // 스케일된 좌표를 실제 좌표로 변환
  const scaleToActual = (scaledPos: Position): Position => ({
    x: scaledPos.x / scale,
    y: scaledPos.y / scale
  });

  // 실제 좌표를 스케일된 좌표로 변환
  const actualToScale = (actualPos: Position): Position => ({
    x: actualPos.x * scale,
    y: actualPos.y * scale
  });

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaledPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const actualPos = scaleToActual(scaledPos);

    setIsCreatingField(true);
    setDragStart(actualPos);
    setCurrentSelection(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isCreatingField || !dragStart) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const scaledPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const actualPos = scaleToActual(scaledPos);

    const selection = {
      x: Math.min(dragStart.x, actualPos.x),
      y: Math.min(dragStart.y, actualPos.y),
      width: Math.abs(actualPos.x - dragStart.x),
      height: Math.abs(actualPos.y - dragStart.y),
      pageNumber: currentSelection?.pageNumber
    };

    setCurrentSelection(selection);
  };

  const handleCanvasMouseUp = () => {
    if (isCreatingField && currentSelection) {
      const { width, height } = currentSelection;

      // 최소 크기 체크 (20x20 픽셀)
      if (width >= 20 && height >= 20) {
        onCanvasClick({
          ...currentSelection,
          pageNumber: currentSelection.pageNumber || currentPageNumber
        });
      }
    }

    setIsCreatingField(false);
    setDragStart(null);
    setCurrentSelection(null);
  };

  const handleFieldMouseDown = (field: TemplateField, e: React.MouseEvent, action: 'move' | 'resize') => {
    e.stopPropagation();

    if (action === 'move') {
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaledPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const actualFieldPos = { x: field.x, y: field.y };
      const scaledFieldPos = actualToScale(actualFieldPos);

      setDraggingField(field.id);
      setDragOffset({
        x: scaledPos.x - scaledFieldPos.x,
        y: scaledPos.y - scaledFieldPos.y
      });
    } else {
      setResizingField(field.id);
      setDragOffset({ x: e.clientX, y: e.clientY });
    }
  };

  // 테이블 컬럼 너비 조절 시작
  const handleColumnResizeMouseDown = (field: TemplateField, columnIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!field.tableData?.columnWidths) return;

    setResizingColumn({
      fieldId: field.id,
      columnIndex,
      startX: e.clientX,
      startWidths: [...field.tableData.columnWidths]
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    if (draggingField) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaledPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const adjustedScaledPos = {
        x: scaledPos.x - dragOffset.x,
        y: scaledPos.y - dragOffset.y
      };
      const actualPos = scaleToActual(adjustedScaledPos);

      onFieldMove(draggingField, {
        x: Math.max(0, Math.min(PDF_WIDTH - 50, actualPos.x)),
        y: Math.max(0, Math.min(PDF_HEIGHT - 20, actualPos.y))
      });
    } else if (resizingField) {
      const field = fields.find(f => f.id === resizingField);
      if (!field) return;

      const deltaX = (e.clientX - dragOffset.x) / scale;
      const deltaY = (e.clientY - dragOffset.y) / scale;

      onFieldResize(resizingField, {
        width: Math.max(50, field.width + deltaX),
        height: Math.max(20, field.height + deltaY)
      });

      setDragOffset({ x: e.clientX, y: e.clientY });
    } else if (resizingColumn) {
      // 테이블 컬럼 너비 조절 처리
      const deltaX = e.clientX - resizingColumn.startX;
      const field = fields.find(f => f.id === resizingColumn.fieldId);

      if (field?.tableData?.columnWidths) {
        const containerWidth = field.width;
        const pixelPerRatio = containerWidth;
        const deltaRatio = deltaX / pixelPerRatio;

        const newWidths = [...resizingColumn.startWidths];
        const currentCol = resizingColumn.columnIndex;
        const nextCol = currentCol + 1;

        if (nextCol < newWidths.length) {
          const minWidth = 0.05;
          const maxCurrentWidth = newWidths[currentCol] + newWidths[nextCol] - minWidth;
          const maxNextWidth = newWidths[currentCol] + newWidths[nextCol] - minWidth;

          newWidths[currentCol] = Math.max(minWidth, Math.min(maxCurrentWidth, newWidths[currentCol] + deltaRatio));
          newWidths[nextCol] = Math.max(minWidth, Math.min(maxNextWidth, newWidths[nextCol] - deltaRatio));

          onFieldResize(resizingColumn.fieldId, {
            tableData: {
              ...field.tableData,
              columnWidths: newWidths
            }
          });
        }
      }
    } else {
      handleCanvasMouseMove(e);
    }
  };

  const handleMouseUp = () => {
    if (draggingField || resizingField || resizingColumn) {
      setDraggingField(null);
      setResizingField(null);
      setResizingColumn(null);
      setDragOffset({ x: 0, y: 0 });
    } else {
      handleCanvasMouseUp();
    }
  };

  const renderField = (field: TemplateField) => {
    const isSelected = selectedFieldId === field.id;
    const isDragging = draggingField === field.id;
    const isResizing = resizingField === field.id;
    const scaledPos = actualToScale({ x: field.x, y: field.y });
    const scaledSize = {
      width: field.width * scale,
      height: field.height * scale
    };

    if (field.type === 'table' && field.tableData) {
      return (
        <div
          key={field.id}
          className={`absolute border bg-white bg-opacity-90 group cursor-move ${
            isSelected ? 'border-blue-500 shadow-lg' : 'border-purple-400'
          } ${isDragging ? 'opacity-75' : ''}`}
          style={{
            left: scaledPos.x,
            top: scaledPos.y,
            width: scaledSize.width,
            height: scaledSize.height,
            fontSize: (field.fontSize || 12) * scale,
            fontFamily: field.fontFamily || 'Arial'
          }}
          onMouseDown={(e) => handleFieldMouseDown(field, e, 'move')}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="w-full h-full overflow-hidden pointer-events-none">
            <div className="relative" style={{ height: '100%' }}>
              <div
                className="flex bg-purple-300 h-6 border-b border-purple-400"
                style={{
                  gridTemplateColumns: field.tableData.columnWidths
                    ? field.tableData.columnWidths.map(width => `${width * 100}%`).join(' ')
                    : `repeat(${field.tableData.cols}, 1fr)`,
                }}
              >
                {Array(field.tableData.cols).fill(null).map((_, colIndex) => (
                  <div
                    key={`header-${colIndex}`}
                    className="relative flex items-center justify-center text-xs font-medium text-purple-800 bg-purple-200 border-r border-purple-300 last:border-r-0"
                    style={{
                      width: field.tableData?.columnWidths
                        ? `${field.tableData.columnWidths[colIndex] * 100}%`
                        : `${100 / field.tableData!.cols}%`
                    }}
                  >
                    {colIndex + 1}
                    {colIndex < field.tableData!.cols - 1 && (
                      <div
                        className="absolute right-0 top-0 w-2 h-full cursor-col-resize bg-purple-500 bg-opacity-0 hover:bg-opacity-30 transition-colors z-10 pointer-events-auto"
                        onMouseDown={(e) => handleColumnResizeMouseDown(field, colIndex, e)}
                        title="드래그하여 컬럼 너비 조절"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col" style={{ height: 'calc(100% - 24px)' }}>
                {Array(field.tableData.rows).fill(null).map((_, rowIndex) => (
                  <div
                    key={`row-${rowIndex}`}
                    className="flex flex-1 border-b border-purple-200 last:border-b-0"
                    style={{
                      minHeight: `${Math.max(20, (scaledSize.height - 45) / field.tableData!.rows)}px`
                    }}
                  >
                    {Array(field.tableData!.cols).fill(null).map((_, colIndex) => {
                      const cellContent = field.tableData!.cells?.[rowIndex]?.[colIndex] || '';
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className="bg-white bg-opacity-70 border-r border-purple-200 hover:bg-opacity-90 cursor-pointer flex items-center justify-center text-xs p-1 transition-colors last:border-r-0 pointer-events-auto"
                          style={{
                            width: field.tableData?.columnWidths
                              ? `${field.tableData.columnWidths[colIndex] * 100}%`
                              : `${100 / field.tableData!.cols}%`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTableCellClick(field.id, rowIndex, colIndex);
                          }}
                          title={cellContent || '클릭하여 편집'}
                        >
                          <span className="text-center text-purple-700 font-medium truncate leading-tight">
                            {cellContent || `${rowIndex + 1}-${colIndex + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-purple-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleFieldMouseDown(field, e, 'resize')}
          />

          {isSelected && (
            <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              📊 {field.label}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={field.id}
        className={`absolute border-2 border-dashed bg-white bg-opacity-75 flex items-center justify-center cursor-move group ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : field.required
            ? 'border-red-400 hover:border-red-500'
            : 'border-gray-400 hover:border-gray-500'
        } ${isDragging ? 'opacity-75' : ''}`}
        style={{
          left: scaledPos.x,
          top: scaledPos.y,
          width: scaledSize.width,
          height: scaledSize.height,
          fontSize: (field.fontSize || 12) * scale,
          fontFamily: field.fontFamily || 'Arial'
        }}
        onMouseDown={(e) => handleFieldMouseDown(field, e, 'move')}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="text-center p-1">
          <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-700 truncate">
            <span>{field.label}</span>
          </div>
        </div>

        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={(e) => handleFieldMouseDown(field, e, 'resize')}
        />

        {isSelected && (
          <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
            📝 {field.label}
          </div>
        )}
      </div>
    );
  };

  if (!pages || pages.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
        <div className="bg-gray-100 px-4 py-3 border-b flex-shrink-0">
          <h3 className="font-medium text-gray-800">템플릿 미리보기</h3>
          <p className="text-sm text-gray-500">PDF를 업로드하면 여기에 미리보기가 표시됩니다</p>
        </div>
        <div className="flex items-center justify-center h-96 text-center text-gray-500">
          <div>
            <div className="text-6xl mb-4">📄</div>
            <p className="text-lg font-medium mb-2">PDF를 업로드하면 여기에 미리보기가 표시됩니다</p>
            <p className="text-sm text-gray-400">파일을 선택하여 시작하세요</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
      <div className="bg-gray-100 px-4 py-3 border-b flex-shrink-0">
        <h3 className="font-medium text-gray-800">템플릿 미리보기</h3>
        <p className="text-sm text-gray-500">
          드래그하여 필드 생성 | 필드 드래그로 이동 | 모서리 드래그로 크기 조절
        </p>
        {scale !== 1 && (
          <p className="text-xs text-blue-600 mt-1">
            화면에 맞춰 {Math.round(scale * 100)}%로 {scale < 1 ? '축소' : '확대'}됨
          </p>
        )}
      </div>

      {/* 헤더 - 페이지 네비게이션 (1페이지 초과시에만 표시) */}
      {pages.length > 1 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">페이지</span>
            <select
              value={currentPageNumber}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pages.map(page => (
                <option key={page.pageNumber} value={page.pageNumber}>
                  {page.pageNumber}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">/ {pages.length}</span>
            <span className="text-xs text-blue-600">
              ({currentPageFields.length}개 필드)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPageNumber - 1)}
              disabled={currentPageNumber === 1}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors text-sm"
            >
              <span>←</span>
              <span>이전</span>
            </button>

            <button
              onClick={() => handlePageChange(currentPageNumber + 1)}
              disabled={currentPageNumber === pages.length}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors text-sm"
            >
              <span>다음</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative bg-gray-100 h-full overflow-auto p-4"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 페이지별 보기만 지원 */}
        {currentPage && (
          <div className="flex justify-center">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg cursor-crosshair select-none"
              style={{
                width: PDF_WIDTH * scale,
                height: PDF_HEIGHT * scale,
                minWidth: PDF_WIDTH * scale,
                minHeight: PDF_HEIGHT * scale,
                flexShrink: 0
              }}
              onMouseDown={handleCanvasMouseDown}
            >
              <img
                src={currentPage.imageUrl}
                alt={`PDF Preview - Page ${currentPageNumber}`}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                draggable={false}
                onLoad={() => handleImageLoad(currentPageNumber)}
                onError={() => handleImageError(currentPageNumber, currentPage.imageUrl)}
              />

              {/* 이미지 로딩 실패 시 fallback UI */}
              {imageLoadErrors.has(currentPageNumber) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">📄</div>
                    <p className="text-sm font-medium">페이지 {currentPageNumber}</p>
                    <p className="text-xs">이미지를 불러올 수 없습니다</p>
                    <p className="text-xs text-red-500 mt-1">URL: {currentPage.imageUrl?.substring(0, 30)}...</p>
                  </div>
                </div>
              )}

              {/* 현재 페이지의 필드들 */}
              {currentPageFields.map(renderField)}

              {/* 새 필드 생성 중 선택 영역 */}
              {isCreatingField && currentSelection && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
                  style={{
                    left: currentSelection.x * scale,
                    top: currentSelection.y * scale,
                    width: currentSelection.width * scale,
                    height: currentSelection.height * scale,
                  }}
                >
                  <div className="text-xs text-blue-700 font-medium p-1">
                    {Math.round(currentSelection.width)} × {Math.round(currentSelection.height)} px
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiPageTemplatePreview;