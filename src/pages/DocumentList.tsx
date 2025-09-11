import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { handlePrint as printDocument, type PrintOptions } from '../utils/printUtils';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  name: string;
  position: string;
}

interface DocumentHistory {
  id: number;
  status: string;
  action: string;
  description: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
}

const DocumentList: React.FC = () => {
  const { documents, loading, fetchDocuments } = useDocumentStore();
  const { user: currentUser } = useAuthStore();
  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documentHistory, setDocumentHistory] = useState<DocumentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [printingDocumentId, setPrintingDocumentId] = useState<number | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handlePreview = async (documentId: number) => {
    try {
      const document = documents.find(d => d.id === documentId);
      if (document) {
        console.log('🔍 DocumentList - 미리보기 문서:', document);
        setPreviewDocument(document);
        
        // 템플릿 필드와 저장된 필드를 합쳐서 설정
        let allFields: any[] = [];
        
        // 템플릿 필드 추가
        if (document.template?.coordinateFields) {
          try {
            const templateFields = JSON.parse(document.template.coordinateFields);
            allFields = [...templateFields];
          } catch (error) {
            console.error('템플릿 필드 파싱 오류:', error);
          }
        }
        
        // 저장된 추가 필드 추가
        const savedFields = document.data?.coordinateFields || [];
        allFields = [...allFields, ...savedFields];
        
        setCoordinateFields(allFields);

        // 서명 필드 처리
        const docSignatureFields = document.data?.signatureFields || [];
        const docSignatures = document.data?.signatures || {};
        
        const processedSignatureFields = docSignatureFields.map((field: any) => ({
          ...field,
          signatureData: docSignatures[field.reviewerEmail]
        }));
        
        console.log('🖋️ DocumentList - 서명 필드 처리:', {
          originalSignatureFields: docSignatureFields,
          signatures: docSignatures,
          processedSignatureFields
        });
        
        setSignatureFields(processedSignatureFields);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('문서 미리보기 실패:', error);
    }
  };

  const handleHistory = async (documentId: number) => {
    setSelectedDocumentId(documentId);
    setHistoryLoading(true);
    try {
      const { token } = useAuthStore.getState();
      const response = await axios.get(
        `http://localhost:8080/api/documents/${documentId}/history`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setDocumentHistory(response.data);
      setShowHistory(true);
    } catch (error) {
      console.error('히스토리 조회 실패:', error);
      alert('히스토리 조회에 실패했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 인쇄 기능 - printUtils의 공통 함수 사용
  const handlePrint = async (document: Document) => {
    try {
      setPrintingDocumentId(document.id);
      
      // 저장된 coordinateFields 사용 (사용자가 입력한 데이터 포함)
      const coordinateFields = document.data?.coordinateFields || [];
      
      // PDF 이미지 URL
      const pdfImageUrl = getPdfImageUrl(document);
      
      // 서명 필드 처리
      const signatureFields = document.data?.signatureFields || [];
      const signatures = document.data?.signatures || {};
      
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
        signatures,
        documentId: document.id,
        documentTitle: document.template?.name || '문서'
      };
      
      await printDocument(printOptions);
      setPrintingDocumentId(null);
    } catch (error) {
      console.error('인쇄 실패:', error);
      setPrintingDocumentId(null);
    }
  };

  const getPdfImageUrl = (doc: Document) => {
    console.log('🔍 DocumentList - PDF 이미지 URL 생성:', {
      template: doc.template,
      pdfImagePath: doc.template?.pdfImagePath
    });
    
    if (!doc.template?.pdfImagePath) {
      console.warn('⚠️ DocumentList - PDF 이미지 경로가 없습니다');
      return '';
    }
    
    const filename = doc.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    const url = `/uploads/pdf-templates/${filename}`;
    
    console.log('📄 DocumentList - 생성된 PDF 이미지 URL:', {
      originalPath: doc.template.pdfImagePath,
      filename: filename,
      url: url
    });
    
    return url;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'REVIEWING':
        return 'bg-blue-100 text-blue-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'READY_FOR_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'EDITING':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '완료';
      case 'REVIEWING':
        return '검토중';
      case 'REJECTED':
        return '반려';
      case 'READY_FOR_REVIEW':
        return '검토준비';
      case 'EDITING':
        return '편집중';
      case 'DRAFT':
        return '초안';
      default:
        return status;
    }
  };

  const getUserRole = (document: Document) => {
    if (!currentUser) return '';
    
    const task = document.tasks?.find(t => t.assignedUserEmail === currentUser.email);
    return task ? task.role : '';
  };

  const canReview = (document: Document) => {
    if (!currentUser) return false;
    
    const task = document.tasks?.find(t => t.assignedUserEmail === currentUser.email);
    return task && task.role === 'REVIEWER';
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'CREATED':
        return '문서 생성';
      case 'UPDATED':
        return '문서 수정';
      case 'STATUS_CHANGED':
        return '상태 변경';
      case 'REVIEW_REQUESTED':
        return '검토 요청';
      case 'REVIEWED':
        return '검토 완료';
      case 'COMPLETED':
        return '문서 완료';
      default:
        return action;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">문서를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <>
      {/* 인쇄용 스타일 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* 모든 요소 숨김 */
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              visibility: hidden !important;
            }
            
            /* 인쇄용 컨테이너만 보이게 */
            .print-only {
              visibility: visible !important;
              display: block !important;
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              background: white !important;
              z-index: 9999 !important;
            }
            
            .print-only * {
              visibility: visible !important;
            }
            
            @page {
              size: A4;
              margin: 0;
            }
            
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .print-container {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              position: relative !important;
              overflow: hidden !important;
              page-break-after: avoid !important;
            }
            
            .print-pdf-container {
              width: 1240px !important;
              height: 1754px !important;
              transform: scale(0.169) !important;
              transform-origin: top left !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
            
            .print-field {
              position: absolute !important;
              background: transparent !important;
              border: none !important;
              font-weight: 600 !important;
              color: black !important;
              padding: 2px !important;
            }
            
            .print-table {
              background: transparent !important;
              border: 1px solid black !important;
            }
            
            .print-table-cell {
              border: 1px solid black !important;
              background: transparent !important;
              color: black !important;
              font-weight: 500 !important;
              padding: 2px !important;
            }
          }
        `
      }} />
      
    <div className="container mx-auto px-4 py-8 no-print">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📋 문서 목록</h1>
        <Link to="/templates" className="btn btn-primary">
          📄 새 문서 생성
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                문서명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                역할
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                생성일
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((document) => (
              <tr key={document.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {document.templateName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(document.status)}`}>
                    {getStatusText(document.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getUserRole(document)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(document.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {document.status === 'COMPLETED' ? (
                    // 완료된 문서는 편집 불가
                    <span className="text-gray-400 mr-4">편집 불가</span>
                  ) : (document.status === 'REVIEWING' || document.status === 'READY_FOR_REVIEW') ? (
                    // 검토 가능한 상태: REVIEWING 또는 READY_FOR_REVIEW
                    <Link
                      to={`/documents/${document.id}/review`}
                      className="text-yellow-600 hover:text-yellow-700 mr-4"
                    >
                     검토
                    </Link>
                  ) : (
                    // 일반 사용자일 때
                    <Link
                      to={`/documents/${document.id}/edit`}
                      className="text-primary-600 hover:text-primary-700 mr-4"
                    >
                      편집
                    </Link>
                  )}
                  <button
                    onClick={() => handleHistory(document.id)}
                    className="text-blue-600 hover:text-blue-700 mr-4"
                  >
                    📜 히스토리
                  </button>
                  <button
                    onClick={() => handlePrint(document)}
                    disabled={printingDocumentId === document.id}
                    className={`mr-4 ${
                      printingDocumentId === document.id 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    {printingDocumentId === document.id ? '준비중...' : '🖨️ 인쇄'}
                  </button>
                  <button
                    onClick={() => handlePreview(document.id)}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documents.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">문서가 없습니다</h3>
          <p className="text-gray-600 mb-4">템플릿을 선택해서 첫 번째 문서를 생성해보세요</p>
          <Link to="/templates" className="btn btn-primary">
            문서 생성하기
          </Link>
        </div>
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">📜 문서 히스토리</h2>
                <p className="text-sm text-gray-600 mt-1">
                  문서의 모든 변경 내역과 상태 변화를 확인할 수 있습니다
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="btn btn-primary text-sm"
              >
                닫기
              </button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="ml-3 text-gray-600">히스토리를 불러오는 중...</span>
                </div>
              ) : documentHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📜</div>
                  <p>아직 히스토리가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documentHistory.slice().reverse().map((history, index) => (
                    <div key={history.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {getActionText(history.action)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {history.description}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {history.performedByName} ({history.performedBy})
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(history.status)}`}>
                            {getStatusText(history.status)}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(history.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {showPreview && previewDocument && previewDocument.template?.pdfImagePath && (
        <DocumentPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          pdfImageUrl={getPdfImageUrl(previewDocument)}
          coordinateFields={coordinateFields}
          signatureFields={signatureFields}
          documentTitle={previewDocument.template.name || '문서'}
        />
      )}
      
      {/* 인쇄 전용 컨테이너 (화면에서는 숨김) */}
      <div className="hidden print-only print-container">
        {printingDocumentId && previewDocument?.template?.pdfImagePath && (
          <div className="print-pdf-container">
            {/* PDF 배경 이미지 */}
            <img 
              src={getPdfImageUrl(previewDocument)}
              alt="PDF Document"
              style={{
                width: '1240px',
                height: '1754px',
                objectFit: 'fill'
              }}
            />
            
            {/* 필드 데이터 오버레이 */}
            {coordinateFields.map((field) => {
              // 테이블 필드 확인
              let isTableField = false;
              let tableInfo = null;
              let tableData = null;
              
              if (field.tableData) {
                isTableField = true;
                tableInfo = field.tableData;
                tableData = field.tableData;
              } else if (field.value) {
                try {
                  const parsedValue = JSON.parse(field.value);
                  if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                    isTableField = true;
                    tableInfo = {
                      rows: parsedValue.rows,
                      cols: parsedValue.cols,
                      columnWidths: parsedValue.columnWidths
                    };
                    tableData = parsedValue;
                  }
                } catch (e) {
                  // JSON 파싱 실패 시 일반 필드로 처리
                }
              }
              
              return (
                <div
                  key={field.id}
                  className="print-field"
                  style={{
                    left: `${field.x}px`,
                    top: `${field.y}px`,
                    width: `${field.width}px`,
                    height: `${field.height}px`,
                    fontSize: `${field.fontSize || 14}px`,
                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                  }}
                >
                  {isTableField && tableData ? (
                    // 테이블 인쇄
                    <table className="print-table" style={{ width: '100%', height: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {Array(tableInfo!.rows).fill(null).map((_, rowIndex) => (
                          <tr key={rowIndex}>
                            {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                              // 강화된 셀 값 추출 로직
                              let cellContent = '';
                              try {
                                // 1차 시도: 직접 접근
                                if (tableData.cells && Array.isArray(tableData.cells)) {
                                  if (tableData.cells[rowIndex] && Array.isArray(tableData.cells[rowIndex])) {
                                    const rawValue = tableData.cells[rowIndex][colIndex];
                                    if (rawValue !== undefined && rawValue !== null) {
                                      cellContent = String(rawValue).trim();
                                    }
                                  }
                                }
                                
                                // 2차 시도: field.value를 다시 파싱
                                if (!cellContent && field.value) {
                                  try {
                                    const reparsed = JSON.parse(field.value);
                                    if (reparsed.cells && Array.isArray(reparsed.cells)) {
                                      if (reparsed.cells[rowIndex] && Array.isArray(reparsed.cells[rowIndex])) {
                                        const fallbackValue = reparsed.cells[rowIndex][colIndex];
                                        if (fallbackValue !== undefined && fallbackValue !== null) {
                                          cellContent = String(fallbackValue).trim();
                                        }
                                      }
                                    }
                                  } catch (parseError) {
                                    console.warn(`📊 DocumentList 인라인 재파싱 실패 [${rowIndex}][${colIndex}]:`, parseError);
                                  }
                                }
                              } catch (error) {
                                console.error(`📊 DocumentList 인라인 셀 값 추출 실패 [${rowIndex}][${colIndex}]:`, error);
                              }
                              
                              return (
                                <td 
                                  key={colIndex}
                                  className="print-table-cell"
                                  style={{
                                    width: tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`,
                                    fontSize: `${field.fontSize || 14}px`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle'
                                  }}
                                >
                                  {cellContent || ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    // 일반 필드 인쇄
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: `${field.fontSize || 14}px`,
                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                      fontWeight: '600',
                      color: 'black'
                    }}>
                      {field.value || ''}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* 서명 필드 인쇄 */}
            {signatureFields.map((field) => (
              <div
                key={field.id}
                className="print-field"
                style={{
                  left: `${field.x}px`,
                  top: `${field.y}px`,
                  width: `${field.width}px`,
                  height: `${field.height}px`,
                }}
              >
                {field.signatureData && (
                  <img 
                    src={field.signatureData} 
                    alt="서명"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default DocumentList; 