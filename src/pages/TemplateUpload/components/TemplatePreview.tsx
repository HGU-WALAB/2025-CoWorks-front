import React, { useState, useRef, useEffect } from 'react';
import { TemplateField } from '../../../types/field';
import { Position } from '../../../types/common';

interface TemplatePreviewProps {
  pdfImageUrl: string | null;
  fields: TemplateField[];
  selectedFieldId: string | null;
  onFieldClick: (field: TemplateField) => void;
  onFieldMove: (fieldId: string, updates: Partial<TemplateField>) => void;
  onFieldResize: (fieldId: string, updates: Partial<TemplateField>) => void;
  onTableCellClick: (fieldId: string, row: number, col: number) => void;
  onCanvasClick: (selection: { x: number; y: number; width: number; height: number }) => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  pdfImageUrl,
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
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
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

  // PDF 원본 크기 (A4 기준)
  const PDF_WIDTH = 1240;
  const PDF_HEIGHT = 1754;

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
    if (!canvasRef.current || !isCreatingField || !dragStart) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaledPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const actualPos = scaleToActual(scaledPos);
    
    const selection = {
      x: Math.min(dragStart.x, actualPos.x),
      y: Math.min(dragStart.y, actualPos.y),
      width: Math.abs(actualPos.x - dragStart.x),
      height: Math.abs(actualPos.y - dragStart.y)
    };
    
    setCurrentSelection(selection);
  };

  const handleCanvasMouseUp = () => {
    if (isCreatingField && currentSelection) {
      const { width, height } = currentSelection;
      
      // 최소 크기 체크 (20x20 픽셀)
      if (width >= 20 && height >= 20) {
        onCanvasClick(currentSelection);
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
        const containerWidth = field.width; // 테이블 전체 너비
        const pixelPerRatio = containerWidth;
        const deltaRatio = deltaX / pixelPerRatio;
        
        const newWidths = [...resizingColumn.startWidths];
        const currentCol = resizingColumn.columnIndex;
        const nextCol = currentCol + 1;
        
        // 현재 컬럼과 다음 컬럼 사이에서 너비 조절
        if (nextCol < newWidths.length) {
          const minWidth = 0.05; // 최소 5%
          const maxCurrentWidth = newWidths[currentCol] + newWidths[nextCol] - minWidth;
          const maxNextWidth = newWidths[currentCol] + newWidths[nextCol] - minWidth;
          
          newWidths[currentCol] = Math.max(minWidth, Math.min(maxCurrentWidth, newWidths[currentCol] + deltaRatio));
          newWidths[nextCol] = Math.max(minWidth, Math.min(maxNextWidth, newWidths[nextCol] - deltaRatio));
          
          // 필드 업데이트
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
          className={`absolute border-2 bg-purple-100 bg-opacity-30 hover:bg-opacity-50 border-purple-500 group cursor-move transition-colors ${
            isDragging ? 'opacity-75' : ''
          }`}
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
              {/* 테이블 헤더 (컬럼 리사이저 포함) */}
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
                    {/* 컬럼 리사이저 (마지막 컬럼 제외) */}
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
              
              {/* 테이블 셀들 */}
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
          
          {/* 리사이즈 핸들 */}
          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-purple-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleFieldMouseDown(field, e, 'resize')}
          />
          
          {isSelected && (
            <div className="absolute -top-6 left-0 bg-purple-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              📊 {field.label}
            </div>
          )}
        </div>
      );
    }

    // 편집자 서명 필드인지 확인
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
        className={`absolute border-2 bg-opacity-30 hover:bg-opacity-50 transition-colors flex items-center justify-center cursor-move group ${
          getFieldColor()
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
            {field.required && <span className="text-red-500 text-xs">*</span>}
          </div>
        </div>

        {/* 리사이즈 핸들 */}
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity ${
            isEditorSignature ? 'bg-green-500' : 'bg-blue-500'
          }`}
          onMouseDown={(e) => handleFieldMouseDown(field, e, 'resize')}
        />

        {isSelected && (
          <div className={`absolute -top-6 left-0 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none flex items-center ${
            isEditorSignature ? 'bg-green-600' : 'bg-blue-600'
          }`}>
            {field.label}
            {field.required && <span className="text-red-500 font-bold ml-1">*</span>}
          </div>
        )}
      </div>
    );
  };

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
      
      <div 
        ref={containerRef}
        className="relative bg-gray-100 h-full overflow-auto flex justify-center items-start p-4"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {pdfImageUrl ? (
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
              src={pdfImageUrl}
              alt="PDF Preview"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              draggable={false}
            />
            
            {/* 기존 필드들 */}
            {fields.map(renderField)}
            
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
        ) : (
          <div className="flex items-center justify-center h-96 text-center text-gray-500">
            <div>
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg font-medium mb-2">PDF를 업로드하면 여기에 미리보기가 표시됩니다</p>
              <p className="text-sm text-gray-400">파일을 선택하여 시작하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatePreview;