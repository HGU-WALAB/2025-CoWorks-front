import React from 'react';
import { CoordinateField } from '../types/field';
import { captureAndSaveToPDF, captureMultiplePagesToPDF } from '../utils/printUtils';

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
  pdfImageUrls?: string[]; // 여러 페이지 지원
  coordinateFields: CoordinateField[];
  signatureFields?: SignatureField[];
  documentTitle?: string;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfImageUrl,
  pdfImageUrls = [],
  coordinateFields,
  signatureFields = [],
  documentTitle = "문서 미리보기"
}) => {
  // Hook들을 항상 호출 (조건문 이전에)
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

  // PDF 문서 영역에 대한 ref (단일 페이지용 - 하위 호환성)
  const documentRef = React.useRef<HTMLDivElement>(null);

  // 모든 페이지에 대한 refs (멀티페이지 인쇄용)
  const pageRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // 페이지 URL 배열 (여러 페이지 또는 단일 페이지)
  const pageUrls = pdfImageUrls.length > 0 ? pdfImageUrls : [pdfImageUrl];
  const totalPages = pageUrls.length;

  // ESC 키로 모달 닫기, 화살표 키로 페이지 이동
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else if (event.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
      } else if (event.key === 'Home') {
        setCurrentPage(1);
      } else if (event.key === 'End') {
        setCurrentPage(totalPages);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentPage, totalPages]);

  // 조건부 렌더링은 Hook 호출 이후에
  if (!isOpen) return null;

  // 모달 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 페이지 렌더링 함수 (재사용을 위해)
  const renderPageFields = React.useCallback((pageNum: number) => {
    const filteredFields = coordinateFields.filter(field => {
      const fieldPage = field.page || 1;
      return fieldPage === pageNum;
    });

    console.log(`🎯 DocumentPreviewModal - 페이지 ${pageNum} 필드 렌더링:`, {
      totalFields: coordinateFields.length,
      filteredCount: filteredFields.length,
      allFieldPages: coordinateFields.map(f => ({ id: f.id, label: f.label, page: f.page })),
      filteredFields: filteredFields.map(f => ({ id: f.id, label: f.label, page: f.page }))
    });

    return filteredFields
      .map((field) => {
        // 필드 타입 확인
        let isTableField = false;
        let isEditorSignature = false;
        let tableInfo = null;
        let tableData = null;

        if (field.type === 'editor_signature') {
          isEditorSignature = true;
        }

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
              tableData = parsedValue;
            }
          } catch (error) {
            // JSON 파싱 실패 시 일반 필드로 처리
          }
        }

        if (!isTableField && field.tableData) {
          isTableField = true;
          tableInfo = field.tableData;
          tableData = {
            rows: field.tableData.rows,
            cols: field.tableData.cols,
            cells: Array(field.tableData.rows).fill(null).map(() =>
              Array(field.tableData!.cols).fill('')
            ),
            columnWidths: field.tableData.columnWidths
          };
        }

        return (
          <div
            key={field.id}
            className="absolute"
            style={{
              left: `${field.x}px`,
              top: `${field.y}px`,
              width: `${field.width}px`,
              height: `${field.height}px`,
              fontSize: `${field.fontSize || 14}px`,
              fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
              fontWeight: '500',
              overflow: 'visible',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isEditorSignature && field.value && field.value.startsWith('data:image') ? (
              <img
                src={field.value}
                alt="편집자 서명"
                className="w-full h-full object-contain"
                style={{ background: 'transparent' }}
              />
            ) : isTableField && tableInfo && tableData ? (
              <table className="w-full h-full border-collapse" style={{ border: '2px solid black', tableLayout: 'fixed' }}>
                <tbody>
                  {Array(tableInfo.rows).fill(null).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                        const cellValue = tableData.cells?.[rowIndex]?.[colIndex] || '';
                        const cellWidth = tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`;
                        return (
                          <td
                            key={colIndex}
                            className="border border-black text-center"
                            style={{
                              width: cellWidth,
                              fontSize: `${Math.max((field.fontSize || 14) * 0.9, 10)}px`,
                              fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                              padding: '4px',
                              fontWeight: '500',
                              lineHeight: '1.2',
                              overflow: 'hidden',
                            }}
                          >
                            {cellValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : field.value ? (
              <div
                className="text-gray-900 flex items-center justify-center w-full h-full"
                style={{
                  fontSize: `${field.fontSize || 14}px`,
                  fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                  fontWeight: '500',
                  color: '#111827',
                  lineHeight: '1.4',
                  textAlign: 'center',
                  wordBreak: 'keep-all',
                  overflow: 'visible',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  padding: '2px 4px'
                }}
              >
                {field.value}
              </div>
            ) : null}
          </div>
        );
      });
  }, [coordinateFields]);

  // 서명 필드 렌더링 함수
  const renderPageSignatures = React.useCallback((pageNum: number) => {
    return signatureFields
      .filter(signatureField => {
        const fieldPage = (signatureField as any).page || 1; // 서명 필드는 타입에 page가 없을 수 있음
        return fieldPage === pageNum && signatureField.signatureData;
      })
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
      ));
  }, [signatureFields]);

  // 멀티페이지 DOM 캡처 기반 인쇄 기능
  const handlePrint = React.useCallback(async () => {
    setIsPrinting(true);

    try {
      // 멀티페이지인 경우
      if (totalPages > 1) {
        // 모든 페이지 refs가 존재하는지 확인
        const validPageElements = pageRefs.current.filter(ref => ref !== null) as HTMLElement[];

        if (validPageElements.length !== totalPages) {
          throw new Error(`일부 페이지를 찾을 수 없습니다. (찾은 페이지: ${validPageElements.length}/${totalPages})`);
        }

        // 모든 페이지를 하나의 PDF로 합침
        await captureMultiplePagesToPDF(
          validPageElements,
          documentTitle || '문서',
          210, // A4 세로
          297
        );
      } else {
        // 단일 페이지인 경우 (하위 호환성)
        if (!documentRef.current) {
          throw new Error('문서 영역을 찾을 수 없습니다.');
        }

        await captureAndSaveToPDF({
          elementRef: documentRef,
          documentTitle: documentTitle || '문서',
          pdfPageWidth: 210,
          pdfPageHeight: 297,
          backgroundColor: '#ffffff'
        });
      }

      setIsPrinting(false);
    } catch (error) {
      console.error('❌ DocumentPreviewModal - 인쇄 실패:', error);
      alert(`인쇄 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setIsPrinting(false);
    }
  }, [documentTitle, totalPages]);

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
            <p className="text-sm text-gray-500 mt-1">
              미리보기 {totalPages > 1 && `· 페이지 ${currentPage} / ${totalPages}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 페이지 네비게이션 */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="이전 페이지 (←)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="다음 페이지 (→)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
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
        <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center items-start">
          {/* 보이는 영역 - 현재 페이지만 표시 */}
          <div
            ref={documentRef}
            className="relative bg-white shadow-lg select-none"
            style={{
              width: '1240px',
              height: '1754px',
              minWidth: '1240px',
              minHeight: '1754px',
              flexShrink: 0
            }}
          >
            {/* PDF 배경 이미지 - 현재 페이지 */}
            <img
              src={pageUrls[currentPage - 1]}
              alt={`Document Preview - Page ${currentPage}`}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                width: '1240px',
                height: '1754px',
                objectFit: 'fill'
              }}
              onError={() => {
                // 이미지 로드 실패
              }}
            />

            {/* 필드 오버레이 - 현재 페이지의 필드만 표시 */}
            <div className="absolute inset-0" style={{ width: '1240px', height: '1754px' }}>
              {coordinateFields
                .filter(field => {
                  // 현재 페이지의 필드만 필터링
                  const fieldPage = field.page || 1;
                  return fieldPage === currentPage;
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

              {/* 서명 필드 렌더링 - 현재 페이지의 서명만 표시 */}
              {signatureFields
                .filter(signatureField => {
                  const fieldPage = (signatureField as any).page || 1;
                  return fieldPage === currentPage && signatureField.signatureData;
                })
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

      {/* 숨겨진 컨테이너 - 모든 페이지 렌더링 (인쇄용) */}
      {totalPages > 1 && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          {pageUrls.map((pageUrl, index) => (
            <div
              key={`print-page-${index}`}
              ref={el => { pageRefs.current[index] = el; }}
              className="relative bg-white"
              style={{
                width: '1240px',
                height: '1754px',
                minWidth: '1240px',
                minHeight: '1754px',
              }}
            >
              {/* PDF 배경 이미지 */}
              <img
                src={pageUrl}
                alt={`Print Page ${index + 1}`}
                className="absolute inset-0 w-full h-full"
                style={{
                  width: '1240px',
                  height: '1754px',
                  objectFit: 'fill'
                }}
              />

              {/* 필드 오버레이 */}
              <div className="absolute inset-0" style={{ width: '1240px', height: '1754px' }}>
                {renderPageFields(index + 1)}
                {renderPageSignatures(index + 1)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentPreviewModal;
