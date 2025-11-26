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
  isInteractive?: boolean;
}

const MultiPageTemplatePreview: React.FC<MultiPageTemplatePreviewProps> = ({
  pages,
  fields,
  selectedFieldId,
  onFieldClick,
  onFieldMove,
  onFieldResize,
  onTableCellClick,
  onCanvasClick,
  isInteractive = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
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

  // 길게 누르기 감지를 위한 상태
  const [longPressTimers, setLongPressTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [isLongPressing, setIsLongPressing] = useState<Set<string>>(new Set());

  // 이미지 로딩 상태 추가
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());

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
    setImageLoadErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageNumber);
      return newSet;
    });
  };

  const handleImageError = (pageNumber: number, imageUrl: string) => {
    console.error(`❌ 페이지 ${pageNumber} 이미지 로드 실패:`, imageUrl);
    setImageLoadErrors(prev => new Set([...prev, pageNumber]));
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
    if (!isInteractive) return;
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaledPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const actualPos = scaleToActual(scaledPos);

    setIsCreatingField(true);
    setDragStart(actualPos);
    setCurrentSelection(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isInteractive || !isCreatingField || !dragStart) return;

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
    if (!isInteractive) return;

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
    if (!isInteractive) return;
    e.stopPropagation();
    
    // 길게 누르기 감지 시작 (300ms 후)
    const timer = setTimeout(() => {
      setIsLongPressing(prev => new Set([...prev, field.id]));
    }, 200);
    
    setLongPressTimers(prev => {
      const newMap = new Map(prev);
      newMap.set(field.id, timer);
      return newMap;
    });
    
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

  const handleFieldMouseUp = (field: TemplateField) => {
    // 타이머 정리
    const timer = longPressTimers.get(field.id);
    if (timer) {
      clearTimeout(timer);
      setLongPressTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(field.id);
        return newMap;
      });
    }
    
    // 길게 누른 상태 해제 (약간의 지연을 두어 클릭 이벤트가 무시되도록)
    if (isLongPressing.has(field.id)) {
      setTimeout(() => {
        setIsLongPressing(prev => {
          const newSet = new Set(prev);
          newSet.delete(field.id);
          return newSet;
        });
      }, 100);
    }
  };

  // 테이블 컬럼 너비 조절 시작
  const handleColumnResizeMouseDown = (field: TemplateField, columnIndex: number, e: React.MouseEvent) => {
    if (!isInteractive) return;
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
    if (!isInteractive) return;
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
    if (!isInteractive) return;
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
    const scaledPos = actualToScale({ x: field.x, y: field.y });
    const scaledSize = {
      width: field.width * scale,
      height: field.height * scale
    };

    if (field.type === 'table' && field.tableData) {
      return (
        <div
          key={field.id}
          className={`absolute border-2 bg-purple-100 bg-opacity-30 hover:bg-opacity-50 border-purple-500 group ${isInteractive ? 'cursor-move' : 'cursor-default'} transition-colors ${
            isDragging ? 'opacity-75' : ''
          }`}
          style={{
            left: scaledPos.x,
            top: scaledPos.y,
            width: scaledSize.width,
            height: scaledSize.height,
            fontSize: (field.fontSize || 18) * scale,
            fontFamily: field.fontFamily || 'Arial'
          }}
          onMouseDown={isInteractive ? (e) => handleFieldMouseDown(field, e, 'move') : undefined}
          onMouseUp={() => isInteractive && handleFieldMouseUp(field)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            if (!isInteractive) return;
            const timer = setTimeout(() => {
              setIsLongPressing(prev => new Set([...prev, field.id]));
            }, 200);
            
            setLongPressTimers(prev => {
              const newMap = new Map(prev);
              newMap.set(field.id, timer);
              return newMap;
            });
          }}
          onTouchEnd={() => {
            if (isInteractive) {
              handleFieldMouseUp(field);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isInteractive) return;
            // 길게 누른 경우 클릭 무시
            if (isLongPressing.has(field.id)) {
              e.preventDefault();
              return;
            }
            onFieldClick(field);
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
                        className={`absolute right-0 top-0 w-2 h-full ${isInteractive ? 'cursor-col-resize pointer-events-auto' : 'pointer-events-none'} bg-purple-500 bg-opacity-0 hover:bg-opacity-30 transition-colors z-10`}
                        onMouseDown={isInteractive ? (e) => handleColumnResizeMouseDown(field, colIndex, e) : undefined}
                        title={isInteractive ? '드래그하여 컬럼 너비 조절' : undefined}
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
                          className={`bg-white bg-opacity-70 border-r border-purple-200 hover:bg-opacity-90 ${isInteractive ? 'cursor-pointer pointer-events-auto' : 'cursor-default pointer-events-none'} flex items-center justify-center text-xs p-1 transition-colors last:border-r-0`}
                          style={{
                            width: field.tableData?.columnWidths
                              ? `${field.tableData.columnWidths[colIndex] * 100}%`
                              : `${100 / field.tableData!.cols}%`
                          }}
                          onClick={isInteractive ? (e) => {
                            e.stopPropagation();
                            onTableCellClick(field.id, rowIndex, colIndex);
                          } : undefined}
                          title={isInteractive ? (cellContent || '클릭하여 편집') : cellContent || undefined}
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
            className={`absolute bottom-0 right-0 w-3 h-3 bg-purple-500 ${isInteractive ? 'cursor-se-resize' : 'cursor-default'} opacity-0 group-hover:opacity-100 transition-opacity`}
            onMouseDown={isInteractive ? (e) => handleFieldMouseDown(field, e, 'resize') : undefined}
          />

          {isSelected && (
            <div className="absolute -top-6 left-0 bg-purple-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              📊 {field.label}
            </div>
          )}
        </div>
      );
    }

    // 작성자 서명 필드인지 확인
    const isEditorSignature = field.type === 'editor_signature';
    const isReviewerSignature = field.type === 'reviewer_signature';
    const isSignerSignature = field.type === 'signer_signature';

    // 필드 타입에 따른 색상 설정
    const getFieldColor = () => {
      if (isEditorSignature) return 'bg-blue-100 border-blue-500';
      if (isReviewerSignature) return 'bg-green-100 border-green-500';
      if (isSignerSignature) return 'bg-orange-100 border-orange-500';
      return 'bg-gray-100 border-gray-500';
    };

    return (
      <div
        key={field.id}
        className={`absolute border-2 bg-opacity-30 hover:bg-opacity-50 transition-colors flex items-center justify-center ${isInteractive ? 'cursor-move' : 'cursor-default'} group ${
          getFieldColor()
        } ${isDragging ? 'opacity-75' : ''}`}
        style={{
          left: scaledPos.x,
          top: scaledPos.y,
          width: scaledSize.width,
          height: scaledSize.height,
          fontSize: (field.fontSize || 18) * scale,
          fontFamily: field.fontFamily || 'Arial'
        }}
        onMouseDown={isInteractive ? (e) => handleFieldMouseDown(field, e, 'move') : undefined}
        onMouseUp={() => isInteractive && handleFieldMouseUp(field)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          if (!isInteractive) return;
          // 터치 시작 시 길게 누르기 감지 시작
          const timer = setTimeout(() => {
            setIsLongPressing(prev => new Set([...prev, field.id]));
          }, 500);
          
          setLongPressTimers(prev => {
            const newMap = new Map(prev);
            newMap.set(field.id, timer);
            return newMap;
          });
        }}
        onTouchEnd={() => {
          if (isInteractive) {
            handleFieldMouseUp(field);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isInteractive) return;
          // 길게 누른 경우 클릭 무시
          if (isLongPressing.has(field.id)) {
            e.preventDefault();
            return;
          }
          onFieldClick(field);
        }}
      >
        <div className="text-center p-1">
          <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-700 truncate">
            <span>{field.label}</span>
            {field.required && <span className="text-red-500 text-xs">*</span>}
          </div>
        </div>

        <div
          className={`absolute bottom-0 right-0 w-3 h-3 ${isInteractive ? 'cursor-se-resize' : 'cursor-default'} opacity-0 group-hover:opacity-100 transition-opacity ${
            isEditorSignature ? 'bg-green-500' : 'bg-blue-500'
          }`}
          onMouseDown={isInteractive ? (e) => handleFieldMouseDown(field, e, 'resize') : undefined}
        />

        {isSelected && (
          <div className={`absolute -top-6 left-0 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none flex items-center ${
            isEditorSignature ? 'bg-green-600' : 'bg-blue-600'
          }`}>
            {field.label}
            {field.required && (
                <span className="text-red-500 text-xs">*</span>
            )}
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
        {isInteractive ? (
          <p className="text-sm text-gray-500">
            드래그하여 필드 생성 | 필드 드래그로 이동 | 모서리 드래그로 크기 조절
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            템플릿 구조를 확인할 수 있습니다.
          </p>
        )}
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
        onMouseMove={isInteractive ? handleMouseMove : undefined}
        onMouseUp={isInteractive ? handleMouseUp : undefined}
        onMouseLeave={isInteractive ? handleMouseUp : undefined}
      >
        {/* 페이지별 보기만 지원 */}
        {currentPage && (
          <div className="flex justify-center">
            <div
              ref={canvasRef}
              className={`relative bg-white shadow-lg ${isInteractive ? 'cursor-crosshair select-none' : 'cursor-default'}`}
              style={{
                width: PDF_WIDTH * scale,
                height: PDF_HEIGHT * scale,
                minWidth: PDF_WIDTH * scale,
                minHeight: PDF_HEIGHT * scale,
                flexShrink: 0
              }}
              onMouseDown={isInteractive ? handleCanvasMouseDown : undefined}
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
              {isInteractive && isCreatingField && currentSelection && (
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