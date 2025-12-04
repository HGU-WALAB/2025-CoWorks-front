import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import { usePdfPages } from '../hooks/usePdfPages';
import { API_BASE_URL } from '../config/api';
import { CoordinateField } from '../types/field';

const DocumentCompleted: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { isAuthenticated } = useAuthStore();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // PDF 페이지 관리
  const {
    pdfPages,
    totalPages
  } = usePdfPages(currentDocument?.template, []);

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 문서가 로드되고 상태가 COMPLETED가 아니면 리다이렉트
  useEffect(() => {
    if (currentDocument && currentDocument.status !== 'COMPLETED') {
      navigate(`/documents/${id}`);
    }
  }, [currentDocument, id, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-800 mb-2">로그인이 필요합니다</h3>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !currentDocument) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-bold text-red-800 mb-2">문서를 불러올 수 없습니다</h3>
          <p className="text-red-700">{error || '문서를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate('/documents')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            문서 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 좌표 필드 파싱
  const coordinateFields: CoordinateField[] = currentDocument.data?.coordinateFields 
    ? (typeof currentDocument.data.coordinateFields === 'string'
        ? JSON.parse(currentDocument.data.coordinateFields)
        : currentDocument.data.coordinateFields)
    : [];

  // 서명 필드 파싱
  const signatureFields = currentDocument.data?.signatureFields || [];

  // PDF 이미지 URL 생성
  const getPdfImageUrl = (pageIndex: number) => {
    if (pdfPages.length === 0) return '';
    if (pageIndex >= 0 && pageIndex < pdfPages.length) {
      return `${API_BASE_URL.replace('/api', '')}${pdfPages[pageIndex]}`;
    }
    return '';
  };

  // 페이지 필드 렌더링 (DocumentPreviewModal 로직 참고)
  const renderPageFields = (pageNum: number) => {
    const filteredFields = coordinateFields.filter(field => {
      const fieldPage = field.page || 1;
      return fieldPage === pageNum;
    });

    return filteredFields.map((field) => {
      let isTableField = false;
      let isEditorSignature = false;
      let isReviewerSignature = false;
      let tableInfo = null;
      let tableData = null;

      // 작성자 서명 필드 확인
      if (field.type === 'editor_signature') {
        isEditorSignature = true;
      }

      // 서명자 서명 필드 확인
      if (field.type === 'reviewer_signature' || field.type === 'signer_signature') {
        isReviewerSignature = true;
      }

      // 테이블 데이터 확인 - DocumentPreviewModal과 동일한 우선순위
      // 1. 서버에서 불러온 데이터 우선 확인 (field.value)
      // 단, 서명 필드인 경우 JSON 파싱 시도하지 않음 (이미지 데이터이므로)
      if (field.value && !isEditorSignature && !isReviewerSignature) {
        try {
          const parsedValue = JSON.parse(field.value);
          if (parsedValue.rows && parsedValue.cols) {
            isTableField = true;
            tableInfo = {
              rows: parsedValue.rows,
              cols: parsedValue.cols,
              columnWidths: parsedValue.columnWidths,
              columnHeaders: parsedValue.columnHeaders || field.tableData?.columnHeaders
            };
            tableData = parsedValue; // 서버에서 불러온 실제 데이터 (cells 포함)
          }
        } catch {
          // JSON 파싱 실패 시 일반 텍스트 필드로 처리
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
          columnWidths: field.tableData.columnWidths,
          columnHeaders: field.tableData.columnHeaders
        };
      }

      // 서명 필드 찾기
      const signatureField = signatureFields.find((sf: any) => sf.id === field.id);
      const signatureData = signatureField?.signatureData || field.value;

      // 픽셀 좌표 직접 사용 (DocumentPreviewModal과 동일)
      const leftPercent = field.x;
      const topPercent = field.y;
      const widthPercent = field.width;
      const heightPercent = field.height;

      return (
        <div
          key={field.id}
          className="absolute"
          style={{
            left: `${leftPercent}px`,
            top: `${topPercent}px`,
            width: `${widthPercent}px`,
            height: `${heightPercent}px`,
            fontSize: `${field.fontSize || 18}px`,
            fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
            fontWeight: '500',
            overflow: 'visible',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isEditorSignature ? (
            signatureData && signatureData.startsWith('data:image') ? (
              <img
                src={signatureData}
                alt="작성자 서명"
                className="w-full h-full object-contain"
                style={{ background: 'transparent' }}
              />
            ) : (
              <div className="text-xs text-red-700 font-medium text-center p-2 flex items-center justify-center gap-1 flex-wrap">
                <span>작성자 서명</span>
                {(field as any).editorName && (
                  <span>({(field as any).editorName})</span>
                )}
              </div>
            )
          ) : isReviewerSignature ? (
            signatureData && signatureData.startsWith('data:image') ? (
              <img
                src={signatureData}
                alt="서명자 서명"
                className="w-full h-full object-contain"
                style={{ background: 'transparent' }}
              />
            ) : (
              <div className="text-xs text-red-700 font-medium text-center p-2 flex items-center justify-center gap-1 flex-wrap">
                <span>
                  {(field as any).reviewerName || (field as any).reviewerEmail || '검토자'} 서명
                </span>
              </div>
            )
          ) : isTableField && tableInfo && tableData ? (
            (() => {
              const hasColumnHeaders = tableInfo.columnHeaders && tableInfo.columnHeaders.some((h: string) => h);
              const rowHeight = hasColumnHeaders 
                ? `${heightPercent / (tableInfo.rows + 1)}px` 
                : `${heightPercent / tableInfo.rows}px`;

              return (
                <table className="w-full h-full border-collapse" style={{ border: '2px solid black', tableLayout: 'fixed' }}>
                  {hasColumnHeaders && (
                    <thead>
                      <tr>
                        {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                          const headerText = tableInfo!.columnHeaders?.[colIndex] || '';
                          const cellWidth = tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`;
                          return (
                            <th
                              key={`header-${colIndex}`}
                              className="border border-black text-center"
                              style={{
                                width: cellWidth,
                                height: rowHeight,
                                fontSize: `${Math.max((field.fontSize || 16) * 1.0, 10)}px`,
                                fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                padding: '4px',
                                fontWeight: '600',
                                lineHeight: '1.2',
                                overflow: 'hidden',
                                backgroundColor: 'white',
                                color: 'black'
                              }}
                            >
                              {headerText || `열 ${colIndex + 1}`}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                  )}
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
                                height: rowHeight,
                                fontSize: `${Math.max((field.fontSize || 18) * 1.2, 10)}px`,
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
              );
            })()
          ) : field.value ? (
            <div
              className="text-gray-900 flex items-center justify-center w-full h-full"
              style={{
                fontSize: `${field.fontSize || 18}px`,
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
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {currentDocument.title || currentDocument.templateName}
              </h1>
              <StatusBadge status={DOCUMENT_STATUS.COMPLETED} size="md" />
            </div>
            <button
              onClick={() => navigate('/documents')}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              목록으로 돌아가기
            </button>
          </div>
          <div className="text-sm text-gray-600">
            <p>생성일: {new Date(currentDocument.createdAt).toLocaleString('ko-KR')}</p>
            <p>완료일: {new Date(currentDocument.updatedAt).toLocaleString('ko-KR')}</p>
          </div>
        </div>

        {/* 문서 뷰어 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">완성된 문서</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                -
              </button>
              <span className="text-sm text-gray-600 w-16 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                +
              </button>
            </div>
          </div>

          {/* 페이지 네비게이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}

          {/* 문서 렌더링 - DocumentPreviewModal과 동일한 크기 */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center items-start">
            <div
              className="mx-auto origin-top-left"
              style={{
                width: 1240 * zoomLevel,
                height: 1754 * zoomLevel,
              }}
            >
              {pdfPages.length > 0 && (
                <div
                  className="relative bg-white shadow-lg select-none origin-top-left"
                  style={{
                    width: '1240px',
                    height: '1754px',
                    minWidth: '1240px',
                    minHeight: '1754px',
                    flexShrink: 0,
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top left'
                  }}
                >
                  {/* PDF 배경 이미지 */}
                  <img
                    src={getPdfImageUrl(currentPage - 1)}
                    alt={`Document Preview - Page ${currentPage}`}
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{
                      width: '1240px',
                      height: '1754px',
                      objectFit: 'fill'
                    }}
                  />

                  {/* 필드 오버레이 */}
                  <div className="absolute inset-0" style={{ width: '1240px', height: '1754px' }}>
                    {renderPageFields(currentPage)}
                    
                    {/* 서명 필드 렌더링 */}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentCompleted;

