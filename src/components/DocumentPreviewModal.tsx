import React from 'react';
import { CoordinateField } from '../types/field';
import { handlePrint as printDocument, type PrintOptions } from '../utils/printUtils';

interface SignatureField {
  id: string;
  reviewerEmail: string;
  reviewerName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string; // 실제 서명 데이터 (base64 이미지)
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfImageUrl: string;
  coordinateFields: CoordinateField[];
  signatureFields?: SignatureField[];
  documentTitle?: string;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfImageUrl,
  coordinateFields,
  signatureFields = [],
  documentTitle = "문서 미리보기"
}) => {
  // Hook들을 항상 호출 (조건문 이전에)
  const [scale, setScale] = React.useState(1);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0, initialScale: 1 });
  const [isPrinting, setIsPrinting] = React.useState(false);

  // ESC 키로 모달 닫기
  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // 조건부 렌더링은 Hook 호출 이후에
  if (!isOpen) return null;

  // 마우스 드래그로 줌 조절
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === e.currentTarget) { // 왼쪽 마우스 버튼만, PDF 영역에서만
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        initialScale: scale
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - dragStart.y;
    const scaleDelta = deltaY * 0.003; // 드래그 감도 조정
    const newScale = Math.max(0.3, Math.min(2.5, dragStart.initialScale + scaleDelta));
    
    setScale(newScale);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 줌 리셋
  const resetZoom = () => {
    setScale(1);
  };

  // 줌 버튼들
  const zoomIn = () => {
    setScale(prev => Math.min(2.5, prev + 0.1));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(0.3, prev - 0.1));
  };

  // 모달 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 인쇄 기능 - printUtils의 공통 함수 사용
  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);
    
    try {
      // 타입 변환: CoordinateField[] → PrintField[]
      const printFields = coordinateFields.map(field => ({
        ...field,
        value: field.value || ''
      }));

      // printUtils의 공통 함수 사용
      const printOptions: PrintOptions = {
        pdfImageUrl,
        coordinateFields: printFields,
        signatureFields,
        signatures: {},
        documentTitle: documentTitle
      };
      
      await printDocument(printOptions);
      setIsPrinting(false);
    } catch (error) {
      console.error('인쇄 실패:', error);
      setIsPrinting(false);
    }
  }, [pdfImageUrl, coordinateFields, signatureFields, documentTitle]);


  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{documentTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">최종 출력 미리보기</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 줌 컨트롤 */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
              <button
                onClick={zoomOut}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                title="축소 (30%~250%)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[4rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                title="확대 (30%~250%)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={resetZoom}
                className="ml-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                title="원본 크기로 리셋"
              >
                리셋
              </button>
            </div>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors ${
                isPrinting 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isPrinting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                  준비중
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  인쇄
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 모달 본문 - PDF 미리보기 */}
        <div 
          className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center items-start"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div 
            className="relative bg-white shadow-lg select-none"
            style={{
              width: `${1240 * scale}px`,
              height: `${1754 * scale}px`,
              minWidth: `${1240 * scale}px`,
              minHeight: `${1754 * scale}px`,
              flexShrink: 0,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            {/* PDF 배경 이미지 */}
            <img 
              src={pdfImageUrl}
              alt="Document Preview"
              className="absolute inset-0 w-full h-full object-contain"
              onError={() => {
                console.error('PDF 이미지 로드 실패:', pdfImageUrl);
              }}
            />
            
            {/* 필드 컨테이너 */}
            <div className="absolute inset-0"
            >
              {/* 디버깅용 - 모든 필드 표시 (개발 모드에서만, 그리고 환경변수로 제어) */}
              {import.meta.env.DEV && import.meta.env.VITE_DEBUG_FIELDS === 'true' && (
                <>
                  {coordinateFields.map((field) => (
                    <div
                      key={`debug-${field.id}`}
                      className="absolute border-2 border-dashed border-blue-400 bg-blue-100 bg-opacity-20 flex items-center justify-center"
                      style={{
                        left: `${(field.x / 1240) * 100}%`,
                        top: `${(field.y / 1754) * 100}%`,
                        width: `${(field.width / 1240) * 100}%`,
                        height: `${(field.height / 1754) * 100}%`,
                      }}
                    >
                      <span className="text-xs text-blue-600 font-medium bg-white px-1 rounded">
                        {field.label} ({field.x},{field.y})
                      </span>
                    </div>
                  ))}
                </>
              )}
              
              {/* 필드 값들을 자연스럽게 오버레이 - 테두리나 배경 없이 */}
              {coordinateFields
                .filter(field => field.value && field.value.trim() !== '') // 값이 있는 필드만 표시
                .map((field) => {
                  console.log('🎯 미리보기 모달 - 필드 렌더링:', {
                    id: field.id,
                    label: field.label,
                    x: field.x,
                    y: field.y,
                    width: field.width,
                    height: field.height,
                    value: field.value
                  });
                  
                  // 테이블 필드인지 확인
                  let isTableField = false;
                  let tableData = null;
                  
                  try {
                    if (field.value && typeof field.value === 'string') {
                      const parsedValue = JSON.parse(field.value);
                      if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                        isTableField = true;
                        tableData = parsedValue;
                        
                        // columnWidths가 없으면 기본값 설정 (균등 분배)
                        if (!tableData.columnWidths) {
                          tableData.columnWidths = Array(tableData.cols).fill(1 / tableData.cols);
                        }
                      }
                    }
                  } catch (e) {
                    // JSON 파싱 실패 시 일반 필드로 처리
                    isTableField = false;
                  }
                  
                  console.log('🔍 미리보기 모달 - 테이블 필드 확인:', {
                    fieldId: field.id,
                    isTableField,
                    tableData: tableData ? {
                      rows: tableData.rows, 
                      cols: tableData.cols,
                      hasColumnWidths: !!tableData.columnWidths,
                      columnWidths: tableData.columnWidths
                    } : null
                  });
                  
                  // 퍼센트 기반 위치 계산
                  const leftPercent = (field.x / 1240) * 100;
                  const topPercent = (field.y / 1754) * 100;
                  const widthPercent = (field.width / 1240) * 100;
                  const heightPercent = (field.height / 1754) * 100;
                  
                  return (
                    <div
                      key={field.id}
                      className="absolute flex items-center"
                      style={{
                        left: `${leftPercent}%`,
                        top: `${topPercent}%`,
                        width: `${widthPercent}%`,
                        height: `${heightPercent}%`,
                      }}
                    >
                      {isTableField && tableData ? (
                        // 테이블 렌더링
                        <div 
                          className="w-full h-full" 
                          style={{
                            overflow: 'hidden', // 넘치는 부분 숨김
                            maxHeight: `${field.height}px` // 절대 원래 높이를 넘지 않음
                          }}
                        >
                          <table 
                            className="w-full border-collapse"
                            style={{
                              tableLayout: 'fixed', // 고정 레이아웃으로 컬럼 너비 적용
                              border: '2px solid #6b7280', // 외곽 테두리를 더 두껍게
                              height: '100%' // 테이블이 컨테이너 높이를 넘지 않도록 고정
                            }}
                          >
                            {/* 컬럼 너비를 위한 colgroup */}
                            {tableData.columnWidths && (
                              <colgroup>
                                {tableData.columnWidths.map((width: number, index: number) => (
                                  <col key={index} style={{ width: `${width * 100}%` }} />
                                ))}
                              </colgroup>
                            )}
                            <tbody>
                              {Array(tableData.rows).fill(null).map((_, rowIndex) => {
                                // 테이블 테두리와 여유 공간을 고려한 실제 사용 가능한 높이 계산
                                const availableHeight = Math.max(field.height - 8, 20); // 테두리와 여유 공간 8px 제외, 최소 20px
                                const rowHeight = Math.max(Math.floor(availableHeight / tableData.rows), 15); // 최소 15px 행 높이
                                
                                return (
                                  <tr 
                                    key={rowIndex}
                                    style={{
                                      height: `${rowHeight}px`, // 계산된 행 높이
                                      maxHeight: `${rowHeight}px` // 최대 높이도 제한
                                    }}
                                  >
                                    {Array(tableData.cols).fill(null).map((_, colIndex) => {
                                      // 강화된 셀 값 추출 로직
                                      let cellValue = '';
                                      try {
                                        // 1차 시도: 직접 접근
                                        if (tableData.cells && Array.isArray(tableData.cells)) {
                                          if (tableData.cells[rowIndex] && Array.isArray(tableData.cells[rowIndex])) {
                                            const rawValue = tableData.cells[rowIndex][colIndex];
                                            if (rawValue !== undefined && rawValue !== null) {
                                              cellValue = String(rawValue).trim();
                                            }
                                          }
                                        }
                                        
                                        // 2차 시도: field.value를 다시 파싱
                                        if (!cellValue && field.value) {
                                          try {
                                            const reparsed = JSON.parse(field.value);
                                            if (reparsed.cells && Array.isArray(reparsed.cells)) {
                                              if (reparsed.cells[rowIndex] && Array.isArray(reparsed.cells[rowIndex])) {
                                                const fallbackValue = reparsed.cells[rowIndex][colIndex];
                                                if (fallbackValue !== undefined && fallbackValue !== null) {
                                                  cellValue = String(fallbackValue).trim();
                                                }
                                              }
                                            }
                                          } catch (parseError) {
                                            console.warn(`📊 DocumentPreviewModal 미리보기 재파싱 실패 [${rowIndex}][${colIndex}]:`, parseError);
                                          }
                                        }
                                      } catch (error) {
                                        console.error(`📊 DocumentPreviewModal 미리보기 셀 값 추출 실패 [${rowIndex}][${colIndex}]:`, error);
                                      }
                                      
                                      return (
                                        <td 
                                          key={colIndex}
                                          className="text-center text-gray-900 font-medium"
                                          style={{
                                            fontSize: `${Math.max(Math.min((field.fontSize || 14) * scale, 20 * scale), 8 * scale)}px !important`, // 기본 14px, 최소 8px, 최대 20px
                                            fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`, // 폰트 패밀리 적용
                                            fontWeight: '500 !important',
                                            padding: `${Math.min(2 * scale, rowHeight * 0.1)}px`, // 패딩 조금 늘림
                                            lineHeight: '1.2', // 라인 높이 조금 늘림
                                            wordBreak: 'break-all',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis', // 긴 텍스트는 생략 표시
                                            border: '1.5px solid #6b7280',
                                            height: `${rowHeight}px`,
                                            maxHeight: `${rowHeight}px`,
                                            minHeight: `${rowHeight}px`, // 최소 높이도 고정
                                            verticalAlign: 'middle',
                                            boxSizing: 'border-box', // 테두리 포함하여 크기 계산
                                            color: '#111827 !important' // 진한 회색으로 텍스트 색상 고정
                                          }}
                                        >
                                          {cellValue}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        // 일반 필드 렌더링
                        <div 
                          className="text-gray-900 font-medium leading-tight w-full"
                          style={{
                            fontSize: `${Math.max(Math.min((field.fontSize || 14) * scale, 20 * scale), 8 * scale)}px !important`, // 기본 14px, 최소 8px, 최대 20px
                            fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`, // 폰트 패밀리 적용
                            fontWeight: '500 !important',
                            lineHeight: '1.2',
                            textAlign: 'center',
                            overflow: 'hidden',
                            wordBreak: 'keep-all',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#111827 !important' // 진한 회색으로 텍스트 색상 고정
                          }}
                        >
                          {(() => {
                            console.log('🔍 미리보기 일반 필드 폰트 정보:', {
                              fieldId: field.id,
                              fontSize: field.fontSize,
                              fontFamily: field.fontFamily,
                              appliedFontSize: `${Math.max(Math.min((field.fontSize || 14) * scale, 20 * scale), 8 * scale)}px`,
                              appliedFontFamily: field.fontFamily || 'Arial',
                              value: field.value
                            });
                            return field.value;
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              
              {/* 빈 필드 표시 (디버깅 목적으로만 환경변수로 제어) */}
              {import.meta.env.DEV && import.meta.env.VITE_DEBUG_FIELDS === 'true' && (
                <>
                  {coordinateFields
                    .filter(field => !field.value || field.value.trim() === '')
                    .map((field) => (
                      <div
                        key={`empty-${field.id}`}
                        className="absolute border border-dashed border-red-300 bg-red-50 bg-opacity-20 flex items-center justify-center"
                        style={{
                          left: field.x,
                          top: field.y,
                          width: field.width,
                          height: field.height,
                        }}
                      >
                        <span className="text-xs text-red-400 font-medium">
                          {field.label} (빈 필드)
                        </span>
                      </div>
                    ))}
                </>
              )}

              {/* 서명 필드 렌더링 - 서명이 있는 경우만 표시 */}
              {signatureFields
                .filter(signatureField => signatureField.signatureData) // 서명 데이터가 있는 경우만 필터링
                .map((signatureField) => {
                  console.log('🖋️ 미리보기 모달 - 서명 필드 렌더링:', {
                    id: signatureField.id,
                    reviewerName: signatureField.reviewerName,
                    x: signatureField.x,
                    y: signatureField.y,
                    width: signatureField.width,
                    height: signatureField.height,
                    hasSignatureData: !!signatureField.signatureData
                  });

                  // 퍼센트 기반 위치 계산
                  const leftPercent = (signatureField.x / 1240) * 100;
                  const topPercent = (signatureField.y / 1754) * 100;
                  const widthPercent = (signatureField.width / 1240) * 100;
                  const heightPercent = (signatureField.height / 1754) * 100;

                  return (
                    <div
                      key={signatureField.id}
                      className="absolute"
                      style={{
                        left: `${leftPercent}%`,
                        top: `${topPercent}%`,
                        width: `${widthPercent}%`,
                        height: `${heightPercent}%`,
                        background: 'transparent',
                      }}
                    >
                      {/* 서명 이미지 표시 (완전히 투명한 배경) */}
                      <img
                        src={signatureField.signatureData}
                        alt={`${signatureField.reviewerName}의 서명`}
                        className="w-full h-full object-contain"
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          background: 'transparent'
                        }}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-600 space-y-1">
              <div>입력된 필드: {coordinateFields.filter(f => f.value?.trim()).length} / {coordinateFields.length}</div>
              {signatureFields.length > 0 && (
                <div>서명 필드: {signatureFields.filter(f => f.signatureData).length} / {signatureFields.length}</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
