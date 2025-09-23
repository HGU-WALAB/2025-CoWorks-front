import React from 'react';
import { CoordinateField } from '../types/field';
import { captureAndSaveToPDF } from '../utils/printUtils';

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
  
  // PDF 문서 영역에 대한 ref
  const documentRef = React.useRef<HTMLDivElement>(null);

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

  // 새로운 DOM 캡처 기반 인쇄 기능
  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);

    try {
      console.log('🖨️ DocumentPreviewModal - 새로운 DOM 캡처 인쇄 시작:', {
        documentRef: !!documentRef.current,
        documentTitle
      });

      if (!documentRef.current) {
        throw new Error('문서 영역을 찾을 수 없습니다.');
      }

      // DOM 캡처를 통한 PDF 저장
      await captureAndSaveToPDF({
        elementRef: documentRef,
        documentTitle: documentTitle || '문서',
        pdfPageWidth: 210, // A4 세로
        pdfPageHeight: 297,
        backgroundColor: '#ffffff'
      });

      console.log('✅ DocumentPreviewModal - 새로운 인쇄 완료');
      setIsPrinting(false);
    } catch (error) {
      console.error('❌ DocumentPreviewModal - 새로운 인쇄 실패:', error);
      alert(`인쇄 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setIsPrinting(false);
    }
  }, [documentTitle]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl max-h-[95vh] w-full mx-4 flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{documentTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">편집 페이지와 동일한 미리보기</p>
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

        {/* 모달 본문 - 편집 페이지와 동일한 PDF 뷰어 */}
        <div 
          className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center items-start"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div 
            ref={documentRef}
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
              style={{
                width: '1240px',
                height: '1754px',
                objectFit: 'fill'
              }}
              onError={() => {
                console.error('PDF 이미지 로드 실패:', pdfImageUrl);
              }}
            />
            
            {/* 필드 오버레이 - 편집 페이지와 동일한 렌더링 */}
            <div className="absolute inset-0" style={{ width: '1240px', height: '1754px' }}>
              {coordinateFields
                .filter(field => {
                  // 편집자 서명 필드는 값이 있는 경우만 표시
                  if (field.type === 'editor_signature') {
                    return field.value && field.value.trim() !== '';
                  }
                  // 일반 필드와 테이블 필드는 값이 있는 경우만 표시
                  return field.value && field.value.trim() !== '';
                })
                .map((field) => {
                // 필드 타입 확인 - 편집 페이지와 동일한 로직
                let isTableField = false;
                let isEditorSignature = false;
                let tableInfo = null;
                let tableData = null;

                // 편집자 서명 필드 확인
                if (field.type === 'editor_signature') {
                  isEditorSignature = true;
                }
                
                // 테이블 데이터 확인 - 편집 페이지와 동일한 우선순위
                // 1. 서버에서 불러온 데이터 우선 확인 (field.value)
                if (field.value) {
                  try {
                    const parsedValue = JSON.parse(field.value);
                    if (parsedValue.rows && parsedValue.cols) {
                      isTableField = true;
                      tableInfo = {
                        rows: parsedValue.rows,
                        cols: parsedValue.cols,
                        columnWidths: parsedValue.columnWidths
                      };
                      tableData = parsedValue; // 서버에서 불러온 실제 데이터 (cells 포함)
                    }
                  } catch (error) {
                    console.error('서버 테이블 데이터 파싱 실패:', error);
                  }
                }
                
                // 2. 서버 데이터가 없으면 템플릿 tableData 속성 확인
                if (!isTableField && field.tableData) {
                  isTableField = true;
                  tableInfo = field.tableData;
                  // 템플릿 데이터만 있고 서버 데이터가 없는 경우 빈 테이블로 초기화
                  tableData = {
                    rows: field.tableData.rows,
                    cols: field.tableData.cols,
                    cells: Array(field.tableData.rows).fill(null).map(() => 
                      Array(field.tableData!.cols).fill('')
                    ),
                    columnWidths: field.tableData.columnWidths
                  };
                }

                // 퍼센트 계산 대신 픽셀 좌표 직접 사용 (편집 페이지와 동일)
                const leftPercent = field.x;
                const topPercent = field.y;
                const widthPercent = field.width;
                const heightPercent = field.height;

                console.log('🎯 미리보기 모달 - 필드 렌더링:', {
                  id: field.id,
                  label: field.label,
                  x: field.x,
                  y: field.y,
                  width: field.width,
                  height: field.height,
                  value: field.value,
                  isTableField,
                  isEditorSignature
                });

                return (
                  <div
                    key={field.id}
                    className="absolute"
                    style={{
                      left: `${leftPercent}px`,
                      top: `${topPercent}px`,
                      width: `${widthPercent}px`,
                      height: `${heightPercent}px`,
                    }}
                  >
                    {isEditorSignature ? (
                      // 편집자 서명 필드 렌더링 - 편집 페이지와 동일
                      <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-transparent">
                        {field.value && field.value.startsWith('data:image') ? (
                          <img
                            src={field.value}
                            alt="편집자 서명"
                            className="max-w-full h-full object-contain bg-transparent"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              background: 'transparent'
                            }}
                          />
                        ) : field.value ? (
                          <div
                            className="text-center text-gray-800"
                            style={{
                              fontSize: `${(field.fontSize || 14)}px !important`,
                              fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                              fontWeight: '500 !important',
                              color: '#1f2937 !important'
                            }}
                          >
                            서명됨: {new Date().toLocaleDateString()}
                          </div>
                        ) : (
                          <div
                            className="text-center text-gray-500"
                            style={{
                              fontSize: `${(field.fontSize || 12)}px !important`,
                              fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`
                            }}
                          >
                            {/* 빈 서명 영역 - 표시하지 않음 */}
                          </div>
                        )}
                      </div>
                    ) : isTableField && tableInfo && tableData ? (
                      // 테이블 렌더링 - 배경색 제거, 테두리만 유지
                      <div className="w-full h-full p-1">
                        <div 
                          className="grid"
                          style={{
                            gridTemplateColumns: tableInfo.columnWidths 
                              ? tableInfo.columnWidths.map((width: number) => `${width * 100}%`).join(' ')
                              : `repeat(${tableInfo.cols}, 1fr)`,
                            height: '100%',
                            gap: '0px' // 셀 간격 완전 제거
                          }}
                        >
                          {Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
                            Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                              let cellText = '';
                              
                              try {
                                // 편집 페이지와 동일한 셀 값 추출 로직
                                if (tableData.cells && 
                                    Array.isArray(tableData.cells) && 
                                    tableData.cells[rowIndex] && 
                                    Array.isArray(tableData.cells[rowIndex])) {
                                  cellText = tableData.cells[rowIndex][colIndex] || '';
                                }
                              } catch (error) {
                                cellText = '';
                              }

                              return (
                                <div 
                                  key={`${rowIndex}-${colIndex}`}
                                  className="border border-gray-800 flex items-center justify-center"
                                  style={{ 
                                    minHeight: '20px',
                                    fontSize: `${(field.fontSize || 14)}px !important`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                    color: '#1f2937', // 진한 회색 텍스트
                                    fontWeight: '500 !important',
                                    backgroundColor: 'transparent', // 배경색 완전 제거
                                    lineHeight: '1.4 !important',
                                    textAlign: 'center',
                                    overflow: 'visible',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    whiteSpace: 'nowrap',
                                    textRendering: 'optimizeLegibility',
                                    WebkitFontSmoothing: 'antialiased',
                                    MozOsxFontSmoothing: 'grayscale',
                                    padding: '2px 4px'
                                  }}
                                >
                                  <span 
                                    className="text-center truncate leading-tight"
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      fontSize: `${(field.fontSize || 14)}px !important`,
                                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                      fontWeight: '500 !important',
                                      color: '#1f2937 !important',
                                      lineHeight: '1.4 !important',
                                      textAlign: 'center',
                                      wordBreak: 'keep-all',
                                      whiteSpace: 'nowrap',
                                      textRendering: 'optimizeLegibility',
                                      WebkitFontSmoothing: 'antialiased',
                                      MozOsxFontSmoothing: 'grayscale'
                                    }}
                                  >
                                    {cellText}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : field.value ? (
                      // 일반 필드 - 값이 있는 경우 (편집 페이지와 동일)
                      <div 
                        className="text-gray-900 flex items-center justify-center w-full h-full"
                        style={{
                          fontSize: `${(field.fontSize || 14)}px !important`,
                          fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                          fontWeight: '500 !important',
                          color: '#111827 !important',
                          lineHeight: '1.4 !important',
                          textAlign: 'center',
                          wordBreak: 'keep-all',
                          overflow: 'visible',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          textRendering: 'optimizeLegibility',
                          WebkitFontSmoothing: 'antialiased',
                          MozOsxFontSmoothing: 'grayscale',
                          padding: '2px 4px'
                        }}
                      >
                        {field.value}
                      </div>
                    ) : (
                      // 일반 필드 - 값이 없는 경우 (빈 상태) - 미리보기에서는 아무것도 표시하지 않음
                      <div className="w-full h-full">
                        {/* 빈 필드는 미리보기에서 표시하지 않음 */}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 서명 필드 렌더링 - 서명이 있는 경우만 표시 */}
              {signatureFields
                .filter(signatureField => signatureField.signatureData)
                .map((signatureField) => (
                  <div
                    key={signatureField.id}
                    className="absolute"
                    style={{
                      left: `${signatureField.x}px`,
                      top: `${signatureField.y}px`,
                      width: `${signatureField.width}px`,
                      height: `${signatureField.height}px`,
                      background: 'transparent',
                    }}
                  >
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
                ))}
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <div>입력된 필드: {coordinateFields.filter(f => f.value?.trim()).length} / {coordinateFields.length}</div>
              {signatureFields.length > 0 && (
                <div className="mt-1">서명 필드: {signatureFields.filter(f => f.signatureData).length} / {signatureFields.length}</div>
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
