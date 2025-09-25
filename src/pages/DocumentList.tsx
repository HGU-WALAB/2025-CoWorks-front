import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import WorkflowModal from '../components/WorkflowModal';
// import { handlePrint as printDocument, type PrintOptions } from '../utils/printUtils';
import { StatusBadge, getStatusText } from '../utils/documentStatusUtils';

// 필터링 및 정렬 타입 정의
type SortOption = 'createdAt-desc' | 'createdAt-asc' | 'updatedAt-desc' | 'updatedAt-asc';
type StatusFilter = 'all' | 'DRAFT' | 'EDITING' | 'READY_FOR_REVIEW' | 'REVIEWING' | 'COMPLETED' | 'REJECTED';

const DocumentList: React.FC = () => {
  const { documents, loading, fetchDocuments } = useDocumentStore();
  const { user: currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  // const [printingDocumentId, setPrintingDocumentId] = useState<number | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [selectedWorkflowDocument, setSelectedWorkflowDocument] = useState<Document | null>(null);

  // 필터링 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('updatedAt-desc');

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // URL 파라미터에서 초기 필터 상태 설정
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam && ['DRAFT', 'EDITING', 'READY_FOR_REVIEW', 'REVIEWING', 'COMPLETED', 'REJECTED'].includes(statusParam)) {
      setStatusFilter(statusParam as StatusFilter);
    }
  }, [searchParams]);

  // 필터링 및 정렬된 문서 목록 계산
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents;

    // 검색어 필터링
    if (searchTerm.trim()) {
      filtered = filtered.filter(doc => {
        const documentTitle = doc.title || doc.templateName || '';
        return documentTitle.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // 상태 필터링
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // 검토자 필터링 (검토 중인 문서에서 현재 사용자가 검토자인 경우만)
    const reviewerParam = searchParams.get('reviewer');
    if (reviewerParam === 'me' && statusFilter === 'REVIEWING' && currentUser) {
      filtered = filtered.filter(doc => {
        return doc.tasks?.some(task => 
          task.role === 'REVIEWER' && task.assignedUserEmail === currentUser.email
        ) || false;
      });
    }

    // 정렬
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'createdAt-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'createdAt-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'updatedAt-desc':
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        case 'updatedAt-asc':
          return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [documents, searchTerm, statusFilter, sortOption, searchParams, currentUser]);

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
          processedSignatureFields,
          signatureFieldsWithData: processedSignatureFields.filter(sf => sf.signatureData).length,
          reviewerEmails: Object.keys(docSignatures),
          hasSignatures: Object.keys(docSignatures).length > 0,
          documentStatus: document.status
        });

        setSignatureFields(processedSignatureFields);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('문서 미리보기 실패:', error);
    }
  };

  // 인쇄 기능 - printUtils의 공통 함수 사용 (현재 사용되지 않음)
  // const handlePrint = async (document: Document) => {
  //   try {
  //     setPrintingDocumentId(document.id);

  //     // 저장된 coordinateFields 사용 (사용자가 입력한 데이터 포함)
  //     const coordinateFields = document.data?.coordinateFields || [];

  //     // PDF 이미지 URL
  //     const pdfImageUrl = getPdfImageUrl(document);

  //     // 서명 필드 처리
  //     const signatureFields = document.data?.signatureFields || [];
  //     const signatures = document.data?.signatures || {};

  //     // 타입 변환: CoordinateField[] → PrintField[]
  //     const printFields = coordinateFields.map(field => ({
  //       ...field,
  //       value: field.value || ''
  //     }));

  //     // printUtils의 공통 함수 사용
  //     const printOptions: PrintOptions = {
  //       pdfImageUrl,
  //       coordinateFields: printFields,
  //       signatureFields,
  //       signatures,
  //       documentId: document.id,
  //       documentTitle: document.title || document.template?.name || '문서'
  //     };

  //     await printDocument(printOptions);
  //     setPrintingDocumentId(null);
  //   } catch (error) {
  //     console.error('인쇄 실패:', error);
  //     setPrintingDocumentId(null);
  //   }
  // };

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


  // const getUserRole = (document: Document) => {
  //   if (!currentUser) return '';

  //   const task = document.tasks?.find(t => t.assignedUserEmail === currentUser.email);
  //   return task ? task.role : '';
  // };

  // 문서의 모든 담당자 정보를 반환하는 함수
  const getTaskAssignees = (doc: Document) => {
    const assignees = {
      creator: doc.tasks?.find(task => task.role === 'CREATOR'),
      editor: doc.tasks?.find(task => task.role === 'EDITOR'),
      reviewer: doc.tasks?.find(task => task.role === 'REVIEWER')
    };

    return assignees;
  };

  // 담당자 정보를 표시하는 컴포넌트
  const renderAssigneeInfo = (task: any, roleLabel: string, colorClass: string) => {
    if (!task) {
      return (
        <div className="flex items-center text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full ${colorClass} mr-2 opacity-30`}></span>
          <span>{roleLabel}: 미할당</span>
        </div>
      );
    }

    return (
      <div className="flex items-center text-xs">
        <span className={`w-2 h-2 rounded-full ${colorClass} mr-2`}></span>
        <span className="text-gray-700">
          {roleLabel}: <span className="font-medium">{(task as any).assignedUserName}</span>
        </span>
      </div>
    );
  };

  // 작업현황 모달 핸들러
  const handleWorkflow = (document: Document) => {
    setSelectedWorkflowDocument(document);
    setShowWorkflowModal(true);
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
        <div>
          <h1 className="text-3xl font-bold text-gray-800">작업 목록</h1>
        </div>
      </div>

      {/* 필터링 및 검색 컨트롤 */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 검색 입력 */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              문서 제목 검색
            </label>
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="문서 제목을 입력하세요..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* 상태 필터 */}
          <div className="lg:w-48">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
              문서 상태
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                const newStatus = e.target.value as StatusFilter;
                setStatusFilter(newStatus);
                
                // URL 파라미터 업데이트
                if (newStatus === 'all') {
                  searchParams.delete('status');
                } else {
                  searchParams.set('status', newStatus);
                }
                setSearchParams(searchParams);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">전체</option>
              <option value="DRAFT">초안</option>
              <option value="EDITING">편집중</option>
              <option value="READY_FOR_REVIEW">서명자 지정</option>
              <option value="REVIEWING">검토중</option>
              <option value="COMPLETED">완료</option>
              <option value="REJECTED">반려</option>
            </select>
          </div>

          {/* 정렬 옵션 */}
          <div className="lg:w-48">
            <label htmlFor="sort-option" className="block text-sm font-medium text-gray-700 mb-2">
              정렬 기준
            </label>
            <select
              id="sort-option"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="updatedAt-desc">수정일 (최신순)</option>
              <option value="updatedAt-asc">수정일 (오래된순)</option>
              <option value="createdAt-desc">생성일 (최신순)</option>
              <option value="createdAt-asc">생성일 (오래된순)</option>
            </select>
          </div>
        </div>

        {/* 필터 결과 요약 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              전체 {documents.length}개 중 {filteredAndSortedDocuments.length}개 문서
              {searchTerm && (
                <span className="ml-2">
                  검색: "<span className="font-medium text-gray-900">{searchTerm}</span>"
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="ml-2">
                  상태: <span className="font-medium text-gray-900">{getStatusText(statusFilter)}</span>
                </span>
              )}
            </div>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  // URL 파라미터도 초기화
                  searchParams.delete('status');
                  setSearchParams(searchParams);
                }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                필터 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="divide-y divide-gray-200">
          {filteredAndSortedDocuments.map((document) => {
            return (
              <div key={document.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {document.title || document.templateName}
                      </h3>
                      <StatusBadge status={document.status} size="sm" />
                      {/* {userRole && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          {userRole}
                        </span>
                      )} */}
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>생성일: {new Date(document.createdAt).toLocaleString('ko-KR', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false
                      })}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>마지막 수정일: {new Date(document.updatedAt || document.createdAt).toLocaleString('ko-KR', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false
                      })}</span>
                    </div>

                    {/* 모든 담당자 정보 표시 */}
                    <div className="mt-3 space-y-1">
                      <div className="flex flex-wrap gap-4">
                        {(() => {
                          const assignees = getTaskAssignees(document);
                          return (
                            <>
                              {renderAssigneeInfo(assignees.editor, '편집자', 'bg-blue-500')}
                              {renderAssigneeInfo(assignees.reviewer, '서명자', 'bg-blue-500')}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {document.status === 'COMPLETED' ? (
                      // 완료된 문서는 편집 불가
                      <span className="px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        완료
                      </span>
                    ) : document.status === 'REVIEWING' ? (
                      // 검토중 상태
                      <Link
                        to={`/documents/${document.id}/review`}
                        className="px-3 py-1.5 text-sm text-black bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        검토
                      </Link>
                    ) : document.status === 'READY_FOR_REVIEW' ? (
                      // 서명자 지정 상태
                      <Link
                        to={`/documents/${document.id}/signer-assignment`}
                        className="px-3 py-1.5 text-sm text-black bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        서명자 지정하기
                      </Link>
                    ) : (
                      // 편집 가능한 상태
                      <Link
                        to={`/documents/${document.id}/edit`}
                        className="px-3 py-1.5 text-sm text-black bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        편집
                      </Link>
                    )}

                    <button
                      onClick={() => handleWorkflow(document)}
                      className="px-3 py-1.5 text-sm text-black bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      작업현황
                    </button>

                    <button
                      onClick={() => handlePreview(document.id)}
                      className="px-3 py-1.5 text-sm text-black bg-white border border-gray-400 rounded-md hover:bg-gray-50 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      미리보기
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {filteredAndSortedDocuments.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-12 text-center">
            {documents.length === 0 ? (
              <>
                <div className="text-gray-400 text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">문서가 없습니다</h3>
                <p className="text-gray-600 mb-4">템플릿을 선택해서 첫 번째 문서를 생성해보세요</p>
                <Link to="/templates" className="btn btn-primary">
                  문서 생성하기
                </Link>
              </>
            ) : (
              <>
                <div className="text-gray-400 text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
                <p className="text-gray-600 mb-4">다른 검색어나 필터 조건을 시도해보세요</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    // URL 파라미터도 초기화
                    searchParams.delete('status');
                    setSearchParams(searchParams);
                  }}
                  className="btn btn-primary"
                >
                  필터 초기화
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 작업현황 모달 */}
      <WorkflowModal
        isOpen={showWorkflowModal}
        onClose={() => setShowWorkflowModal(false)}
        document={selectedWorkflowDocument}
      />

      {/* 미리보기 모달 */}
      {showPreview && previewDocument && previewDocument.template?.pdfImagePath && (
        <DocumentPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          pdfImageUrl={getPdfImageUrl(previewDocument)}
          coordinateFields={coordinateFields}
          signatureFields={signatureFields}
          documentTitle={previewDocument.title || previewDocument.template?.name || '문서'}
        />
      )}

      {/* 인쇄 전용 컨테이너 (화면에서는 숨김) */}
      <div className="hidden print-only print-container">
        {/* {printingDocumentId && previewDocument?.template?.pdfImagePath && ( */}
        {false}
      </div>
    </div>
    </>
  );
};

export default DocumentList; 